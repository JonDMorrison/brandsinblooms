-- Admin RPC: change the subscription plan for a tenant.
--
-- Root cause of the ChangePlanModal bug: the modal was doing a direct
-- client-side UPDATE on public.subscriptions. RLS on that table restricts
-- UPDATEs to a user's own subscription row, so an admin's UPDATE against
-- another tenant's row silently affected 0 rows (no error, because RLS
-- makes the target row invisible for UPDATE). The modal then closed and the
-- UI "reverted" to the previous plan because nothing had actually changed.
--
-- This RPC runs SECURITY DEFINER, validates the caller against
-- app_admin_emails (same pattern as admin_extend_trial / admin_list_tenants),
-- updates the subscription(s) for every user in the tenant, and inserts an
-- admin_audit_log row atomically.

CREATE OR REPLACE FUNCTION public.admin_change_tenant_plan(
  p_tenant_id uuid,
  p_plan text,
  p_end_date date,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_rows_updated int;
  v_previous_plan text;
  v_tenant_name text;
  v_primary_email text;
BEGIN
  -- 1. Authorize: caller must be authenticated and in app_admin_emails
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Access denied. Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_admin_emails a WHERE lower(a.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Access denied. Master admin required.';
  END IF;

  -- 2. Validate inputs
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_plan IS NULL OR btrim(p_plan) = '' THEN
    RAISE EXCEPTION 'plan is required';
  END IF;

  IF p_plan NOT IN ('free_trial', 'seed', 'sprout', 'bloom', 'thrive', 'expired') THEN
    RAISE EXCEPTION 'invalid plan: %', p_plan;
  END IF;

  IF p_end_date IS NULL THEN
    RAISE EXCEPTION 'end_date is required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  -- 3. Gather context for audit log
  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

  SELECT s.plan::text INTO v_previous_plan
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  SELECT u.email INTO v_primary_email
  FROM public.users u
  WHERE u.tenant_id = p_tenant_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  -- 4. Update every subscription for every user in the tenant
  UPDATE public.subscriptions
  SET
    plan = p_plan::public.subscription_plan,
    tier = p_plan,
    end_date = p_end_date,
    crm_enabled = (p_plan NOT IN ('free_trial', 'expired')),
    deleted_at = NULL,
    updated_at = now()
  WHERE user_id IN (
    SELECT id FROM public.users WHERE tenant_id = p_tenant_id
  );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 5. If the tenant has a user but no subscription row, create one so the
  --    admin's intent is honored even for broken / pre-existing accounts.
  IF v_rows_updated = 0 THEN
    INSERT INTO public.subscriptions (user_id, plan, tier, start_date, end_date, crm_enabled)
    SELECT
      u.id,
      p_plan::public.subscription_plan,
      p_plan,
      CURRENT_DATE,
      p_end_date,
      (p_plan NOT IN ('free_trial', 'expired'))
    FROM public.users u
    WHERE u.tenant_id = p_tenant_id
      AND NOT EXISTS (
        SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
      );

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  END IF;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'No users found for tenant %. Nothing updated.', p_tenant_id;
  END IF;

  -- 6. Audit log
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    target_tenant_id,
    action_type,
    action_details
  ) VALUES (
    auth.uid(),
    p_tenant_id,
    'change_plan',
    jsonb_build_object(
      'previous_plan', v_previous_plan,
      'new_plan', p_plan,
      'end_date', p_end_date,
      'reason', btrim(p_reason),
      'tenant_name', v_tenant_name,
      'contact_email', v_primary_email,
      'rows_updated', v_rows_updated
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rows_updated', v_rows_updated,
    'previous_plan', v_previous_plan,
    'new_plan', p_plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_tenant_plan(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_tenant_plan(uuid, text, date, text) TO service_role;

NOTIFY pgrst, 'reload schema';
