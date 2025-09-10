-- Create POS connections table
CREATE TABLE public.pos_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  credentials_encrypted text,
  settings jsonb DEFAULT '{}',
  cursor text,
  last_sync_at timestamp with time zone,
  is_active boolean DEFAULT true,
  sync_status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create POS customers table
CREATE TABLE public.pos_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  pos_id text NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  tags text[],
  address jsonb,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connection_id, pos_id)
);

-- Create POS products table
CREATE TABLE public.pos_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  pos_id text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric,
  category text,
  sku text,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connection_id, pos_id)
);

-- Create POS orders table  
CREATE TABLE public.pos_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  pos_id text NOT NULL,
  customer_pos_id text,
  order_number text,
  total_amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  status text,
  order_date timestamp with time zone NOT NULL,
  line_items jsonb,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connection_id, pos_id)
);

-- Create POS sync logs table
CREATE TABLE public.pos_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  customers_synced integer DEFAULT 0,
  products_synced integer DEFAULT 0,
  orders_synced integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Create CRM customer links table
CREATE TABLE public.crm_customer_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  crm_customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  pos_customer_id uuid NOT NULL REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  link_method text NOT NULL DEFAULT 'email',
  confidence_score numeric DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, crm_customer_id, pos_customer_id)
);

-- Enable RLS on all tables
ALTER TABLE public.pos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pos_connections
CREATE POLICY "Users can manage pos connections for their tenant" ON public.pos_connections
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = pos_connections.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create RLS policies for pos_customers
CREATE POLICY "Users can manage pos customers for their tenant" ON public.pos_customers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = pos_customers.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create RLS policies for pos_products
CREATE POLICY "Users can manage pos products for their tenant" ON public.pos_products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = pos_products.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create RLS policies for pos_orders
CREATE POLICY "Users can manage pos orders for their tenant" ON public.pos_orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = pos_orders.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create RLS policies for pos_sync_logs
CREATE POLICY "Users can view sync logs for their connections" ON public.pos_sync_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pos_connections pc
    JOIN users u ON u.tenant_id = pc.tenant_id
    WHERE pc.id = pos_sync_logs.connection_id 
    AND u.id = auth.uid()
  )
);

-- Create RLS policies for crm_customer_links
CREATE POLICY "Users can manage customer links for their tenant" ON public.crm_customer_links
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = crm_customer_links.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_pos_customers_tenant_connection ON public.pos_customers(tenant_id, connection_id);
CREATE INDEX idx_pos_customers_email ON public.pos_customers(email);
CREATE INDEX idx_pos_products_tenant_connection ON public.pos_products(tenant_id, connection_id);
CREATE INDEX idx_pos_orders_tenant_connection ON public.pos_orders(tenant_id, connection_id);
CREATE INDEX idx_pos_orders_date ON public.pos_orders(order_date);
CREATE INDEX idx_pos_sync_logs_connection ON public.pos_sync_logs(connection_id);
CREATE INDEX idx_crm_customer_links_tenant ON public.crm_customer_links(tenant_id);

-- Add updated_at triggers
CREATE TRIGGER update_pos_connections_updated_at
  BEFORE UPDATE ON public.pos_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_customers_updated_at
  BEFORE UPDATE ON public.pos_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_products_updated_at
  BEFORE UPDATE ON public.pos_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_orders_updated_at
  BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();