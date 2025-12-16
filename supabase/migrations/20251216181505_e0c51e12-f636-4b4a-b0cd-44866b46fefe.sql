-- FIX 2: Add missing index for webhook merchant lookup (91% seq scans currently)
CREATE INDEX IF NOT EXISTS idx_square_connections_merchant_status 
ON public.square_connections(merchant_id) 
WHERE status = 'connected';

-- FIX 3: Add composite index for company_profiles RLS checks (94% seq scans)
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_active 
ON public.company_profiles(user_id) 
WHERE deleted_at IS NULL;

-- FIX 4: Add index for pos_sync_jobs lookups
CREATE INDEX IF NOT EXISTS idx_pos_sync_jobs_tenant_status 
ON public.pos_sync_jobs(tenant_id, status);

-- FIX 5: Force vacuum on products table to reclaim dead rows
-- Note: VACUUM cannot run in transaction, run manually via SQL Editor:
-- VACUUM (VERBOSE, ANALYZE) products;