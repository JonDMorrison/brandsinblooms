-- Create Lightspeed customers sync table
CREATE TABLE IF NOT EXISTS public.lightspeed_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lightspeed_customer_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  loyalty_balance NUMERIC DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  first_purchase_date TIMESTAMP WITH TIME ZONE,
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  customer_group_id TEXT,
  contact_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, lightspeed_customer_id)
);

-- Create index for faster lookups
CREATE INDEX idx_lightspeed_customers_tenant ON public.lightspeed_customers(tenant_id);
CREATE INDEX idx_lightspeed_customers_email ON public.lightspeed_customers(email);
CREATE INDEX idx_lightspeed_customers_contact ON public.lightspeed_customers(contact_id);
CREATE INDEX idx_lightspeed_customers_last_purchase ON public.lightspeed_customers(last_purchase_date);

-- Enable RLS
ALTER TABLE public.lightspeed_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lightspeed_customers
CREATE POLICY "Users can view their tenant's Lightspeed customers"
  ON public.lightspeed_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_customers.tenant_id
    )
  );

CREATE POLICY "Users can insert their tenant's Lightspeed customers"
  ON public.lightspeed_customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_customers.tenant_id
    )
  );

CREATE POLICY "Users can update their tenant's Lightspeed customers"
  ON public.lightspeed_customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_customers.tenant_id
    )
  );

-- Create Lightspeed sales sync table
CREATE TABLE IF NOT EXISTS public.lightspeed_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lightspeed_sale_id TEXT NOT NULL,
  lightspeed_customer_id TEXT,
  contact_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  line_items JSONB DEFAULT '[]'::jsonb,
  payment_method TEXT,
  note TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, lightspeed_sale_id)
);

-- Create indexes
CREATE INDEX idx_lightspeed_sales_tenant ON public.lightspeed_sales(tenant_id);
CREATE INDEX idx_lightspeed_sales_customer ON public.lightspeed_sales(lightspeed_customer_id);
CREATE INDEX idx_lightspeed_sales_contact ON public.lightspeed_sales(contact_id);
CREATE INDEX idx_lightspeed_sales_date ON public.lightspeed_sales(sale_date);
CREATE INDEX idx_lightspeed_sales_status ON public.lightspeed_sales(status);

-- Enable RLS
ALTER TABLE public.lightspeed_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lightspeed_sales
CREATE POLICY "Users can view their tenant's Lightspeed sales"
  ON public.lightspeed_sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_sales.tenant_id
    )
  );

CREATE POLICY "Users can insert their tenant's Lightspeed sales"
  ON public.lightspeed_sales FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_sales.tenant_id
    )
  );

-- Create Lightspeed products sync table
CREATE TABLE IF NOT EXISTS public.lightspeed_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lightspeed_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  price NUMERIC DEFAULT 0,
  inventory_count INTEGER DEFAULT 0,
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, lightspeed_product_id)
);

-- Create indexes
CREATE INDEX idx_lightspeed_products_tenant ON public.lightspeed_products(tenant_id);
CREATE INDEX idx_lightspeed_products_sku ON public.lightspeed_products(sku);

-- Enable RLS
ALTER TABLE public.lightspeed_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lightspeed_products
CREATE POLICY "Users can view their tenant's Lightspeed products"
  ON public.lightspeed_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_products.tenant_id
    )
  );

CREATE POLICY "Users can insert their tenant's Lightspeed products"
  ON public.lightspeed_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_products.tenant_id
    )
  );

CREATE POLICY "Users can update their tenant's Lightspeed products"
  ON public.lightspeed_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = lightspeed_products.tenant_id
    )
  );

-- Add sync tracking columns to lightspeed_connections
ALTER TABLE public.lightspeed_connections 
ADD COLUMN IF NOT EXISTS last_customer_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_sales_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_product_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS customers_synced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_synced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_synced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_registered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_errors JSONB DEFAULT '[]'::jsonb;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_lightspeed_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lightspeed_customers_updated_at
  BEFORE UPDATE ON public.lightspeed_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lightspeed_customers_updated_at();

CREATE OR REPLACE FUNCTION public.update_lightspeed_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lightspeed_products_updated_at
  BEFORE UPDATE ON public.lightspeed_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lightspeed_products_updated_at();