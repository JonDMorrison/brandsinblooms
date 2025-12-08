-- Add SMS consent tracking columns to crm_customers
ALTER TABLE crm_customers
ADD COLUMN IF NOT EXISTS sms_consent_source text,
ADD COLUMN IF NOT EXISTS sms_consent_ip text,
ADD COLUMN IF NOT EXISTS sms_consent_method text;

-- Create SMS consent events table for auditing
CREATE TABLE IF NOT EXISTS crm_sms_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  phone text NOT NULL,
  event_type text NOT NULL,
  source text NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE crm_sms_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SMS consent events for their tenant"
ON crm_sms_consent_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u WHERE u.tenant_id = crm_sms_consent_events.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Users can insert SMS consent events for their tenant"
ON crm_sms_consent_events FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM users u WHERE u.tenant_id = crm_sms_consent_events.tenant_id AND u.id = auth.uid()
));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_consent_events_customer ON crm_sms_consent_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_events_tenant ON crm_sms_consent_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_events_created ON crm_sms_consent_events(created_at DESC);