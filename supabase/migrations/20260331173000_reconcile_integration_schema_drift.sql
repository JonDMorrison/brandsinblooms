-- Reconcile integration schema drift in environments where migration history
-- claims the Shopify and GA4 integration migrations were applied but the live
-- schema is still missing those objects.

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
  ON public.shopify_connections (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_status
  ON public.shopify_connections (status);

CREATE INDEX IF NOT EXISTS idx_shopify_connections_webhook_health
  ON public.shopify_connections (webhooks_subscribed, webhook_next_retry_at)
  WHERE status = 'connected';

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopify_connections'
      AND policyname = 'Users can view their tenant''s Shopify connections'
  ) THEN
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
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_shopify_connections_updated_at
  ON public.shopify_connections;

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
  ON public.shopify_customers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_email
  ON public.shopify_customers (email);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_contact
  ON public.shopify_customers (contact_id);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_last_order
  ON public.shopify_customers (last_order_date);

ALTER TABLE public.shopify_customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopify_customers'
      AND policyname = 'Users can view their tenant''s Shopify customers'
  ) THEN
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
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_shopify_customers_updated_at
  ON public.shopify_customers;

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
  ON public.shopify_orders (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_customer
  ON public.shopify_orders (shopify_customer_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_contact
  ON public.shopify_orders (contact_id);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_date
  ON public.shopify_orders (order_date);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_financial_status
  ON public.shopify_orders (financial_status);

ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopify_orders'
      AND policyname = 'Users can view their tenant''s Shopify orders'
  ) THEN
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
  END IF;
END $$;

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
  ON public.shopify_products (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shopify_products_status
  ON public.shopify_products (status);

CREATE INDEX IF NOT EXISTS idx_shopify_products_vendor
  ON public.shopify_products (vendor);

ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopify_products'
      AND policyname = 'Users can view their tenant''s Shopify products'
  ) THEN
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
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_shopify_products_updated_at
  ON public.shopify_products;

CREATE TRIGGER update_shopify_products_updated_at
  BEFORE UPDATE ON public.shopify_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.google_analytics_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS property_name TEXT,
  ADD COLUMN IF NOT EXISTS measurement_id TEXT,
  ADD COLUMN IF NOT EXISTS google_account_email TEXT,
  ADD COLUMN IF NOT EXISTS last_pull_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_status TEXT,
  ADD COLUMN IF NOT EXISTS last_test_message TEXT;

UPDATE public.google_analytics_settings AS gas
SET tenant_id = users.tenant_id
FROM public.users AS users
WHERE users.id = gas.user_id
  AND gas.tenant_id IS NULL;

DROP POLICY IF EXISTS "Users can manage their own GA settings"
  ON public.google_analytics_settings;

DROP POLICY IF EXISTS "Users can manage their tenant GA settings"
  ON public.google_analytics_settings;

CREATE POLICY "Users can manage their tenant GA settings"
  ON public.google_analytics_settings
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = google_analytics_settings.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.tenant_id = google_analytics_settings.tenant_id
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS google_analytics_settings_tenant_user_unique
  ON public.google_analytics_settings (tenant_id, user_id);

NOTIFY pgrst, 'reload schema';