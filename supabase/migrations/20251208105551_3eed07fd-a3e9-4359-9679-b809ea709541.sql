-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  
  -- Basic product info
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  
  -- Pricing
  price NUMERIC(10, 2) DEFAULT 0,
  cost_price NUMERIC(10, 2),
  compare_at_price NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Inventory
  inventory_count INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Categorization
  category TEXT,
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'platform' CHECK (source IN ('platform', 'square', 'stripe', 'shopify', 'lightspeed', 'import')),
  external_id TEXT,
  external_data JSONB DEFAULT '{}',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  is_visible BOOLEAN DEFAULT true,
  
  -- SEO
  slug TEXT,
  meta_title TEXT,
  meta_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product variations table
CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Variation info
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  
  -- Pricing (overrides parent if set)
  price NUMERIC(10, 2),
  cost_price NUMERIC(10, 2),
  compare_at_price NUMERIC(10, 2),
  
  -- Inventory
  inventory_count INTEGER DEFAULT 0,
  
  -- Attributes (e.g., {"size": "Large", "color": "Red"})
  attributes JSONB DEFAULT '{}',
  
  -- External sync
  external_id TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product images table
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES public.product_variations(id) ON DELETE CASCADE,
  
  -- Image reference (can link to global gallery or external URL)
  global_image_id UUID REFERENCES public.global_image_gallery(id) ON DELETE SET NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  
  -- Source
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'ai_generated', 'external', 'square', 'shopify', 'stripe')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Products RLS policies
CREATE POLICY "Users can view products for their tenant"
ON public.products FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = products.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Users can insert products for their tenant"
ON public.products FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = products.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Users can update products for their tenant"
ON public.products FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = products.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Users can delete products for their tenant"
ON public.products FOR DELETE
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.tenant_id = products.tenant_id AND u.id = auth.uid()
));

-- Product variations RLS policies
CREATE POLICY "Users can manage product variations for their tenant"
ON public.product_variations FOR ALL
USING (EXISTS (
  SELECT 1 FROM products p
  JOIN users u ON u.tenant_id = p.tenant_id
  WHERE p.id = product_variations.product_id AND u.id = auth.uid()
));

-- Product images RLS policies
CREATE POLICY "Users can manage product images for their tenant"
ON public.product_images FOR ALL
USING (EXISTS (
  SELECT 1 FROM products p
  JOIN users u ON u.tenant_id = p.tenant_id
  WHERE p.id = product_images.product_id AND u.id = auth.uid()
));

-- Create indexes
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_products_source ON public.products(source);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_external_id ON public.products(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_products_category ON public.products(category) WHERE category IS NOT NULL;
CREATE UNIQUE INDEX idx_products_tenant_sku ON public.products(tenant_id, sku) WHERE sku IS NOT NULL;

CREATE INDEX idx_product_variations_product_id ON public.product_variations(product_id);
CREATE INDEX idx_product_variations_external_id ON public.product_variations(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX idx_product_images_variation_id ON public.product_images(variation_id) WHERE variation_id IS NOT NULL;

-- Update timestamps trigger
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variations_updated_at
  BEFORE UPDATE ON public.product_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();