-- SH-000: Create canonical Shopify integration tables.
-- This migration is schema-only groundwork for the future first-class Shopify
-- integration. It does not introduce any sync, OAuth, or webhook runtime code.

CREATE TABLE IF NOT EXISTS public.shopify_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  shop_domain TEXT NOT NULL,
  shop_name TEXT,
  shop_owner TEXT,
  shop_email TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_customer_sync TIMESTAMPTZ,
  last_sales_sync TIMESTAMPTZ,
  last_product_sync TIMESTAMPTZ,
  customers_synced INTEGER NOT NULL DEFAULT 0,
  sales_synced INTEGER NOT NULL DEFAULT 0,
  products_synced INTEGER NOT NULL DEFAULT 0,
  webhooks_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_subscription_ids JSONB,
  webhooks_last_checked_at TIMESTAMPTZ,
  webhook_last_error TEXT,
  last_webhook_received_at TIMESTAMPTZ,
  webhook_retry_count INTEGER NOT NULL DEFAULT 0,
  webhook_next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shop_domain)
);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_tenant
  ON public.shopify_connections(tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_status
  ON public.shopify_connections(status);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_webhook_health
  ON public.shopify_connections(webhooks_subscribed, webhook_next_retry_at)
  WHERE status = 'connected';

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's Shopify connections"
  ON public.shopify_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = shopify_connections.tenant_id
    )
  );

CREATE TRIGGER update_shopify_connections_updated_at
  BEFORE UPDATE ON public.shopify_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shopify_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shopify_customer_id TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  total_spent NUMERIC,
  orders_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  accepts_marketing BOOLEAN DEFAULT FALSE,
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  default_address JSONB,
  contact_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shopify_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_tenant
  ON public.shopify_customers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_email
  ON public.shopify_customers(email);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_contact
  ON public.shopify_customers(contact_id);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_last_order
  ON public.shopify_customers(last_order_date);

ALTER TABLE public.shopify_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's Shopify customers"
  ON public.shopify_customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = shopify_customers.tenant_id
    )
  );

CREATE TRIGGER update_shopify_customers_updated_at
  BEFORE UPDATE ON public.shopify_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  shopify_customer_id TEXT,
  contact_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  email TEXT,
  order_number TEXT,
  order_date TIMESTAMPTZ,
  total_price NUMERIC,
  subtotal_price NUMERIC,
  total_tax NUMERIC,
  currency TEXT,
  financial_status TEXT,
  fulfillment_status TEXT,
  line_items JSONB,
  shipping_address JSONB,
  discount_codes JSONB,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  note TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_tenant
  ON public.shopify_orders(tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_customer
  ON public.shopify_orders(shopify_customer_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_contact
  ON public.shopify_orders(contact_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_date
  ON public.shopify_orders(order_date);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_financial_status
  ON public.shopify_orders(financial_status);

ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's Shopify orders"
  ON public.shopify_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = shopify_orders.tenant_id
    )
  );

CREATE TABLE IF NOT EXISTS public.shopify_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  title TEXT,
  vendor TEXT,
  product_type TEXT,
  status TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  variants JSONB,
  images JSONB,
  inventory_quantity INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_products_tenant
  ON public.shopify_products(tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_products_status
  ON public.shopify_products(status);

CREATE INDEX IF NOT EXISTS idx_shopify_products_vendor
  ON public.shopify_products(vendor);

ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's Shopify products"
  ON public.shopify_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = shopify_products.tenant_id
    )
  );

CREATE TRIGGER update_shopify_products_updated_at
  BEFORE UPDATE ON public.shopify_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();