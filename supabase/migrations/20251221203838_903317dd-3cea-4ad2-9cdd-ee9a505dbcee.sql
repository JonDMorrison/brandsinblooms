-- =============================================
-- TIME-BASED & LIFECYCLE METRICS TABLES
-- =============================================

-- 1. Core lifecycle metrics table
CREATE TABLE public.customer_lifecycle_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Time-Based Metrics (Days Since)
  days_since_signup INTEGER,
  days_since_last_purchase INTEGER,
  days_since_last_engagement INTEGER,
  days_since_last_automation INTEGER,
  
  -- Core Timestamps
  customer_created_at TIMESTAMPTZ,
  first_purchase_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  last_email_engagement_at TIMESTAMPTZ,
  last_sms_engagement_at TIMESTAMPTZ,
  last_any_engagement_at TIMESTAMPTZ,
  last_automation_received_at TIMESTAMPTZ,
  
  -- Lifecycle Stage
  lifecycle_stage TEXT NOT NULL DEFAULT 'new',
  previous_lifecycle_stage TEXT,
  lifecycle_stage_changed_at TIMESTAMPTZ DEFAULT NOW(),
  days_in_current_stage INTEGER DEFAULT 0,
  
  -- Churn Tracking
  is_churned BOOLEAN DEFAULT FALSE,
  churned_at TIMESTAMPTZ,
  time_to_churn_days INTEGER,
  churn_risk_score NUMERIC DEFAULT 0,
  predicted_churn_date DATE,
  
  -- Reactivation Tracking
  is_reactivated BOOLEAN DEFAULT FALSE,
  reactivated_at TIMESTAMPTZ,
  reactivation_count INTEGER DEFAULT 0,
  time_to_reactivation_days INTEGER,
  avg_time_to_reactivation_days NUMERIC,
  last_reactivation_trigger TEXT,
  
  -- Reactivation Success
  total_churn_events INTEGER DEFAULT 0,
  successful_reactivations INTEGER DEFAULT 0,
  reactivation_success_rate NUMERIC DEFAULT 0,
  
  -- Activity Metrics
  purchases_last_30d INTEGER DEFAULT 0,
  purchases_last_90d INTEGER DEFAULT 0,
  engagements_last_30d INTEGER DEFAULT 0,
  engagements_last_90d INTEGER DEFAULT 0,
  automations_received_last_30d INTEGER DEFAULT 0,
  
  -- Velocity & Trends
  engagement_velocity NUMERIC DEFAULT 0,
  purchase_velocity NUMERIC DEFAULT 0,
  
  -- Scores
  lifecycle_health_score NUMERIC DEFAULT 0,
  retention_probability NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Lifecycle events history table
CREATE TABLE public.customer_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  trigger_reason TEXT,
  trigger_source TEXT,
  trigger_source_id UUID,
  
  days_since_last_purchase_at_event INTEGER,
  days_since_last_engagement_at_event INTEGER,
  churn_risk_score_at_event NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tenant-specific lifecycle thresholds
CREATE TABLE public.tenant_lifecycle_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  new_to_engaged_engagement_count INTEGER DEFAULT 2,
  engaged_to_active_buyer_purchase_count INTEGER DEFAULT 1,
  active_to_loyal_days INTEGER DEFAULT 180,
  active_to_at_risk_days INTEGER DEFAULT 45,
  at_risk_to_dormant_days INTEGER DEFAULT 90,
  dormant_to_churned_days INTEGER DEFAULT 180,
  
  reactivation_purchase_required BOOLEAN DEFAULT TRUE,
  reactivation_engagement_required BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.customer_lifecycle_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_lifecycle_thresholds ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- customer_lifecycle_metrics policies
CREATE POLICY "Users can view lifecycle metrics for their tenant"
  ON public.customer_lifecycle_metrics FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert lifecycle metrics for their tenant"
  ON public.customer_lifecycle_metrics FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update lifecycle metrics for their tenant"
  ON public.customer_lifecycle_metrics FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete lifecycle metrics for their tenant"
  ON public.customer_lifecycle_metrics FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- customer_lifecycle_events policies
CREATE POLICY "Users can view lifecycle events for their tenant"
  ON public.customer_lifecycle_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert lifecycle events for their tenant"
  ON public.customer_lifecycle_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- tenant_lifecycle_thresholds policies
CREATE POLICY "Users can view thresholds for their tenant"
  ON public.tenant_lifecycle_thresholds FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert thresholds for their tenant"
  ON public.tenant_lifecycle_thresholds FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update thresholds for their tenant"
  ON public.tenant_lifecycle_thresholds FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_lifecycle_metrics_customer ON public.customer_lifecycle_metrics(customer_id);
CREATE INDEX idx_lifecycle_metrics_tenant ON public.customer_lifecycle_metrics(tenant_id);
CREATE INDEX idx_lifecycle_metrics_stage ON public.customer_lifecycle_metrics(lifecycle_stage);
CREATE INDEX idx_lifecycle_metrics_churned ON public.customer_lifecycle_metrics(is_churned);
CREATE INDEX idx_lifecycle_metrics_risk ON public.customer_lifecycle_metrics(churn_risk_score DESC);

CREATE INDEX idx_lifecycle_events_customer ON public.customer_lifecycle_events(customer_id);
CREATE INDEX idx_lifecycle_events_tenant ON public.customer_lifecycle_events(tenant_id);
CREATE INDEX idx_lifecycle_events_type ON public.customer_lifecycle_events(event_type);
CREATE INDEX idx_lifecycle_events_created ON public.customer_lifecycle_events(created_at DESC);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE TRIGGER update_customer_lifecycle_metrics_updated_at
  BEFORE UPDATE ON public.customer_lifecycle_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_lifecycle_thresholds_updated_at
  BEFORE UPDATE ON public.tenant_lifecycle_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SQL FUNCTIONS
-- =============================================

-- Function to determine lifecycle stage based on activity patterns
CREATE OR REPLACE FUNCTION public.determine_lifecycle_stage(
  p_customer_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_days_since_signup INTEGER;
  v_days_since_purchase INTEGER;
  v_days_since_engagement INTEGER;
  v_total_purchases INTEGER;
  v_total_engagements INTEGER;
  v_thresholds RECORD;
  v_new_stage TEXT;
BEGIN
  -- Get customer tenant
  SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
  
  -- Get thresholds (use defaults if not set)
  SELECT 
    COALESCE(new_to_engaged_engagement_count, 2) as new_to_engaged_engagement_count,
    COALESCE(engaged_to_active_buyer_purchase_count, 1) as engaged_to_active_buyer_purchase_count,
    COALESCE(active_to_loyal_days, 180) as active_to_loyal_days,
    COALESCE(active_to_at_risk_days, 45) as active_to_at_risk_days,
    COALESCE(at_risk_to_dormant_days, 90) as at_risk_to_dormant_days,
    COALESCE(dormant_to_churned_days, 180) as dormant_to_churned_days
  INTO v_thresholds
  FROM tenant_lifecycle_thresholds
  WHERE tenant_id = v_tenant_id;
  
  -- Use defaults if no thresholds exist
  IF v_thresholds IS NULL THEN
    v_thresholds := ROW(2, 1, 180, 45, 90, 180);
  END IF;
  
  -- Get customer metrics
  SELECT 
    EXTRACT(DAY FROM NOW() - c.created_at)::INTEGER,
    EXTRACT(DAY FROM NOW() - COALESCE(c.last_purchase_date, c.created_at))::INTEGER,
    EXTRACT(DAY FROM NOW() - COALESCE(GREATEST(c.last_open_at, c.last_email_clicked_at), c.created_at))::INTEGER,
    COALESCE(c.order_count, 0)::INTEGER,
    COALESCE(ccm.total_email_opens, 0) + COALESCE(ccm.total_email_clicks, 0)
  INTO v_days_since_signup, v_days_since_purchase, v_days_since_engagement, v_total_purchases, v_total_engagements
  FROM crm_customers c
  LEFT JOIN customer_cross_channel_metrics ccm ON ccm.customer_id = c.id
  WHERE c.id = p_customer_id;
  
  -- Determine stage based on activity
  IF v_days_since_purchase > v_thresholds.dormant_to_churned_days 
     AND v_days_since_engagement > v_thresholds.dormant_to_churned_days THEN
    v_new_stage := 'churned';
  ELSIF v_days_since_engagement > v_thresholds.at_risk_to_dormant_days THEN
    v_new_stage := 'dormant';
  ELSIF v_days_since_purchase > v_thresholds.active_to_at_risk_days THEN
    v_new_stage := 'at_risk';
  ELSIF v_days_since_signup >= v_thresholds.active_to_loyal_days 
     AND v_total_purchases >= 3 
     AND v_days_since_purchase < v_thresholds.active_to_at_risk_days THEN
    v_new_stage := 'loyal';
  ELSIF v_total_purchases >= v_thresholds.engaged_to_active_buyer_purchase_count 
     AND v_days_since_purchase < v_thresholds.active_to_at_risk_days THEN
    v_new_stage := 'active_buyer';
  ELSIF v_total_engagements >= v_thresholds.new_to_engaged_engagement_count THEN
    v_new_stage := 'engaged';
  ELSE
    v_new_stage := 'new';
  END IF;
  
  RETURN v_new_stage;
END;
$$;

-- Function to calculate churn risk score (0-100)
CREATE OR REPLACE FUNCTION public.calculate_churn_risk_score(
  p_customer_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_since_purchase INTEGER;
  v_days_since_engagement INTEGER;
  v_purchase_frequency NUMERIC;
  v_engagement_trend NUMERIC;
  v_risk_score NUMERIC := 0;
BEGIN
  SELECT 
    EXTRACT(DAY FROM NOW() - COALESCE(c.last_purchase_date, c.created_at))::INTEGER,
    EXTRACT(DAY FROM NOW() - COALESCE(GREATEST(c.last_open_at, c.last_email_clicked_at), c.created_at))::INTEGER,
    CASE WHEN EXTRACT(DAY FROM NOW() - c.created_at) > 0 
      THEN COALESCE(c.order_count, 0)::NUMERIC / (EXTRACT(DAY FROM NOW() - c.created_at) / 30.0)
      ELSE 0 END
  INTO v_days_since_purchase, v_days_since_engagement, v_purchase_frequency
  FROM crm_customers c
  WHERE c.id = p_customer_id;
  
  -- Calculate risk based on inactivity
  -- Days since purchase (max 40 points)
  v_risk_score := v_risk_score + LEAST(40, (v_days_since_purchase / 180.0) * 40);
  
  -- Days since engagement (max 30 points)
  v_risk_score := v_risk_score + LEAST(30, (v_days_since_engagement / 90.0) * 30);
  
  -- Low purchase frequency (max 30 points)
  IF v_purchase_frequency < 0.5 THEN
    v_risk_score := v_risk_score + 30;
  ELSIF v_purchase_frequency < 1 THEN
    v_risk_score := v_risk_score + 15;
  END IF;
  
  RETURN LEAST(100, GREATEST(0, v_risk_score));
END;
$$;

-- Function to recalculate all lifecycle metrics for a customer
CREATE OR REPLACE FUNCTION public.recalculate_lifecycle_metrics(
  p_customer_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_customer RECORD;
  v_new_stage TEXT;
  v_current_stage TEXT;
  v_churn_risk NUMERIC;
  v_last_automation TIMESTAMPTZ;
BEGIN
  -- Get customer data
  SELECT 
    c.id,
    c.tenant_id,
    c.created_at,
    c.first_purchase_date,
    c.last_purchase_date,
    c.last_open_at,
    c.last_email_clicked_at,
    EXTRACT(DAY FROM NOW() - c.created_at)::INTEGER as days_since_signup,
    EXTRACT(DAY FROM NOW() - COALESCE(c.last_purchase_date, c.created_at))::INTEGER as days_since_purchase,
    EXTRACT(DAY FROM NOW() - COALESCE(GREATEST(c.last_open_at, c.last_email_clicked_at), c.created_at))::INTEGER as days_since_engagement
  INTO v_customer
  FROM crm_customers c
  WHERE c.id = p_customer_id;
  
  IF v_customer IS NULL THEN
    RETURN;
  END IF;
  
  v_tenant_id := v_customer.tenant_id;
  
  -- Get last automation received
  SELECT MAX(sent_at) INTO v_last_automation
  FROM crm_automation_logs
  WHERE customer_id = p_customer_id;
  
  -- Calculate new stage and risk
  v_new_stage := determine_lifecycle_stage(p_customer_id);
  v_churn_risk := calculate_churn_risk_score(p_customer_id);
  
  -- Get current stage if exists
  SELECT lifecycle_stage INTO v_current_stage
  FROM customer_lifecycle_metrics
  WHERE customer_id = p_customer_id;
  
  -- Upsert lifecycle metrics
  INSERT INTO customer_lifecycle_metrics (
    customer_id,
    tenant_id,
    days_since_signup,
    days_since_last_purchase,
    days_since_last_engagement,
    days_since_last_automation,
    customer_created_at,
    first_purchase_at,
    last_purchase_at,
    last_email_engagement_at,
    last_any_engagement_at,
    last_automation_received_at,
    lifecycle_stage,
    previous_lifecycle_stage,
    lifecycle_stage_changed_at,
    churn_risk_score,
    is_churned,
    churned_at
  ) VALUES (
    p_customer_id,
    v_tenant_id,
    v_customer.days_since_signup,
    v_customer.days_since_purchase,
    v_customer.days_since_engagement,
    CASE WHEN v_last_automation IS NOT NULL 
      THEN EXTRACT(DAY FROM NOW() - v_last_automation)::INTEGER 
      ELSE NULL END,
    v_customer.created_at,
    v_customer.first_purchase_date,
    v_customer.last_purchase_date,
    GREATEST(v_customer.last_open_at, v_customer.last_email_clicked_at),
    GREATEST(v_customer.last_open_at, v_customer.last_email_clicked_at),
    v_last_automation,
    v_new_stage,
    v_current_stage,
    NOW(),
    v_churn_risk,
    v_new_stage = 'churned',
    CASE WHEN v_new_stage = 'churned' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    days_since_signup = EXCLUDED.days_since_signup,
    days_since_last_purchase = EXCLUDED.days_since_last_purchase,
    days_since_last_engagement = EXCLUDED.days_since_last_engagement,
    days_since_last_automation = EXCLUDED.days_since_last_automation,
    last_purchase_at = EXCLUDED.last_purchase_at,
    last_email_engagement_at = EXCLUDED.last_email_engagement_at,
    last_any_engagement_at = EXCLUDED.last_any_engagement_at,
    last_automation_received_at = EXCLUDED.last_automation_received_at,
    lifecycle_stage = EXCLUDED.lifecycle_stage,
    previous_lifecycle_stage = CASE 
      WHEN customer_lifecycle_metrics.lifecycle_stage != EXCLUDED.lifecycle_stage 
      THEN customer_lifecycle_metrics.lifecycle_stage 
      ELSE customer_lifecycle_metrics.previous_lifecycle_stage END,
    lifecycle_stage_changed_at = CASE 
      WHEN customer_lifecycle_metrics.lifecycle_stage != EXCLUDED.lifecycle_stage 
      THEN NOW() 
      ELSE customer_lifecycle_metrics.lifecycle_stage_changed_at END,
    days_in_current_stage = CASE 
      WHEN customer_lifecycle_metrics.lifecycle_stage != EXCLUDED.lifecycle_stage 
      THEN 0 
      ELSE EXTRACT(DAY FROM NOW() - customer_lifecycle_metrics.lifecycle_stage_changed_at)::INTEGER END,
    churn_risk_score = EXCLUDED.churn_risk_score,
    is_churned = EXCLUDED.is_churned,
    churned_at = CASE 
      WHEN EXCLUDED.is_churned AND NOT customer_lifecycle_metrics.is_churned 
      THEN NOW() 
      ELSE customer_lifecycle_metrics.churned_at END,
    time_to_churn_days = CASE 
      WHEN EXCLUDED.is_churned AND NOT customer_lifecycle_metrics.is_churned 
      THEN EXTRACT(DAY FROM NOW() - customer_lifecycle_metrics.customer_created_at)::INTEGER 
      ELSE customer_lifecycle_metrics.time_to_churn_days END,
    total_churn_events = CASE 
      WHEN EXCLUDED.is_churned AND NOT customer_lifecycle_metrics.is_churned 
      THEN customer_lifecycle_metrics.total_churn_events + 1 
      ELSE customer_lifecycle_metrics.total_churn_events END,
    updated_at = NOW();
  
  -- Track stage change event
  IF v_current_stage IS NOT NULL AND v_current_stage != v_new_stage THEN
    INSERT INTO customer_lifecycle_events (
      tenant_id,
      customer_id,
      event_type,
      from_stage,
      to_stage,
      trigger_reason,
      trigger_source,
      days_since_last_purchase_at_event,
      days_since_last_engagement_at_event,
      churn_risk_score_at_event
    ) VALUES (
      v_tenant_id,
      p_customer_id,
      CASE 
        WHEN v_new_stage = 'churned' THEN 'churned'
        WHEN v_current_stage IN ('churned', 'dormant') AND v_new_stage IN ('active_buyer', 'engaged', 'loyal') THEN 'reactivated'
        ELSE 'stage_change'
      END,
      v_current_stage,
      v_new_stage,
      'Automatic recalculation',
      'scheduled_job',
      v_customer.days_since_purchase,
      v_customer.days_since_engagement,
      v_churn_risk
    );
    
    -- Handle reactivation
    IF v_current_stage IN ('churned', 'dormant') AND v_new_stage IN ('active_buyer', 'engaged', 'loyal') THEN
      UPDATE customer_lifecycle_metrics SET
        is_reactivated = TRUE,
        reactivated_at = NOW(),
        reactivation_count = reactivation_count + 1,
        successful_reactivations = successful_reactivations + 1,
        time_to_reactivation_days = CASE 
          WHEN churned_at IS NOT NULL 
          THEN EXTRACT(DAY FROM NOW() - churned_at)::INTEGER 
          ELSE NULL END,
        reactivation_success_rate = CASE 
          WHEN total_churn_events > 0 
          THEN ((successful_reactivations + 1)::NUMERIC / total_churn_events) * 100 
          ELSE 0 END,
        last_reactivation_trigger = 'engagement',
        is_churned = FALSE
      WHERE customer_id = p_customer_id;
    END IF;
  END IF;
END;
$$;

-- Function to refresh all lifecycle metrics for a tenant
CREATE OR REPLACE FUNCTION public.refresh_all_lifecycle_metrics(
  p_tenant_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_customer_id IN 
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_lifecycle_metrics(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to get tenant lifecycle statistics
CREATE OR REPLACE FUNCTION public.get_tenant_lifecycle_stats(
  p_tenant_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'lifecycle_stage_breakdown', json_build_object(
      'new', COUNT(*) FILTER (WHERE lifecycle_stage = 'new'),
      'engaged', COUNT(*) FILTER (WHERE lifecycle_stage = 'engaged'),
      'active_buyer', COUNT(*) FILTER (WHERE lifecycle_stage = 'active_buyer'),
      'loyal', COUNT(*) FILTER (WHERE lifecycle_stage = 'loyal'),
      'at_risk', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
      'dormant', COUNT(*) FILTER (WHERE lifecycle_stage = 'dormant'),
      'churned', COUNT(*) FILTER (WHERE lifecycle_stage = 'churned')
    ),
    'avg_days_since_signup', COALESCE(AVG(days_since_signup), 0),
    'avg_days_since_last_purchase', COALESCE(AVG(days_since_last_purchase), 0),
    'avg_days_since_last_engagement', COALESCE(AVG(days_since_last_engagement), 0),
    'avg_days_since_last_automation', COALESCE(AVG(days_since_last_automation), 0),
    'overall_churn_rate', CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE is_churned)::NUMERIC / COUNT(*)) * 100 
      ELSE 0 END,
    'overall_reactivation_success_rate', COALESCE(AVG(reactivation_success_rate), 0),
    'avg_time_to_churn_days', AVG(time_to_churn_days),
    'avg_time_to_reactivation_days', AVG(time_to_reactivation_days),
    'at_risk_customer_count', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
    'customers_churned_last_30d', COUNT(*) FILTER (WHERE churned_at > NOW() - INTERVAL '30 days'),
    'customers_reactivated_last_30d', COUNT(*) FILTER (WHERE reactivated_at > NOW() - INTERVAL '30 days')
  ) INTO v_result
  FROM customer_lifecycle_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_result;
END;
$$;