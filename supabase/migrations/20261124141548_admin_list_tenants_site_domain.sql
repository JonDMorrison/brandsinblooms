-- newsletter-qa2 #13: the admin client list shows the tenant's BloomSites
-- custom domain when one exists. admin_list_tenants gains site_domain and
-- site_domain_status (public.domains, type 'custom'; an active domain is
-- preferred over a pending one). Existing columns are unchanged.

DROP FUNCTION IF EXISTS public.admin_list_tenants(text, text, integer, integer);

CREATE FUNCTION public.admin_list_tenants(
  p_search text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  tenant_id uuid, primary_contact_user_id uuid, company_name text, website text,
  city text, region text, country text, onboarding_completed_at timestamp with time zone,
  tenant_created_at timestamp with time zone, primary_contact_email text,
  primary_contact_name text, primary_contact_last_login timestamp with time zone,
  plan text, subscription_status text, trial_start timestamp with time zone,
  trial_end timestamp with time zone, current_period_end timestamp with time zone,
  last_activity_at timestamp with time zone, is_trialing boolean, is_paid_active boolean,
  trial_not_expired boolean, is_active boolean, health_score integer,
  onboarding_steps_done integer, onboarding_steps_total integer,
  site_domain text, site_domain_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    v.onboarding_steps_total::int,
    d.domain::text,
    d.status::text
  FROM public.admin_tenant_overview v
  LEFT JOIN LATERAL (
    SELECT dm.domain, dm.status
      FROM public.domains dm
     WHERE dm.tenant_id = v.tenant_id::uuid
       AND dm.type = 'custom'
       AND dm.status <> 'archived'
     ORDER BY (dm.status = 'active') DESC, dm.created_at DESC
     LIMIT 1
  ) d ON true
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
      OR d.domain ILIKE '%' || p_search || '%'
    )
  ORDER BY v.last_activity_at DESC NULLS LAST, v.tenant_created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_tenants(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_tenants(text, text, integer, integer) TO authenticated, service_role;
