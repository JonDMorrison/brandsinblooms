-- The dashboard supports a user-scoped fallback while tenant context loads.
-- Without these indexes that path scanned every company's customers/campaigns,
-- even for a two-customer test account. These indexes preserve all results,
-- permissions and function definitions; they do not change source records.
SET LOCAL lock_timeout = '3s';
CREATE INDEX IF NOT EXISTS idx_crm_customers_reporting_user
  ON public.crm_customers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_reporting_user
  ON public.crm_campaigns(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_personas_reporting_user
  ON public.crm_personas(user_id) WHERE user_id IS NOT NULL;
