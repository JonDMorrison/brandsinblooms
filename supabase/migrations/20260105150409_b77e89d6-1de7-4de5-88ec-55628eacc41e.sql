-- Add skip tracking columns to crm_outbox
ALTER TABLE crm_outbox 
ADD COLUMN IF NOT EXISTS skip_reason TEXT,
ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;

-- Add channel availability to automation_runs
ALTER TABLE automation_runs 
ADD COLUMN IF NOT EXISTS channel_availability JSONB DEFAULT '{}'::jsonb;

-- Update crm_automation_logs to allow new status values for skipped steps
-- First check existing constraint and drop if exists
ALTER TABLE crm_automation_logs 
DROP CONSTRAINT IF EXISTS crm_automation_logs_status_check;

-- Allow new statuses: queued, sent, failed, skipped_no_channel, skipped_no_recipient
ALTER TABLE crm_automation_logs 
ADD CONSTRAINT crm_automation_logs_status_check 
CHECK (status IN ('queued', 'sent', 'failed', 'skipped_no_channel', 'skipped_no_recipient'));

-- Add skip_reason to crm_automation_logs
ALTER TABLE crm_automation_logs 
ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Create index for finding skipped messages
CREATE INDEX IF NOT EXISTS idx_crm_outbox_skipped 
ON crm_outbox(status, skipped_at) 
WHERE status = 'skipped';

-- Create index for automation runs with channel availability
CREATE INDEX IF NOT EXISTS idx_automation_runs_channel_availability 
ON automation_runs USING GIN(channel_availability);