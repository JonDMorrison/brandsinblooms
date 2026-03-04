-- Repair migration: make admin tenant RPC auth robust
-- Problem: some admin RPCs authorize using JWT claim `email`, which may be absent.
-- Fix: authorize via auth.uid() -> auth.users.email -> app_admin_emails (case-insensitive).

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
    v.tenant_id,
    v.company_name,
    v.website,
    v.city,
    v.region,
    v.country,
    v.onboarding_completed_at,
    v.tenant_created_at,
    v.primary_contact_email,
    v.primary_contact_name,
    v.primary_contact_last_login,
    v.plan::text,
    v.subscription_status,
    v.trial_start,
    v.trial_end,
    v.current_period_end,
    v.last_activity_at,
    v.is_trialing,
    v.is_paid_active,
    v.trial_not_expired,
    v.is_active
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

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS TABLE (
  total_tenants bigint,
  active_trials bigint,
  paid_active bigint,
  inactive_tenants bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
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
    COUNT(*)::bigint as total_tenants,
    COUNT(*) FILTER (WHERE is_trialing)::bigint as active_trials,
    COUNT(*) FILTER (WHERE is_paid_active)::bigint as paid_active,
    COUNT(*) FILTER (WHERE NOT is_active)::bigint as inactive_tenants
  FROM public.admin_tenant_overview v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenants(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenants(text, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO service_role;

NOTIFY pgrst, 'reload schema';
