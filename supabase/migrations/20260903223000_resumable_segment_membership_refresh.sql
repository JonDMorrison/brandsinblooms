-- Dynamic segments need a dependable fallback when an event-driven refresh is
-- missed. The previous nightly cron was disabled and attempted to materialize
-- an entire tenant in one Edge Function invocation. This queue stores a small,
-- leased cursor per tenant so large customer databases can be refreshed safely
-- across bounded invocations.

CREATE TABLE IF NOT EXISTS public.crm_segment_recompute_jobs (
  tenant_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'failed')),
  cursor_customer_id UUID,
  cycle_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_until TIMESTAMPTZ,
  worker_token UUID,
  batches_completed INTEGER NOT NULL DEFAULT 0,
  customers_evaluated BIGINT NOT NULL DEFAULT 0,
  last_cycle_batches INTEGER,
  last_cycle_customers BIGINT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_segment_recompute_jobs_due
  ON public.crm_segment_recompute_jobs (next_due_at, claimed_until, updated_at);

ALTER TABLE public.crm_segment_recompute_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_segment_recompute_jobs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_segment_recompute_jobs
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_segment_recompute_job(
  p_worker_token UUID,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  tenant_id UUID,
  cursor_customer_id UUID,
  worker_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_worker_token IS NULL THEN
    RAISE EXCEPTION 'worker token is required';
  END IF;

  INSERT INTO public.crm_segment_recompute_jobs (tenant_id, next_due_at)
  SELECT DISTINCT segments.tenant_id, now()
  FROM public.crm_segments AS segments
  WHERE segments.auto_update = true
    AND segments.status = 'active'
    AND segments.deleted_at IS NULL
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN QUERY
  WITH candidate AS (
    SELECT jobs.tenant_id
    FROM public.crm_segment_recompute_jobs AS jobs
    WHERE jobs.next_due_at <= now()
      AND (jobs.claimed_until IS NULL OR jobs.claimed_until < now())
      AND EXISTS (
        SELECT 1
        FROM public.crm_segments AS segments
        WHERE segments.tenant_id = jobs.tenant_id
          AND segments.auto_update = true
          AND segments.status = 'active'
          AND segments.deleted_at IS NULL
      )
    ORDER BY
      CASE WHEN jobs.status = 'running' THEN 0 ELSE 1 END,
      jobs.next_due_at,
      jobs.updated_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  ), claimed AS (
    UPDATE public.crm_segment_recompute_jobs AS jobs
    SET status = 'running',
        cycle_started_at = CASE
          WHEN jobs.status = 'running' THEN jobs.cycle_started_at
          ELSE now()
        END,
        claimed_until = now() + make_interval(
          secs => greatest(60, least(coalesce(p_lease_seconds, 300), 900))
        ),
        worker_token = p_worker_token,
        last_error = NULL,
        updated_at = now()
    FROM candidate
    WHERE jobs.tenant_id = candidate.tenant_id
    RETURNING jobs.tenant_id, jobs.cursor_customer_id, jobs.worker_token
  )
  SELECT claimed.tenant_id, claimed.cursor_customer_id, claimed.worker_token
  FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_segment_recompute_batch(
  p_tenant_id UUID,
  p_worker_token UUID,
  p_last_customer_id UUID DEFAULT NULL,
  p_customers_evaluated INTEGER DEFAULT 0,
  p_finished BOOLEAN DEFAULT false,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.crm_segment_recompute_jobs AS jobs
  SET status = CASE
        WHEN p_error IS NOT NULL THEN 'failed'
        WHEN p_finished THEN 'pending'
        ELSE 'running'
      END,
      cursor_customer_id = CASE
        WHEN p_finished THEN NULL
        WHEN p_last_customer_id IS NOT NULL THEN p_last_customer_id
        ELSE jobs.cursor_customer_id
      END,
      cycle_started_at = CASE WHEN p_finished THEN NULL ELSE jobs.cycle_started_at END,
      last_completed_at = CASE WHEN p_finished THEN now() ELSE jobs.last_completed_at END,
      next_due_at = CASE
        WHEN p_error IS NOT NULL THEN now() + interval '5 minutes'
        WHEN p_finished THEN now() + interval '24 hours'
        ELSE now()
      END,
      claimed_until = NULL,
      worker_token = NULL,
      batches_completed = CASE
        WHEN p_finished THEN 0
        ELSE jobs.batches_completed + 1
      END,
      customers_evaluated = CASE
        WHEN p_finished THEN 0
        ELSE jobs.customers_evaluated + greatest(coalesce(p_customers_evaluated, 0), 0)
      END,
      last_cycle_batches = CASE
        WHEN p_finished THEN jobs.batches_completed + 1
        ELSE jobs.last_cycle_batches
      END,
      last_cycle_customers = CASE
        WHEN p_finished THEN jobs.customers_evaluated
          + greatest(coalesce(p_customers_evaluated, 0), 0)
        ELSE jobs.last_cycle_customers
      END,
      last_error = left(p_error, 1000),
      updated_at = now()
  WHERE jobs.tenant_id = p_tenant_id
    AND jobs.worker_token = p_worker_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_segment_recompute_batch(
  UUID, UUID, UUID, INTEGER, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_segment_recompute_batch(
  UUID, UUID, UUID, INTEGER, BOOLEAN, TEXT
) TO service_role;

COMMENT ON TABLE public.crm_segment_recompute_jobs IS
  'Service-only cursors and leases for resumable daily dynamic-segment refreshes.';
COMMENT ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER) IS
  'Claims one due tenant refresh with a bounded lease and initializes missing tenant jobs.';
COMMENT ON FUNCTION public.finish_segment_recompute_batch(UUID, UUID, UUID, INTEGER, BOOLEAN, TEXT) IS
  'Advances, completes, or safely retries a leased dynamic-segment refresh batch.';

DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'recompute-all-system-segments-nightly',
      'segment-membership-refresh-worker'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'segment-membership-refresh-worker',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/recompute-all-tenants-segments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', public.get_service_role_key(),
          'Authorization', 'Bearer ' || public.get_service_role_key()
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
