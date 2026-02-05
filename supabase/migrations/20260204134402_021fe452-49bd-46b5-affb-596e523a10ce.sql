-- Update claim_scheduled_campaigns to include stuck campaign recovery
-- Stuck campaigns (sending for >15 min) are recovered before claiming new ones

CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size integer DEFAULT 10)
RETURNS SETOF crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed_ids UUID[];
  recovered_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  -- STEP 1: Recover stuck campaigns (sending for > 15 minutes)
  -- Campaigns with < 3 attempts are reset to 'scheduled' for retry
  -- Campaigns with >= 3 attempts are marked as 'failed'
  
  -- Reset stuck campaigns with room for retry
  WITH stuck_retryable AS (
    SELECT id
    FROM crm_campaigns
    WHERE status = 'sending'
      AND sending_started_at IS NOT NULL
      AND sending_started_at < NOW() - INTERVAL '15 minutes'
      AND COALESCE(send_attempts, 0) < 3
    FOR UPDATE SKIP LOCKED
  )
  UPDATE crm_campaigns
  SET 
    status = 'scheduled',
    sending_started_at = NULL,
    send_started_at = NULL,
    failure_reason = 'Recovered from stuck sending state (attempt ' || COALESCE(send_attempts, 1) || ')'
  WHERE id IN (SELECT id FROM stuck_retryable)
  RETURNING id INTO recovered_count;
  
  GET DIAGNOSTICS recovered_count = ROW_COUNT;
  
  IF recovered_count > 0 THEN
    RAISE NOTICE 'Recovered % stuck campaigns for retry', recovered_count;
  END IF;
  
  -- Mark stuck campaigns with too many attempts as failed
  WITH stuck_failed AS (
    SELECT id
    FROM crm_campaigns
    WHERE status = 'sending'
      AND sending_started_at IS NOT NULL
      AND sending_started_at < NOW() - INTERVAL '15 minutes'
      AND COALESCE(send_attempts, 0) >= 3
    FOR UPDATE SKIP LOCKED
  )
  UPDATE crm_campaigns
  SET 
    status = 'failed',
    failure_reason = 'Send timeout after ' || COALESCE(send_attempts, 3) || ' attempts',
    send_error = 'Send timeout after ' || COALESCE(send_attempts, 3) || ' attempts'
  WHERE id IN (SELECT id FROM stuck_failed);
  
  GET DIAGNOSTICS failed_count = ROW_COUNT;
  
  IF failed_count > 0 THEN
    RAISE NOTICE 'Marked % stuck campaigns as failed (max attempts exceeded)', failed_count;
  END IF;

  -- STEP 2: Claim scheduled campaigns for sending
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
      sending_started_at = NOW(),
      send_started_at = NOW(),
      send_attempts = COALESCE(send_attempts, 0) + 1,
      failure_reason = NULL,
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
$function$;

-- Add index for efficient stuck campaign queries
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_sending_stuck 
ON crm_campaigns (status, sending_started_at) 
WHERE status = 'sending';

COMMENT ON FUNCTION public.claim_scheduled_campaigns IS 
'Atomically claims scheduled campaigns for sending. Also recovers stuck campaigns:
- Campaigns in "sending" for >15 min with <3 attempts: reset to "scheduled"
- Campaigns in "sending" for >15 min with >=3 attempts: marked as "failed"';