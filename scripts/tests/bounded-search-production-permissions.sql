-- Read-only production policy/function definitions captured 2026-11-05.
-- Applied ONLY to the disposable benchmark database; no production changes.
CREATE OR REPLACE FUNCTION public.has_tenant_permission(p_tenant_id uuid, p_permission text, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_has_location boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF coalesce(public.is_master_admin(v_user_id), false) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.admin_session_context AS context
      WHERE context.admin_user_id = v_user_id
        AND context.active_tenant_id = p_tenant_id
    );
  END IF;

  SELECT app_user.role
  INTO v_role
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id
    AND app_user.tenant_id = p_tenant_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_location_access AS access
    JOIN public.tenant_locations AS location
      ON location.tenant_id = access.tenant_id
     AND location.id = access.location_id
     AND location.is_active
    WHERE access.user_id = v_user_id
      AND access.tenant_id = p_tenant_id
      AND (p_location_id IS NULL OR access.location_id = p_location_id)
  ) INTO v_has_location;

  IF v_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  CASE lower(coalesce(p_permission, ''))
    WHEN 'location.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND v_has_location);
    WHEN 'location.manage' THEN RETURN false;
    WHEN 'user.manage' THEN RETURN false;
    WHEN 'customer.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.delete' THEN RETURN false;
    WHEN 'campaign.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'campaign.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'segment.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'segment.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'automation.read' THEN RETURN v_role = 'marketing';
    WHEN 'automation.write' THEN RETURN v_role = 'marketing';
    WHEN 'loyalty.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'loyalty.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'reporting.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'export.customers' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_has_role boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_admin_emails a
    WHERE lower(a.email) = v_email
  ) THEN
    RETURN true;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = $1 AND ur.role::text = ''master_admin'')'
      INTO v_has_role
      USING _user_id;

    RETURN COALESCE(v_has_role, false);
  END IF;

  RETURN false;
END;
$function$
;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_customers_select_by_scope ON public.crm_customers FOR SELECT TO authenticated USING (((tenant_id IN ( SELECT full_read_candidates.tenant_id
   FROM ( SELECT app_user.tenant_id
           FROM users app_user
          WHERE (app_user.id = ( SELECT auth.uid() AS uid))
        UNION
         SELECT context.active_tenant_id
           FROM admin_session_context context
          WHERE (context.admin_user_id = ( SELECT auth.uid() AS uid))) full_read_candidates
  WHERE ((full_read_candidates.tenant_id IS NOT NULL) AND has_tenant_permission(full_read_candidates.tenant_id, 'customer.read'::text, NULL::uuid)))) OR (has_tenant_permission(tenant_id, 'customer.read'::text, primary_location_id) OR (EXISTS ( SELECT 1
   FROM customer_location_activity activity
  WHERE ((activity.customer_id = crm_customers.id) AND (activity.tenant_id = crm_customers.tenant_id) AND has_tenant_permission(activity.tenant_id, 'customer.read'::text, activity.location_id)))))));
ALTER TABLE public.customer_intelligence_source_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_intelligence_source_events_select ON public.customer_intelligence_source_events FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT t.id
   FROM tenants t
  WHERE has_tenant_permission(t.id, 'customer.read'::text, NULL::uuid))));
