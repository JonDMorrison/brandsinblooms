-- The segment refresh claim RPC returns a column named tenant_id. In PL/pgSQL,
-- ON CONFLICT (tenant_id) is therefore ambiguous between the output variable
-- and the target-table column. Target the table primary-key constraint
-- explicitly so the worker can initialize per-tenant refresh cursors.

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
  ON CONFLICT ON CONSTRAINT crm_segment_recompute_jobs_pkey DO NOTHING;

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

REVOKE ALL ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.claim_segment_recompute_job(UUID, INTEGER) IS
  'Claims one due tenant refresh with a bounded lease and initializes missing tenant jobs without PL/pgSQL tenant_id ambiguity.';
