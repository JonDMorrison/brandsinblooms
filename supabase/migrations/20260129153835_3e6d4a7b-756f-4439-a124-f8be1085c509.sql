-- Phase 3 Hardening: Add unique constraint for automation idempotency
-- Prevents duplicate trigger events for the same submission+automation combination

-- Create unique index for form submission -> automation trigger events idempotency
-- This ensures a single form submission cannot create duplicate trigger events for the same automation
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_trigger_events_submission_automation_unique 
ON public.automation_trigger_events (submission_id, automation_id) 
WHERE submission_id IS NOT NULL AND automation_id IS NOT NULL;

-- Also add a unique index for form_id + submission_id to prevent any duplicate events from same form submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_trigger_events_form_submission_unique 
ON public.automation_trigger_events (form_id, submission_id) 
WHERE form_id IS NOT NULL AND submission_id IS NOT NULL;

-- Add a comment explaining the purpose
COMMENT ON INDEX idx_automation_trigger_events_submission_automation_unique IS 
'Ensures idempotent automation scheduling - one trigger event per submission+automation pair';

COMMENT ON INDEX idx_automation_trigger_events_form_submission_unique IS 
'Ensures no duplicate form_submitted events per submission';