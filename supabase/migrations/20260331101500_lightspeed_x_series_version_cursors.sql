ALTER TABLE public.lightspeed_connections
  ADD COLUMN IF NOT EXISTS last_customer_version_cursor TEXT,
  ADD COLUMN IF NOT EXISTS last_sales_version_cursor TEXT,
  ADD COLUMN IF NOT EXISTS last_product_version_cursor TEXT;