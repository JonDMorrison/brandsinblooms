-- Harden the multi-location permission foundation with selected-tenant master
-- admin scope, least-privilege legacy roles, server-backed client access, and
-- protected/audited role and location assignment changes.

UPDATE public.users
SET role = 'marketing'
WHERE role = 'team';

CREATE OR REPLACE FUNCTION public.has_tenant_permission(
  p_tenant_id uuid,
  p_permission text,
  p_location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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

  IF p_location_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_location_access AS access
      WHERE access.user_id = v_user_id
        AND access.tenant_id = p_tenant_id
        AND access.location_id = p_location_id
    ) INTO v_has_location;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_location_access AS access
      WHERE access.user_id = v_user_id
        AND access.tenant_id = p_tenant_id
    ) INTO v_has_location;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  CASE lower(coalesce(p_permission, ''))
    WHEN 'location.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND v_has_location);
    WHEN 'location.manage' THEN
      RETURN false;
    WHEN 'user.manage' THEN
      RETURN false;
    WHEN 'customer.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.delete' THEN
      RETURN false;
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
    WHEN 'automation.read' THEN
      RETURN v_role = 'marketing';
    WHEN 'automation.write' THEN
      RETURN v_role = 'marketing';
    WHEN 'loyalty.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'loyalty.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'reporting.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'export.customers' THEN
      RETURN false;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE TABLE public.crm_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('role_change', 'location_assignment')),
  old_role text,
  new_role text,
  old_location_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  new_location_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_access_audit_tenant_created_idx
  ON public.crm_access_audit (tenant_id, created_at DESC);

ALTER TABLE public.crm_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_access_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.crm_access_audit TO authenticated;
GRANT ALL ON TABLE public.crm_access_audit TO service_role;

CREATE POLICY crm_access_audit_owner_select
  ON public.crm_access_audit
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'user.manage', NULL));

CREATE OR REPLACE FUNCTION public.get_current_crm_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_database_role text;
  v_role text;
  v_location_ids uuid[] := ARRAY[]::uuid[];
  v_permissions text[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF coalesce(public.is_master_admin(v_user_id), false) THEN
    SELECT context.active_tenant_id
    INTO v_tenant_id
    FROM public.admin_session_context AS context
    WHERE context.admin_user_id = v_user_id;
    v_role := 'owner_admin';
  ELSE
    SELECT app_user.tenant_id, app_user.role
    INTO v_tenant_id, v_database_role
    FROM public.users AS app_user
    WHERE app_user.id = v_user_id;

    v_role := CASE
      WHEN v_database_role IN ('owner', 'admin') THEN 'owner_admin'
      WHEN v_database_role IN ('team', 'marketing') THEN 'marketing'
      WHEN v_database_role IN ('store_manager', 'staff') THEN v_database_role
      ELSE NULL
    END;

    SELECT coalesce(array_agg(access.location_id ORDER BY access.location_id), ARRAY[]::uuid[])
    INTO v_location_ids
    FROM public.user_location_access AS access
    WHERE access.user_id = v_user_id
      AND access.tenant_id = v_tenant_id;
  END IF;

  IF v_tenant_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Tenant access required' USING ERRCODE = '42501';
  END IF;

  v_permissions := CASE v_role
    WHEN 'owner_admin' THEN ARRAY[
      'access.manage', 'customers.read', 'customers.write',
      'campaigns.read', 'campaigns.write', 'campaigns.send',
      'segments.manage', 'automations.manage', 'loyalty.read',
      'loyalty.write', 'reports.read', 'integrations.manage',
      'content.design'
    ]::text[]
    WHEN 'marketing' THEN ARRAY[
      'customers.read', 'customers.write', 'campaigns.read',
      'campaigns.write', 'campaigns.send', 'segments.manage',
      'automations.manage', 'loyalty.read', 'loyalty.write',
      'reports.read', 'content.design'
    ]::text[]
    WHEN 'store_manager' THEN ARRAY[
      'customers.read', 'customers.write', 'campaigns.read',
      'loyalty.read', 'loyalty.write', 'reports.read'
    ]::text[]
    WHEN 'staff' THEN ARRAY['customers.read', 'loyalty.read']::text[]
    ELSE ARRAY[]::text[]
  END;

  RETURN jsonb_build_object(
    'tenantId', v_tenant_id,
    'role', v_role,
    'locationIds', to_jsonb(v_location_ids),
    'permissions', to_jsonb(v_permissions)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_has_permission(
  p_permission text,
  p_tenant_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_role text;
BEGIN
  IF nullif(btrim(coalesce(p_permission, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  v_access := public.get_current_crm_access();
  v_role := v_access->>'role';

  IF p_tenant_id IS NOT NULL
     AND p_tenant_id::text IS DISTINCT FROM v_access->>'tenantId' THEN
    RETURN false;
  END IF;

  IF NOT coalesce(v_access->'permissions' ? p_permission, false) THEN
    RETURN false;
  END IF;

  IF p_location_id IS NOT NULL AND v_role IN ('store_manager', 'staff') THEN
    RETURN coalesce(v_access->'locationIds' ? p_location_id::text, false);
  END IF;

  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_user_crm_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_tenant uuid;
  v_actor_role text;
  v_locations uuid[];
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' OR v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_actor = OLD.id THEN
    RAISE EXCEPTION 'Users cannot change their own CRM access'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(public.is_master_admin(v_actor), false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_session_context AS context
      WHERE context.admin_user_id = v_actor
        AND context.active_tenant_id = OLD.tenant_id
    ) OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'CRM access changes require the active tenant'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT app_user.tenant_id, app_user.role
    INTO v_actor_tenant, v_actor_role
    FROM public.users AS app_user
    WHERE app_user.id = v_actor;

    IF v_actor_role NOT IN ('owner', 'admin')
       OR v_actor_tenant IS DISTINCT FROM OLD.tenant_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'CRM access changes require a tenant owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT coalesce(array_agg(access.location_id ORDER BY access.location_id), ARRAY[]::uuid[])
  INTO v_locations
  FROM public.user_location_access AS access
  WHERE access.user_id = OLD.id
    AND access.tenant_id = OLD.tenant_id;

  INSERT INTO public.crm_access_audit (
    tenant_id, target_user_id, actor_user_id, event_type,
    old_role, new_role, old_location_ids, new_location_ids
  ) VALUES (
    OLD.tenant_id, OLD.id, v_actor, 'role_change',
    OLD.role, NEW.role, v_locations, v_locations
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_crm_role_trigger ON public.users;
CREATE TRIGGER protect_user_crm_role_trigger
BEFORE UPDATE OF role ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_crm_role();

CREATE OR REPLACE FUNCTION public.set_tenant_user_crm_access(
  p_user_id uuid,
  p_role text,
  p_location_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_database_role text;
  v_old_role text;
  v_old_locations uuid[];
  v_locations uuid[];
BEGIN
  IF p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN (
    'owner_admin', 'marketing', 'store_manager', 'staff'
  ) THEN
    RAISE EXCEPTION 'A valid user and CRM role are required';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := (v_access->>'tenantId')::uuid;

  IF NOT coalesce(v_access->'permissions' ? 'access.manage', false) THEN
    RAISE EXCEPTION 'CRM access changes require a tenant owner'
      USING ERRCODE = '42501';
  END IF;

  SELECT app_user.role
  INTO v_old_role
  FROM public.users AS app_user
  WHERE app_user.id = p_user_id
    AND app_user.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not in the active tenant'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Users cannot change their own CRM access'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(location_id ORDER BY location_id), ARRAY[]::uuid[])
  INTO v_locations
  FROM (
    SELECT DISTINCT value AS location_id
    FROM unnest(coalesce(p_location_ids, ARRAY[]::uuid[])) AS value
    JOIN public.tenant_locations AS location
      ON location.id = value
     AND location.tenant_id = v_tenant_id
  ) normalized;

  IF cardinality(v_locations) <> cardinality(
    ARRAY(SELECT DISTINCT value FROM unnest(coalesce(p_location_ids, ARRAY[]::uuid[])) AS value)
  ) THEN
    RAISE EXCEPTION 'Every location must belong to the active tenant';
  END IF;

  IF p_role IN ('store_manager', 'staff') AND cardinality(v_locations) = 0 THEN
    RAISE EXCEPTION 'Store managers and staff require at least one location';
  END IF;

  IF p_role IN ('owner_admin', 'marketing') THEN
    v_locations := ARRAY[]::uuid[];
  END IF;

  SELECT coalesce(array_agg(access.location_id ORDER BY access.location_id), ARRAY[]::uuid[])
  INTO v_old_locations
  FROM public.user_location_access AS access
  WHERE access.user_id = p_user_id
    AND access.tenant_id = v_tenant_id;

  v_database_role := CASE p_role
    WHEN 'owner_admin' THEN 'admin'
    ELSE p_role
  END;

  UPDATE public.users
  SET role = v_database_role
  WHERE id = p_user_id
    AND tenant_id = v_tenant_id;

  DELETE FROM public.user_location_access
  WHERE user_id = p_user_id
    AND tenant_id = v_tenant_id;

  INSERT INTO public.user_location_access (
    tenant_id, user_id, location_id, assigned_by
  )
  SELECT v_tenant_id, p_user_id, location_id, v_actor
  FROM unnest(v_locations) AS location_id;

  IF v_old_locations IS DISTINCT FROM v_locations THEN
    INSERT INTO public.crm_access_audit (
      tenant_id, target_user_id, actor_user_id, event_type,
      old_role, new_role, old_location_ids, new_location_ids
    ) VALUES (
      v_tenant_id, p_user_id, v_actor, 'location_assignment',
      v_old_role, v_database_role, v_old_locations, v_locations
    );
  END IF;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'tenantId', v_tenant_id,
    'role', p_role,
    'locationIds', to_jsonb(v_locations)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_crm_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_crm_access() TO authenticated;

REVOKE ALL ON FUNCTION public.has_tenant_permission(uuid, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid, text, uuid)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_has_permission(text, uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_has_permission(text, uuid, uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.set_tenant_user_crm_access(uuid, text, uuid[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_user_crm_access(uuid, text, uuid[])
TO authenticated;

REVOKE ALL ON FUNCTION public.protect_user_crm_role() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_current_crm_access() IS
  'Returns the authenticated user CRM role, location scope, and UI permissions for the active tenant.';
COMMENT ON TABLE public.crm_access_audit IS
  'Immutable owner-visible audit trail for CRM role and location-scope changes.';
