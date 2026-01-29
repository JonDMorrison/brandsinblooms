-- Phase 3 Finalization: Canonical Result + Worker Idempotency

-- 1. Add claimed_at column for atomic worker claim pattern
ALTER TABLE public.automation_trigger_events 
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Create index for efficient claim queries
CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_claimable
ON public.automation_trigger_events (created_at)
WHERE processed_at IS NULL AND claimed_at IS NULL;

-- 2. Add rejection_type to form_submissions metadata (no schema change needed - JSONB)
-- The result column will be simplified to: accepted | rejected
-- rejection_type stored in metadata.rejection_type as: invalid | rate_limited | spam

-- 3. Create atomic claim function for worker idempotency
CREATE OR REPLACE FUNCTION public.claim_trigger_events(
  p_event_type TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS SETOF public.automation_trigger_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomically claim and return events using FOR UPDATE SKIP LOCKED
  -- This prevents race conditions when multiple workers process simultaneously
  RETURN QUERY
  UPDATE public.automation_trigger_events
  SET claimed_at = NOW()
  WHERE id IN (
    SELECT id FROM public.automation_trigger_events
    WHERE event_type = p_event_type
      AND processed_at IS NULL
      AND claimed_at IS NULL
      AND retry_count < COALESCE(max_retries, 3)
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$$;

-- 4. Create function to release expired claims (for stuck workers)
CREATE OR REPLACE FUNCTION public.release_stale_claims(
  p_stale_threshold_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released INTEGER;
BEGIN
  WITH released AS (
    UPDATE public.automation_trigger_events
    SET claimed_at = NULL
    WHERE claimed_at < NOW() - (p_stale_threshold_minutes || ' minutes')::INTERVAL
      AND processed_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_released FROM released;
  
  RETURN v_released;
END;
$$;

-- 5. Comment documenting canonical result semantics
COMMENT ON COLUMN public.form_submissions.result IS 
'Canonical result values: accepted | rejected. 
Rejection details stored in:
- reason: Human-readable message
- metadata.rejection_type: invalid | rate_limited | spam';

COMMENT ON COLUMN public.automation_trigger_events.claimed_at IS
'Timestamp when a worker claimed this event for processing. 
Used for atomic claim pattern to prevent double-processing.
Workers use FOR UPDATE SKIP LOCKED to claim events atomically.
Stale claims (>15 min) can be released by release_stale_claims().';