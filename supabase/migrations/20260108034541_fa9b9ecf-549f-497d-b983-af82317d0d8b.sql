-- Backfill crm_customers purchase data from pos_orders using square_customer_id matching
-- This updates first_purchase_date, last_purchase_date, total_spent, lifetime_value

-- Add webhooks_subscribed column to square_connections
ALTER TABLE square_connections 
ADD COLUMN IF NOT EXISTS webhooks_subscribed boolean DEFAULT false;

-- Backfill customer purchase data for Christine's tenant
WITH order_stats AS (
  SELECT 
    po.external_customer_id,
    MIN(po.order_date::date) as first_order,
    MAX(po.order_date::date) as last_order,
    SUM(po.total_amount) as total_amount,
    COUNT(*) as order_count
  FROM pos_orders po
  JOIN square_connections sc ON po.pos_connection_id = sc.id
  WHERE sc.tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
    AND po.external_customer_id IS NOT NULL
    AND po.external_customer_id != ''
  GROUP BY po.external_customer_id
)
UPDATE crm_customers cc
SET 
  first_purchase_date = COALESCE(cc.first_purchase_date, os.first_order),
  last_purchase_date = GREATEST(COALESCE(cc.last_purchase_date, '1970-01-01'::date), os.last_order),
  total_spent = COALESCE(cc.total_spent, 0) + os.total_amount,
  lifetime_value = COALESCE(cc.lifetime_value, 0) + os.total_amount,
  updated_at = NOW()
FROM order_stats os
WHERE cc.square_customer_id = os.external_customer_id
  AND cc.tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62'
  AND (cc.last_purchase_date IS NULL OR cc.last_purchase_date < os.last_order);