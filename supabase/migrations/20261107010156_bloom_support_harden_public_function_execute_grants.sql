-- Supabase grants EXECUTE on newly created functions to API roles by default.
-- These functions are either trigger-only, service-role-only, or authenticated
-- RLS helpers. Keep their callable surface explicit so an RPC request can never
-- invoke privileged trigger/service functions directly.

revoke execute on function public.apply_pos_checkout_sms_consent()
  from public, anon, authenticated;
grant execute on function public.apply_pos_checkout_sms_consent()
  to service_role;

revoke execute on function public.configure_pos_sms_checkout_policy(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.configure_pos_sms_checkout_policy(uuid, uuid, text)
  to service_role;

revoke execute on function public.crm_customers_identity_generation_row()
  from public, anon, authenticated;
grant execute on function public.crm_customers_identity_generation_row()
  to service_role;

revoke execute on function public.crm_customers_identity_generation_stmt()
  from public, anon, authenticated;
grant execute on function public.crm_customers_identity_generation_stmt()
  to service_role;

revoke execute on function public.customer_intelligence_events_generation_trigger()
  from public, anon, authenticated;
grant execute on function public.customer_intelligence_events_generation_trigger()
  to service_role;

-- These helpers are called by authenticated RLS policies. Anonymous callers do
-- not need them, while authenticated and service-role callers do.
revoke execute on function public.bloom_can_access_tenant(uuid)
  from public, anon;
grant execute on function public.bloom_can_access_tenant(uuid)
  to authenticated, service_role;

revoke execute on function public.bloom_can_access_tenant_folder(text)
  from public, anon;
grant execute on function public.bloom_can_access_tenant_folder(text)
  to authenticated, service_role;
