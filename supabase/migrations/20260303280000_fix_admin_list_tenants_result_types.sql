-- Repair migration: fix admin_list_tenants return type mismatch
-- Root cause: admin_tenant_overview columns (e.g. subscription_status) may be enums/dates,
-- while admin_list_tenants declares TEXT/TIMESTAMPTZ in RETURNS TABLE.
-- Explicit casts avoid "structure of query does not match function result type".

CREATE OR REPLACE FUNCTION public.admin_list_tenants(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  tenant_id uuid,
  company_name text,
  website text,
  city text,
  region text,
  country text,
  onboarding_completed_at timestamptz,
  tenant_created_at timestamptz,
  primary_contact_email text,
  primary_contact_name text,
  primary_contact_last_login timestamptz,
  plan text,
  subscription_status text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_end timestamptz,
  last_activity_at timestamptz,
  is_trialing boolean,
  is_paid_active boolean,
  trial_not_expired boolean,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_has_role boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_admin_emails a
    WHERE lower(a.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  RETURN QUERY
  SELECT
    v.tenant_id::uuid,
    v.company_name::text,
    v.website::text,
    v.city::text,
    v.region::text,
    v.country::text,
    v.onboarding_completed_at::timestamptz,
    v.tenant_created_at::timestamptz,
    v.primary_contact_email::text,
    v.primary_contact_name::text,
    v.primary_contact_last_login::timestamptz,
    v.plan::text,
    v.subscription_status::text,
    v.trial_start::timestamptz,
    v.trial_end::timestamptz,
    v.current_period_end::timestamptz,
    v.last_activity_at::timestamptz,
    v.is_trialing::boolean,
    v.is_paid_active::boolean,
    v.trial_not_expired::boolean,
    v.is_active::boolean
  FROM public.admin_tenant_overview v
  WHERE (
      p_status IS NULL OR
      (p_status = 'trialing' AND v.is_trialing) OR
      (p_status = 'active' AND v.is_paid_active) OR
      (p_status = 'canceled' AND NOT v.is_active)
    )
    AND (
      p_search IS NULL
      OR v.company_name ILIKE '%' || p_search || '%'
      OR v.primary_contact_email ILIKE '%' || p_search || '%'
      OR v.website ILIKE '%' || p_search || '%'
    )
  ORDER BY v.last_activity_at DESC NULLS LAST, v.tenant_created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenants(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenants(text, text, int, int) TO service_role;

NOTIFY pgrst, 'reload schema';
