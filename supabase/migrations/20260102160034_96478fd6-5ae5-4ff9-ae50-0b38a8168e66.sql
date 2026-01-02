-- Add unique constraint for email_dns_checks upsert operations
-- This fixes the 42P10 error when saving verification results

ALTER TABLE email_dns_checks 
ADD CONSTRAINT email_dns_checks_domain_check_unique 
UNIQUE (email_domain_id, check_name);

-- Add index for faster lookups by domain
CREATE INDEX IF NOT EXISTS idx_email_dns_checks_domain_id 
ON email_dns_checks(email_domain_id);