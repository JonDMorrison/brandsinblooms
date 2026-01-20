-- Add automation columns to email_tracking_events if missing
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES crm_automations(id) ON DELETE SET NULL;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS automation_node_id text;

-- Create email_send_log table for mapping Resend message IDs
CREATE TABLE IF NOT EXISTS email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES crm_automations(id) ON DELETE SET NULL,
  automation_node_id text,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text,
  resend_message_id text,
  status text DEFAULT 'sent',
  error_message text,
  tracked_links_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes for email_send_log
CREATE INDEX IF NOT EXISTS idx_email_send_log_msg ON email_send_log(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_campaign ON email_send_log(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_tenant ON email_send_log(tenant_id, created_at DESC);

-- Enable RLS on email_send_log
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_send_log
CREATE POLICY "Users can view their tenant send logs"
ON email_send_log FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service can insert send logs"
ON email_send_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update send logs"
ON email_send_log FOR UPDATE
USING (true);

-- Add index for automation tracking
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_automation ON email_tracking_events(automation_id, created_at DESC);