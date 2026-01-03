-- Add unique index on tracked_links for deterministic link IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_links_deterministic 
ON tracked_links (tenant_id, campaign_id, url);

-- Add parity snapshot column to crm_campaigns
ALTER TABLE crm_campaigns 
ADD COLUMN IF NOT EXISTS metrics_parity_snapshot jsonb;

-- Create send_overrides table for audit trail
CREATE TABLE IF NOT EXISTS send_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  reason text NOT NULL,
  health_status text NOT NULL,
  bounce_rate numeric,
  complaint_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on send_overrides
ALTER TABLE send_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for send_overrides
CREATE POLICY "Users can view their tenant's overrides"
ON send_overrides FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

CREATE POLICY "Users can create overrides for their tenant"
ON send_overrides FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Index for send_overrides lookups
CREATE INDEX idx_send_overrides_campaign ON send_overrides(campaign_id);
CREATE INDEX idx_send_overrides_tenant ON send_overrides(tenant_id, created_at DESC);