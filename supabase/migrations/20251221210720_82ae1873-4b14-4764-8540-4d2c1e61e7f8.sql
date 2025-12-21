-- =============================================
-- NEGATIVE BEHAVIOR & RISK SIGNALS TABLES
-- =============================================

-- 1. Create customer_risk_signals table
CREATE TABLE public.customer_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- ◆ Rapid Opt-Outs
  total_opt_outs INTEGER DEFAULT 0,
  sms_opt_outs INTEGER DEFAULT 0,
  email_opt_outs INTEGER DEFAULT 0,
  opt_out_speed_days NUMERIC,
  messages_before_opt_out INTEGER,
  is_rapid_opt_out BOOLEAN DEFAULT FALSE,
  last_opt_out_at TIMESTAMPTZ,
  opt_out_sources TEXT[] DEFAULT '{}',
  opt_out_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ Message Ignoring Streak
  current_ignore_streak INTEGER DEFAULT 0,
  max_ignore_streak INTEGER DEFAULT 0,
  total_messages_ignored INTEGER DEFAULT 0,
  ignore_streak_started_at TIMESTAMPTZ,
  is_ignoring_messages BOOLEAN DEFAULT FALSE,
  avg_ignore_streak_length NUMERIC DEFAULT 0,
  ignore_streak_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ No Engagement After X Messages
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_engaged INTEGER DEFAULT 0,
  messages_since_last_engagement INTEGER DEFAULT 0,
  last_engagement_at TIMESTAMPTZ,
  engagement_gap_threshold INTEGER DEFAULT 5,
  is_no_engagement_alert BOOLEAN DEFAULT FALSE,
  engagement_gap_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ Incentive Abuse Patterns
  total_incentives_used INTEGER DEFAULT 0,
  incentives_stacked INTEGER DEFAULT 0,
  incentives_shared INTEGER DEFAULT 0,
  incentives_used_at_expiry INTEGER DEFAULT 0,
  avg_incentive_value_used NUMERIC DEFAULT 0,
  max_incentive_value_used NUMERIC DEFAULT 0,
  incentive_abuse_signals JSONB DEFAULT '{}',
  is_suspected_incentive_abuser BOOLEAN DEFAULT FALSE,
  incentive_abuse_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ Coupon-Only Purchasing
  total_purchases INTEGER DEFAULT 0,
  purchases_with_coupon INTEGER DEFAULT 0,
  purchases_without_coupon INTEGER DEFAULT 0,
  coupon_only_ratio NUMERIC DEFAULT 0,
  consecutive_coupon_purchases INTEGER DEFAULT 0,
  max_consecutive_coupon_purchases INTEGER DEFAULT 0,
  avg_order_value_with_coupon NUMERIC DEFAULT 0,
  avg_order_value_without_coupon NUMERIC DEFAULT 0,
  is_coupon_dependent BOOLEAN DEFAULT FALSE,
  coupon_dependency_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ Long-Term Dormant State
  days_since_last_purchase INTEGER,
  days_since_last_engagement INTEGER,
  days_since_first_message INTEGER,
  dormancy_start_date TIMESTAMPTZ,
  dormancy_duration_days INTEGER DEFAULT 0,
  is_long_term_dormant BOOLEAN DEFAULT FALSE,
  dormant_reactivation_attempts INTEGER DEFAULT 0,
  dormant_reactivation_responses INTEGER DEFAULT 0,
  dormancy_risk_score NUMERIC DEFAULT 0,
  
  -- ◆ Hard Bounce History
  total_hard_bounces INTEGER DEFAULT 0,
  total_soft_bounces INTEGER DEFAULT 0,
  consecutive_hard_bounces INTEGER DEFAULT 0,
  first_hard_bounce_at TIMESTAMPTZ,
  last_hard_bounce_at TIMESTAMPTZ,
  hard_bounce_rate NUMERIC DEFAULT 0,
  is_email_invalid BOOLEAN DEFAULT FALSE,
  bounce_categories TEXT[] DEFAULT '{}',
  bounce_risk_score NUMERIC DEFAULT 0,
  
  -- SMS-Specific Risk Signals
  sms_delivery_failures INTEGER DEFAULT 0,
  sms_carrier_blocks INTEGER DEFAULT 0,
  sms_spam_reports INTEGER DEFAULT 0,
  sms_invalid_number_flags INTEGER DEFAULT 0,
  is_sms_unreachable BOOLEAN DEFAULT FALSE,
  sms_risk_score NUMERIC DEFAULT 0,
  
  -- Aggregate Risk Scoring
  overall_risk_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  risk_factors TEXT[] DEFAULT '{}',
  risk_trend TEXT DEFAULT 'stable',
  last_risk_assessment_at TIMESTAMPTZ,
  
  -- Suppression Management
  should_suppress BOOLEAN DEFAULT FALSE,
  suppression_reason TEXT,
  auto_suppressed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create negative_behavior_events table
CREATE TABLE public.negative_behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL,
  event_subtype TEXT,
  channel TEXT NOT NULL,
  
  campaign_id UUID,
  message_id UUID,
  automation_id UUID,
  
  opt_out_source TEXT,
  bounce_type TEXT,
  bounce_reason TEXT,
  ignore_streak_length INTEGER,
  abuse_type TEXT,
  
  messages_received_before INTEGER,
  time_since_last_message_seconds INTEGER,
  
  risk_score_impact NUMERIC DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create suppression_list table
CREATE TABLE public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  
  email TEXT,
  phone TEXT,
  
  suppression_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  reason TEXT,
  
  source_event_id UUID REFERENCES public.negative_behavior_events(id) ON DELETE SET NULL,
  auto_suppressed BOOLEAN DEFAULT FALSE,
  
  suppressed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  lifted_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.customer_risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negative_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for customer_risk_signals
CREATE POLICY "Users can view risk signals for their tenant"
  ON public.customer_risk_signals FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert risk signals for their tenant"
  ON public.customer_risk_signals FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update risk signals for their tenant"
  ON public.customer_risk_signals FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete risk signals for their tenant"
  ON public.customer_risk_signals FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 6. RLS Policies for negative_behavior_events
CREATE POLICY "Users can view negative events for their tenant"
  ON public.negative_behavior_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert negative events for their tenant"
  ON public.negative_behavior_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 7. RLS Policies for suppression_list
CREATE POLICY "Users can view suppression list for their tenant"
  ON public.suppression_list FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert to suppression list for their tenant"
  ON public.suppression_list FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update suppression list for their tenant"
  ON public.suppression_list FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete from suppression list for their tenant"
  ON public.suppression_list FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 8. Create indexes for performance
CREATE INDEX idx_risk_signals_customer ON public.customer_risk_signals(customer_id);
CREATE INDEX idx_risk_signals_tenant ON public.customer_risk_signals(tenant_id);
CREATE INDEX idx_risk_signals_score ON public.customer_risk_signals(overall_risk_score DESC);
CREATE INDEX idx_risk_signals_level ON public.customer_risk_signals(risk_level);
CREATE INDEX idx_risk_signals_suppression ON public.customer_risk_signals(should_suppress) WHERE should_suppress = TRUE;

CREATE INDEX idx_negative_events_customer ON public.negative_behavior_events(customer_id);
CREATE INDEX idx_negative_events_tenant ON public.negative_behavior_events(tenant_id);
CREATE INDEX idx_negative_events_type ON public.negative_behavior_events(event_type);
CREATE INDEX idx_negative_events_created ON public.negative_behavior_events(created_at DESC);

CREATE INDEX idx_suppression_tenant ON public.suppression_list(tenant_id);
CREATE INDEX idx_suppression_email ON public.suppression_list(email);
CREATE INDEX idx_suppression_phone ON public.suppression_list(phone);
CREATE INDEX idx_suppression_active ON public.suppression_list(tenant_id, channel) WHERE lifted_at IS NULL;

-- 9. Create updated_at triggers
CREATE TRIGGER update_customer_risk_signals_updated_at
  BEFORE UPDATE ON public.customer_risk_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppression_list_updated_at
  BEFORE UPDATE ON public.suppression_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Create track_negative_behavior_event function
CREATE OR REPLACE FUNCTION public.track_negative_behavior_event(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_event_type TEXT,
  p_event_subtype TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'email',
  p_campaign_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL,
  p_automation_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_messages_before INTEGER;
  v_risk_impact NUMERIC := 0;
BEGIN
  -- Get messages received before this event
  SELECT COALESCE(total_messages_sent, 0) INTO v_messages_before
  FROM customer_risk_signals
  WHERE customer_id = p_customer_id;
  
  -- Calculate risk impact based on event type
  CASE p_event_type
    WHEN 'opt_out' THEN v_risk_impact := 20;
    WHEN 'bounce' THEN 
      IF p_event_subtype = 'hard' THEN v_risk_impact := 30;
      ELSE v_risk_impact := 5;
      END IF;
    WHEN 'complaint' THEN v_risk_impact := 40;
    WHEN 'ignore' THEN v_risk_impact := 5;
    WHEN 'abuse' THEN v_risk_impact := 25;
    ELSE v_risk_impact := 10;
  END CASE;
  
  -- Insert the event
  INSERT INTO negative_behavior_events (
    tenant_id, customer_id, event_type, event_subtype, channel,
    campaign_id, message_id, automation_id,
    opt_out_source, bounce_type, bounce_reason, abuse_type,
    messages_received_before, risk_score_impact, metadata
  ) VALUES (
    p_tenant_id, p_customer_id, p_event_type, p_event_subtype, p_channel,
    p_campaign_id, p_message_id, p_automation_id,
    CASE WHEN p_event_type = 'opt_out' THEN p_event_subtype ELSE NULL END,
    CASE WHEN p_event_type = 'bounce' THEN p_event_subtype ELSE NULL END,
    p_metadata->>'bounce_reason',
    CASE WHEN p_event_type = 'abuse' THEN p_event_subtype ELSE NULL END,
    v_messages_before, v_risk_impact, p_metadata
  ) RETURNING id INTO v_event_id;
  
  -- Trigger recalculation of risk signals
  PERFORM recalculate_risk_signals(p_customer_id);
  
  RETURN v_event_id;
END;
$$;

-- 11. Create recalculate_risk_signals function
CREATE OR REPLACE FUNCTION public.recalculate_risk_signals(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_opt_out_risk NUMERIC := 0;
  v_ignore_risk NUMERIC := 0;
  v_engagement_gap_risk NUMERIC := 0;
  v_incentive_abuse_risk NUMERIC := 0;
  v_coupon_dependency_risk NUMERIC := 0;
  v_dormancy_risk NUMERIC := 0;
  v_bounce_risk NUMERIC := 0;
  v_overall_risk NUMERIC := 0;
  v_risk_level TEXT := 'minimal';
  v_risk_factors TEXT[] := '{}';
  v_customer RECORD;
  v_signals RECORD;
BEGIN
  -- Get customer and tenant info
  SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
  IF v_tenant_id IS NULL THEN RETURN; END IF;
  
  -- Get or create risk signals record
  INSERT INTO customer_risk_signals (customer_id, tenant_id)
  VALUES (p_customer_id, v_tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  SELECT * INTO v_signals FROM customer_risk_signals WHERE customer_id = p_customer_id;
  
  -- Calculate Opt-Out Risk Score
  IF v_signals.is_rapid_opt_out THEN
    v_opt_out_risk := v_opt_out_risk + 40;
    v_risk_factors := array_append(v_risk_factors, 'rapid_opt_out');
  END IF;
  IF v_signals.total_opt_outs > 1 THEN
    v_opt_out_risk := v_opt_out_risk + 30;
    v_risk_factors := array_append(v_risk_factors, 'multiple_opt_outs');
  END IF;
  IF COALESCE(v_signals.messages_before_opt_out, 999) < 5 THEN
    v_opt_out_risk := v_opt_out_risk + 30;
  END IF;
  v_opt_out_risk := LEAST(100, v_opt_out_risk);
  
  -- Calculate Ignore Streak Risk Score
  v_ignore_risk := LEAST(100, (v_signals.current_ignore_streak * 15) + (v_signals.max_ignore_streak * 5));
  IF v_signals.is_ignoring_messages THEN
    v_risk_factors := array_append(v_risk_factors, 'ignoring_messages');
  END IF;
  
  -- Calculate Engagement Gap Risk Score
  v_engagement_gap_risk := LEAST(100, v_signals.messages_since_last_engagement * 10);
  IF v_signals.is_no_engagement_alert THEN
    v_risk_factors := array_append(v_risk_factors, 'no_engagement');
  END IF;
  
  -- Calculate Incentive Abuse Risk Score
  IF v_signals.incentives_stacked > 0 THEN
    v_incentive_abuse_risk := v_incentive_abuse_risk + 25;
    v_risk_factors := array_append(v_risk_factors, 'incentive_stacking');
  END IF;
  IF v_signals.incentives_shared > 0 THEN
    v_incentive_abuse_risk := v_incentive_abuse_risk + 35;
    v_risk_factors := array_append(v_risk_factors, 'incentive_sharing');
  END IF;
  IF v_signals.incentives_used_at_expiry > 2 THEN
    v_incentive_abuse_risk := v_incentive_abuse_risk + 20;
  END IF;
  v_incentive_abuse_risk := LEAST(100, v_incentive_abuse_risk);
  IF v_signals.is_suspected_incentive_abuser THEN
    v_risk_factors := array_append(v_risk_factors, 'suspected_abuser');
  END IF;
  
  -- Calculate Coupon Dependency Risk Score
  IF v_signals.coupon_only_ratio > 80 THEN
    v_coupon_dependency_risk := 80 + LEAST(20, v_signals.consecutive_coupon_purchases * 2);
    v_risk_factors := array_append(v_risk_factors, 'coupon_dependent');
  ELSE
    v_coupon_dependency_risk := v_signals.coupon_only_ratio * 0.8;
  END IF;
  
  -- Calculate Dormancy Risk Score
  v_dormancy_risk := LEAST(100, (COALESCE(v_signals.dormancy_duration_days, 0)::NUMERIC / 90) * 100);
  IF v_signals.is_long_term_dormant THEN
    v_risk_factors := array_append(v_risk_factors, 'long_term_dormant');
  END IF;
  
  -- Calculate Bounce Risk Score
  IF v_signals.total_hard_bounces >= 2 THEN
    v_bounce_risk := 100;
    v_risk_factors := array_append(v_risk_factors, 'multiple_hard_bounces');
  ELSE
    v_bounce_risk := (v_signals.total_hard_bounces * 40) + (v_signals.consecutive_hard_bounces * 20);
  END IF;
  IF v_signals.is_email_invalid THEN
    v_risk_factors := array_append(v_risk_factors, 'invalid_email');
  END IF;
  
  -- Calculate Overall Risk Score (weighted average)
  v_overall_risk := 
    (v_opt_out_risk * 0.20) +
    (v_ignore_risk * 0.15) +
    (v_engagement_gap_risk * 0.15) +
    (v_incentive_abuse_risk * 0.10) +
    (v_coupon_dependency_risk * 0.10) +
    (v_dormancy_risk * 0.15) +
    (v_bounce_risk * 0.15);
  
  -- Determine Risk Level
  CASE
    WHEN v_overall_risk >= 81 THEN v_risk_level := 'critical';
    WHEN v_overall_risk >= 61 THEN v_risk_level := 'high';
    WHEN v_overall_risk >= 41 THEN v_risk_level := 'moderate';
    WHEN v_overall_risk >= 21 THEN v_risk_level := 'low';
    ELSE v_risk_level := 'minimal';
  END CASE;
  
  -- Update the risk signals record
  UPDATE customer_risk_signals SET
    opt_out_risk_score = v_opt_out_risk,
    ignore_streak_risk_score = v_ignore_risk,
    engagement_gap_risk_score = v_engagement_gap_risk,
    incentive_abuse_risk_score = v_incentive_abuse_risk,
    coupon_dependency_risk_score = v_coupon_dependency_risk,
    dormancy_risk_score = v_dormancy_risk,
    bounce_risk_score = v_bounce_risk,
    overall_risk_score = v_overall_risk,
    risk_level = v_risk_level,
    risk_factors = v_risk_factors,
    should_suppress = (v_risk_level = 'critical'),
    suppression_reason = CASE WHEN v_risk_level = 'critical' THEN 'Auto-flagged: Critical risk score' ELSE NULL END,
    last_risk_assessment_at = NOW(),
    updated_at = NOW()
  WHERE customer_id = p_customer_id;
END;
$$;

-- 12. Create get_tenant_risk_stats function
CREATE OR REPLACE FUNCTION public.get_tenant_risk_stats(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'risk_level_breakdown', jsonb_build_object(
      'minimal', COUNT(*) FILTER (WHERE risk_level = 'minimal'),
      'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
      'moderate', COUNT(*) FILTER (WHERE risk_level = 'moderate'),
      'high', COUNT(*) FILTER (WHERE risk_level = 'high'),
      'critical', COUNT(*) FILTER (WHERE risk_level = 'critical')
    ),
    'avg_overall_risk_score', ROUND(AVG(overall_risk_score)::NUMERIC, 1),
    'rapid_opt_out_count', COUNT(*) FILTER (WHERE is_rapid_opt_out = TRUE),
    'avg_ignore_streak', ROUND(AVG(current_ignore_streak)::NUMERIC, 1),
    'coupon_dependent_count', COUNT(*) FILTER (WHERE is_coupon_dependent = TRUE),
    'long_term_dormant_count', COUNT(*) FILTER (WHERE is_long_term_dormant = TRUE),
    'hard_bounce_count', COUNT(*) FILTER (WHERE total_hard_bounces > 0),
    'suppressed_count', COUNT(*) FILTER (WHERE should_suppress = TRUE),
    'risk_trend_distribution', jsonb_build_object(
      'improving', COUNT(*) FILTER (WHERE risk_trend = 'improving'),
      'stable', COUNT(*) FILTER (WHERE risk_trend = 'stable'),
      'worsening', COUNT(*) FILTER (WHERE risk_trend = 'worsening')
    )
  ) INTO v_result
  FROM customer_risk_signals
  WHERE tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

-- 13. Create refresh_all_risk_signals function
CREATE OR REPLACE FUNCTION public.refresh_all_risk_signals(p_tenant_id UUID)
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
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_risk_signals(v_customer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;