-- Create atomic claim function for outbox messages
-- Uses FOR UPDATE SKIP LOCKED for safe concurrent worker access

CREATE OR REPLACE FUNCTION public.claim_outbox_messages(
  p_limit INTEGER DEFAULT 50,
  p_worker_id TEXT DEFAULT NULL
)
RETURNS SETOF public.crm_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_until TIMESTAMPTZ := now() + INTERVAL '5 minutes';
  v_worker_id TEXT := COALESCE(p_worker_id, 'worker-' || substring(gen_random_uuid()::text, 1, 8));
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.crm_outbox
    WHERE status = 'queued'
      AND scheduled_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.crm_outbox o
  SET 
    status = 'processing',
    locked_until = v_lock_until,
    locked_by = v_worker_id,
    updated_at = now()
  FROM claimable c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.claim_outbox_messages(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_messages(INTEGER, TEXT) TO service_role;

-- Drop existing policy if exists before creating (for idempotency)
DROP POLICY IF EXISTS "Service role can insert message logs" ON public.crm_message_logs;

-- Add INSERT policy for crm_message_logs
CREATE POLICY "Service role can insert message logs"
ON public.crm_message_logs
FOR INSERT
TO service_role
WITH CHECK (true);

COMMENT ON FUNCTION public.claim_outbox_messages IS 
'Atomically claim outbox messages for processing using FOR UPDATE SKIP LOCKED. Returns claimed rows with status set to processing.';