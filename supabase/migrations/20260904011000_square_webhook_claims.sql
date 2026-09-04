-- Make provider webhook handling retryable and exclusive. A worker crash can
-- be reclaimed after the lease expires; successful events are acknowledged
-- once and never applied again.

ALTER TABLE public.pos_webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_pos_webhook_event(
  p_tenant_id uuid,
  p_provider text,
  p_connection_id uuid,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_stale_after_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.pos_webhook_events%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Webhook event claims require service authorization'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_connection_id IS NULL
     OR nullif(btrim(p_provider), '') IS NULL
     OR nullif(btrim(p_event_id), '') IS NULL
     OR nullif(btrim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'Webhook event identity is incomplete';
  END IF;
  IF p_stale_after_minutes IS NULL OR p_stale_after_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Webhook claim window must be between 1 and 60 minutes';
  END IF;

  INSERT INTO public.pos_webhook_events(
    tenant_id, provider, connection_id, event_id, event_type, payload,
    status, attempt_count, last_attempt_at
  ) VALUES (
    p_tenant_id, lower(btrim(p_provider)), p_connection_id, btrim(p_event_id),
    p_event_type, coalesce(p_payload, '{}'::jsonb), 'processing', 1, now()
  )
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING * INTO v_event;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', true,
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'reason', 'new'
    );
  END IF;

  SELECT * INTO v_event
  FROM public.pos_webhook_events AS event
  WHERE event.provider = lower(btrim(p_provider))
    AND event.event_id = btrim(p_event_id)
  FOR UPDATE;

  IF v_event.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_event.connection_id IS DISTINCT FROM p_connection_id THEN
    RAISE EXCEPTION 'Webhook event identity conflicts with its original tenant or connection';
  END IF;

  IF v_event.status = 'processed' THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'reason', 'already_processed'
    );
  END IF;

  IF v_event.status = 'processing'
     AND v_event.last_attempt_at >=
       now() - make_interval(mins => p_stale_after_minutes) THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'reason', 'already_processing'
    );
  END IF;

  UPDATE public.pos_webhook_events
  SET status = 'processing',
      error_message = NULL,
      payload = coalesce(p_payload, payload),
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
  WHERE id = v_event.id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'claimed', true,
    'event_id', v_event.id,
    'attempt_count', v_event.attempt_count,
    'reason', 'retry'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pos_webhook_event(
  p_event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Webhook event completion requires service authorization'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pos_webhook_events
  SET status = 'processed',
      processed_at = now(),
      error_message = NULL
  WHERE id = p_event_id
    AND status = 'processing';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_pos_webhook_event(
  p_event_id uuid,
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Webhook event failure updates require service authorization'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pos_webhook_events
  SET status = 'failed',
      error_message = left(coalesce(p_error_message, 'Unknown webhook error'), 2000)
  WHERE id = p_event_id
    AND status = 'processing';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pos_webhook_event(
  uuid, text, uuid, text, text, jsonb, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pos_webhook_event(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_pos_webhook_event(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_pos_webhook_event(
  uuid, text, uuid, text, text, jsonb, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pos_webhook_event(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_pos_webhook_event(uuid, text)
  TO service_role;
