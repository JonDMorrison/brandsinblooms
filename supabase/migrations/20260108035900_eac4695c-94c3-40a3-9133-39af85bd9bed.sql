-- ============================================
-- SECURITY FIX: Revoke public access to backfill function
-- ============================================

-- Revoke execute from PUBLIC (which includes authenticated)
REVOKE EXECUTE ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid) FROM anon;

-- Drop the old function and recreate with proper authorization check
DROP FUNCTION IF EXISTS public.backfill_customer_purchase_data_from_pos(uuid);

-- Create the secured version with admin check
CREATE OR REPLACE FUNCTION public.backfill_customer_purchase_data_from_pos(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant_id uuid;
  v_is_master_admin boolean := false;
  v_updated_count integer := 0;
  v_max_date date;
  v_min_date date;
BEGIN
  -- AUTHORIZATION CHECK: Verify calling user is either:
  -- 1. A member of the target tenant, OR
  -- 2. A master admin (in app_admin_emails)
  
  -- Check if user belongs to tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM users
  WHERE id = auth.uid();
  
  -- Check if user is master admin
  SELECT EXISTS (
    SELECT 1 FROM app_admin_emails aae
    JOIN auth.users au ON au.email = aae.email
    WHERE au.id = auth.uid()
  ) INTO v_is_master_admin;
  
  -- Deny access if not authorized
  IF v_user_tenant_id IS NULL OR (v_user_tenant_id != p_tenant_id AND NOT v_is_master_admin) THEN
    RAISE EXCEPTION 'Access denied: User does not have permission to backfill this tenant';
  END IF;

  -- Compute deterministic totals from pos_orders and SET them (not add)
  WITH order_stats AS (
    SELECT 
      po.external_customer_id,
      MIN(po.order_date::date) as first_order,
      MAX(po.order_date::date) as last_order,
      SUM(COALESCE(po.total_amount, 0)) as total_amount,
      COUNT(*) as order_count
    FROM pos_orders po
    JOIN square_connections sc ON po.pos_connection_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND po.external_customer_id IS NOT NULL
      AND po.external_customer_id != ''
    GROUP BY po.external_customer_id
  )
  UPDATE crm_customers cc
  SET 
    -- SET deterministically, don't ADD
    first_purchase_date = LEAST(COALESCE(cc.first_purchase_date, os.first_order), os.first_order),
    last_purchase_date = GREATEST(COALESCE(cc.last_purchase_date, os.last_order), os.last_order),
    pos_total_spent = os.total_amount,
    pos_order_count = os.order_count,
    total_spent = os.total_amount,
    lifetime_value = os.total_amount,
    updated_at = NOW()
  FROM order_stats os
  WHERE cc.square_customer_id = os.external_customer_id
    AND cc.tenant_id = p_tenant_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Get date range
  SELECT MIN(last_purchase_date), MAX(last_purchase_date)
  INTO v_min_date, v_max_date
  FROM crm_customers
  WHERE tenant_id = p_tenant_id
    AND last_purchase_date IS NOT NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'customers_updated', v_updated_count,
    'min_purchase_date', v_min_date,
    'max_purchase_date', v_max_date,
    'tenant_id', p_tenant_id
  );
END;
$$;

-- Explicitly grant only to authenticated (but function has internal authorization check)
GRANT EXECUTE ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid) TO authenticated;

COMMENT ON FUNCTION public.backfill_customer_purchase_data_from_pos IS 
'Backfills customer purchase data from POS orders. Requires user to be a member of the target tenant or a master admin.';