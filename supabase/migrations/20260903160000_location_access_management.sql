-- Complete the server-backed CRM access model with active-location enforcement,
-- an owner-facing overview, audited store management, and lockout protection.

ALTER TABLE public.crm_access_audit
  DROP CONSTRAINT crm_access_audit_target_user_id_fkey,
  ALTER COLUMN target_user_id DROP NOT NULL,
  ADD CONSTRAINT crm_access_audit_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN location_id uuid,
  ADD COLUMN before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT crm_access_audit_location_fkey
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.crm_access_audit
  DROP CONSTRAINT crm_access_audit_event_type_check,
  ADD CONSTRAINT crm_access_audit_event_type_check CHECK (event_type IN (
    'role_change',
    'location_assignment',
    'location_created',
    'location_updated'
  ));

-- Inactive stores must never grant effective customer, campaign, or loyalty
-- access, even if an old assignment exists temporarily during a transaction.
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
$$;

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
      WHEN v_database_role = 'marketing' THEN 'marketing'
      WHEN v_database_role IN ('store_manager', 'staff') THEN v_database_role
      ELSE NULL
    END;

    SELECT coalesce(array_agg(access.location_id ORDER BY access.location_id), ARRAY[]::uuid[])
    INTO v_location_ids
    FROM public.user_location_access AS access
    JOIN public.tenant_locations AS location
      ON location.tenant_id = access.tenant_id
     AND location.id = access.location_id
     AND location.is_active
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

CREATE OR REPLACE FUNCTION public.get_tenant_access_overview(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_can_manage boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := (v_access->>'tenantId')::uuid;

  IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  v_can_manage := coalesce(v_access->'permissions' ? 'access.manage', false);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'current_user_id', v_actor_id,
    'current_role', v_access->>'role',
    'can_manage', v_can_manage,
    'locations', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', location.id,
          'name', location.name,
          'code', location.code,
          'timezone', location.timezone,
          'is_active', location.is_active
        ) ORDER BY location.name, location.id
      )
      FROM public.tenant_locations AS location
      WHERE location.tenant_id = v_tenant_id
        AND (
          v_can_manage OR
          public.has_tenant_permission(v_tenant_id, 'location.read', location.id)
        )
    ), '[]'::jsonb),
    'members', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', member.id,
          'name', coalesce(member.full_name, member.name, member.email),
          'email', member.email,
          'role', CASE
            WHEN member.role IN ('owner', 'admin') THEN 'owner_admin'
            WHEN member.role = 'marketing' THEN 'marketing'
            WHEN member.role IN ('store_manager', 'staff') THEN member.role
            ELSE 'staff'
          END,
          'location_ids', coalesce((
            SELECT jsonb_agg(access.location_id ORDER BY access.location_id)
            FROM public.user_location_access AS access
            JOIN public.tenant_locations AS assigned_location
              ON assigned_location.tenant_id = access.tenant_id
             AND assigned_location.id = access.location_id
             AND assigned_location.is_active
            WHERE access.tenant_id = v_tenant_id
              AND access.user_id = member.id
          ), '[]'::jsonb)
        ) ORDER BY coalesce(member.full_name, member.name, member.email), member.id
      )
      FROM public.users AS member
      WHERE member.tenant_id = v_tenant_id
        AND (v_can_manage OR member.id = v_actor_id)
    ), '[]'::jsonb)
  );
END;
$$;

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
    RAISE EXCEPTION 'User is not in the active tenant' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Users cannot change their own CRM access' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(location_id ORDER BY location_id), ARRAY[]::uuid[])
  INTO v_locations
  FROM (
    SELECT DISTINCT requested.location_id
    FROM unnest(coalesce(p_location_ids, ARRAY[]::uuid[])) AS requested(location_id)
    JOIN public.tenant_locations AS location
      ON location.id = requested.location_id
     AND location.tenant_id = v_tenant_id
     AND location.is_active
  ) normalized;

  IF cardinality(v_locations) <> cardinality(ARRAY(
    SELECT DISTINCT requested.location_id
    FROM unnest(coalesce(p_location_ids, ARRAY[]::uuid[])) AS requested(location_id)
  )) THEN
    RAISE EXCEPTION 'Every assigned location must be active and belong to the tenant';
  END IF;

  IF p_role IN ('store_manager', 'staff') AND cardinality(v_locations) = 0 THEN
    RAISE EXCEPTION 'Store managers and staff require at least one active location';
  END IF;

  IF v_old_role IN ('owner', 'admin')
    AND p_role <> 'owner_admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.users AS administrator
      WHERE administrator.tenant_id = v_tenant_id
        AND administrator.id <> p_user_id
        AND administrator.role IN ('owner', 'admin')
    )
  THEN
    RAISE EXCEPTION 'Cannot demote the last tenant administrator';
  END IF;

  IF p_role IN ('owner_admin', 'marketing') THEN
    v_locations := ARRAY[]::uuid[];
  END IF;

  SELECT coalesce(array_agg(access.location_id ORDER BY access.location_id), ARRAY[]::uuid[])
  INTO v_old_locations
  FROM public.user_location_access AS access
  WHERE access.user_id = p_user_id
    AND access.tenant_id = v_tenant_id;

  v_database_role := CASE
    WHEN p_role = 'owner_admin' AND v_old_role = 'owner' THEN 'owner'
    WHEN p_role = 'owner_admin' THEN 'admin'
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
  SELECT v_tenant_id, p_user_id, assigned.location_id, v_actor
  FROM unnest(v_locations) AS assigned(location_id);

  IF v_old_locations IS DISTINCT FROM v_locations THEN
    INSERT INTO public.crm_access_audit (
      tenant_id, target_user_id, actor_user_id, event_type,
      old_role, new_role, old_location_ids, new_location_ids,
      before_state, after_state
    ) VALUES (
      v_tenant_id, p_user_id, v_actor, 'location_assignment',
      v_old_role, v_database_role, v_old_locations, v_locations,
      jsonb_build_object('location_ids', v_old_locations),
      jsonb_build_object('location_ids', v_locations)
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

CREATE OR REPLACE FUNCTION public.save_tenant_location(
  p_location_id uuid,
  p_name text,
  p_code text,
  p_timezone text,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_location public.tenant_locations%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_removed_user_ids uuid[] := ARRAY[]::uuid[];
  v_code text := nullif(lower(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9_-]+', '-', 'g')), '');
  v_timezone text := trim(coalesce(p_timezone, 'UTC'));
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := (v_access->>'tenantId')::uuid;

  IF NOT coalesce(v_access->'permissions' ? 'access.manage', false) THEN
    RAISE EXCEPTION 'Location management denied' USING ERRCODE = '42501';
  END IF;

  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Location name is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone
  ) THEN
    RAISE EXCEPTION 'Unknown IANA timezone';
  END IF;

  IF p_location_id IS NULL THEN
    INSERT INTO public.tenant_locations(
      tenant_id, name, code, timezone, is_active, created_by
    ) VALUES (
      v_tenant_id, trim(p_name), v_code, v_timezone,
      coalesce(p_is_active, true), v_actor_id
    ) RETURNING * INTO v_location;
  ELSE
    SELECT * INTO v_location
    FROM public.tenant_locations AS location
    WHERE location.id = p_location_id
      AND location.tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Location not found';
    END IF;

    v_before := to_jsonb(v_location);
    UPDATE public.tenant_locations
    SET name = trim(p_name),
        code = v_code,
        timezone = v_timezone,
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    WHERE id = p_location_id
    RETURNING * INTO v_location;

    -- Deactivation revokes assignments instead of allowing them to become
    -- effective again silently if the location is later reactivated.
    IF v_location.is_active IS FALSE THEN
      SELECT coalesce(array_agg(access.user_id ORDER BY access.user_id), ARRAY[]::uuid[])
      INTO v_removed_user_ids
      FROM public.user_location_access AS access
      WHERE access.tenant_id = v_tenant_id
        AND access.location_id = v_location.id;

      DELETE FROM public.user_location_access
      WHERE tenant_id = v_tenant_id
        AND location_id = v_location.id;

      v_before := v_before || jsonb_build_object(
        'revoked_user_ids', to_jsonb(v_removed_user_ids)
      );
    END IF;
  END IF;

  INSERT INTO public.crm_access_audit(
    tenant_id, actor_user_id, location_id, event_type,
    before_state, after_state
  ) VALUES (
    v_tenant_id, v_actor_id, v_location.id,
    CASE WHEN p_location_id IS NULL THEN 'location_created' ELSE 'location_updated' END,
    v_before, to_jsonb(v_location)
  );

  RETURN to_jsonb(v_location) - 'address';
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_access_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_access_overview(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.set_tenant_user_crm_access(uuid, text, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_user_crm_access(uuid, text, uuid[])
  TO authenticated;

REVOKE ALL ON FUNCTION public.save_tenant_location(uuid, text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tenant_location(uuid, text, text, text, boolean)
  TO authenticated;

COMMENT ON FUNCTION public.get_tenant_access_overview(uuid) IS
  'Returns the authorized location and member overview for the active tenant.';
COMMENT ON FUNCTION public.set_tenant_user_crm_access(uuid, text, uuid[]) IS
  'Atomically changes CRM role and active store assignments with lockout protection and audit history.';
COMMENT ON FUNCTION public.save_tenant_location(uuid, text, text, text, boolean) IS
  'Creates or updates a store and revokes assignments atomically when deactivated.';
