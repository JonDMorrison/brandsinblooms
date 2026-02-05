-- Ensure the email queue worker RPC exists and is exposed via PostgREST.

CREATE OR REPLACE FUNCTION public.claim_email_send_jobs(
  batch_size INT DEFAULT 10,
  worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  stale_after_minutes INT DEFAULT 10
)
RETURNS SETOF public.email_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT id
    FROM email_send_jobs
    WHERE (
      status = 'pending'
      OR (
        status = 'in_progress'
        AND (claimed_at IS NULL OR claimed_at < (NOW() - make_interval(mins => stale_after_minutes)))
      )
    )
    ORDER BY created_at ASC, batch_index ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = NOW(),
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = attempts + 1,
      updated_at = NOW()
    WHERE j.id IN (SELECT id FROM claimable)
    RETURNING j.id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM email_send_jobs
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_send_jobs(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_jobs(INT, TEXT, UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
