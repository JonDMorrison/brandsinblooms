-- Create table for logging test email sends
CREATE TABLE IF NOT EXISTS email_test_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES crm_automations(id) ON DELETE SET NULL,
  automation_node_id text,
  to_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent', -- sent|failed
  error text,
  diagnostics jsonb,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_test_sends_tenant ON email_test_sends(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_test_sends_campaign ON email_test_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_test_sends_automation ON email_test_sends(automation_id);
CREATE INDEX IF NOT EXISTS idx_email_test_sends_user ON email_test_sends(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE email_test_sends ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own tenant's test sends
CREATE POLICY "Users can view their tenant test sends"
ON email_test_sends
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

-- RLS policy: Users can insert test sends for their tenant
CREATE POLICY "Users can insert test sends for their tenant"
ON email_test_sends
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
  AND user_id = auth.uid()
);