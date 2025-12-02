-- Add Entri-related columns to email_domains table
ALTER TABLE email_domains ADD COLUMN IF NOT EXISTS entri_connection_id TEXT;
ALTER TABLE email_domains ADD COLUMN IF NOT EXISTS entri_provider TEXT;
ALTER TABLE email_domains ADD COLUMN IF NOT EXISTS is_entri_managed BOOLEAN NOT NULL DEFAULT false;

-- Add index for Entri lookups
CREATE INDEX IF NOT EXISTS idx_email_domains_entri_managed 
ON email_domains(tenant_id, is_entri_managed) WHERE is_entri_managed = true;

-- Add comments explaining Entri fields
COMMENT ON COLUMN email_domains.entri_connection_id IS 'Entri session/connection ID from successful DNS setup';
COMMENT ON COLUMN email_domains.entri_provider IS 'DNS provider detected by Entri (e.g., GoDaddy, Cloudflare, Namecheap)';
COMMENT ON COLUMN email_domains.is_entri_managed IS 'Whether DNS was set up via Entri automatic flow';