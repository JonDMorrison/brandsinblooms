-- ============================================
-- POST-PURCHASE BEHAVIOR METRICS SCHEMA
-- ============================================

-- 1. Create customer_post_purchase_metrics table
CREATE TABLE public.customer_post_purchase_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Post-purchase email engagement
  post_purchase_emails_sent INTEGER DEFAULT 0,
  post_purchase_emails_opened INTEGER DEFAULT 0,
  post_purchase_emails_clicked INTEGER DEFAULT 0,
  post_purchase_email_open_rate NUMERIC DEFAULT 0,
  post_purchase_email_ctr NUMERIC DEFAULT 0,
  
  -- Post-purchase SMS engagement
  post_purchase_sms_sent INTEGER DEFAULT 0,
  post_purchase_sms_delivered INTEGER DEFAULT 0,
  post_purchase_sms_clicked INTEGER DEFAULT 0,
  post_purchase_follow_up_ctr NUMERIC DEFAULT 0,
  
  -- Time to next purchase
  avg_time_to_next_purchase_days NUMERIC,
  min_time_to_next_purchase_days INTEGER,
  max_time_to_next_purchase_days INTEGER,
  last_time_to_next_purchase_days INTEGER,
  
  -- Incentive & Coupon metrics
  total_incentives_offered INTEGER DEFAULT 0,
  total_incentives_redeemed INTEGER DEFAULT 0,
  incentive_redemption_rate NUMERIC DEFAULT 0,
  total_coupon_value_redeemed NUMERIC DEFAULT 0,
  unique_coupons_used INTEGER DEFAULT 0,
  coupon_usage_frequency NUMERIC DEFAULT 0,
  
  -- Incentive dependency
  purchases_with_incentive INTEGER DEFAULT 0,
  purchases_without_incentive INTEGER DEFAULT 0,
  incentive_dependency_score NUMERIC DEFAULT 0,
  
  -- Automation attribution
  total_automation_messages INTEGER DEFAULT 0,
  purchases_after_automation INTEGER DEFAULT 0,
  automation_conversion_rate NUMERIC DEFAULT 0,
  last_automation_purchase_at TIMESTAMPTZ,
  
  -- Drop-off analysis
  incentives_expired_unused INTEGER DEFAULT 0,
  drop_off_after_incentive_rate NUMERIC DEFAULT 0,
  days_since_last_incentive_redemption INTEGER,
  
  -- Aggregate scores
  post_purchase_engagement_score NUMERIC DEFAULT 0,
  incentive_effectiveness_score NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create incentive_tracking table
CREATE TABLE public.incentive_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  
  -- Incentive details
  incentive_type TEXT NOT NULL,
  code TEXT,
  value NUMERIC,
  value_type TEXT,
  
  -- Source tracking
  source_type TEXT NOT NULL,
  source_id UUID,
  automation_id UUID REFERENCES crm_automations(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  
  -- Timing
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  
  -- Redemption details
  redemption_order_id UUID,
  redemption_amount NUMERIC,
  order_total NUMERIC,
  
  -- Status
  status TEXT DEFAULT 'sent',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.customer_post_purchase_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_tracking ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for customer_post_purchase_metrics
CREATE POLICY "Users can view post-purchase metrics for their tenant" 
ON public.customer_post_purchase_metrics FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert post-purchase metrics for their tenant" 
ON public.customer_post_purchase_metrics FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update post-purchase metrics for their tenant" 
ON public.customer_post_purchase_metrics FOR UPDATE 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete post-purchase metrics for their tenant" 
ON public.customer_post_purchase_metrics FOR DELETE 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- 5. RLS Policies for incentive_tracking
CREATE POLICY "Users can view incentives for their tenant" 
ON public.incentive_tracking FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert incentives for their tenant" 
ON public.incentive_tracking FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update incentives for their tenant" 
ON public.incentive_tracking FOR UPDATE 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete incentives for their tenant" 
ON public.incentive_tracking FOR DELETE 
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- 6. Indexes
CREATE INDEX idx_post_purchase_metrics_customer ON public.customer_post_purchase_metrics(customer_id);
CREATE INDEX idx_post_purchase_metrics_tenant ON public.customer_post_purchase_metrics(tenant_id);
CREATE INDEX idx_incentive_tracking_customer ON public.incentive_tracking(customer_id);
CREATE INDEX idx_incentive_tracking_tenant ON public.incentive_tracking(tenant_id);
CREATE INDEX idx_incentive_tracking_status ON public.incentive_tracking(status);
CREATE INDEX idx_incentive_tracking_expires ON public.incentive_tracking(expires_at) WHERE status = 'sent';
CREATE INDEX idx_incentive_tracking_code ON public.incentive_tracking(code) WHERE code IS NOT NULL;

-- 7. Updated_at triggers
CREATE TRIGGER update_customer_post_purchase_metrics_updated_at
  BEFORE UPDATE ON public.customer_post_purchase_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incentive_tracking_updated_at
  BEFORE UPDATE ON public.incentive_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Track incentive sent function
CREATE OR REPLACE FUNCTION public.track_incentive_sent(
  p_customer_id UUID,
  p_tenant_id UUID,
  p_code TEXT DEFAULT NULL,
  p_value NUMERIC DEFAULT NULL,
  p_value_type TEXT DEFAULT 'fixed',
  p_incentive_type TEXT DEFAULT 'coupon',
  p_source_type TEXT DEFAULT 'automation',
  p_source_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incentive_id UUID;
BEGIN
  -- Insert incentive tracking record
  INSERT INTO public.incentive_tracking (
    customer_id, tenant_id, code, value, value_type, incentive_type,
    source_type, source_id, automation_id, campaign_id, expires_at, status
  ) VALUES (
    p_customer_id, p_tenant_id, p_code, p_value, p_value_type, p_incentive_type,
    p_source_type, p_source_id,
    CASE WHEN p_source_type = 'automation' THEN p_source_id ELSE NULL END,
    CASE WHEN p_source_type = 'campaign' THEN p_source_id ELSE NULL END,
    p_expires_at, 'sent'
  )
  RETURNING id INTO v_incentive_id;

  -- Update or insert post-purchase metrics
  INSERT INTO public.customer_post_purchase_metrics (customer_id, tenant_id, total_incentives_offered)
  VALUES (p_customer_id, p_tenant_id, 1)
  ON CONFLICT (customer_id) DO UPDATE SET
    total_incentives_offered = customer_post_purchase_metrics.total_incentives_offered + 1,
    updated_at = NOW();

  RETURN v_incentive_id;
END;
$$;

-- 9. Track incentive redeemed function
CREATE OR REPLACE FUNCTION public.track_incentive_redeemed(
  p_customer_id UUID,
  p_code TEXT,
  p_order_id UUID DEFAULT NULL,
  p_order_total NUMERIC DEFAULT NULL,
  p_discount_applied NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_incentive_record RECORD;
BEGIN
  -- Find the incentive by code and customer
  SELECT * INTO v_incentive_record
  FROM public.incentive_tracking
  WHERE customer_id = p_customer_id
    AND code = p_code
    AND status = 'sent'
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_incentive_record IS NULL THEN
    -- No matching incentive found, still track the redemption
    SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
    
    INSERT INTO public.customer_post_purchase_metrics (customer_id, tenant_id, total_incentives_redeemed, purchases_with_incentive)
    VALUES (p_customer_id, v_tenant_id, 1, 1)
    ON CONFLICT (customer_id) DO UPDATE SET
      total_incentives_redeemed = customer_post_purchase_metrics.total_incentives_redeemed + 1,
      purchases_with_incentive = customer_post_purchase_metrics.purchases_with_incentive + 1,
      days_since_last_incentive_redemption = 0,
      updated_at = NOW();
    
    RETURN TRUE;
  END IF;

  -- Update incentive record
  UPDATE public.incentive_tracking SET
    status = 'redeemed',
    redeemed_at = NOW(),
    redemption_order_id = p_order_id,
    redemption_amount = p_discount_applied,
    order_total = p_order_total
  WHERE id = v_incentive_record.id;

  -- Update post-purchase metrics
  UPDATE public.customer_post_purchase_metrics SET
    total_incentives_redeemed = total_incentives_redeemed + 1,
    total_coupon_value_redeemed = total_coupon_value_redeemed + COALESCE(p_discount_applied, 0),
    purchases_with_incentive = purchases_with_incentive + 1,
    days_since_last_incentive_redemption = 0,
    incentive_redemption_rate = CASE 
      WHEN total_incentives_offered > 0 
      THEN ((total_incentives_redeemed + 1)::NUMERIC / total_incentives_offered) * 100 
      ELSE 0 
    END,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;

  RETURN TRUE;
END;
$$;

-- 10. Mark expired incentives function
CREATE OR REPLACE FUNCTION public.mark_expired_incentives()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Find and mark expired incentives
  FOR v_record IN 
    SELECT id, customer_id
    FROM public.incentive_tracking
    WHERE status = 'sent'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  LOOP
    -- Update incentive status
    UPDATE public.incentive_tracking SET status = 'expired' WHERE id = v_record.id;
    
    -- Update customer metrics
    UPDATE public.customer_post_purchase_metrics SET
      incentives_expired_unused = incentives_expired_unused + 1,
      drop_off_after_incentive_rate = CASE 
        WHEN total_incentives_offered > 0 
        THEN ((incentives_expired_unused + 1)::NUMERIC / total_incentives_offered) * 100 
        ELSE 0 
      END,
      updated_at = NOW()
    WHERE customer_id = v_record.customer_id;
    
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- 11. Recalculate post-purchase metrics function
CREATE OR REPLACE FUNCTION public.recalculate_post_purchase_metrics(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_total_purchases INTEGER;
  v_purchase_intervals NUMERIC[];
  v_avg_interval NUMERIC;
  v_min_interval INTEGER;
  v_max_interval INTEGER;
  v_automation_msgs INTEGER;
  v_purchases_after_auto INTEGER;
  v_engagement_score NUMERIC;
  v_incentive_effectiveness NUMERIC;
BEGIN
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
  IF v_tenant_id IS NULL THEN RETURN FALSE; END IF;

  -- Calculate time between purchases
  WITH ordered_purchases AS (
    SELECT order_date, 
           LAG(order_date) OVER (ORDER BY order_date) as prev_date
    FROM pos_orders
    WHERE pos_customer_id IN (
      SELECT clover_customer_id FROM crm_customers WHERE id = p_customer_id
      UNION
      SELECT square_customer_id FROM crm_customers WHERE id = p_customer_id
    )
    ORDER BY order_date
  ),
  intervals AS (
    SELECT EXTRACT(EPOCH FROM (order_date - prev_date)) / 86400 as days_diff
    FROM ordered_purchases
    WHERE prev_date IS NOT NULL
  )
  SELECT 
    AVG(days_diff),
    MIN(days_diff)::INTEGER,
    MAX(days_diff)::INTEGER
  INTO v_avg_interval, v_min_interval, v_max_interval
  FROM intervals;

  -- Count automation messages and conversions
  SELECT COUNT(*) INTO v_automation_msgs
  FROM crm_automation_logs
  WHERE customer_id = p_customer_id;

  -- Count purchases within 7 days of automation message
  SELECT COUNT(DISTINCT po.id) INTO v_purchases_after_auto
  FROM pos_orders po
  JOIN crm_customers c ON (po.pos_customer_id = c.clover_customer_id OR po.pos_customer_id = c.square_customer_id)
  WHERE c.id = p_customer_id
    AND EXISTS (
      SELECT 1 FROM crm_automation_logs al
      WHERE al.customer_id = p_customer_id
        AND al.sent_at IS NOT NULL
        AND po.order_date BETWEEN al.sent_at AND al.sent_at + INTERVAL '7 days'
    );

  -- Get total purchases
  SELECT COUNT(*) INTO v_total_purchases
  FROM pos_orders
  WHERE pos_customer_id IN (
    SELECT clover_customer_id FROM crm_customers WHERE id = p_customer_id
    UNION
    SELECT square_customer_id FROM crm_customers WHERE id = p_customer_id
  );

  -- Upsert the metrics
  INSERT INTO public.customer_post_purchase_metrics (
    customer_id, tenant_id,
    avg_time_to_next_purchase_days, min_time_to_next_purchase_days, max_time_to_next_purchase_days,
    total_automation_messages, purchases_after_automation, automation_conversion_rate,
    purchases_without_incentive
  ) VALUES (
    p_customer_id, v_tenant_id,
    v_avg_interval, v_min_interval, v_max_interval,
    v_automation_msgs, v_purchases_after_auto,
    CASE WHEN v_automation_msgs > 0 THEN (v_purchases_after_auto::NUMERIC / v_automation_msgs) * 100 ELSE 0 END,
    v_total_purchases
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    avg_time_to_next_purchase_days = EXCLUDED.avg_time_to_next_purchase_days,
    min_time_to_next_purchase_days = EXCLUDED.min_time_to_next_purchase_days,
    max_time_to_next_purchase_days = EXCLUDED.max_time_to_next_purchase_days,
    total_automation_messages = EXCLUDED.total_automation_messages,
    purchases_after_automation = EXCLUDED.purchases_after_automation,
    automation_conversion_rate = EXCLUDED.automation_conversion_rate,
    purchases_without_incentive = GREATEST(0, v_total_purchases - customer_post_purchase_metrics.purchases_with_incentive),
    incentive_dependency_score = CASE 
      WHEN v_total_purchases > 0 
      THEN (customer_post_purchase_metrics.purchases_with_incentive::NUMERIC / v_total_purchases) * 100 
      ELSE 0 
    END,
    coupon_usage_frequency = CASE 
      WHEN v_total_purchases > 0 
      THEN customer_post_purchase_metrics.unique_coupons_used::NUMERIC / v_total_purchases 
      ELSE 0 
    END,
    updated_at = NOW();

  -- Calculate and update engagement scores
  SELECT 
    -- Post-purchase engagement score (weighted)
    (COALESCE(post_purchase_email_open_rate, 0) * 0.3 +
     COALESCE(incentive_redemption_rate, 0) * 0.2 +
     COALESCE(automation_conversion_rate, 0) * 0.25 +
     CASE WHEN avg_time_to_next_purchase_days IS NOT NULL AND avg_time_to_next_purchase_days < 30 THEN 25 
          WHEN avg_time_to_next_purchase_days IS NOT NULL AND avg_time_to_next_purchase_days < 60 THEN 15
          WHEN avg_time_to_next_purchase_days IS NOT NULL THEN 5
          ELSE 0 END),
    -- Incentive effectiveness score
    (COALESCE(incentive_redemption_rate, 0) * 0.4 +
     (100 - COALESCE(drop_off_after_incentive_rate, 0)) * 0.3 +
     COALESCE(automation_conversion_rate, 0) * 0.3)
  INTO v_engagement_score, v_incentive_effectiveness
  FROM customer_post_purchase_metrics
  WHERE customer_id = p_customer_id;

  UPDATE customer_post_purchase_metrics SET
    post_purchase_engagement_score = LEAST(100, GREATEST(0, v_engagement_score)),
    incentive_effectiveness_score = LEAST(100, GREATEST(0, v_incentive_effectiveness))
  WHERE customer_id = p_customer_id;

  RETURN TRUE;
END;
$$;

-- 12. Refresh all post-purchase metrics for a tenant
CREATE OR REPLACE FUNCTION public.refresh_all_post_purchase_metrics(p_tenant_id UUID DEFAULT NULL)
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
    SELECT id FROM crm_customers 
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  LOOP
    PERFORM recalculate_post_purchase_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;