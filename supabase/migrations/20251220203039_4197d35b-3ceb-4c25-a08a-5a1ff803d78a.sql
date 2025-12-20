-- =============================================
-- Identity & Profile Behavior Metrics Migration
-- =============================================

-- Signup Source & Attribution
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS signup_source TEXT;
-- Values: 'organic', 'paid', 'referral', 'qr_code', 'pos_square', 'pos_clover', 'pos_lightspeed', 'import', 'manual', 'api'

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS signup_campaign TEXT;
-- Track UTM campaign or referral code

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS signup_referrer_id UUID REFERENCES crm_customers(id);
-- For referral tracking

-- Preferred Channel
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'none';
-- Values: 'email', 'sms', 'both', 'none'

-- Opt-Out Timestamps (currently only opt-in timestamps exist)
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS email_opt_out_at TIMESTAMPTZ;

-- Store/Location Association
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Geographic Location Fields
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS state_region TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'US';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lon NUMERIC;

-- =============================================
-- Email Consent Events Table (mirrors SMS consent events)
-- =============================================
CREATE TABLE IF NOT EXISTS crm_email_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'opt_in', 'opt_out', 'imported_unknown', 'updated_by_admin'
  source TEXT NOT NULL, -- 'signup_form', 'preference_center', 'import', 'admin', 'unsubscribe_link'
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on email consent events
ALTER TABLE crm_email_consent_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email consent events
CREATE POLICY "Users can view own tenant email consent events" ON crm_email_consent_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tenant email consent events" ON crm_email_consent_events
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crm_email_consent_events_customer_id ON crm_email_consent_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_consent_events_tenant_id ON crm_email_consent_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_signup_source ON crm_customers(signup_source);
CREATE INDEX IF NOT EXISTS idx_crm_customers_preferred_channel ON crm_customers(preferred_channel);
CREATE INDEX IF NOT EXISTS idx_crm_customers_store_id ON crm_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_city ON crm_customers(city);
CREATE INDEX IF NOT EXISTS idx_crm_customers_state_region ON crm_customers(state_region);