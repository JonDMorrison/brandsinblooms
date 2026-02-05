-- Ensure the scheduled-campaign claim RPC exists and uses simple due-time semantics.
-- This avoids drift where older versions might depend on legacy columns (claim_token/send_attempts/etc).

-- Create index for efficient scheduled campaign queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_scheduled_pending
ON public.crm_campaigns (scheduled_at, status)
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size INT DEFAULT 10)
RETURNS SETOF public.crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT id
    FROM public.crm_campaigns
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.crm_campaigns
    SET
      status = 'sending',
      send_started_at = NOW(),
      send_error = NULL
    WHERE id IN (SELECT id FROM claimable)
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM public.crm_campaigns
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO service_role;

-- Reload PostgREST schema cache so RPC is immediately visible.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    -- If pg_notify or pgrst channel isn't available, ignore.
    NULL;
END;
$$;
