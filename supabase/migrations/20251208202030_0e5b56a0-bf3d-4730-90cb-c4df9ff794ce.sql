-- Add unique constraint for Square product sync upserts
ALTER TABLE public.products 
ADD CONSTRAINT products_tenant_id_external_id_key UNIQUE (tenant_id, external_id);

-- Add unique constraint for product_variations if it doesn't exist
ALTER TABLE public.product_variations 
ADD CONSTRAINT product_variations_product_id_external_id_key UNIQUE (product_id, external_id);