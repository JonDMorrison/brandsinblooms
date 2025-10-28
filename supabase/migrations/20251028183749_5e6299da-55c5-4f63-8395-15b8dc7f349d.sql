-- Create lightspeed_connections table
CREATE TABLE IF NOT EXISTS public.lightspeed_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  retailer_id BIGINT,
  domain_prefix TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  installed_by TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS lightspeed_conn_tenant_domain_ux
  ON public.lightspeed_connections (tenant_id, domain_prefix);

-- Enable RLS
ALTER TABLE public.lightspeed_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their tenant's lightspeed connections"
  ON public.lightspeed_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.tenant_id = lightspeed_connections.tenant_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their tenant's lightspeed connections"
  ON public.lightspeed_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.tenant_id = lightspeed_connections.tenant_id
        AND u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.tenant_id = lightspeed_connections.tenant_id
        AND u.id = auth.uid()
    )
  );

-- Update timestamp trigger
CREATE TRIGGER update_lightspeed_connections_updated_at
  BEFORE UPDATE ON public.lightspeed_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();