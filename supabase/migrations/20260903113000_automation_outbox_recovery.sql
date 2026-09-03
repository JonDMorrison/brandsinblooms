-- Recover recent worker crashes without releasing stale customer messages.
-- Old work is expired into an audited terminal state; only work scheduled in
-- the last 24 hours can be claimed or reclaimed.

CREATE TABLE IF NOT EXISTS public.automation_recovery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_at timestamptz NOT NULL,
  reason text NOT NULL,
  expired_outbox_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  failed_run_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  expired_outbox_count integer NOT NULL DEFAULT 0 CHECK (expired_outbox_count >= 0),
  failed_run_count integer NOT NULL DEFAULT 0 CHECK (failed_run_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_recovery_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_recovery_batches FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_recovery_batches TO service_role;

CREATE OR REPLACE FUNCTION public.expire_stale_automation_work(
  p_cutoff timestamptz DEFAULT now() - interval '24 hours',
  p_limit integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_outbox_ids uuid[] := '{}'::uuid[];
  v_expired_run_ids uuid[] := '{}'::uuid[];
  v_run_ids uuid[] := '{}'::uuid[];
BEGIN
  IF p_cutoff IS NULL OR p_cutoff > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'cutoff must be at least 15 minutes in the past';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 10000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('automation-outbox-recovery', 0));

  WITH candidates AS (
    SELECT o.id
    FROM public.crm_outbox o
    WHERE o.status IN ('queued', 'retrying', 'processing')
      AND o.scheduled_at < p_cutoff
    ORDER BY o.scheduled_at, o.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), expired AS (
    UPDATE public.crm_outbox o
    SET status = 'skipped',
        skip_reason = 'Expired: message was more than 24 hours overdue',
        skipped_at = now(),
        locked_until = NULL,
        locked_by = NULL,
        error_message = coalesce(o.error_message, 'STALE_AUTOMATION_MESSAGE_EXPIRED'),
        updated_at = now()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.id, o.automation_run_id
  )
  SELECT
    coalesce(array_agg(id ORDER BY id), '{}'::uuid[]),
    coalesce(array_agg(DISTINCT automation_run_id) FILTER (
      WHERE automation_run_id IS NOT NULL
    ), '{}'::uuid[])
  INTO v_outbox_ids, v_expired_run_ids
  FROM expired;

  WITH candidates AS (
    SELECT r.id
    FROM public.automation_runs r
    WHERE r.status = 'active'
      AND r.started_at < p_cutoff
      AND (
        r.id = ANY(v_expired_run_ids)
        OR NOT EXISTS (
          SELECT 1
          FROM public.crm_outbox o
          WHERE o.automation_run_id = r.id
            AND o.status IN ('queued', 'retrying', 'processing')
            AND o.scheduled_at >= p_cutoff
        )
      )
    ORDER BY r.started_at, r.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), failed AS (
    UPDATE public.automation_runs r
    SET status = 'failed',
        completed_at = now(),
        error_message = 'Automation expired after remaining incomplete for more than 24 hours',
        updated_at = now()
    FROM candidates c
    WHERE r.id = c.id
    RETURNING r.id
  )
  SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[])
  INTO v_run_ids
  FROM failed;

  IF cardinality(v_outbox_ids) > 0 OR cardinality(v_run_ids) > 0 THEN
    INSERT INTO public.automation_recovery_batches (
      id, cutoff_at, reason, expired_outbox_ids, failed_run_ids,
      expired_outbox_count, failed_run_count
    ) VALUES (
      v_batch_id, p_cutoff,
      'Expired stale automation work without releasing old customer messages',
      v_outbox_ids, v_run_ids, cardinality(v_outbox_ids), cardinality(v_run_ids)
    );
  END IF;

  RETURN jsonb_build_object(
    'batch_id', CASE WHEN cardinality(v_outbox_ids) > 0 OR cardinality(v_run_ids) > 0
      THEN v_batch_id ELSE NULL END,
    'expired_outbox_count', cardinality(v_outbox_ids),
    'failed_run_count', cardinality(v_run_ids),
    'cutoff_at', p_cutoff
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_outbox_messages(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50,
  p_worker_id text DEFAULT NULL
)
RETURNS SETOF public.crm_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_until timestamptz := now() + interval '5 minutes';
  v_worker_id text := coalesce(
    nullif(btrim(p_worker_id), ''),
    'worker-' || substring(gen_random_uuid()::text, 1, 8)
  );
BEGIN
  IF p_tenant_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'tenant is required and limit must be between 1 and 200';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT o.id
    FROM public.crm_outbox o
    WHERE o.tenant_id = p_tenant_id
      AND (
        o.status = 'queued'
        OR (
          o.status = 'processing'
          AND (o.locked_until IS NULL OR o.locked_until < now())
        )
      )
      AND o.scheduled_at <= now()
      AND o.scheduled_at >= now() - interval '24 hours'
      AND (o.locked_until IS NULL OR o.locked_until < now())
    ORDER BY o.priority, o.scheduled_at, o.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.crm_outbox o
  SET status = 'processing',
      locked_until = v_lock_until,
      locked_by = v_worker_id,
      updated_at = now()
  FROM claimable c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_automation_work(timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_messages(uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_automation_work(timestamptz, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_messages(uuid, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.expire_stale_automation_work(timestamptz, integer) IS
  'Expires overdue automation messages and terminally fails stranded runs without sending stale content.';
COMMENT ON FUNCTION public.claim_outbox_messages(uuid, integer, text) IS
  'Claims queued or recently crashed automation messages; work older than 24 hours is never released.';
