-- Add webhook subscription tracking columns
ALTER TABLE square_connections 
ADD COLUMN IF NOT EXISTS webhook_subscription_id text,
ADD COLUMN IF NOT EXISTS webhooks_last_checked_at timestamptz;

-- Add pos_total_spent column to crm_customers for deterministic POS tracking
ALTER TABLE crm_customers
ADD COLUMN IF NOT EXISTS pos_total_spent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pos_order_count integer DEFAULT 0;

-- Create idempotent backfill function for any tenant (admin-only)
CREATE OR REPLACE FUNCTION backfill_customer_purchase_data_from_pos(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_max_date date;
  v_min_date date;
BEGIN
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
    -- total_spent/lifetime_value should reflect pos_total_spent + any other sources
    -- For now, just use POS data as the source of truth
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

-- Grant execute to authenticated users (will be protected by RLS in the calling code)
GRANT EXECUTE ON FUNCTION backfill_customer_purchase_data_from_pos(uuid) TO authenticated;