-- Add retry/dead-letter fields to sms_messages
ALTER TABLE sms_messages
ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
ADD COLUMN IF NOT EXISTS failure_type text,
ADD COLUMN IF NOT EXISTS error_code text;

-- Add scheduled_at if it doesn't exist
ALTER TABLE sms_messages
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Add dead_lettered_at to sms_send_jobs
ALTER TABLE sms_send_jobs
ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

-- Add indexes for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_sms_messages_retry_eligible
  ON sms_messages (status, scheduled_at, dead_lettered_at, attempts)
  WHERE status = 'queued' AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_failed
  ON sms_messages (campaign_id, status)
  WHERE status = 'failed';