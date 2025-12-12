-- Add claim fields to sms_send_jobs for bulletproof concurrency safety
ALTER TABLE sms_send_jobs
ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
ADD COLUMN IF NOT EXISTS claimed_by text,
ADD COLUMN IF NOT EXISTS claim_token uuid;

-- Add index to support fast claiming queries
CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_claiming
  ON sms_send_jobs (status, claimed_at, created_at);

-- Add composite index for claim token validation
CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_claim_token
  ON sms_send_jobs (id, claim_token);

COMMENT ON COLUMN sms_send_jobs.claimed_at IS 'Timestamp when a worker claimed this job';
COMMENT ON COLUMN sms_send_jobs.claimed_by IS 'Worker instance identifier that claimed this job';
COMMENT ON COLUMN sms_send_jobs.claim_token IS 'Unique token to verify claim ownership';