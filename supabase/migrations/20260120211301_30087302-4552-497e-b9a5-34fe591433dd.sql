-- Add missing columns for idempotent campaign sending
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS send_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS send_error TEXT;

-- Create index for efficient scheduled campaign queries
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_scheduled_pending 
ON public.crm_campaigns (scheduled_at, status) 
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Create atomic claim function for scheduled campaigns
-- Uses FOR UPDATE SKIP LOCKED to prevent double-claiming in concurrent scenarios
CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size INT DEFAULT 10)
RETURNS SETOF public.crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  -- Atomically select and lock campaigns that are due for sending
  -- FOR UPDATE SKIP LOCKED ensures concurrent workers don't claim same campaigns
  WITH claimable AS (
    SELECT id
    FROM crm_campaigns
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE crm_campaigns
    SET 
      status = 'sending',
      send_started_at = NOW(),
      send_error = NULL
    WHERE id IN (SELECT id FROM claimable)
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;
  
  -- Return full campaign rows for the claimed campaigns
  RETURN QUERY
  SELECT *
  FROM crm_campaigns
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_campaigns(INT) TO service_role;

-- Create helper function to atomically claim a single campaign for immediate send
-- Used by "Send Now" button to prevent double-sends
CREATE OR REPLACE FUNCTION public.claim_campaign_for_send(campaign_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  previous_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
BEGIN
  -- Get current status with row lock
  SELECT status INTO current_status
  FROM crm_campaigns
  WHERE id = campaign_id
  FOR UPDATE;
  
  -- Check if campaign exists
  IF current_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;
  
  -- Only allow claiming from these statuses
  IF current_status NOT IN ('draft', 'scheduled') THEN
    RETURN QUERY SELECT 
      FALSE, 
      current_status, 
      CASE 
        WHEN current_status = 'sending' THEN 'Campaign is already being sent'
        WHEN current_status = 'sent' THEN 'Campaign has already been sent'
        WHEN current_status = 'failed' THEN 'Campaign previously failed - reset to draft first'
        ELSE 'Campaign cannot be sent from status: ' || current_status
      END;
    RETURN;
  END IF;
  
  -- Atomically update to sending
  UPDATE crm_campaigns
  SET 
    status = 'sending',
    send_started_at = NOW(),
    send_error = NULL
  WHERE id = campaign_id;
  
  RETURN QUERY SELECT TRUE, current_status, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_campaign_for_send(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_for_send(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.claim_scheduled_campaigns IS 
'Atomically claims scheduled campaigns for sending. Uses FOR UPDATE SKIP LOCKED to ensure concurrent workers never claim the same campaign.';

COMMENT ON FUNCTION public.claim_campaign_for_send IS 
'Atomically claims a single campaign for immediate sending. Prevents double-sends by checking and updating status in one transaction.';