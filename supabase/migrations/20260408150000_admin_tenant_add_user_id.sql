-- Add primary_contact_user_id to admin_tenant_overview and admin_list_tenants.
-- This exposes the auth user UUID of the primary contact so the admin UI can
-- call admin_delete_user (which takes target_user_id, not tenant_id).

CREATE OR REPLACE VIEW admin_tenant_overview AS
SELECT
  t.id as tenant_id,
  u.id as primary_contact_user_id,
  t.name as company_name,
  COALESCE(t.website, cp.website_url, '') as website,
  COALESCE(cp.city, '') as city,
  COALESCE(cp.state_province, '') as region,
  COALESCE(cp.country, '') as country,
  COALESCE(cp.onboarding_completed_at, cp.crm_onboarding_completed_at) as onboarding_completed_at,
  t.created_at as tenant_created_at,
  t.archived_at,
  u.email as primary_contact_email,
  COALESCE(u.full_name, u.name, '') as primary_contact_name,
  au.last_sign_in_at as primary_contact_last_login,
  s.plan,
  CASE
    WHEN s.end_date > now() AND s.deleted_at IS NULL THEN 'active'
    WHEN s.end_date <= now() THEN 'expired'
    ELSE 'canceled'
  END as subscription_status,
  s.start_date as trial_start,
  s.end_date as trial_end,
  s.end_date as current_period_end,
  GREATEST(
    au.last_sign_in_at,
    t.last_event_at
  ) as last_activity_at,
  (s.plan = 'free_trial') as is_trialing,
  (s.plan != 'free_trial' AND s.end_date > now() AND s.deleted_at IS NULL) as is_paid_active,
  (now() <= s.end_date) as trial_not_expired,
  (t.archived_at IS NULL) as is_active,
  -- Health score: 20 pts each for domain, social, contacts, campaign, recent login
  (
    CASE WHEN COALESCE(domain_ct.cnt, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(social_ct.cnt, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(customer_ct.cnt, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(campaign_ct.cnt, 0) > 0 THEN 20 ELSE 0 END +
    CASE WHEN au.last_sign_in_at > now() - interval '30 days' THEN 20 ELSE 0 END
  )::int as health_score,
  -- Onboarding: count completed steps out of key milestones
  (
    CASE WHEN cp.brand_primary_color IS NOT NULL AND cp.brand_secondary_color IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN cp.company_name IS NOT NULL AND cp.company_overview IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(domain_ct.cnt, 0) > 0 THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(social_ct.cnt, 0) > 0 THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(customer_ct.cnt, 0) > 0 THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(campaign_ct.cnt, 0) > 0 THEN 1 ELSE 0 END +
    CASE WHEN cp.onboarding_completed_at IS NOT NULL OR cp.crm_onboarding_completed_at IS NOT NULL THEN 1 ELSE 0 END
  )::int as onboarding_steps_done,
  7 as onboarding_steps_total
FROM tenants t
LEFT JOIN LATERAL (
  SELECT u.*
  FROM users u
  WHERE u.tenant_id = t.id
  ORDER BY u.created_at ASC
  LIMIT 1
) u ON true
LEFT JOIN LATERAL (
  SELECT au.*
  FROM auth.users au
  WHERE au.id = u.id
  LIMIT 1
) au ON true
LEFT JOIN LATERAL (
  SELECT cp.*
  FROM company_profiles cp
  WHERE cp.user_id = u.id
  LIMIT 1
) cp ON true
LEFT JOIN LATERAL (
  SELECT s.*
  FROM subscriptions s
  WHERE s.user_id = u.id
  ORDER BY s.updated_at DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as cnt
  FROM email_domains ed
  WHERE ed.tenant_id = t.id
    AND ed.status IN ('verified', 'warming_up', 'active')
) domain_ct ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as cnt
  FROM social_connections sc
  WHERE sc.user_id = u.id
    AND sc.is_active = true
) social_ct ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as cnt
  FROM crm_customers cc
  WHERE cc.tenant_id = t.id
) customer_ct ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as cnt
  FROM crm_campaigns camp
  WHERE camp.tenant_id = t.id
    AND camp.status = 'sent'
) campaign_ct ON true;

-- Update admin_list_tenants RPC to include primary_contact_user_id
CREATE OR REPLACE FUNCTION public.admin_list_tenants(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  tenant_id uuid,
  primary_contact_user_id uuid,
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
  is_active boolean,
  health_score int,
  onboarding_steps_done int,
  onboarding_steps_total int
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
    v.tenant_id::uuid,
    v.primary_contact_user_id::uuid,
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
    v.is_active::boolean,
    v.health_score::int,
    v.onboarding_steps_done::int,
    v.onboarding_steps_total::int
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
