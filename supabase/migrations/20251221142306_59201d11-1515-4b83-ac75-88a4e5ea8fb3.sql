-- =====================================================
-- Loyalty & Perks Program Behavior Metrics
-- =====================================================

-- 1. Create customer_loyalty_metrics table
CREATE TABLE public.customer_loyalty_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Enrollment & Timing
  is_perks_member BOOLEAN DEFAULT FALSE,
  perks_enrolled_at TIMESTAMPTZ,
  customer_created_at TIMESTAMPTZ,
  time_to_join_perks_days INTEGER,
  
  -- Points Activity
  total_points_earned INTEGER DEFAULT 0,
  total_points_redeemed INTEGER DEFAULT 0,
  current_points_balance INTEGER DEFAULT 0,
  non_redeemed_points_ratio NUMERIC DEFAULT 0,
  
  -- Redemption Behavior
  total_redemptions INTEGER DEFAULT 0,
  redemption_frequency NUMERIC DEFAULT 0,
  avg_redemption_delay_days NUMERIC,
  min_redemption_delay_days INTEGER,
  max_redemption_delay_days INTEGER,
  last_redemption_at TIMESTAMPTZ,
  
  -- Revenue Attribution
  total_perks_driven_revenue NUMERIC DEFAULT 0,
  total_non_perks_revenue NUMERIC DEFAULT 0,
  perks_revenue_percentage NUMERIC DEFAULT 0,
  avg_order_value_with_perks NUMERIC,
  avg_order_value_without_perks NUMERIC,
  
  -- Tier Progression
  current_loyalty_tier TEXT DEFAULT 'bronze',
  previous_loyalty_tier TEXT,
  tier_upgraded_at TIMESTAMPTZ,
  tier_progression_speed_days INTEGER,
  tier_upgrade_count INTEGER DEFAULT 0,
  
  -- Engagement Comparison
  member_engagement_score NUMERIC DEFAULT 0,
  member_email_open_rate NUMERIC,
  member_sms_click_rate NUMERIC,
  member_purchase_frequency NUMERIC,
  
  -- Aggregate Scores
  loyalty_engagement_score NUMERIC DEFAULT 0,
  loyalty_risk_score NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create loyalty_points_transactions table
CREATE TABLE public.loyalty_points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
  points_amount INTEGER NOT NULL,
  points_balance_after INTEGER,
  
  source_type TEXT NOT NULL,
  source_id UUID,
  order_id UUID,
  order_total NUMERIC,
  
  redemption_value NUMERIC,
  description TEXT,
  external_transaction_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create perks_enrollment_events table
CREATE TABLE public.perks_enrollment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL CHECK (event_type IN ('enrolled', 'tier_upgraded', 'tier_downgraded', 'cancelled')),
  previous_tier TEXT,
  new_tier TEXT,
  enrollment_source TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.customer_loyalty_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perks_enrollment_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for customer_loyalty_metrics (using users table pattern)
CREATE POLICY "Users can view loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete loyalty metrics for their tenant"
  ON public.customer_loyalty_metrics FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 6. RLS Policies for loyalty_points_transactions
CREATE POLICY "Users can view points transactions for their tenant"
  ON public.loyalty_points_transactions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert points transactions for their tenant"
  ON public.loyalty_points_transactions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 7. RLS Policies for perks_enrollment_events
CREATE POLICY "Users can view enrollment events for their tenant"
  ON public.perks_enrollment_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert enrollment events for their tenant"
  ON public.perks_enrollment_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 8. Indexes
CREATE INDEX idx_loyalty_metrics_customer_id ON public.customer_loyalty_metrics(customer_id);
CREATE INDEX idx_loyalty_metrics_tenant_id ON public.customer_loyalty_metrics(tenant_id);
CREATE INDEX idx_loyalty_metrics_is_member ON public.customer_loyalty_metrics(is_perks_member);
CREATE INDEX idx_loyalty_metrics_tier ON public.customer_loyalty_metrics(current_loyalty_tier);

CREATE INDEX idx_points_transactions_customer_id ON public.loyalty_points_transactions(customer_id);
CREATE INDEX idx_points_transactions_tenant_id ON public.loyalty_points_transactions(tenant_id);
CREATE INDEX idx_points_transactions_type ON public.loyalty_points_transactions(transaction_type);
CREATE INDEX idx_points_transactions_created_at ON public.loyalty_points_transactions(created_at DESC);

CREATE INDEX idx_enrollment_events_customer_id ON public.perks_enrollment_events(customer_id);
CREATE INDEX idx_enrollment_events_tenant_id ON public.perks_enrollment_events(tenant_id);

-- 9. Updated_at trigger for customer_loyalty_metrics
CREATE TRIGGER update_customer_loyalty_metrics_updated_at
  BEFORE UPDATE ON public.customer_loyalty_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SQL FUNCTIONS
-- =====================================================

-- 10. Track Loyalty Enrollment
CREATE OR REPLACE FUNCTION public.track_loyalty_enrollment(
  p_customer_id UUID,
  p_tenant_id UUID,
  p_enrollment_source TEXT DEFAULT 'signup'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_created_at TIMESTAMPTZ;
  v_time_to_join INTEGER;
  v_event_id UUID;
BEGIN
  SELECT created_at INTO v_customer_created_at
  FROM crm_customers
  WHERE id = p_customer_id;
  
  v_time_to_join := EXTRACT(DAY FROM (NOW() - COALESCE(v_customer_created_at, NOW())));
  
  INSERT INTO customer_loyalty_metrics (
    customer_id, tenant_id, is_perks_member, perks_enrolled_at,
    customer_created_at, time_to_join_perks_days, current_loyalty_tier
  )
  VALUES (
    p_customer_id, p_tenant_id, TRUE, NOW(),
    v_customer_created_at, v_time_to_join, 'bronze'
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    is_perks_member = TRUE,
    perks_enrolled_at = COALESCE(customer_loyalty_metrics.perks_enrolled_at, NOW()),
    time_to_join_perks_days = COALESCE(customer_loyalty_metrics.time_to_join_perks_days, v_time_to_join),
    updated_at = NOW();
  
  INSERT INTO perks_enrollment_events (
    tenant_id, customer_id, event_type, new_tier, enrollment_source
  )
  VALUES (p_tenant_id, p_customer_id, 'enrolled', 'bronze', p_enrollment_source)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- 11. Track Points Earned
CREATE OR REPLACE FUNCTION public.track_points_earned(
  p_customer_id UUID,
  p_tenant_id UUID,
  p_points INTEGER,
  p_source_type TEXT,
  p_source_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_total_earned INTEGER;
  v_transaction_id UUID;
BEGIN
  SELECT COALESCE(current_points_balance, 0), COALESCE(total_points_earned, 0)
  INTO v_current_balance, v_total_earned
  FROM customer_loyalty_metrics
  WHERE customer_id = p_customer_id;
  
  v_new_balance := COALESCE(v_current_balance, 0) + p_points;
  v_total_earned := COALESCE(v_total_earned, 0) + p_points;
  
  INSERT INTO loyalty_points_transactions (
    tenant_id, customer_id, transaction_type, points_amount,
    points_balance_after, source_type, source_id, order_id, description
  )
  VALUES (
    p_tenant_id, p_customer_id, 'earn', p_points,
    v_new_balance, p_source_type, p_source_id, p_order_id, p_description
  )
  RETURNING id INTO v_transaction_id;
  
  INSERT INTO customer_loyalty_metrics (customer_id, tenant_id, total_points_earned, current_points_balance)
  VALUES (p_customer_id, p_tenant_id, p_points, v_new_balance)
  ON CONFLICT (customer_id) DO UPDATE SET
    total_points_earned = customer_loyalty_metrics.total_points_earned + p_points,
    current_points_balance = v_new_balance,
    non_redeemed_points_ratio = CASE 
      WHEN (customer_loyalty_metrics.total_points_earned + p_points) > 0 
      THEN (v_new_balance::NUMERIC / (customer_loyalty_metrics.total_points_earned + p_points)) * 100
      ELSE 0 
    END,
    updated_at = NOW();
  
  RETURN v_transaction_id;
END;
$$;

-- 12. Track Points Redeemed
CREATE OR REPLACE FUNCTION public.track_points_redeemed(
  p_customer_id UUID,
  p_tenant_id UUID,
  p_points INTEGER,
  p_order_id UUID DEFAULT NULL,
  p_order_total NUMERIC DEFAULT NULL,
  p_redemption_value NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_last_earn_at TIMESTAMPTZ;
  v_redemption_delay INTEGER;
  v_transaction_id UUID;
  v_total_redemptions INTEGER;
  v_current_avg_delay NUMERIC;
BEGIN
  SELECT 
    COALESCE(current_points_balance, 0),
    COALESCE(total_redemptions, 0),
    avg_redemption_delay_days
  INTO v_current_balance, v_total_redemptions, v_current_avg_delay
  FROM customer_loyalty_metrics
  WHERE customer_id = p_customer_id;
  
  v_new_balance := GREATEST(0, COALESCE(v_current_balance, 0) - p_points);
  
  SELECT created_at INTO v_last_earn_at
  FROM loyalty_points_transactions
  WHERE customer_id = p_customer_id AND transaction_type = 'earn'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_last_earn_at IS NOT NULL THEN
    v_redemption_delay := EXTRACT(DAY FROM (NOW() - v_last_earn_at));
  END IF;
  
  INSERT INTO loyalty_points_transactions (
    tenant_id, customer_id, transaction_type, points_amount,
    points_balance_after, source_type, order_id, order_total, 
    redemption_value, description
  )
  VALUES (
    p_tenant_id, p_customer_id, 'redeem', -p_points,
    v_new_balance, 'redemption', p_order_id, p_order_total,
    p_redemption_value, p_description
  )
  RETURNING id INTO v_transaction_id;
  
  IF v_current_avg_delay IS NOT NULL AND v_redemption_delay IS NOT NULL THEN
    v_current_avg_delay := ((v_current_avg_delay * v_total_redemptions) + v_redemption_delay) / (v_total_redemptions + 1);
  ELSE
    v_current_avg_delay := v_redemption_delay;
  END IF;
  
  UPDATE customer_loyalty_metrics SET
    total_points_redeemed = total_points_redeemed + p_points,
    current_points_balance = v_new_balance,
    total_redemptions = total_redemptions + 1,
    last_redemption_at = NOW(),
    avg_redemption_delay_days = v_current_avg_delay,
    min_redemption_delay_days = LEAST(COALESCE(min_redemption_delay_days, v_redemption_delay), v_redemption_delay),
    max_redemption_delay_days = GREATEST(COALESCE(max_redemption_delay_days, v_redemption_delay), v_redemption_delay),
    total_perks_driven_revenue = total_perks_driven_revenue + COALESCE(p_order_total, 0),
    non_redeemed_points_ratio = CASE 
      WHEN total_points_earned > 0 
      THEN (v_new_balance::NUMERIC / total_points_earned) * 100
      ELSE 0 
    END,
    redemption_frequency = CASE
      WHEN perks_enrolled_at IS NOT NULL AND perks_enrolled_at < NOW() 
      THEN (total_redemptions + 1)::NUMERIC / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - perks_enrolled_at)) / 2592000)
      ELSE total_redemptions + 1
    END,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;
  
  RETURN v_transaction_id;
END;
$$;

-- 13. Update Loyalty Tier
CREATE OR REPLACE FUNCTION public.update_loyalty_tier(
  p_customer_id UUID,
  p_tenant_id UUID,
  p_new_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tier TEXT;
  v_enrolled_at TIMESTAMPTZ;
  v_progression_speed INTEGER;
  v_event_type TEXT;
BEGIN
  SELECT current_loyalty_tier, perks_enrolled_at
  INTO v_current_tier, v_enrolled_at
  FROM customer_loyalty_metrics
  WHERE customer_id = p_customer_id;
  
  IF v_current_tier = p_new_tier THEN
    RETURN;
  END IF;
  
  IF v_enrolled_at IS NOT NULL THEN
    v_progression_speed := EXTRACT(DAY FROM (NOW() - v_enrolled_at));
  END IF;
  
  v_event_type := CASE
    WHEN p_new_tier IN ('platinum', 'gold', 'silver') AND v_current_tier IN ('bronze', 'silver', 'gold') THEN 'tier_upgraded'
    ELSE 'tier_downgraded'
  END;
  
  INSERT INTO perks_enrollment_events (
    tenant_id, customer_id, event_type, previous_tier, new_tier
  )
  VALUES (p_tenant_id, p_customer_id, v_event_type, v_current_tier, p_new_tier);
  
  UPDATE customer_loyalty_metrics SET
    previous_loyalty_tier = current_loyalty_tier,
    current_loyalty_tier = p_new_tier,
    tier_upgraded_at = CASE WHEN v_event_type = 'tier_upgraded' THEN NOW() ELSE tier_upgraded_at END,
    tier_progression_speed_days = CASE WHEN v_event_type = 'tier_upgraded' THEN v_progression_speed ELSE tier_progression_speed_days END,
    tier_upgrade_count = CASE WHEN v_event_type = 'tier_upgraded' THEN tier_upgrade_count + 1 ELSE tier_upgrade_count END,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;
END;
$$;

-- 14. Recalculate Loyalty Metrics
CREATE OR REPLACE FUNCTION public.recalculate_loyalty_metrics(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_total_earned INTEGER;
  v_total_redeemed INTEGER;
  v_current_balance INTEGER;
  v_total_redemptions INTEGER;
  v_perks_revenue NUMERIC;
  v_enrolled_at TIMESTAMPTZ;
  v_months_since_enrollment NUMERIC;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM customer_loyalty_metrics
  WHERE customer_id = p_customer_id;
  
  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM crm_customers
    WHERE id = p_customer_id;
  END IF;
  
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'earn' THEN points_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'redeem' THEN ABS(points_amount) ELSE 0 END), 0),
    COALESCE(COUNT(CASE WHEN transaction_type = 'redeem' THEN 1 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'redeem' THEN order_total ELSE 0 END), 0)
  INTO v_total_earned, v_total_redeemed, v_total_redemptions, v_perks_revenue
  FROM loyalty_points_transactions
  WHERE customer_id = p_customer_id;
  
  v_current_balance := v_total_earned - v_total_redeemed;
  
  SELECT perks_enrolled_at INTO v_enrolled_at
  FROM customer_loyalty_metrics
  WHERE customer_id = p_customer_id;
  
  IF v_enrolled_at IS NOT NULL THEN
    v_months_since_enrollment := GREATEST(1, EXTRACT(EPOCH FROM (NOW() - v_enrolled_at)) / 2592000);
  ELSE
    v_months_since_enrollment := 1;
  END IF;
  
  UPDATE customer_loyalty_metrics SET
    total_points_earned = v_total_earned,
    total_points_redeemed = v_total_redeemed,
    current_points_balance = v_current_balance,
    total_redemptions = v_total_redemptions,
    total_perks_driven_revenue = v_perks_revenue,
    non_redeemed_points_ratio = CASE 
      WHEN v_total_earned > 0 THEN (v_current_balance::NUMERIC / v_total_earned) * 100
      ELSE 0 
    END,
    redemption_frequency = v_total_redemptions::NUMERIC / v_months_since_enrollment,
    perks_revenue_percentage = CASE
      WHEN (v_perks_revenue + COALESCE(total_non_perks_revenue, 0)) > 0 
      THEN (v_perks_revenue / (v_perks_revenue + COALESCE(total_non_perks_revenue, 0))) * 100
      ELSE 0
    END,
    loyalty_engagement_score = LEAST(100, (
      (CASE WHEN is_perks_member THEN 20 ELSE 0 END) +
      (LEAST(30, (v_total_redeemed::NUMERIC / GREATEST(1, v_total_earned)) * 30)) +
      (LEAST(25, v_total_redemptions * 5)) +
      (LEAST(25, (v_perks_revenue / 100)))
    )),
    loyalty_risk_score = CASE
      WHEN v_current_balance > 500 AND last_redemption_at < NOW() - INTERVAL '90 days' THEN 80
      WHEN v_current_balance > 200 AND last_redemption_at < NOW() - INTERVAL '60 days' THEN 50
      WHEN v_current_balance > 100 AND last_redemption_at < NOW() - INTERVAL '30 days' THEN 30
      ELSE 10
    END,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;
END;
$$;

-- 15. Calculate Tenant Perks Enrollment Rate
CREATE OR REPLACE FUNCTION public.calculate_tenant_perks_enrollment_rate(p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_customers INTEGER;
  v_enrolled_customers INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_customers
  FROM crm_customers
  WHERE tenant_id = p_tenant_id;
  
  SELECT COUNT(*) INTO v_enrolled_customers
  FROM customer_loyalty_metrics
  WHERE tenant_id = p_tenant_id AND is_perks_member = TRUE;
  
  IF v_total_customers = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (v_enrolled_customers::NUMERIC / v_total_customers) * 100;
END;
$$;

-- 16. Refresh All Loyalty Metrics
CREATE OR REPLACE FUNCTION public.refresh_all_loyalty_metrics(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_customer_id IN 
    SELECT customer_id FROM customer_loyalty_metrics WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_loyalty_metrics(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;