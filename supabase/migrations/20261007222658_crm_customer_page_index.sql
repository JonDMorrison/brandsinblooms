-- Support the live tenant-filtered, newest-first customer list without sorting
-- or reading every customer's full record before returning a 15-row page.
-- Includes the fields needed by the existing location-scope RLS checks.
-- No records, reporting counts, grants or policies are changed.
SET LOCAL lock_timeout = '3s';
CREATE INDEX IF NOT EXISTS idx_crm_customers_active_tenant_created
  ON public.crm_customers(tenant_id,created_at DESC,id)
  INCLUDE(primary_location_id)
  WHERE deleted_at IS NULL AND merged_into_customer_id IS NULL;
