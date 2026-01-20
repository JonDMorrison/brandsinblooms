-- Create table for tracked email links
CREATE TABLE IF NOT EXISTS email_tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES crm_automations(id) ON DELETE SET NULL,
  automation_node_id text,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  message_id text, -- Resend message ID for correlation
  original_url text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for click events
CREATE TABLE IF NOT EXISTS email_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tracked_link_id uuid NOT NULL REFERENCES email_tracked_links(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  user_agent text,
  ip_address text,
  referer text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_campaign ON email_tracked_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_automation ON email_tracked_links(automation_id);
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_token ON email_tracked_links(token);
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_tenant ON email_tracked_links(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_click_events_link ON email_click_events(tracked_link_id);
CREATE INDEX IF NOT EXISTS idx_email_click_events_tenant ON email_click_events(tenant_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_click_events_customer ON email_click_events(customer_id);

-- Enable RLS
ALTER TABLE email_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_click_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_tracked_links
CREATE POLICY "Users can view their tenant tracked links"
ON email_tracked_links FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role can insert tracked links"
ON email_tracked_links FOR INSERT
WITH CHECK (true);

-- RLS policies for email_click_events  
CREATE POLICY "Users can view their tenant click events"
ON email_click_events FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can insert click events via tracking"
ON email_click_events FOR INSERT
WITH CHECK (true);