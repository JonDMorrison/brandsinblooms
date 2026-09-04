-- The CRM dashboard snapshot originally only accepted the caller's own users.tenant_id.
-- Master admins manage a tenant through admin_session_context, so the old guard
-- returned 42501/403 even though the rest of the CRM RLS surface explicitly
-- permits master-admin reads. Patch the existing function in place so fresh
-- databases keep the full snapshot implementation from its original migration,
-- while production receives only the authorization/security correction.
--
-- SECURITY DEFINER is intentional here: the target tenant is validated before
-- any data query, normal users remain restricted to their own tenant, and master
-- admins may only request the tenant currently selected in admin_session_context.
-- Explicit EXECUTE grants avoid PUBLIC access to the definer routine.

do $migration$
declare
  v_definition text;
  v_patched text;
  v_old_auth constant text := $old_auth$
	IF p_tenant_id IS NOT NULL THEN
		SELECT u.tenant_id
		INTO v_actor_tenant_id
		FROM public.users u
		WHERE u.id = v_actor_user_id;

		IF v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
			RAISE EXCEPTION 'Not authorized for tenant dashboard stats'
				USING ERRCODE = '42501';
		END IF;
	ELSIF p_user_id IS DISTINCT FROM v_actor_user_id THEN
$old_auth$;
  v_new_auth constant text := $new_auth$
	IF p_tenant_id IS NOT NULL THEN
		SELECT u.tenant_id
		INTO v_actor_tenant_id
		FROM public.users u
		WHERE u.id = v_actor_user_id;

		IF v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
			IF NOT COALESCE(public.is_master_admin(v_actor_user_id), false)
				OR NOT EXISTS (
					SELECT 1
					FROM public.admin_session_context admin_context
					WHERE admin_context.admin_user_id = v_actor_user_id
						AND admin_context.active_tenant_id = p_tenant_id
				) THEN
				RAISE EXCEPTION 'Not authorized for tenant dashboard stats'
					USING ERRCODE = '42501';
			END IF;
		END IF;
	ELSIF p_user_id IS DISTINCT FROM v_actor_user_id THEN
$new_auth$;
  v_old_header constant text := $old_header$
 STABLE
 SET search_path TO 'public'
$old_header$;
  v_new_header constant text := $new_header$
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
$new_header$;
begin
  select pg_get_functiondef(
    'public.get_crm_dashboard_snapshot(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position(v_old_auth in v_definition) = 0 then
    raise exception 'Expected dashboard authorization block was not found';
  end if;

  if position(v_old_header in v_definition) = 0 then
    raise exception 'Expected dashboard function header was not found';
  end if;

  v_patched := replace(v_definition, v_old_auth, v_new_auth);
  v_patched := replace(v_patched, v_old_header, v_new_header);
  execute v_patched;
end;
$migration$;

revoke all on function public.get_crm_dashboard_snapshot(uuid, uuid)
  from public, anon;
grant execute on function public.get_crm_dashboard_snapshot(uuid, uuid)
  to authenticated, service_role;

comment on function public.get_crm_dashboard_snapshot(uuid, uuid) is
  'Returns the CRM dashboard snapshot for the caller tenant, or for the tenant actively selected by a master admin.';
