-- Add email consent tracking columns to crm_customers table
ALTER TABLE crm_customers 
ADD COLUMN IF NOT EXISTS email_opt_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_opt_in_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS email_consent_source text,
ADD COLUMN IF NOT EXISTS email_consent_ip text,
ADD COLUMN IF NOT EXISTS email_consent_method text;

-- Create index for faster consent queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_email_opt_in ON crm_customers(email_opt_in) WHERE email_opt_in = true;

-- Mark existing customers with purchase history as having implied consent
UPDATE crm_customers 
SET 
  email_opt_in = true,
  email_consent_source = 'legacy_import',
  email_consent_method = 'implied_consent',
  email_opt_in_at = COALESCE(last_purchase_date, created_at)
WHERE (total_spent > 0 OR last_purchase_date IS NOT NULL) AND email_opt_in IS NULL;

-- Set remaining customers to false (need confirmation)
UPDATE crm_customers
SET 
  email_opt_in = false,
  email_consent_source = 'legacy_import',
  email_consent_method = 'pending_confirmation'
WHERE email_opt_in IS NULL;