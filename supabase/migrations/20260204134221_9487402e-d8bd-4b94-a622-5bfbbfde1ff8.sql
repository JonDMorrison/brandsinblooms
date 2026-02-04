-- Add reliability and observability columns to crm_campaigns
-- Safe/idempotent: uses IF NOT EXISTS pattern

-- Add failure_reason column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_campaigns' AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE crm_campaigns ADD COLUMN failure_reason TEXT NULL;
  END IF;
END $$;

-- Add send_attempts column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_campaigns' AND column_name = 'send_attempts'
  ) THEN
    ALTER TABLE crm_campaigns ADD COLUMN send_attempts INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add sending_started_at column (alias for send_started_at if that's preferred)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_campaigns' AND column_name = 'sending_started_at'
  ) THEN
    ALTER TABLE crm_campaigns ADD COLUMN sending_started_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Update the claim_scheduled_campaigns function to track send_attempts
CREATE OR REPLACE FUNCTION public.claim_scheduled_campaigns(batch_size integer DEFAULT 10)
RETURNS SETOF crm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      sending_started_at = NOW(),
      send_started_at = NOW(),  -- Keep for backward compatibility
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

-- Add comment for documentation
COMMENT ON COLUMN crm_campaigns.failure_reason IS 'Error message from the last failed send attempt';
COMMENT ON COLUMN crm_campaigns.send_attempts IS 'Number of times sending has been attempted';
COMMENT ON COLUMN crm_campaigns.sending_started_at IS 'Timestamp when the current send attempt started';