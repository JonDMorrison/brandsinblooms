-- Add columns for robust verification retry system
-- These columns track verification attempts and enable background retries

-- Add verification tracking columns to email_domains
ALTER TABLE email_domains 
ADD COLUMN IF NOT EXISTS last_verify_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS verify_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_verify_error text,
ADD COLUMN IF NOT EXISTS next_verify_at timestamptz,
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS resend_status jsonb;

-- Create index for cron job to find domains needing verification
CREATE INDEX IF NOT EXISTS idx_email_domains_next_verify 
ON email_domains(next_verify_at) 
WHERE status IN ('pending_dns', 'verifying', 'pending');

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_email_domains_status 
ON email_domains(status);

-- Add comment for documentation
COMMENT ON COLUMN email_domains.verify_attempts IS 'Number of verification attempts for retry backoff';
COMMENT ON COLUMN email_domains.next_verify_at IS 'Next scheduled verification time for cron job';
COMMENT ON COLUMN email_domains.resend_status IS 'Raw status payload from Resend API';