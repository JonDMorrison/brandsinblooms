-- Drop the existing function to allow return type change
DROP FUNCTION IF EXISTS public.claim_scheduled_campaigns(integer);

-- Add claim_token column for additional concurrency safety
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_campaigns' AND column_name = 'claim_token'
  ) THEN
    ALTER TABLE crm_campaigns ADD COLUMN claim_token UUID NULL;
  END IF;
END $$;

-- Add index for claim token lookups
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_claim_token 
ON crm_campaigns (claim_token) 
WHERE claim_token IS NOT NULL;

-- Hardened claim_scheduled_campaigns with claim token for double-claim prevention
CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size integer DEFAULT 10)
RETURNS SETOF crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claim_token UUID := gen_random_uuid();
  recovered_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  -- ============================================================
  -- CONCURRENCY GUARANTEES:
  -- 1. FOR UPDATE SKIP LOCKED prevents multiple workers from 
  --    selecting the same rows simultaneously
  -- 2. claim_token provides idempotency - a campaign can only
  --    be processed by the worker that set the token
  -- 3. All operations are atomic within this transaction
  -- 4. No tenant isolation needed - campaigns are globally unique
  -- ============================================================

  -- STEP 1: Recover stuck campaigns (sending for > 15 minutes)
  -- Uses SKIP LOCKED to prevent race conditions during recovery
  
  -- Reset stuck campaigns with room for retry (< 3 attempts)
  WITH stuck_retryable AS (
    SELECT c.id
    FROM crm_campaigns c
    WHERE c.status = 'sending'
      AND c.sending_started_at IS NOT NULL
      AND c.sending_started_at < NOW() - INTERVAL '15 minutes'
      AND COALESCE(c.send_attempts, 0) < 3
    FOR UPDATE SKIP LOCKED
  )
  UPDATE crm_campaigns c
  SET 
    status = 'scheduled',
    sending_started_at = NULL,
    send_started_at = NULL,
    claim_token = NULL,
    failure_reason = 'Recovered from stuck sending state (attempt ' || COALESCE(c.send_attempts, 1) || ')'
  WHERE c.id IN (SELECT sr.id FROM stuck_retryable sr);
  
  GET DIAGNOSTICS recovered_count = ROW_COUNT;
  
  IF recovered_count > 0 THEN
    RAISE LOG '[claim_scheduled_campaigns] Recovered % stuck campaigns for retry', recovered_count;
  END IF;
  
  -- Mark stuck campaigns with too many attempts as failed (>= 3 attempts)
  WITH stuck_failed AS (
    SELECT c.id
    FROM crm_campaigns c
    WHERE c.status = 'sending'
      AND c.sending_started_at IS NOT NULL
      AND c.sending_started_at < NOW() - INTERVAL '15 minutes'
      AND COALESCE(c.send_attempts, 0) >= 3
    FOR UPDATE SKIP LOCKED
  )
  UPDATE crm_campaigns c
  SET 
    status = 'failed',
    claim_token = NULL,
    failure_reason = 'Send timeout after ' || COALESCE(c.send_attempts, 3) || ' attempts',
    send_error = 'Send timeout after ' || COALESCE(c.send_attempts, 3) || ' attempts'
  WHERE c.id IN (SELECT sf.id FROM stuck_failed sf);
  
  GET DIAGNOSTICS failed_count = ROW_COUNT;
  
  IF failed_count > 0 THEN
    RAISE LOG '[claim_scheduled_campaigns] Marked % stuck campaigns as failed (max attempts)', failed_count;
  END IF;

  -- STEP 2: Atomically claim scheduled campaigns
  -- The claim_token ensures only this worker can process these campaigns
  WITH claimable AS (
    SELECT c.id
    FROM crm_campaigns c
    WHERE c.status = 'scheduled'
      AND c.scheduled_at IS NOT NULL
      AND c.scheduled_at <= NOW()
      AND c.claim_token IS NULL  -- Not already claimed
    ORDER BY c.scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE crm_campaigns c
  SET 
    status = 'sending',
    sending_started_at = NOW(),
    send_started_at = NOW(),
    send_attempts = COALESCE(c.send_attempts, 0) + 1,
    claim_token = v_claim_token,
    failure_reason = NULL,
    send_error = NULL
  WHERE c.id IN (SELECT cl.id FROM claimable cl);
  
  -- Return full campaign rows for the claimed campaigns
  RETURN QUERY
  SELECT *
  FROM crm_campaigns c
  WHERE c.claim_token = v_claim_token;
END;
$function$;

-- Function to verify claim before processing (optional extra safety)
CREATE OR REPLACE FUNCTION public.verify_campaign_claim(
  p_campaign_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT (status = 'sending' AND claim_token = p_claim_token)
  INTO v_valid
  FROM crm_campaigns
  WHERE id = p_campaign_id;
  
  RETURN COALESCE(v_valid, FALSE);
END;
$function$;

-- Function to release claim on completion
CREATE OR REPLACE FUNCTION public.complete_campaign_send(
  p_campaign_id UUID,
  p_claim_token UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_metrics JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- Only update if claim token matches (prevents race conditions)
  UPDATE crm_campaigns
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    sent_at = CASE WHEN p_success THEN NOW() ELSE sent_at END,
    claim_token = NULL,  -- Release the claim
    failure_reason = CASE WHEN p_success THEN NULL ELSE p_error_message END,
    send_error = CASE WHEN p_success THEN NULL ELSE p_error_message END,
    metrics = COALESCE(p_metrics, metrics)
  WHERE id = p_campaign_id
    AND claim_token = p_claim_token
    AND status = 'sending';
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  IF v_rows_updated = 0 THEN
    RAISE LOG '[complete_campaign_send] Failed to complete campaign % - claim token mismatch or invalid status', p_campaign_id;
  END IF;
  
  RETURN v_rows_updated > 0;
END;
$function$;

COMMENT ON FUNCTION public.claim_scheduled_campaigns IS 
'Atomically claims scheduled campaigns for sending. Uses FOR UPDATE SKIP LOCKED 
and claim_token for double-claim prevention. Safe for concurrent workers.';

COMMENT ON COLUMN crm_campaigns.claim_token IS 
'UUID token set when a worker claims a campaign. Ensures only the claiming worker can complete the send.';