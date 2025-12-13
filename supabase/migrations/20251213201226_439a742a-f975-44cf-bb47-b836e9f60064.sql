-- Create clover_connections table
CREATE TABLE IF NOT EXISTS public.clover_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id TEXT,
  employee_id TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  merchant_name TEXT,
  status TEXT DEFAULT 'pending',
  region TEXT DEFAULT 'na',
  environment TEXT DEFAULT 'production',
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_customer_sync TIMESTAMPTZ,
  last_sales_sync TIMESTAMPTZ,
  last_product_sync TIMESTAMPTZ,
  customers_synced INTEGER DEFAULT 0,
  sales_synced INTEGER DEFAULT 0,
  products_synced INTEGER DEFAULT 0,
  sync_errors JSONB,
  setup_wizard_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.clover_connections 
ADD CONSTRAINT clover_connections_tenant_unique UNIQUE (tenant_id, merchant_id);

-- Enable RLS
ALTER TABLE public.clover_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own tenant clover connections"
  ON public.clover_connections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = clover_connections.tenant_id AND u.id = auth.uid()
  ));

CREATE POLICY "Users can insert own tenant clover connections"
  ON public.clover_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tenant clover connections"
  ON public.clover_connections FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = clover_connections.tenant_id AND u.id = auth.uid()
  ));

CREATE POLICY "Users can delete own tenant clover connections"
  ON public.clover_connections FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = clover_connections.tenant_id AND u.id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_clover_connections_updated_at
  BEFORE UPDATE ON public.clover_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add Clover-specific columns to crm_customers if not exists
ALTER TABLE public.crm_customers 
  ADD COLUMN IF NOT EXISTS clover_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS clover_last_synced_at TIMESTAMPTZ;

-- Update pos_orders RLS to support clover connections
DROP POLICY IF EXISTS "Users can view own tenant pos orders" ON pos_orders;

CREATE POLICY "Users can view own tenant pos orders" ON pos_orders
FOR SELECT USING (
  EXISTS (SELECT 1 FROM pos_connections pc WHERE pc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = pc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM square_connections sc WHERE sc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = sc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM clover_connections cc WHERE cc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = cc.tenant_id AND u.id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own tenant pos orders" ON pos_orders;

CREATE POLICY "Users can insert own tenant pos orders" ON pos_orders
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM pos_connections pc WHERE pc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = pc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM square_connections sc WHERE sc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = sc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM clover_connections cc WHERE cc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = cc.tenant_id AND u.id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own tenant pos orders" ON pos_orders;

CREATE POLICY "Users can update own tenant pos orders" ON pos_orders
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM pos_connections pc WHERE pc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = pc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM square_connections sc WHERE sc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = sc.tenant_id AND u.id = auth.uid()))
  OR EXISTS (SELECT 1 FROM clover_connections cc WHERE cc.id = pos_orders.pos_connection_id AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = cc.tenant_id AND u.id = auth.uid()))
);