-- Create customer_purchase_metrics table for Purchase & Transaction Behavior Metrics
CREATE TABLE public.customer_purchase_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Core purchase metrics
  total_purchases INTEGER DEFAULT 0,
  first_purchase_date DATE,
  last_purchase_date DATE,
  
  -- Frequency & timing metrics
  purchase_frequency NUMERIC DEFAULT 0,
  avg_days_between_purchases NUMERIC,
  min_days_between_purchases INTEGER,
  max_days_between_purchases INTEGER,
  
  -- Value metrics
  average_order_value NUMERIC DEFAULT 0,
  lifetime_value NUMERIC DEFAULT 0,
  revenue_per_month NUMERIC DEFAULT 0,
  
  -- Purchase behavior
  repeat_purchase_rate NUMERIC DEFAULT 0,
  purchase_velocity NUMERIC DEFAULT 0,
  days_since_last_purchase INTEGER,
  
  -- Discount behavior
  total_discounted_purchases INTEGER DEFAULT 0,
  total_full_price_purchases INTEGER DEFAULT 0,
  discount_driven_ratio NUMERIC DEFAULT 0,
  total_discount_amount NUMERIC DEFAULT 0,
  
  -- Seasonal patterns
  seasonal_patterns JSONB DEFAULT '{}',
  peak_purchase_month TEXT,
  
  -- Product affinity
  product_category_affinity JSONB DEFAULT '{}',
  top_product_categories TEXT[],
  favorite_products TEXT[],
  
  -- Derived scores
  purchase_engagement_score NUMERIC DEFAULT 0,
  customer_tier TEXT DEFAULT 'new',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_customer_purchase_metrics_customer_id ON public.customer_purchase_metrics(customer_id);
CREATE INDEX idx_customer_purchase_metrics_tenant_id ON public.customer_purchase_metrics(tenant_id);
CREATE INDEX idx_customer_purchase_metrics_last_purchase ON public.customer_purchase_metrics(last_purchase_date);
CREATE INDEX idx_customer_purchase_metrics_tier ON public.customer_purchase_metrics(customer_tier);

-- Enable RLS
ALTER TABLE public.customer_purchase_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view purchase metrics for their tenant"
ON public.customer_purchase_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.tenant_id = customer_purchase_metrics.tenant_id
  )
);

CREATE POLICY "Users can insert purchase metrics for their tenant"
ON public.customer_purchase_metrics FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.tenant_id = customer_purchase_metrics.tenant_id
  )
);

CREATE POLICY "Users can update purchase metrics for their tenant"
ON public.customer_purchase_metrics FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.tenant_id = customer_purchase_metrics.tenant_id
  )
);

-- Service role bypass
CREATE POLICY "Service role full access to purchase metrics"
ON public.customer_purchase_metrics FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Updated at trigger
CREATE TRIGGER update_customer_purchase_metrics_updated_at
BEFORE UPDATE ON public.customer_purchase_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to recalculate all purchase metrics for a customer
CREATE OR REPLACE FUNCTION public.recalculate_purchase_metrics(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_total_purchases INTEGER;
  v_first_purchase DATE;
  v_last_purchase DATE;
  v_total_amount NUMERIC;
  v_avg_order_value NUMERIC;
  v_months_active NUMERIC;
  v_purchase_frequency NUMERIC;
  v_days_between_avg NUMERIC;
  v_days_between_min INTEGER;
  v_days_between_max INTEGER;
  v_days_since_last INTEGER;
  v_discounted_count INTEGER;
  v_full_price_count INTEGER;
  v_total_discount NUMERIC;
  v_seasonal JSONB;
  v_peak_month TEXT;
  v_category_affinity JSONB;
  v_top_categories TEXT[];
  v_favorite_products TEXT[];
  v_recent_90d_spend NUMERIC;
  v_prev_90d_spend NUMERIC;
  v_velocity NUMERIC;
  v_engagement_score NUMERIC;
  v_customer_tier TEXT;
BEGIN
  -- Get tenant_id from customer
  SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate core metrics from pos_orders
  SELECT 
    COUNT(*),
    MIN(order_date::date),
    MAX(order_date::date),
    COALESCE(SUM(total_amount), 0)
  INTO v_total_purchases, v_first_purchase, v_last_purchase, v_total_amount
  FROM pos_orders
  WHERE customer_id = p_customer_id;

  -- If no purchases, ensure record exists with defaults
  IF v_total_purchases = 0 OR v_total_purchases IS NULL THEN
    INSERT INTO customer_purchase_metrics (customer_id, tenant_id)
    VALUES (p_customer_id, v_tenant_id)
    ON CONFLICT (customer_id) DO NOTHING;
    RETURN;
  END IF;

  -- Average order value
  v_avg_order_value := ROUND(v_total_amount / NULLIF(v_total_purchases, 0), 2);

  -- Months active
  v_months_active := GREATEST(1, EXTRACT(EPOCH FROM (NOW() - v_first_purchase)) / (30.44 * 24 * 60 * 60));
  
  -- Purchase frequency (per month)
  v_purchase_frequency := ROUND(v_total_purchases / v_months_active, 2);

  -- Days since last purchase
  v_days_since_last := EXTRACT(DAY FROM NOW() - v_last_purchase)::INTEGER;

  -- Calculate time between purchases
  WITH purchase_gaps AS (
    SELECT 
      order_date,
      LAG(order_date) OVER (ORDER BY order_date) as prev_date
    FROM pos_orders
    WHERE customer_id = p_customer_id
  )
  SELECT 
    ROUND(AVG(EXTRACT(DAY FROM order_date - prev_date)), 1),
    MIN(EXTRACT(DAY FROM order_date - prev_date))::INTEGER,
    MAX(EXTRACT(DAY FROM order_date - prev_date))::INTEGER
  INTO v_days_between_avg, v_days_between_min, v_days_between_max
  FROM purchase_gaps
  WHERE prev_date IS NOT NULL;

  -- Discount behavior
  SELECT 
    COUNT(*) FILTER (WHERE COALESCE(discount_amount, 0) > 0),
    COUNT(*) FILTER (WHERE COALESCE(discount_amount, 0) = 0),
    COALESCE(SUM(discount_amount), 0)
  INTO v_discounted_count, v_full_price_count, v_total_discount
  FROM pos_orders
  WHERE customer_id = p_customer_id;

  -- Seasonal patterns (monthly distribution)
  SELECT jsonb_object_agg(month_name, cnt)
  INTO v_seasonal
  FROM (
    SELECT 
      TO_CHAR(order_date, 'Mon') as month_name,
      COUNT(*) as cnt
    FROM pos_orders
    WHERE customer_id = p_customer_id
    GROUP BY TO_CHAR(order_date, 'Mon'), EXTRACT(MONTH FROM order_date)
    ORDER BY EXTRACT(MONTH FROM order_date)
  ) monthly;

  -- Peak purchase month
  SELECT TO_CHAR(order_date, 'Month')
  INTO v_peak_month
  FROM pos_orders
  WHERE customer_id = p_customer_id
  GROUP BY TO_CHAR(order_date, 'Month'), EXTRACT(MONTH FROM order_date)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Product category affinity from items JSONB
  WITH item_categories AS (
    SELECT 
      COALESCE(item->>'category', item->>'name', 'Other') as category
    FROM pos_orders,
    jsonb_array_elements(COALESCE(items, '[]'::jsonb)) as item
    WHERE customer_id = p_customer_id
  )
  SELECT jsonb_object_agg(category, cnt)
  INTO v_category_affinity
  FROM (
    SELECT category, COUNT(*) as cnt
    FROM item_categories
    GROUP BY category
    ORDER BY cnt DESC
    LIMIT 10
  ) cats;

  -- Top product categories (top 3)
  SELECT ARRAY_AGG(category ORDER BY cnt DESC)
  INTO v_top_categories
  FROM (
    SELECT 
      COALESCE(item->>'category', 'Other') as category,
      COUNT(*) as cnt
    FROM pos_orders,
    jsonb_array_elements(COALESCE(items, '[]'::jsonb)) as item
    WHERE customer_id = p_customer_id
    GROUP BY category
    ORDER BY cnt DESC
    LIMIT 3
  ) top_cats;

  -- Favorite products (top 5)
  SELECT ARRAY_AGG(product_name ORDER BY cnt DESC)
  INTO v_favorite_products
  FROM (
    SELECT 
      item->>'name' as product_name,
      COUNT(*) as cnt
    FROM pos_orders,
    jsonb_array_elements(COALESCE(items, '[]'::jsonb)) as item
    WHERE customer_id = p_customer_id
    AND item->>'name' IS NOT NULL
    GROUP BY item->>'name'
    ORDER BY cnt DESC
    LIMIT 5
  ) top_prods;

  -- Purchase velocity (compare last 90 days vs previous 90 days)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_recent_90d_spend
  FROM pos_orders
  WHERE customer_id = p_customer_id
  AND order_date >= NOW() - INTERVAL '90 days';

  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_prev_90d_spend
  FROM pos_orders
  WHERE customer_id = p_customer_id
  AND order_date >= NOW() - INTERVAL '180 days'
  AND order_date < NOW() - INTERVAL '90 days';

  -- Velocity calculation (-100 to +100 scale)
  IF v_prev_90d_spend > 0 THEN
    v_velocity := ROUND(((v_recent_90d_spend - v_prev_90d_spend) / v_prev_90d_spend) * 100, 2);
    v_velocity := GREATEST(-100, LEAST(100, v_velocity));
  ELSIF v_recent_90d_spend > 0 THEN
    v_velocity := 100;
  ELSE
    v_velocity := 0;
  END IF;

  -- Calculate engagement score (0-100)
  -- Recency: 30%, Frequency: 25%, Monetary: 25%, Velocity: 10%, Loyalty: 10%
  v_engagement_score := 0;
  
  -- Recency score (30%): 0 days = 30, 365+ days = 0
  v_engagement_score := v_engagement_score + GREATEST(0, 30 - (v_days_since_last * 30.0 / 365));
  
  -- Frequency score (25%): based on purchases per month
  v_engagement_score := v_engagement_score + LEAST(25, v_purchase_frequency * 10);
  
  -- Monetary score (25%): based on LTV (assume $1000 = max score)
  v_engagement_score := v_engagement_score + LEAST(25, (v_total_amount / 1000) * 25);
  
  -- Velocity score (10%): positive velocity = bonus
  v_engagement_score := v_engagement_score + CASE 
    WHEN v_velocity > 50 THEN 10
    WHEN v_velocity > 0 THEN 5 + (v_velocity / 10)
    WHEN v_velocity > -50 THEN 5
    ELSE 0
  END;
  
  -- Loyalty score (10%): repeat purchase bonus
  IF v_total_purchases > 1 THEN
    v_engagement_score := v_engagement_score + LEAST(10, v_total_purchases);
  END IF;

  v_engagement_score := ROUND(LEAST(100, v_engagement_score), 1);

  -- Determine customer tier
  v_customer_tier := CASE
    WHEN v_engagement_score >= 80 THEN 'vip'
    WHEN v_engagement_score >= 60 THEN 'loyal'
    WHEN v_engagement_score >= 40 THEN 'regular'
    WHEN v_engagement_score >= 20 THEN 'occasional'
    ELSE 'new'
  END;

  -- Upsert the metrics
  INSERT INTO customer_purchase_metrics (
    customer_id, tenant_id,
    total_purchases, first_purchase_date, last_purchase_date,
    purchase_frequency, avg_days_between_purchases, min_days_between_purchases, max_days_between_purchases,
    average_order_value, lifetime_value, revenue_per_month,
    repeat_purchase_rate, purchase_velocity, days_since_last_purchase,
    total_discounted_purchases, total_full_price_purchases, discount_driven_ratio, total_discount_amount,
    seasonal_patterns, peak_purchase_month,
    product_category_affinity, top_product_categories, favorite_products,
    purchase_engagement_score, customer_tier
  ) VALUES (
    p_customer_id, v_tenant_id,
    v_total_purchases, v_first_purchase, v_last_purchase,
    v_purchase_frequency, v_days_between_avg, v_days_between_min, v_days_between_max,
    v_avg_order_value, v_total_amount, ROUND(v_total_amount / v_months_active, 2),
    CASE WHEN v_total_purchases > 1 THEN ROUND((v_total_purchases - 1)::NUMERIC / v_total_purchases * 100, 1) ELSE 0 END,
    v_velocity, v_days_since_last,
    v_discounted_count, v_full_price_count,
    ROUND(v_discounted_count::NUMERIC / NULLIF(v_total_purchases, 0) * 100, 1),
    v_total_discount,
    COALESCE(v_seasonal, '{}'),
    TRIM(v_peak_month),
    COALESCE(v_category_affinity, '{}'),
    COALESCE(v_top_categories, ARRAY[]::TEXT[]),
    COALESCE(v_favorite_products, ARRAY[]::TEXT[]),
    v_engagement_score, v_customer_tier
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    total_purchases = EXCLUDED.total_purchases,
    first_purchase_date = EXCLUDED.first_purchase_date,
    last_purchase_date = EXCLUDED.last_purchase_date,
    purchase_frequency = EXCLUDED.purchase_frequency,
    avg_days_between_purchases = EXCLUDED.avg_days_between_purchases,
    min_days_between_purchases = EXCLUDED.min_days_between_purchases,
    max_days_between_purchases = EXCLUDED.max_days_between_purchases,
    average_order_value = EXCLUDED.average_order_value,
    lifetime_value = EXCLUDED.lifetime_value,
    revenue_per_month = EXCLUDED.revenue_per_month,
    repeat_purchase_rate = EXCLUDED.repeat_purchase_rate,
    purchase_velocity = EXCLUDED.purchase_velocity,
    days_since_last_purchase = EXCLUDED.days_since_last_purchase,
    total_discounted_purchases = EXCLUDED.total_discounted_purchases,
    total_full_price_purchases = EXCLUDED.total_full_price_purchases,
    discount_driven_ratio = EXCLUDED.discount_driven_ratio,
    total_discount_amount = EXCLUDED.total_discount_amount,
    seasonal_patterns = EXCLUDED.seasonal_patterns,
    peak_purchase_month = EXCLUDED.peak_purchase_month,
    product_category_affinity = EXCLUDED.product_category_affinity,
    top_product_categories = EXCLUDED.top_product_categories,
    favorite_products = EXCLUDED.favorite_products,
    purchase_engagement_score = EXCLUDED.purchase_engagement_score,
    customer_tier = EXCLUDED.customer_tier,
    updated_at = NOW();

  -- Also update customer_engagement_summary with purchase score
  UPDATE customer_engagement_summary
  SET purchase_score = v_engagement_score,
      updated_at = NOW()
  WHERE customer_id = p_customer_id;
END;
$$;

-- Function to update purchase metrics after a purchase event
CREATE OR REPLACE FUNCTION public.update_customer_purchase_metrics(
  p_customer_id UUID,
  p_order_id UUID DEFAULT NULL,
  p_event_type TEXT DEFAULT 'purchase'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simply delegate to the full recalculation
  PERFORM recalculate_purchase_metrics(p_customer_id);
END;
$$;

-- Batch function to refresh all purchase metrics
CREATE OR REPLACE FUNCTION public.refresh_all_purchase_metrics(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_customer IN 
    SELECT DISTINCT c.id
    FROM crm_customers c
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND EXISTS (SELECT 1 FROM pos_orders o WHERE o.customer_id = c.id)
  LOOP
    PERFORM recalculate_purchase_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.recalculate_purchase_metrics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_customer_purchase_metrics(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_purchase_metrics(UUID) TO authenticated, service_role;