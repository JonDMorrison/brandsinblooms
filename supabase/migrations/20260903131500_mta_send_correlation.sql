-- Correlate every Mobile Text Alerts send with BloomSuite's message row.

CREATE OR REPLACE FUNCTION public.apply_sms_delivery_status_batch(
  p_deliveries jsonb,
  p_source text DEFAULT 'reconciliation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_provider_message_id text;
  v_external_id text;
  v_provider_status text;
  v_occurred_at timestamptz;
  v_message public.sms_messages%ROWTYPE;
  v_target_status text;
  v_current_rank integer;
  v_target_rank integer;
  v_event_id uuid;
  v_outcome text;
  v_applied integer := 0;
  v_unmatched integer := 0;
  v_duplicate integer := 0;
  v_ignored integer := 0;
  v_correlated integer := 0;
  v_total integer := 0;
  v_sent integer;
  v_delivered integer;
  v_failed integer;
BEGIN
  IF jsonb_typeof(p_deliveries) <> 'array' THEN
    RAISE EXCEPTION 'deliveries must be a JSON array';
  END IF;
  IF nullif(trim(p_source), '') IS NULL THEN
    RAISE EXCEPTION 'source is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_total := v_total + 1;
    v_provider_message_id := nullif(trim(v_item->>'providerMessageId'), '');
    v_external_id := nullif(trim(v_item->>'externalId'), '');
    v_provider_status := lower(regexp_replace(trim(coalesce(v_item->>'status', '')), '[^a-zA-Z0-9]+', '_', 'g'));
    v_occurred_at := NULL;
    IF nullif(v_item->>'occurredAt', '') IS NOT NULL THEN
      BEGIN
        v_occurred_at := (v_item->>'occurredAt')::timestamptz;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        v_occurred_at := NULL;
      END;
    END IF;

    IF v_provider_message_id IS NULL OR v_provider_status = '' THEN
      v_ignored := v_ignored + 1;
      CONTINUE;
    END IF;

    SELECT m.* INTO v_message
    FROM public.sms_messages m
    WHERE m.provider = 'mobile_text_alerts'
      AND m.provider_message_id = v_provider_message_id
    FOR UPDATE;

    -- New sends supply sms_messages.id as MTA externalId. This recovers the
    -- provider ID after a lost response or a duplicate-request 409 without
    -- ever sending the message again.
    IF NOT FOUND AND v_external_id IS NOT NULL THEN
      SELECT m.* INTO v_message
      FROM public.sms_messages m
      WHERE m.provider = 'mobile_text_alerts'
        AND m.id::text = v_external_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.sms_messages
        SET provider_message_id = v_provider_message_id,
            twilio_sid = coalesce(twilio_sid, v_provider_message_id),
            error_code = CASE WHEN error_code = 'MTA_MESSAGE_ID_MISSING' THEN NULL ELSE error_code END,
            error_message = CASE WHEN error_code = 'MTA_MESSAGE_ID_MISSING' THEN NULL ELSE error_message END,
            failure_type = CASE WHEN failure_type = 'provider_tracking' THEN NULL ELSE failure_type END,
            updated_at = now()
        WHERE id = v_message.id;

        v_message.provider_message_id := v_provider_message_id;
        v_message.twilio_sid := coalesce(v_message.twilio_sid, v_provider_message_id);
        v_correlated := v_correlated + 1;
      END IF;
    END IF;

    IF NOT FOUND THEN
      v_unmatched := v_unmatched + 1;
      CONTINUE;
    END IF;

    v_target_status := CASE
      WHEN v_provider_status = 'delivered' THEN 'delivered'
      WHEN v_provider_status IN ('failed', 'rejected', 'undelivered', 'undeliverable', 'not_delivered', 'delivery_failed', 'expired', 'canceled', 'cancelled') THEN 'failed'
      WHEN v_provider_status IN ('sent', 'accepted', 'submitted', 'queued', 'pending', 'sending', 'unknown') THEN 'sent'
      ELSE NULL
    END;

    v_event_id := NULL;
    INSERT INTO public.sms_provider_delivery_events (
      provider, provider_message_id, provider_status, occurred_at, source,
      carrier, destination, external_id, processed_message_id, outcome
    ) VALUES (
      'mobile_text_alerts', v_provider_message_id, v_provider_status, v_occurred_at, p_source,
      nullif(v_item->>'carrier', ''), nullif(v_item->>'destination', ''),
      v_external_id, v_message.id, 'received'
    )
    ON CONFLICT (provider, provider_message_id, provider_status) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NULL THEN
      v_duplicate := v_duplicate + 1;
    END IF;

    IF v_target_status IS NULL THEN
      v_ignored := v_ignored + 1;
      v_outcome := 'ignored_status';
    ELSE
      v_current_rank := CASE v_message.status WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END;
      v_target_rank := CASE v_target_status WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END;

      IF v_target_rank < v_current_rank THEN
        v_ignored := v_ignored + 1;
        v_outcome := 'stale_status';
      ELSIF v_target_status = v_message.status THEN
        v_outcome := 'already_applied';
      ELSE
        UPDATE public.sms_messages
        SET status = v_target_status,
            provider_status = v_provider_status,
            provider_status_at = coalesce(v_occurred_at, now()),
            provider_status_source = p_source,
            delivered_at = CASE WHEN v_target_status = 'delivered' THEN coalesce(v_occurred_at, now()) ELSE delivered_at END,
            failure_type = CASE WHEN v_target_status = 'failed' THEN 'provider' WHEN v_target_status = 'delivered' THEN NULL ELSE failure_type END,
            error_code = CASE WHEN v_target_status = 'failed' THEN v_provider_status WHEN v_target_status = 'delivered' THEN NULL ELSE error_code END,
            error_message = CASE WHEN v_target_status = 'failed' THEN 'Provider delivery status: ' || v_provider_status WHEN v_target_status = 'delivered' THEN NULL ELSE error_message END,
            updated_at = now()
        WHERE id = v_message.id;

        v_applied := v_applied + 1;
        v_outcome := 'applied';

        IF v_message.customer_id IS NOT NULL AND v_target_status IN ('delivered', 'failed') THEN
          PERFORM public.update_customer_sms_metrics(v_message.customer_id, v_target_status);
        END IF;

        IF v_message.campaign_id IS NOT NULL THEN
          SELECT
            count(*) FILTER (WHERE m.status IN ('sent', 'delivered', 'failed'))::integer,
            count(*) FILTER (WHERE m.status = 'delivered')::integer,
            count(*) FILTER (WHERE m.status = 'failed')::integer
          INTO v_sent, v_delivered, v_failed
          FROM public.sms_messages m
          WHERE m.campaign_id = v_message.campaign_id;

          UPDATE public.crm_sms_campaigns
          SET metrics = coalesce(metrics, '{}'::jsonb) || jsonb_build_object(
                'sent', v_sent,
                'delivered', v_delivered,
                'failed', v_failed,
                'bounced', v_failed
              ),
              updated_at = now()
          WHERE id = v_message.campaign_id;
        END IF;
      END IF;
    END IF;

    IF v_event_id IS NOT NULL THEN
      UPDATE public.sms_provider_delivery_events
      SET outcome = v_outcome
      WHERE id = v_event_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'applied', v_applied,
    'unmatched', v_unmatched,
    'duplicates', v_duplicate,
    'ignored', v_ignored,
    'correlated', v_correlated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text)
  IS 'Idempotently applies MTA delivery outcomes, correlating lost send responses by BloomSuite external ID.';
