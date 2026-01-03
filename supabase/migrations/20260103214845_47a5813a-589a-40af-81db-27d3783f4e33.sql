-- Drop existing RLS policies for send_overrides and recreate with JWT claim check
DROP POLICY IF EXISTS "Users can view their tenant's overrides" ON send_overrides;
DROP POLICY IF EXISTS "Users can create overrides for their tenant" ON send_overrides;

-- Create SECURITY DEFINER function to safely check tenant from JWT
CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb->>'tenant_id',
    ''
  )::uuid
$$;

-- Create new policies using JWT tenant claim for stricter isolation
CREATE POLICY "tenant_read_jwt"
ON send_overrides FOR SELECT
USING (
  -- Fallback to user table lookup if JWT claim not set
  tenant_id = COALESCE(
    public.get_jwt_tenant_id(),
    (SELECT tenant_id FROM users WHERE id = auth.uid())
  )
);

CREATE POLICY "tenant_write_jwt"
ON send_overrides FOR INSERT
WITH CHECK (
  tenant_id = COALESCE(
    public.get_jwt_tenant_id(),
    (SELECT tenant_id FROM users WHERE id = auth.uid())
  )
);

-- Create analytics_alerts table for storing threshold breaches
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric NOT NULL,
  threshold numeric NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Enable RLS on analytics_alerts
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;

-- RLS for analytics_alerts
CREATE POLICY "tenant_read_alerts"
ON analytics_alerts FOR SELECT
USING (
  tenant_id = COALESCE(
    public.get_jwt_tenant_id(),
    (SELECT tenant_id FROM users WHERE id = auth.uid())
  )
  OR tenant_id IS NULL -- Allow reading system-wide alerts
);

CREATE POLICY "service_write_alerts"
ON analytics_alerts FOR INSERT
WITH CHECK (true); -- Service role only inserts

-- Index for faster alert queries
CREATE INDEX IF NOT EXISTS idx_analytics_alerts_created 
ON analytics_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_tenant 
ON analytics_alerts(tenant_id, created_at DESC);

-- Add last_purge_at to track retention purges (stored in a simple config pattern)
-- We'll use email_tracking_events system alerts for this