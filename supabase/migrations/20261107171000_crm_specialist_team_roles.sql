-- Additional least-privilege CRM team roles for designers, contact list managers, and campaign senders.
-- Existing tenant owners, marketing users, store managers and staff retain their permissions.
-- This migration adds role choices only; it does not assign or create accounts.
-- New roles are tenant-wide, with no implicit location grants.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY[
    'owner', 'admin', 'marketing', 'store_manager', 'staff', 'team',
    'designer', 'list_manager', 'sender'
  ]::text[]));

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
      RETURN v_role IN ('marketing', 'designer', 'list_manager', 'sender') OR
        (v_role IN ('store_manager', 'staff') AND v_has_location);
    WHEN 'location.manage' THEN RETURN false;
    WHEN 'user.manage' THEN RETURN false;
    WHEN 'customer.read' THEN
      RETURN v_role IN ('marketing', 'designer', 'list_manager', 'sender') OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.write' THEN
      RETURN v_role IN ('marketing', 'list_manager') OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.delete' THEN RETURN false;
    WHEN 'campaign.read' THEN
      RETURN v_role IN ('marketing', 'designer', 'sender') OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'campaign.write' THEN
      RETURN v_role IN ('marketing', 'designer', 'sender') OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'segment.read' THEN
      RETURN v_role IN ('marketing', 'designer', 'list_manager', 'sender') OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'segment.write' THEN
      RETURN v_role IN ('marketing', 'list_manager') OR
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
      RETURN v_role IN ('marketing', 'list_manager', 'sender') OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'campaign.send' THEN RETURN v_role IN ('marketing', 'sender');
    WHEN 'content.design' THEN RETURN v_role IN ('marketing', 'designer');
    WHEN 'export.customers' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_current_crm_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      WHEN v_database_role IN ('store_manager', 'staff', 'designer', 'list_manager', 'sender') THEN v_database_role
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

    WHEN 'designer' THEN ARRAY[
      'customers.read', 'campaigns.read', 'campaigns.write', 'content.design'
    ]::text[]
    WHEN 'list_manager' THEN ARRAY[
      'customers.read', 'customers.write', 'segments.manage', 'reports.read'
    ]::text[]
    WHEN 'sender' THEN ARRAY[
      'customers.read', 'campaigns.read', 'campaigns.write',
      'campaigns.send', 'reports.read'
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_tenant_access_overview(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
            WHEN member.role IN ('store_manager', 'staff', 'designer', 'list_manager', 'sender') THEN member.role
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
$function$
;
CREATE OR REPLACE FUNCTION public.set_tenant_user_crm_access(p_user_id uuid, p_role text, p_location_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'owner_admin', 'marketing', 'store_manager', 'staff',
    'designer', 'list_manager', 'sender'
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

  IF p_role IN ('owner_admin', 'marketing', 'designer', 'list_manager', 'sender') THEN
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
$function$
;


-- Existing tag policies are tenant-scoped but do not distinguish marketing
-- and creative roles. Restrictive policies preserve existing roles while
-- limiting the new specialist roles to the intended List Manager.
CREATE POLICY crm_tags_specialist_insert_guard ON public.crm_tags
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role IN ('designer', 'list_manager', 'sender')
    )
    OR EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role = 'list_manager'
        AND app_user.tenant_id = crm_tags.tenant_id
    )
  );

CREATE POLICY crm_tags_specialist_update_guard ON public.crm_tags
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role IN ('designer', 'list_manager', 'sender')
    )
    OR EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role = 'list_manager'
        AND app_user.tenant_id = crm_tags.tenant_id
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role IN ('designer', 'list_manager', 'sender')
    )
    OR EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role = 'list_manager'
        AND app_user.tenant_id = crm_tags.tenant_id
    )
  );

CREATE POLICY customer_tags_specialist_insert_guard ON public.customer_tags
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role IN ('designer', 'list_manager', 'sender')
    )
    OR EXISTS (
      SELECT 1
      FROM public.users app_user
      JOIN public.crm_customers contact ON contact.tenant_id = app_user.tenant_id
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role = 'list_manager'
        AND contact.id = customer_tags.contact_id
    )
  );

CREATE POLICY customer_tags_specialist_delete_guard ON public.customer_tags
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.users app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role IN ('designer', 'list_manager', 'sender')
    )
    OR EXISTS (
      SELECT 1
      FROM public.users app_user
      JOIN public.crm_customers contact ON contact.tenant_id = app_user.tenant_id
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.role = 'list_manager'
        AND contact.id = customer_tags.contact_id
    )
  );

-- A tag can never be attached to a contact belonging to another tenant,
-- even if the caller knows both UUIDs.
CREATE POLICY customer_tags_matching_tenant_guard ON public.customer_tags
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.crm_customers contact
      JOIN public.crm_tags tag ON tag.tenant_id = contact.tenant_id
      WHERE contact.id = customer_tags.contact_id
        AND tag.id = customer_tags.tag_id
    )
  );
