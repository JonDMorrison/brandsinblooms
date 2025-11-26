-- Create square_connections table
CREATE TABLE square_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id TEXT,
  location_id TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  merchant_name TEXT,
  status TEXT DEFAULT 'pending',
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_customer_sync TIMESTAMPTZ,
  last_sales_sync TIMESTAMPTZ,
  last_product_sync TIMESTAMPTZ,
  customers_synced INTEGER DEFAULT 0,
  sales_synced INTEGER DEFAULT 0,
  products_synced INTEGER DEFAULT 0,
  environment TEXT DEFAULT 'production',
  sync_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, merchant_id)
);

-- Enable RLS
ALTER TABLE square_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's Square connections"
  ON square_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = square_connections.tenant_id
    )
  );

CREATE POLICY "Users can insert their tenant's Square connections"
  ON square_connections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = square_connections.tenant_id
    )
  );

CREATE POLICY "Users can update their tenant's Square connections"
  ON square_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = square_connections.tenant_id
    )
  );

CREATE POLICY "Users can delete their tenant's Square connections"
  ON square_connections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = square_connections.tenant_id
    )
  );

-- Add provider column to oauth_states for multi-provider support
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'lightspeed';

-- Create index for faster queries
CREATE INDEX idx_square_connections_tenant ON square_connections(tenant_id);
CREATE INDEX idx_square_connections_status ON square_connections(status);
CREATE INDEX idx_oauth_states_provider ON oauth_states(provider);