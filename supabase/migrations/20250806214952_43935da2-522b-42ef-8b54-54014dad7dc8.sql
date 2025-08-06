-- Create customer_360_enriched view for comprehensive customer data
CREATE OR REPLACE VIEW customer_360_enriched AS
SELECT 
  c.*,
  COALESCE(order_stats.total_spent, 0) AS enriched_total_spent,
  COALESCE(order_stats.order_count, 0) AS order_count,
  order_stats.last_order_date,
  order_stats.first_order_date,
  order_stats.avg_order_value,
  order_stats.favorite_products,
  order_stats.product_categories,
  CASE 
    WHEN COALESCE(order_stats.total_spent, c.total_spent, 0) >= 1000 THEN 'VIP'
    WHEN COALESCE(order_stats.total_spent, c.total_spent, 0) >= 500 THEN 'Loyal'
    WHEN COALESCE(order_stats.total_spent, c.total_spent, 0) >= 100 THEN 'Regular'
    ELSE 'New'
  END AS loyalty_status,
  CASE 
    WHEN order_stats.last_order_date >= NOW() - INTERVAL '30 days' THEN 'Active'
    WHEN order_stats.last_order_date >= NOW() - INTERVAL '90 days' THEN 'At Risk'
    WHEN order_stats.last_order_date IS NOT NULL THEN 'Churned'
    ELSE 'Prospect'
  END AS customer_status
FROM crm_customers c
LEFT JOIN (
  SELECT 
    po.external_customer_id,
    SUM(po.total_amount) AS total_spent,
    COUNT(po.id) AS order_count,
    MAX(po.order_date) AS last_order_date,
    MIN(po.order_date) AS first_order_date,
    AVG(po.total_amount) AS avg_order_value,
    STRING_AGG(DISTINCT (item->>'name'), ', ') AS favorite_products,
    STRING_AGG(DISTINCT (item->>'category'), ', ') AS product_categories
  FROM pos_orders po
  CROSS JOIN LATERAL jsonb_array_elements(po.items) AS item
  GROUP BY po.external_customer_id
) order_stats ON order_stats.external_customer_id = c.email;

-- Create segments table for smart segmentation  
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query_json JSONB NOT NULL,
  count_cached INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_computed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for segments
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for segments
CREATE POLICY "Users can manage segments for their tenant" 
ON segments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = segments.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Create updated_at trigger for segments
CREATE OR REPLACE FUNCTION update_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW
  EXECUTE FUNCTION update_segments_updated_at();

-- Create customer timeline events table
CREATE TABLE IF NOT EXISTS customer_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'order', 'email_sent', 'sms_sent', 'coupon_redeemed', 'campaign_interaction'
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for customer timeline events
ALTER TABLE customer_timeline_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for customer timeline events
CREATE POLICY "Users can view timeline events for their tenant customers" 
ON customer_timeline_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_customers c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.id = customer_timeline_events.customer_id 
    AND u.id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_timeline_events_customer_date 
ON customer_timeline_events(customer_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_segments_tenant_active 
ON segments(tenant_id, is_active);

-- Grant necessary permissions
GRANT SELECT ON customer_360_enriched TO authenticated;
GRANT ALL ON segments TO authenticated;
GRANT ALL ON customer_timeline_events TO authenticated;