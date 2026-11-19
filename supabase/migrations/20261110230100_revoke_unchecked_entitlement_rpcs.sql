-- crm-r1-F34: these SECURITY DEFINER entitlement and data-lifecycle RPCs take a
-- tenant or user id from the caller and check neither the caller's tenant nor an
-- admin role, yet `authenticated` holds an explicit EXECUTE grant on each. Any
-- signed-in user of any tenant could set another tenant's budget, reset its usage,
-- enable CRM on another user's profile, and tombstone or restore another user's
-- data. No browser or Edge Function code calls them through the API; they run from
-- service-role workers and inside other definer functions (as their owner), which
-- this keeps working.

REVOKE EXECUTE ON FUNCTION public.admin_backfill_subscription_budgets(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reset_sync_usage_for_month(uuid, date, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resync_tenant_budget(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_org_usage_initialized(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enable_crm_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_user_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user_data(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_backfill_subscription_budgets(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_sync_usage_for_month(uuid, date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resync_tenant_budget(uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_org_usage_initialized(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_crm_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_user_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_user_data(uuid) TO service_role;
