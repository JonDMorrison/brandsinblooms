-- Fix the unique constraint on automation_runs to allow re-entry
-- Currently: customer can only have ONE run per automation ever (even after completion/failure)
-- Should be: customer can have multiple runs, but only ONE active/paused run at a time

-- Drop the problematic unique constraint
ALTER TABLE automation_runs DROP CONSTRAINT IF EXISTS automation_runs_automation_id_customer_id_key;

-- Create a partial unique index that only prevents duplicate ACTIVE runs
-- This allows completed/failed runs to exist while preventing concurrent active runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_active_unique 
ON automation_runs (automation_id, customer_id) 
WHERE status IN ('active', 'paused');

-- Also reset any stuck 'failed' automation runs for Christine's tenant so they can retry
UPDATE automation_runs 
SET status = 'cancelled', 
    error_message = COALESCE(error_message, '') || ' | Reset to allow re-entry',
    completed_at = NOW()
WHERE tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
AND status = 'failed';