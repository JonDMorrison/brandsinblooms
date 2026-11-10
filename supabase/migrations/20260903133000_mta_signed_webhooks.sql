-- Signed Mobile Text Alerts webhooks and atomic SMS consent handling.

CREATE TABLE IF NOT EXISTS public.sms_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mobile_text_alerts',
  provider_reply_id text NOT NULL,
  external_id text,
  from_phone text NOT NULL,
  to_phone text,
  message_content text NOT NULL,
  media_url text,
  received_at timestamptz NOT NULL,
  keyword text NOT NULL CHECK (keyword IN ('stop', 'start', 'help', 'reply')),
  resolution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reply_id)
);

ALTER TABLE public.sms_inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view inbound SMS"
ON public.sms_inbound_messages
FOR SELECT TO authenticated
USING (
  tenant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.tenant_id = sms_inbound_messages.tenant_id
  )
);

CREATE INDEX IF NOT EXISTS idx_sms_inbound_messages_customer
  ON public.sms_inbound_messages (customer_id, received_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_inbound_messages_phone
  ON public.sms_inbound_messages ((right(regexp_replace(from_phone, '\\D', '', 'g'), 10)), received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_inbound_messages_unmatched
  ON public.sms_inbound_messages (received_at DESC)
  WHERE customer_id IS NULL;

-- Surface inbound SMS activity on the unified customer timeline.
ALTER TABLE public.customer_timeline
  DROP CONSTRAINT IF EXISTS customer_timeline_activity_type_check;
ALTER TABLE public.customer_timeline
  ADD CONSTRAINT customer_timeline_activity_type_check CHECK (
    activity_type IN (
      'email_sent', 'sms_sent', 'email_opened', 'email_clicked', 'purchase',
      'segment_added', 'tag_added', 'sms_received', 'sms_opt_out', 'sms_opt_in'
    )
  );

CREATE OR REPLACE FUNCTION public.apply_mta_inbound_sms(p_reply jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reply_id text := nullif(trim(p_reply->>'providerReplyId'), '');
  v_from text := nullif(trim(p_reply->>'fromNumber'), '');
  v_to text := nullif(trim(p_reply->>'toNumber'), '');
  v_external_id text := nullif(trim(p_reply->>'externalId'), '');
  v_message text := nullif(trim(p_reply->>'message'), '');
  v_media_url text := nullif(trim(p_reply->>'mediaUrl'), '');
  v_keyword text := lower(coalesce(nullif(trim(p_reply->>'keyword'), ''), 'reply'));
  v_occurred_at timestamptz := now();
  v_customer_id uuid;
  v_tenant_id uuid;
  v_last_sent_at timestamptz;
  v_phone_customers uuid[];
  v_routed_customers uuid[];
  v_target_customers uuid[];
  v_target_customer_id uuid;
  v_inbound_id uuid;
  v_resolution text := 'unmatched';
  v_was_opted_in boolean;
  v_queued_failed integer := 0;
  v_failed_this_customer integer := 0;
  v_target_count integer := 0;
BEGIN
  IF v_reply_id IS NULL OR v_from IS NULL OR v_message IS NULL THEN
    RAISE EXCEPTION 'providerReplyId, fromNumber, and message are required';
  END IF;
  IF v_keyword NOT IN ('stop', 'start', 'help', 'reply') THEN
    RAISE EXCEPTION 'unsupported SMS keyword classification';
  END IF;
  IF nullif(p_reply->>'occurredAt', '') IS NOT NULL THEN
    BEGIN
      v_occurred_at := (p_reply->>'occurredAt')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_occurred_at := now();
    END;
  END IF;

  -- externalId is sms_messages.id for all new BloomSuite sends.
  IF v_external_id IS NOT NULL THEN
    SELECT m.customer_id, m.tenant_id, m.sent_at
      INTO v_customer_id, v_tenant_id, v_last_sent_at
    FROM public.sms_messages m
    WHERE m.provider = 'mobile_text_alerts'
      AND m.id::text = v_external_id
      AND m.customer_id IS NOT NULL
    LIMIT 1;
    IF FOUND THEN v_resolution := 'external_id'; END IF;
  END IF;

  -- If an older provider message has no externalId, require the recent
  -- outbound route to resolve to exactly one customer.
  IF v_customer_id IS NULL THEN
    SELECT array_agg(x.customer_id ORDER BY x.last_sent_at DESC)
      INTO v_routed_customers
    FROM (
      SELECT m.customer_id, max(m.sent_at) AS last_sent_at
      FROM public.sms_messages m
      WHERE m.provider = 'mobile_text_alerts'
        AND m.customer_id IS NOT NULL
        AND right(regexp_replace(m.phone, '\\D', '', 'g'), 10) = right(regexp_replace(v_from, '\\D', '', 'g'), 10)
        AND (
          v_to IS NULL OR m.from_phone IS NULL OR
          right(regexp_replace(m.from_phone, '\\D', '', 'g'), 10) = right(regexp_replace(v_to, '\\D', '', 'g'), 10)
        )
      GROUP BY m.customer_id
    ) x;

    IF coalesce(cardinality(v_routed_customers), 0) = 1 THEN
      v_customer_id := v_routed_customers[1];
      SELECT c.tenant_id INTO v_tenant_id FROM public.crm_customers c WHERE c.id = v_customer_id;
      SELECT max(m.sent_at) INTO v_last_sent_at
      FROM public.sms_messages m WHERE m.customer_id = v_customer_id;
      v_resolution := 'outbound_route';
    ELSIF coalesce(cardinality(v_routed_customers), 0) > 1 THEN
      v_resolution := 'ambiguous_outbound_route';
    END IF;
  END IF;

  SELECT array_agg(c.id ORDER BY c.created_at)
    INTO v_phone_customers
  FROM public.crm_customers c
  WHERE c.deleted_at IS NULL
    AND c.merged_into_customer_id IS NULL
    AND nullif(regexp_replace(c.phone, '\\D', '', 'g'), '') IS NOT NULL
    AND right(regexp_replace(c.phone, '\\D', '', 'g'), 10) = right(regexp_replace(v_from, '\\D', '', 'g'), 10);

  IF v_customer_id IS NULL AND coalesce(cardinality(v_phone_customers), 0) = 1 THEN
    v_customer_id := v_phone_customers[1];
    SELECT c.tenant_id INTO v_tenant_id FROM public.crm_customers c WHERE c.id = v_customer_id;
    v_resolution := 'unique_phone';
  ELSIF v_customer_id IS NULL AND coalesce(cardinality(v_phone_customers), 0) > 1 THEN
    v_resolution := 'ambiguous_phone';
  END IF;

  INSERT INTO public.sms_inbound_messages (
    tenant_id, customer_id, provider, provider_reply_id, external_id,
    from_phone, to_phone, message_content, media_url, received_at, keyword, resolution
  ) VALUES (
    v_tenant_id, v_customer_id, 'mobile_text_alerts', v_reply_id, v_external_id,
    v_from, v_to, v_message, v_media_url, v_occurred_at, v_keyword, v_resolution
  )
  ON CONFLICT (provider, provider_reply_id) DO NOTHING
  RETURNING id INTO v_inbound_id;

  IF v_inbound_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'providerReplyId', v_reply_id);
  END IF;

  IF v_customer_id IS NOT NULL THEN
    v_target_customers := ARRAY[v_customer_id];
  ELSIF v_keyword = 'stop' THEN
    -- STOP fails safe across tenants when a number is genuinely ambiguous.
    v_target_customers := coalesce(v_phone_customers, ARRAY[]::uuid[]);
  ELSE
    v_target_customers := ARRAY[]::uuid[];
  END IF;

  FOREACH v_target_customer_id IN ARRAY v_target_customers
  LOOP
    SELECT c.tenant_id,
           coalesce(c.sms_opt_in, false) OR coalesce(c.sms_consent, false) OR
           EXISTS (
             SELECT 1 FROM public.customer_consents cc
             WHERE cc.customer_id = c.id AND cc.channel = 'sms' AND cc.status = 'opted_in'
           )
      INTO v_tenant_id, v_was_opted_in
    FROM public.crm_customers c
    WHERE c.id = v_target_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;
    v_target_count := v_target_count + 1;

    IF v_keyword = 'stop' THEN
      UPDATE public.crm_customers
      SET sms_opt_in = false,
          sms_consent = false,
          sms_opt_out_at = v_occurred_at,
          sms_consent_source = 'mta_webhook',
          sms_consent_method = 'keyword_stop',
          updated_at = now()
      WHERE id = v_target_customer_id;

      INSERT INTO public.customer_consents (customer_id, channel, status, consent_timestamp, created_at, updated_at)
      VALUES (v_target_customer_id, 'sms', 'opted_out', v_occurred_at, now(), now())
      ON CONFLICT (customer_id, channel) DO UPDATE
      SET status = 'opted_out', consent_timestamp = excluded.consent_timestamp, updated_at = now();

      INSERT INTO public.crm_sms_consent_events (tenant_id, customer_id, phone, event_type, source, created_at)
      VALUES (v_tenant_id, v_target_customer_id, v_from, 'opt_out', 'mta_webhook', v_occurred_at);

      INSERT INTO public.sms_compliance_events (
        tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
      ) VALUES (
        v_tenant_id, v_target_customer_id, v_from, 'STOP', v_message,
        'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
      );

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_opt_out',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id),
        v_occurred_at, now()
      );

      WITH failed AS (
        UPDATE public.sms_messages
        SET status = 'failed',
            failure_type = 'compliance',
            error_code = 'SMS_OPTED_OUT',
            error_message = 'Recipient opted out by SMS keyword',
            dead_lettered_at = now(),
            updated_at = now()
        WHERE customer_id = v_target_customer_id AND status = 'queued'
        RETURNING 1
      ) SELECT count(*)::integer INTO v_failed_this_customer FROM failed;
      v_queued_failed := v_queued_failed + v_failed_this_customer;

      IF v_was_opted_in THEN
        PERFORM public.update_customer_sms_metrics(v_target_customer_id, 'opt_out');
      END IF;

    ELSIF v_keyword = 'start' THEN
      UPDATE public.crm_customers
      SET sms_opt_in = true,
          sms_consent = true,
          sms_opt_in_at = v_occurred_at,
          sms_opt_out_at = NULL,
          sms_consent_source = 'mta_webhook',
          sms_consent_method = 'keyword_start',
          sms_consent_details = coalesce(sms_consent_details, '{}'::jsonb) ||
            jsonb_build_object('captured_at', v_occurred_at, 'keyword', upper(v_message)),
          updated_at = now()
      WHERE id = v_target_customer_id;

      INSERT INTO public.customer_consents (customer_id, channel, status, consent_timestamp, created_at, updated_at)
      VALUES (v_target_customer_id, 'sms', 'opted_in', v_occurred_at, now(), now())
      ON CONFLICT (customer_id, channel) DO UPDATE
      SET status = 'opted_in', consent_timestamp = excluded.consent_timestamp, updated_at = now();

      INSERT INTO public.crm_sms_consent_events (tenant_id, customer_id, phone, event_type, source, created_at)
      VALUES (v_tenant_id, v_target_customer_id, v_from, 'opt_in', 'mta_webhook', v_occurred_at);

      INSERT INTO public.sms_compliance_events (
        tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
      ) VALUES (
        v_tenant_id, v_target_customer_id, v_from, 'START', v_message,
        'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
      );

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_opt_in',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id),
        v_occurred_at, now()
      );

    ELSE
      IF v_keyword = 'help' THEN
        INSERT INTO public.sms_compliance_events (
          tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
        ) VALUES (
          v_tenant_id, v_target_customer_id, v_from, 'HELP', v_message,
          'inbound_sms', v_reply_id, jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to), v_occurred_at
        );
      END IF;

      INSERT INTO public.customer_timeline (customer_id, tenant_id, activity_type, metadata, created_at, updated_at)
      VALUES (
        v_target_customer_id, v_tenant_id, 'sms_received',
        jsonb_build_object('source', 'mta_webhook', 'provider_reply_id', v_reply_id, 'keyword', v_keyword),
        v_occurred_at, now()
      );

      PERFORM public.update_customer_sms_metrics(
        v_target_customer_id, 'replied', v_last_sent_at, v_occurred_at
      );
      PERFORM public.update_cross_channel_metrics(v_target_customer_id, 'sms', 'replied');
    END IF;
  END LOOP;

  IF v_target_count = 0 AND v_keyword IN ('stop', 'help') THEN
    INSERT INTO public.sms_compliance_events (
      tenant_id, customer_id, phone, event_type, message_content, source, twilio_sid, metadata, created_at
    ) VALUES (
      NULL, NULL, v_from, upper(v_keyword), v_message,
      'inbound_sms', v_reply_id,
      jsonb_build_object('provider', 'mobile_text_alerts', 'to', v_to, 'resolution', v_resolution),
      v_occurred_at
    );
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'inboundMessageId', v_inbound_id,
    'resolution', v_resolution,
    'matchedCustomers', v_target_count,
    'queuedMessagesFailed', v_queued_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mta_inbound_sms(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mta_inbound_sms(jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_mta_inbound_sms(jsonb)
  IS 'Atomically records an authenticated MTA reply and applies channel-specific SMS consent changes.';
