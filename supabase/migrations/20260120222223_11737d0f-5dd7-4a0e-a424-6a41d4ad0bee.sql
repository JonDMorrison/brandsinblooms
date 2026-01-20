-- Email send skips table for tracking why recipients were skipped
CREATE TABLE IF NOT EXISTS email_send_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES crm_automations(id) ON DELETE SET NULL,
  automation_node_id text,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  email text NOT NULL,
  reason text NOT NULL, -- opt_out|suppressed|invalid_email|missing_email|bounced|complained|unsubscribed
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_send_skips_campaign ON email_send_skips(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_skips_tenant ON email_send_skips(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_skips_reason ON email_send_skips(reason, created_at DESC);

-- Enable RLS
ALTER TABLE email_send_skips ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their tenant skipped sends"
ON email_send_skips FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service can insert skipped sends"
ON email_send_skips FOR INSERT
WITH CHECK (true);

-- Add index to suppression_list for faster email lookups
CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON suppression_list(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_suppression_list_channel ON suppression_list(tenant_id, channel);