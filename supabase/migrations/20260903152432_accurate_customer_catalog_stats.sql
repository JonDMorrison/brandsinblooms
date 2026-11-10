-- Return exact customer-catalog totals from Postgres instead of summing the
-- first PostgREST page in the browser. The tenant is resolved server-side so
-- callers cannot request another organization's figures.

CREATE OR REPLACE FUNCTION public.get_customer_catalog_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF coalesce(public.is_master_admin(v_user_id), false) THEN
    SELECT admin_context.active_tenant_id
    INTO v_tenant_id
    FROM public.admin_session_context AS admin_context
    WHERE admin_context.admin_user_id = v_user_id;
  ELSE
    SELECT app_user.tenant_id
    INTO v_tenant_id
    FROM public.users AS app_user
    WHERE app_user.id = v_user_id;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant access required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totalCustomers', count(*),
    'newThisMonth', count(*) FILTER (
      WHERE customer.created_at >= date_trunc('month', current_timestamp)
    ),
    'totalSpent', coalesce(sum(customer.total_spent), 0)
  )
  INTO v_result
  FROM public.crm_customers AS customer
  WHERE customer.tenant_id = v_tenant_id
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_catalog_stats()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_catalog_stats()
TO authenticated;

COMMENT ON FUNCTION public.get_customer_catalog_stats() IS
  'Returns exact active-customer count, current-month additions, and total spend for the caller''s effective tenant.';
