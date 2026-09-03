-- Make trigger-event consumption exclusive, retryable, and observable.

ALTER TABLE public.automation_trigger_events
  ADD COLUMN IF NOT EXISTS claimed_by text;

DROP INDEX IF EXISTS public.idx_automation_trigger_events_claimable;
CREATE INDEX idx_automation_trigger_events_claimable
  ON public.automation_trigger_events (coalesce(queued_until, created_at), created_at)
  WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_due_automation_trigger_events(
  p_limit integer DEFAULT 100,
  p_worker_id text DEFAULT NULL,
  p_stale_after_minutes integer DEFAULT 15
)
RETURNS SETOF public.automation_trigger_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id text := coalesce(
    nullif(btrim(p_worker_id), ''),
    'automation-executor-' || substring(gen_random_uuid()::text, 1, 8)
  );
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'limit must be between 1 and 500';
  END IF;
  IF p_stale_after_minutes IS NULL OR p_stale_after_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'stale claim window must be between 1 and 60 minutes';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM public.automation_trigger_events e
    WHERE e.processed_at IS NULL
      AND coalesce(e.retry_count, 0) < coalesce(e.max_retries, 3)
      AND (e.queued_until IS NULL OR e.queued_until <= now())
      AND (
        e.claimed_at IS NULL
        OR e.claimed_at < now() - make_interval(mins => p_stale_after_minutes)
      )
    ORDER BY coalesce(e.queued_until, e.created_at), e.created_at, e.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.automation_trigger_events e
  SET claimed_at = now(),
      claimed_by = v_worker_id
  FROM candidates c
  WHERE e.id = c.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_automation_trigger_event(
  p_event_id uuid,
  p_worker_id text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE public.automation_trigger_events
  SET processed_at = now(),
      error_message = p_error_message,
      queued_until = NULL,
      claimed_at = NULL,
      claimed_by = NULL
  WHERE id = p_event_id
    AND processed_at IS NULL
    AND claimed_by = p_worker_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.defer_automation_trigger_event(
  p_event_id uuid,
  p_worker_id text,
  p_queued_until timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_count integer;
BEGIN
  IF p_queued_until IS NULL OR p_queued_until <= now() THEN
    RAISE EXCEPTION 'queued_until must be in the future';
  END IF;

  UPDATE public.automation_trigger_events
  SET queued_until = p_queued_until,
      error_message = NULL,
      claimed_at = NULL,
      claimed_by = NULL
  WHERE id = p_event_id
    AND processed_at IS NULL
    AND claimed_by = p_worker_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_automation_trigger_event(
  p_event_id uuid,
  p_worker_id text,
  p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_retry_count integer;
  v_max_retries integer;
  v_processed_at timestamptz;
BEGIN
  UPDATE public.automation_trigger_events
  SET retry_count = coalesce(retry_count, 0) + 1,
      last_error_at = now(),
      error_message = coalesce(p_error_message, 'Unknown trigger processing error'),
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{last_error}',
        to_jsonb(coalesce(p_error_message, 'Unknown trigger processing error')),
        true
      ),
      processed_at = CASE
        WHEN coalesce(retry_count, 0) + 1 >= coalesce(max_retries, 3)
          THEN now()
        ELSE NULL
      END,
      queued_until = CASE
        WHEN coalesce(retry_count, 0) + 1 >= coalesce(max_retries, 3)
          THEN NULL
        ELSE now() + make_interval(
          mins => least(60, power(2, coalesce(retry_count, 0) + 1)::integer)
        )
      END,
      claimed_at = NULL,
      claimed_by = NULL
  WHERE id = p_event_id
    AND processed_at IS NULL
    AND claimed_by = p_worker_id
  RETURNING retry_count, max_retries, processed_at
  INTO v_retry_count, v_max_retries, v_processed_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', false);
  END IF;

  RETURN jsonb_build_object(
    'updated', true,
    'retry_count', v_retry_count,
    'max_retries', v_max_retries,
    'terminal', v_processed_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_automation_trigger_events(integer, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_automation_trigger_event(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.defer_automation_trigger_event(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_automation_trigger_event(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_trigger_events(text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stale_claims(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_trigger_event_retry(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_due_automation_trigger_events(integer, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_automation_trigger_event(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.defer_automation_trigger_event(uuid, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_automation_trigger_event(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_trigger_events(text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stale_claims(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_trigger_event_retry(uuid, text)
  TO service_role;

COMMENT ON COLUMN public.automation_trigger_events.claimed_by IS
  'Worker token that owns the current trigger-event claim.';
COMMENT ON FUNCTION public.claim_due_automation_trigger_events(integer, text, integer) IS
  'Atomically claims due automation trigger events and safely reclaims stale worker locks.';
