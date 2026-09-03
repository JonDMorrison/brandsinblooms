-- Track Mobile Text Alerts delivery outcomes and reconcile them continuously.

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mobile_text_alerts',
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_source text;

UPDATE public.sms_messages
SET provider_message_id = twilio_sid
WHERE provider_message_id IS NULL
  AND twilio_sid IS NOT NULL;

-- Preserve historical Twilio-shaped SIDs instead of attributing them to MTA.
UPDATE public.sms_messages
SET provider = 'twilio'
WHERE provider_message_id LIKE 'SM%';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_messages_provider_message
  ON public.sms_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_status
  ON public.sms_messages (provider, provider_status, provider_status_at)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sms_provider_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  provider_status text NOT NULL,
  occurred_at timestamptz,
  source text NOT NULL,
  carrier text,
  destination text,
  external_id text,
  processed_message_id uuid REFERENCES public.sms_messages(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_message_id, provider_status)
);

ALTER TABLE public.sms_provider_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_events_message
  ON public.sms_provider_delivery_events (processed_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_events_unmatched
  ON public.sms_provider_delivery_events (created_at DESC)
  WHERE processed_message_id IS NULL;

CREATE TABLE IF NOT EXISTS public.sms_delivery_reconciliation_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  next_page integer NOT NULL DEFAULT 1 CHECK (next_page > 0),
  cycle_started_at timestamptz,
  last_run_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  lock_token uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_delivery_reconciliation_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sms_delivery_reconciliation_state (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_sms_delivery_reconciliation(
  p_worker_id text,
  p_claim_token uuid,
  p_stale_minutes integer DEFAULT 10
)
RETURNS TABLE(page integer, claim_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF nullif(trim(p_worker_id), '') IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'worker_id and claim_token are required';
  END IF;
  IF p_stale_minutes IS NULL OR p_stale_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'stale_minutes must be between 1 and 60';
  END IF;

  RETURN QUERY
  UPDATE public.sms_delivery_reconciliation_state s
  SET locked_at = now(),
      locked_by = p_worker_id,
      lock_token = p_claim_token,
      cycle_started_at = CASE WHEN s.next_page = 1 THEN now() ELSE s.cycle_started_at END,
      last_run_at = now(),
      last_error = NULL,
      updated_at = now()
  WHERE s.singleton
    AND (s.lock_token IS NULL OR s.locked_at < now() - make_interval(mins => p_stale_minutes))
  RETURNING s.next_page, s.lock_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_sms_delivery_reconciliation(
  p_claim_token uuid,
  p_next_page integer,
  p_cycle_complete boolean DEFAULT false,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_claim_token IS NULL OR p_next_page IS NULL OR p_next_page < 1 THEN
    RETURN false;
  END IF;

  UPDATE public.sms_delivery_reconciliation_state
  SET next_page = CASE WHEN p_cycle_complete THEN 1 ELSE p_next_page END,
      last_completed_at = CASE WHEN p_cycle_complete AND p_error IS NULL THEN now() ELSE last_completed_at END,
      last_error = left(p_error, 1000),
      locked_at = NULL,
      locked_by = NULL,
      lock_token = NULL,
      updated_at = now()
  WHERE singleton
    AND lock_token = p_claim_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

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
      nullif(v_item->>'externalId', ''), v_message.id, 'received'
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
    'ignored', v_ignored
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sms_delivery_reconciliation(text, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_sms_delivery_reconciliation(uuid, integer, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_sms_delivery_reconciliation(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_sms_delivery_reconciliation(uuid, integer, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.apply_sms_delivery_status_batch(jsonb, text)
  IS 'Idempotently applies Mobile Text Alerts delivery outcomes without allowing terminal status regression.';

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'mta-delivery-reconciliation-worker'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'mta-delivery-reconciliation-worker',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/mta-delivery-reconciliation-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', public.get_service_role_key()
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END;
$$;
