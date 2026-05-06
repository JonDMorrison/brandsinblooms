-- =============================================================
-- Fix: Add columns referenced by pos-sync-worker but missing
-- from the database schema.
-- =============================================================

-- 1. lightspeed_connections — version cursor columns for delta sync
ALTER TABLE public.lightspeed_connections
  ADD COLUMN IF NOT EXISTS last_sales_version_cursor TEXT,
  ADD COLUMN IF NOT EXISTS last_customer_version_cursor TEXT,
  ADD COLUMN IF NOT EXISTS last_product_version_cursor TEXT;

-- 2. lightspeed_products — richer product metadata written by pos-sync-worker
ALTER TABLE public.lightspeed_products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS supply_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT 0;

-- 3. products — shared catalog mirror fields written by pos-sync-worker
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT 0;

-- 4. Reload PostgREST schema cache so new columns are immediately
--    visible to Edge Functions via the Supabase client.
NOTIFY pgrst, 'reload schema';