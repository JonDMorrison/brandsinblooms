-- Fix ambiguous "id" reference in claim_email_send_job_ids()
-- In PL/pgSQL, output columns from RETURNS TABLE(...) are variables, so unqualified "id"
-- can become ambiguous against table columns.

CREATE OR REPLACE FUNCTION public.claim_email_send_job_ids(
  batch_size INT DEFAULT 10,
  worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  stale_after_minutes INT DEFAULT 10
)
RETURNS TABLE (
  id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT j.id
    FROM public.email_send_jobs j
    WHERE (
      j.status = 'pending'
      OR (
        j.status = 'in_progress'
        AND (j.claimed_at IS NULL OR j.claimed_at < (NOW() - make_interval(mins => stale_after_minutes)))
      )
    )
    ORDER BY j.created_at ASC, j.batch_index ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = NOW(),
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = j.attempts + 1,
      updated_at = NOW()
    WHERE j.id IN (SELECT claimable.id FROM claimable)
    RETURNING j.id
  )
  SELECT ARRAY_AGG(claimed.id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT unnest(COALESCE(claimed_ids, ARRAY[]::UUID[])) AS id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_job_ids(INT, TEXT, UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
