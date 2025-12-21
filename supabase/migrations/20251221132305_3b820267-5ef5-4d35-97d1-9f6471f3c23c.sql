-- ================================================
-- Phase 1: Create customer_cross_channel_metrics table
-- ================================================

CREATE TABLE public.customer_cross_channel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Multi-channel engagement score (0-100)
  multi_channel_score NUMERIC DEFAULT 0,
  
  -- Preferred channel by engagement (email, sms, equal, unknown)
  preferred_channel TEXT DEFAULT 'unknown',
  
  -- Channel fatigue indicators (0-100, higher = more fatigued)
  email_fatigue_score INTEGER DEFAULT 0,
  sms_fatigue_score INTEGER DEFAULT 0,
  fatigue_status TEXT DEFAULT 'none', -- none, low, moderate, high, critical
  
  -- Last engaged channel tracking
  last_engaged_channel TEXT, -- 'email' or 'sms'
  last_engagement_at TIMESTAMPTZ,
  days_since_last_engagement INTEGER DEFAULT 0,
  
  -- Rolling window interaction counts (positive engagements: opens, clicks, replies)
  email_interactions_7d INTEGER DEFAULT 0,
  sms_interactions_7d INTEGER DEFAULT 0,
  email_interactions_30d INTEGER DEFAULT 0,
  sms_interactions_30d INTEGER DEFAULT 0,
  
  -- Messaging frequency tracking (messages sent to customer)
  email_messages_received_7d INTEGER DEFAULT 0,
  sms_messages_received_7d INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_cross_channel_customer ON public.customer_cross_channel_metrics(customer_id);
CREATE INDEX idx_cross_channel_tenant ON public.customer_cross_channel_metrics(tenant_id);
CREATE INDEX idx_cross_channel_fatigue ON public.customer_cross_channel_metrics(fatigue_status);
CREATE INDEX idx_cross_channel_preferred ON public.customer_cross_channel_metrics(preferred_channel);

-- Enable RLS
ALTER TABLE public.customer_cross_channel_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view cross-channel metrics for their tenant"
  ON public.customer_cross_channel_metrics
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to cross-channel metrics"
  ON public.customer_cross_channel_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_cross_channel_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cross_channel_metrics_timestamp
  BEFORE UPDATE ON public.customer_cross_channel_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cross_channel_metrics_updated_at();

-- ================================================
-- Phase 2: SQL Functions for Cross-Channel Metrics
-- ================================================

-- Function 1: Main update function called on any engagement event
CREATE OR REPLACE FUNCTION public.update_cross_channel_metrics(
  p_customer_id UUID,
  p_channel TEXT,
  p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_positive_engagement BOOLEAN;
BEGIN
  -- Get tenant_id from customer
  SELECT tenant_id INTO v_tenant_id
  FROM public.crm_customers
  WHERE id = p_customer_id;
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Determine if this is a positive engagement (not just sent/delivered)
  v_is_positive_engagement := p_event_type IN ('opened', 'clicked', 'replied');
  
  -- Upsert the cross-channel metrics record
  INSERT INTO public.customer_cross_channel_metrics (
    customer_id,
    tenant_id,
    last_engaged_channel,
    last_engagement_at,
    days_since_last_engagement
  ) VALUES (
    p_customer_id,
    v_tenant_id,
    CASE WHEN v_is_positive_engagement THEN p_channel ELSE NULL END,
    CASE WHEN v_is_positive_engagement THEN NOW() ELSE NULL END,
    0
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    last_engaged_channel = CASE 
      WHEN v_is_positive_engagement THEN p_channel 
      ELSE customer_cross_channel_metrics.last_engaged_channel 
    END,
    last_engagement_at = CASE 
      WHEN v_is_positive_engagement THEN NOW() 
      ELSE customer_cross_channel_metrics.last_engagement_at 
    END,
    days_since_last_engagement = CASE 
      WHEN v_is_positive_engagement THEN 0 
      ELSE COALESCE(
        EXTRACT(DAY FROM (NOW() - customer_cross_channel_metrics.last_engagement_at))::INTEGER,
        customer_cross_channel_metrics.days_since_last_engagement
      )
    END,
    updated_at = NOW();
  
  -- Calculate and update all derived metrics
  PERFORM public.recalculate_cross_channel_scores(p_customer_id);
END;
$$;

-- Function 2: Recalculate all cross-channel scores for a customer
CREATE OR REPLACE FUNCTION public.recalculate_cross_channel_scores(
  p_customer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_score NUMERIC := 0;
  v_sms_score NUMERIC := 0;
  v_multi_channel_score NUMERIC := 0;
  v_preferred_channel TEXT := 'unknown';
  v_email_fatigue INTEGER := 0;
  v_sms_fatigue INTEGER := 0;
  v_fatigue_status TEXT := 'none';
  v_cross_channel_bonus NUMERIC := 0;
  v_recency_bonus NUMERIC := 0;
  v_last_engagement TIMESTAMPTZ;
  v_email_sent_7d INTEGER := 0;
  v_sms_sent_7d INTEGER := 0;
  v_email_interactions_7d INTEGER := 0;
  v_sms_interactions_7d INTEGER := 0;
  v_email_interactions_30d INTEGER := 0;
  v_sms_interactions_30d INTEGER := 0;
BEGIN
  -- Get email engagement score
  SELECT COALESCE(engagement_score, 0) INTO v_email_score
  FROM public.customer_email_metrics
  WHERE customer_id = p_customer_id;
  
  -- Get SMS engagement score
  SELECT COALESCE(engagement_score, 0) INTO v_sms_score
  FROM public.customer_sms_metrics
  WHERE customer_id = p_customer_id;
  
  -- Get last engagement time
  SELECT last_engagement_at INTO v_last_engagement
  FROM public.customer_cross_channel_metrics
  WHERE customer_id = p_customer_id;
  
  -- Calculate rolling window interactions from email tracking events
  SELECT 
    COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND event_type IN ('opened', 'clicked') THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND event_type IN ('opened', 'clicked') THEN 1 ELSE 0 END), 0)
  INTO v_email_interactions_7d, v_email_interactions_30d
  FROM public.email_tracking_events
  WHERE customer_id = p_customer_id;
  
  -- Calculate rolling window interactions from SMS (clicks + replies)
  SELECT 
    COALESCE(SUM(CASE WHEN last_clicked_at >= NOW() - INTERVAL '7 days' THEN total_clicked ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN last_replied_at >= NOW() - INTERVAL '7 days' THEN total_replied ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN last_clicked_at >= NOW() - INTERVAL '30 days' THEN total_clicked ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN last_replied_at >= NOW() - INTERVAL '30 days' THEN total_replied ELSE 0 END), 0)
  INTO v_sms_interactions_7d, v_sms_interactions_30d
  FROM public.customer_sms_metrics
  WHERE customer_id = p_customer_id;
  
  -- Calculate messages received in last 7 days
  SELECT COUNT(*) INTO v_email_sent_7d
  FROM public.email_tracking_events
  WHERE customer_id = p_customer_id
    AND event_type = 'sent'
    AND created_at >= NOW() - INTERVAL '7 days';
    
  SELECT COUNT(*) INTO v_sms_sent_7d
  FROM public.sms_messages
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - INTERVAL '7 days';
  
  -- Calculate cross-channel bonus (active on both channels)
  IF v_email_score > 20 AND v_sms_score > 20 THEN
    v_cross_channel_bonus := 20;
  ELSIF v_email_score > 10 OR v_sms_score > 10 THEN
    v_cross_channel_bonus := 10;
  END IF;
  
  -- Calculate recency bonus
  IF v_last_engagement IS NOT NULL THEN
    IF v_last_engagement >= NOW() - INTERVAL '7 days' THEN
      v_recency_bonus := 10;
    ELSIF v_last_engagement >= NOW() - INTERVAL '30 days' THEN
      v_recency_bonus := 5;
    END IF;
  END IF;
  
  -- Calculate multi-channel score: 35% email + 35% SMS + 20% cross-channel + 10% recency
  v_multi_channel_score := LEAST(100, 
    (v_email_score * 0.35) + 
    (v_sms_score * 0.35) + 
    (v_cross_channel_bonus) + 
    (v_recency_bonus)
  );
  
  -- Determine preferred channel
  IF v_email_score > v_sms_score + 10 THEN
    v_preferred_channel := 'email';
  ELSIF v_sms_score > v_email_score + 10 THEN
    v_preferred_channel := 'sms';
  ELSIF v_email_score > 0 OR v_sms_score > 0 THEN
    v_preferred_channel := 'equal';
  ELSE
    v_preferred_channel := 'unknown';
  END IF;
  
  -- Calculate email fatigue (high frequency + low engagement = fatigue)
  IF v_email_sent_7d > 0 THEN
    v_email_fatigue := LEAST(100, GREATEST(0,
      (v_email_sent_7d * 10) - (v_email_score * 0.5)
    )::INTEGER);
  END IF;
  
  -- Calculate SMS fatigue
  IF v_sms_sent_7d > 0 THEN
    v_sms_fatigue := LEAST(100, GREATEST(0,
      (v_sms_sent_7d * 15) - (v_sms_score * 0.5)
    )::INTEGER);
  END IF;
  
  -- Determine overall fatigue status
  v_fatigue_status := CASE
    WHEN GREATEST(v_email_fatigue, v_sms_fatigue) >= 80 THEN 'critical'
    WHEN GREATEST(v_email_fatigue, v_sms_fatigue) >= 60 THEN 'high'
    WHEN GREATEST(v_email_fatigue, v_sms_fatigue) >= 40 THEN 'moderate'
    WHEN GREATEST(v_email_fatigue, v_sms_fatigue) >= 20 THEN 'low'
    ELSE 'none'
  END;
  
  -- Update the cross-channel metrics record
  UPDATE public.customer_cross_channel_metrics
  SET
    multi_channel_score = v_multi_channel_score,
    preferred_channel = v_preferred_channel,
    email_fatigue_score = v_email_fatigue,
    sms_fatigue_score = v_sms_fatigue,
    fatigue_status = v_fatigue_status,
    email_interactions_7d = v_email_interactions_7d,
    sms_interactions_7d = v_sms_interactions_7d,
    email_interactions_30d = v_email_interactions_30d,
    sms_interactions_30d = v_sms_interactions_30d,
    email_messages_received_7d = v_email_sent_7d,
    sms_messages_received_7d = v_sms_sent_7d,
    days_since_last_engagement = CASE 
      WHEN last_engagement_at IS NOT NULL 
      THEN EXTRACT(DAY FROM (NOW() - last_engagement_at))::INTEGER 
      ELSE 0 
    END
  WHERE customer_id = p_customer_id;
END;
$$;

-- Function 3: Batch refresh for all customers (for scheduled runs)
CREATE OR REPLACE FUNCTION public.refresh_all_cross_channel_metrics(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_customer RECORD;
BEGIN
  FOR v_customer IN
    SELECT DISTINCT c.id, c.tenant_id
    FROM public.crm_customers c
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    -- Ensure record exists
    INSERT INTO public.customer_cross_channel_metrics (customer_id, tenant_id)
    VALUES (v_customer.id, v_customer.tenant_id)
    ON CONFLICT (customer_id) DO NOTHING;
    
    -- Recalculate scores
    PERFORM public.recalculate_cross_channel_scores(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_cross_channel_metrics(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_cross_channel_metrics(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_cross_channel_scores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_cross_channel_scores(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_cross_channel_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_cross_channel_metrics(UUID) TO service_role;