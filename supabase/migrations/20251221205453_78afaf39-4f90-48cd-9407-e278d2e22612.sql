-- =============================================
-- CONTENT INTERACTION & INTENT METRICS TABLES
-- =============================================

-- 1. Customer Content Intent Metrics (main metrics table)
CREATE TABLE public.customer_content_intent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Content Type Engagement (Story vs Offer)
  total_story_views INTEGER DEFAULT 0,
  total_offer_views INTEGER DEFAULT 0,
  total_story_clicks INTEGER DEFAULT 0,
  total_offer_clicks INTEGER DEFAULT 0,
  story_engagement_rate NUMERIC DEFAULT 0,
  offer_engagement_rate NUMERIC DEFAULT 0,
  preferred_content_type TEXT DEFAULT 'balanced',
  
  -- Educational vs Promotional Response Ratio
  educational_messages_received INTEGER DEFAULT 0,
  educational_messages_engaged INTEGER DEFAULT 0,
  promotional_messages_received INTEGER DEFAULT 0,
  promotional_messages_engaged INTEGER DEFAULT 0,
  educational_response_rate NUMERIC DEFAULT 0,
  promotional_response_rate NUMERIC DEFAULT 0,
  edu_promo_ratio NUMERIC DEFAULT 1,
  content_preference TEXT DEFAULT 'balanced',
  
  -- Brand Story Open Rate
  brand_story_emails_sent INTEGER DEFAULT 0,
  brand_story_emails_opened INTEGER DEFAULT 0,
  brand_story_open_rate NUMERIC DEFAULT 0,
  brand_story_avg_read_time_seconds INTEGER,
  
  -- CTA Interaction Frequency
  total_ctas_viewed INTEGER DEFAULT 0,
  total_ctas_clicked INTEGER DEFAULT 0,
  cta_click_rate NUMERIC DEFAULT 0,
  cta_clicks_last_7d INTEGER DEFAULT 0,
  cta_clicks_last_30d INTEGER DEFAULT 0,
  cta_interaction_frequency NUMERIC DEFAULT 0,
  most_clicked_cta_type TEXT,
  
  -- Intent Score (Derived Composite Metric)
  intent_score NUMERIC DEFAULT 0,
  intent_level TEXT DEFAULT 'unknown',
  intent_trend TEXT DEFAULT 'stable',
  intent_score_components JSONB DEFAULT '{}',
  last_intent_signal_at TIMESTAMPTZ,
  
  -- Engagement Depth
  total_messages_received INTEGER DEFAULT 0,
  total_messages_opened INTEGER DEFAULT 0,
  total_messages_read_deeply INTEGER DEFAULT 0,
  engagement_depth_score NUMERIC DEFAULT 0,
  avg_messages_engaged_per_session NUMERIC DEFAULT 0,
  multi_content_sessions INTEGER DEFAULT 0,
  single_content_sessions INTEGER DEFAULT 0,
  depth_ratio NUMERIC DEFAULT 0,
  
  -- Click Pattern Consistency
  total_click_sessions INTEGER DEFAULT 0,
  clicks_on_first_cta INTEGER DEFAULT 0,
  clicks_after_scrolling INTEGER DEFAULT 0,
  avg_ctas_viewed_before_click NUMERIC DEFAULT 0,
  click_timing_pattern TEXT DEFAULT 'unknown',
  consistent_click_position TEXT,
  click_pattern_consistency_score NUMERIC DEFAULT 0,
  
  -- Message Relevance Score
  total_relevant_opens INTEGER DEFAULT 0,
  total_delayed_opens INTEGER DEFAULT 0,
  quick_open_rate NUMERIC DEFAULT 0,
  total_unsubscribe_requests INTEGER DEFAULT 0,
  total_spam_reports INTEGER DEFAULT 0,
  relevance_feedback_score NUMERIC DEFAULT 0,
  message_relevance_score NUMERIC DEFAULT 0,
  best_performing_content_category TEXT,
  worst_performing_content_category TEXT,
  
  -- Block-Level Engagement
  block_engagement_breakdown JSONB DEFAULT '{}',
  top_performing_block_types TEXT[] DEFAULT '{}',
  avg_blocks_viewed_per_message NUMERIC DEFAULT 0,
  
  -- Time-based patterns
  peak_engagement_hour INTEGER,
  peak_engagement_day TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Content Interaction Events (granular tracking)
CREATE TABLE public.content_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  
  campaign_id UUID,
  block_id UUID,
  message_id UUID,
  channel TEXT NOT NULL,
  
  content_type TEXT NOT NULL,
  content_category TEXT,
  block_type TEXT,
  
  interaction_type TEXT NOT NULL,
  cta_type TEXT,
  cta_position INTEGER,
  
  time_spent_seconds INTEGER,
  scroll_depth_percent INTEGER,
  blocks_viewed INTEGER,
  is_deep_engagement BOOLEAN DEFAULT FALSE,
  
  time_since_send_seconds INTEGER,
  is_quick_response BOOLEAN DEFAULT FALSE,
  
  device_type TEXT,
  user_agent TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campaign Content Classification
CREATE TABLE public.campaign_content_classification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  crm_campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  block_id UUID,
  
  content_type TEXT NOT NULL,
  content_category TEXT NOT NULL,
  
  is_brand_story BOOLEAN DEFAULT FALSE,
  is_time_sensitive BOOLEAN DEFAULT FALSE,
  is_educational BOOLEAN DEFAULT FALSE,
  is_promotional BOOLEAN DEFAULT FALSE,
  has_cta BOOLEAN DEFAULT FALSE,
  cta_types TEXT[] DEFAULT '{}',
  
  ai_classified BOOLEAN DEFAULT FALSE,
  ai_confidence_score NUMERIC,
  ai_classification_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_campaign_block UNIQUE (campaign_id, block_id),
  CONSTRAINT unique_crm_campaign_block UNIQUE (crm_campaign_id, block_id)
);

-- Enable RLS
ALTER TABLE public.customer_content_intent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_content_classification ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_content_intent_metrics
CREATE POLICY "Users can view content intent metrics for their tenant"
  ON public.customer_content_intent_metrics FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert content intent metrics for their tenant"
  ON public.customer_content_intent_metrics FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update content intent metrics for their tenant"
  ON public.customer_content_intent_metrics FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete content intent metrics for their tenant"
  ON public.customer_content_intent_metrics FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for content_interaction_events
CREATE POLICY "Users can view content interaction events for their tenant"
  ON public.content_interaction_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert content interaction events for their tenant"
  ON public.content_interaction_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage content interaction events"
  ON public.content_interaction_events FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for campaign_content_classification
CREATE POLICY "Users can view campaign content classification for their tenant"
  ON public.campaign_content_classification FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage campaign content classification for their tenant"
  ON public.campaign_content_classification FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_content_intent_customer ON public.customer_content_intent_metrics(customer_id);
CREATE INDEX idx_content_intent_tenant ON public.customer_content_intent_metrics(tenant_id);
CREATE INDEX idx_content_intent_score ON public.customer_content_intent_metrics(intent_score DESC);
CREATE INDEX idx_content_intent_level ON public.customer_content_intent_metrics(intent_level);

CREATE INDEX idx_content_events_customer ON public.content_interaction_events(customer_id);
CREATE INDEX idx_content_events_session ON public.content_interaction_events(session_id);
CREATE INDEX idx_content_events_campaign ON public.content_interaction_events(campaign_id);
CREATE INDEX idx_content_events_type ON public.content_interaction_events(interaction_type);
CREATE INDEX idx_content_events_created ON public.content_interaction_events(created_at DESC);
CREATE INDEX idx_content_events_tenant ON public.content_interaction_events(tenant_id);

CREATE INDEX idx_content_classification_campaign ON public.campaign_content_classification(campaign_id);
CREATE INDEX idx_content_classification_crm_campaign ON public.campaign_content_classification(crm_campaign_id);
CREATE INDEX idx_content_classification_type ON public.campaign_content_classification(content_type);

-- Triggers for updated_at
CREATE TRIGGER update_content_intent_updated_at
  BEFORE UPDATE ON public.customer_content_intent_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_classification_updated_at
  BEFORE UPDATE ON public.campaign_content_classification
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SQL FUNCTIONS FOR CONTENT INTENT METRICS
-- =============================================

-- Function to track content interaction
CREATE OR REPLACE FUNCTION public.track_content_interaction(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_session_id TEXT,
  p_channel TEXT,
  p_content_type TEXT,
  p_interaction_type TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_block_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL,
  p_content_category TEXT DEFAULT NULL,
  p_block_type TEXT DEFAULT NULL,
  p_cta_type TEXT DEFAULT NULL,
  p_cta_position INTEGER DEFAULT NULL,
  p_time_spent_seconds INTEGER DEFAULT NULL,
  p_scroll_depth_percent INTEGER DEFAULT NULL,
  p_blocks_viewed INTEGER DEFAULT NULL,
  p_time_since_send_seconds INTEGER DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_is_deep_engagement BOOLEAN := FALSE;
  v_is_quick_response BOOLEAN := FALSE;
BEGIN
  IF (p_time_spent_seconds IS NOT NULL AND p_time_spent_seconds > 30) OR 
     (p_scroll_depth_percent IS NOT NULL AND p_scroll_depth_percent > 75) THEN
    v_is_deep_engagement := TRUE;
  END IF;
  
  IF p_time_since_send_seconds IS NOT NULL AND p_time_since_send_seconds < 7200 THEN
    v_is_quick_response := TRUE;
  END IF;

  INSERT INTO content_interaction_events (
    tenant_id, customer_id, session_id, campaign_id, block_id, message_id,
    channel, content_type, content_category, block_type,
    interaction_type, cta_type, cta_position,
    time_spent_seconds, scroll_depth_percent, blocks_viewed,
    is_deep_engagement, time_since_send_seconds, is_quick_response,
    device_type, metadata
  ) VALUES (
    p_tenant_id, p_customer_id, p_session_id, p_campaign_id, p_block_id, p_message_id,
    p_channel, p_content_type, p_content_category, p_block_type,
    p_interaction_type, p_cta_type, p_cta_position,
    p_time_spent_seconds, p_scroll_depth_percent, p_blocks_viewed,
    v_is_deep_engagement, p_time_since_send_seconds, v_is_quick_response,
    p_device_type, p_metadata
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to calculate intent score
CREATE OR REPLACE FUNCTION public.calculate_content_intent_score(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics RECORD;
  v_intent_score NUMERIC := 0;
  v_cta_component NUMERIC := 0;
  v_depth_component NUMERIC := 0;
  v_consistency_component NUMERIC := 0;
  v_preference_component NUMERIC := 0;
  v_quick_response_component NUMERIC := 0;
  v_relevance_component NUMERIC := 0;
  v_intent_level TEXT := 'unknown';
  v_intent_trend TEXT := 'stable';
  v_recent_score NUMERIC;
  v_previous_score NUMERIC;
BEGIN
  SELECT * INTO v_metrics FROM customer_content_intent_metrics WHERE customer_id = p_customer_id;
  
  IF v_metrics IS NULL THEN
    RETURN jsonb_build_object(
      'intent_score', 0,
      'intent_level', 'unknown',
      'intent_trend', 'stable',
      'components', jsonb_build_object()
    );
  END IF;
  
  v_cta_component := LEAST(100, COALESCE(v_metrics.cta_interaction_frequency, 0) * 100);
  v_depth_component := COALESCE(v_metrics.engagement_depth_score, 0);
  v_consistency_component := COALESCE(v_metrics.click_pattern_consistency_score, 0);
  
  IF v_metrics.content_preference != 'balanced' THEN
    v_preference_component := 75;
  ELSE
    v_preference_component := 50;
  END IF;
  
  v_quick_response_component := COALESCE(v_metrics.quick_open_rate, 0);
  v_relevance_component := COALESCE(v_metrics.message_relevance_score, 0);
  
  v_intent_score := 
    (v_cta_component * 0.25) +
    (v_depth_component * 0.20) +
    (v_consistency_component * 0.15) +
    (v_preference_component * 0.15) +
    (v_quick_response_component * 0.15) +
    (v_relevance_component * 0.10);
  
  v_intent_score := GREATEST(0, LEAST(100, v_intent_score));
  
  IF v_intent_score >= 75 THEN
    v_intent_level := 'high';
  ELSIF v_intent_score >= 50 THEN
    v_intent_level := 'medium';
  ELSIF v_intent_score >= 25 THEN
    v_intent_level := 'low';
  ELSE
    v_intent_level := 'unknown';
  END IF;
  
  SELECT COALESCE(AVG(
    CASE WHEN is_deep_engagement THEN 100 ELSE 50 END +
    CASE WHEN is_quick_response THEN 50 ELSE 0 END
  ), 0) INTO v_recent_score
  FROM content_interaction_events
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - INTERVAL '30 days';
  
  SELECT COALESCE(AVG(
    CASE WHEN is_deep_engagement THEN 100 ELSE 50 END +
    CASE WHEN is_quick_response THEN 50 ELSE 0 END
  ), 0) INTO v_previous_score
  FROM content_interaction_events
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - INTERVAL '60 days'
    AND created_at < NOW() - INTERVAL '30 days';
  
  IF v_previous_score > 0 THEN
    IF v_recent_score > v_previous_score * 1.1 THEN
      v_intent_trend := 'increasing';
    ELSIF v_recent_score < v_previous_score * 0.9 THEN
      v_intent_trend := 'decreasing';
    ELSE
      v_intent_trend := 'stable';
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'intent_score', ROUND(v_intent_score, 2),
    'intent_level', v_intent_level,
    'intent_trend', v_intent_trend,
    'components', jsonb_build_object(
      'cta_frequency_component', ROUND(v_cta_component, 2),
      'engagement_depth_component', ROUND(v_depth_component, 2),
      'click_consistency_component', ROUND(v_consistency_component, 2),
      'content_preference_component', ROUND(v_preference_component, 2),
      'quick_response_component', ROUND(v_quick_response_component, 2),
      'relevance_component', ROUND(v_relevance_component, 2)
    )
  );
END;
$$;

-- Function to recalculate all content intent metrics for a customer
CREATE OR REPLACE FUNCTION public.recalculate_content_intent_metrics(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_story_views INTEGER := 0;
  v_offer_views INTEGER := 0;
  v_story_clicks INTEGER := 0;
  v_offer_clicks INTEGER := 0;
  v_story_engagement_rate NUMERIC := 0;
  v_offer_engagement_rate NUMERIC := 0;
  v_preferred_content_type TEXT := 'balanced';
  v_edu_received INTEGER := 0;
  v_edu_engaged INTEGER := 0;
  v_promo_received INTEGER := 0;
  v_promo_engaged INTEGER := 0;
  v_edu_response_rate NUMERIC := 0;
  v_promo_response_rate NUMERIC := 0;
  v_edu_promo_ratio NUMERIC := 1;
  v_content_preference TEXT := 'balanced';
  v_brand_story_sent INTEGER := 0;
  v_brand_story_opened INTEGER := 0;
  v_brand_story_open_rate NUMERIC := 0;
  v_brand_story_avg_read_time INTEGER;
  v_ctas_viewed INTEGER := 0;
  v_ctas_clicked INTEGER := 0;
  v_cta_click_rate NUMERIC := 0;
  v_cta_clicks_7d INTEGER := 0;
  v_cta_clicks_30d INTEGER := 0;
  v_cta_interaction_frequency NUMERIC := 0;
  v_most_clicked_cta TEXT;
  v_messages_received INTEGER := 0;
  v_messages_opened INTEGER := 0;
  v_messages_read_deeply INTEGER := 0;
  v_engagement_depth_score NUMERIC := 0;
  v_multi_sessions INTEGER := 0;
  v_single_sessions INTEGER := 0;
  v_depth_ratio NUMERIC := 0;
  v_click_sessions INTEGER := 0;
  v_first_cta_clicks INTEGER := 0;
  v_after_scroll_clicks INTEGER := 0;
  v_avg_ctas_before_click NUMERIC := 0;
  v_click_timing_pattern TEXT := 'unknown';
  v_click_consistency_score NUMERIC := 0;
  v_relevant_opens INTEGER := 0;
  v_delayed_opens INTEGER := 0;
  v_quick_open_rate NUMERIC := 0;
  v_unsubscribes INTEGER := 0;
  v_spam_reports INTEGER := 0;
  v_relevance_score NUMERIC := 0;
  v_intent_result JSONB;
  v_peak_hour INTEGER;
  v_peak_day TEXT;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM crm_customers WHERE id = p_customer_id;
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Content Type Engagement
  SELECT 
    COUNT(*) FILTER (WHERE content_type = 'story' AND interaction_type = 'view'),
    COUNT(*) FILTER (WHERE content_type = 'offer' AND interaction_type = 'view'),
    COUNT(*) FILTER (WHERE content_type = 'story' AND interaction_type IN ('click', 'cta_click')),
    COUNT(*) FILTER (WHERE content_type = 'offer' AND interaction_type IN ('click', 'cta_click'))
  INTO v_story_views, v_offer_views, v_story_clicks, v_offer_clicks
  FROM content_interaction_events
  WHERE customer_id = p_customer_id;
  
  IF v_story_views > 0 THEN v_story_engagement_rate := (v_story_clicks::NUMERIC / v_story_views) * 100; END IF;
  IF v_offer_views > 0 THEN v_offer_engagement_rate := (v_offer_clicks::NUMERIC / v_offer_views) * 100; END IF;
  
  IF v_story_engagement_rate > v_offer_engagement_rate * 1.2 THEN
    v_preferred_content_type := 'story';
  ELSIF v_offer_engagement_rate > v_story_engagement_rate * 1.2 THEN
    v_preferred_content_type := 'offer';
  END IF;
  
  -- Educational vs Promotional
  SELECT 
    COUNT(*) FILTER (WHERE content_category = 'educational'),
    COUNT(*) FILTER (WHERE content_category = 'educational' AND interaction_type IN ('click', 'cta_click', 'open')),
    COUNT(*) FILTER (WHERE content_category = 'promotional'),
    COUNT(*) FILTER (WHERE content_category = 'promotional' AND interaction_type IN ('click', 'cta_click', 'open'))
  INTO v_edu_received, v_edu_engaged, v_promo_received, v_promo_engaged
  FROM content_interaction_events
  WHERE customer_id = p_customer_id;
  
  IF v_edu_received > 0 THEN v_edu_response_rate := (v_edu_engaged::NUMERIC / v_edu_received) * 100; END IF;
  IF v_promo_received > 0 THEN v_promo_response_rate := (v_promo_engaged::NUMERIC / v_promo_received) * 100; END IF;
  IF v_promo_response_rate > 0 THEN v_edu_promo_ratio := v_edu_response_rate / v_promo_response_rate; END IF;
  
  IF v_edu_response_rate > v_promo_response_rate * 1.2 THEN
    v_content_preference := 'educational';
  ELSIF v_promo_response_rate > v_edu_response_rate * 1.2 THEN
    v_content_preference := 'promotional';
  END IF;
  
  -- Brand Story Open Rate
  SELECT 
    COUNT(*) FILTER (WHERE content_type = 'story'),
    COUNT(*) FILTER (WHERE content_type = 'story' AND interaction_type = 'open'),
    AVG(time_spent_seconds) FILTER (WHERE content_type = 'story' AND time_spent_seconds IS NOT NULL)
  INTO v_brand_story_sent, v_brand_story_opened, v_brand_story_avg_read_time
  FROM content_interaction_events
  WHERE customer_id = p_customer_id AND content_category = 'brand_story';
  
  IF v_brand_story_sent > 0 THEN 
    v_brand_story_open_rate := (v_brand_story_opened::NUMERIC / v_brand_story_sent) * 100; 
  END IF;
  
  -- CTA Interaction Frequency
  SELECT 
    COUNT(*) FILTER (WHERE interaction_type = 'view'),
    COUNT(*) FILTER (WHERE interaction_type = 'cta_click'),
    COUNT(*) FILTER (WHERE interaction_type = 'cta_click' AND created_at >= NOW() - INTERVAL '7 days'),
    COUNT(*) FILTER (WHERE interaction_type = 'cta_click' AND created_at >= NOW() - INTERVAL '30 days')
  INTO v_ctas_viewed, v_ctas_clicked, v_cta_clicks_7d, v_cta_clicks_30d
  FROM content_interaction_events
  WHERE customer_id = p_customer_id;
  
  IF v_ctas_viewed > 0 THEN v_cta_click_rate := (v_ctas_clicked::NUMERIC / v_ctas_viewed) * 100; END IF;
  
  SELECT COUNT(DISTINCT message_id) INTO v_messages_received
  FROM content_interaction_events WHERE customer_id = p_customer_id;
  
  IF v_messages_received > 0 THEN
    v_cta_interaction_frequency := v_ctas_clicked::NUMERIC / v_messages_received;
  END IF;
  
  SELECT cta_type INTO v_most_clicked_cta
  FROM content_interaction_events
  WHERE customer_id = p_customer_id AND cta_type IS NOT NULL
  GROUP BY cta_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Engagement Depth
  SELECT 
    COUNT(DISTINCT message_id),
    COUNT(DISTINCT message_id) FILTER (WHERE interaction_type = 'open'),
    COUNT(DISTINCT message_id) FILTER (WHERE is_deep_engagement = TRUE)
  INTO v_messages_received, v_messages_opened, v_messages_read_deeply
  FROM content_interaction_events
  WHERE customer_id = p_customer_id;
  
  IF v_messages_opened > 0 THEN
    v_engagement_depth_score := (v_messages_read_deeply::NUMERIC / v_messages_opened) * 100;
  END IF;
  
  SELECT 
    COUNT(*) FILTER (WHERE cnt >= 2),
    COUNT(*) FILTER (WHERE cnt = 1)
  INTO v_multi_sessions, v_single_sessions
  FROM (
    SELECT session_id, COUNT(*) as cnt
    FROM content_interaction_events
    WHERE customer_id = p_customer_id
    GROUP BY session_id
  ) s;
  
  IF (v_multi_sessions + v_single_sessions) > 0 THEN
    v_depth_ratio := v_multi_sessions::NUMERIC / (v_multi_sessions + v_single_sessions);
  END IF;
  
  -- Click Pattern Consistency
  SELECT 
    COUNT(DISTINCT session_id) FILTER (WHERE interaction_type = 'cta_click'),
    COUNT(*) FILTER (WHERE interaction_type = 'cta_click' AND cta_position = 1),
    COUNT(*) FILTER (WHERE interaction_type = 'cta_click' AND cta_position > 1),
    AVG(cta_position) FILTER (WHERE interaction_type = 'cta_click' AND cta_position IS NOT NULL)
  INTO v_click_sessions, v_first_cta_clicks, v_after_scroll_clicks, v_avg_ctas_before_click
  FROM content_interaction_events
  WHERE customer_id = p_customer_id;
  
  SELECT 
    CASE 
      WHEN AVG(time_since_send_seconds) < 300 THEN 'immediate'
      WHEN AVG(time_since_send_seconds) < 7200 THEN 'considered'
      ELSE 'delayed'
    END INTO v_click_timing_pattern
  FROM content_interaction_events
  WHERE customer_id = p_customer_id AND time_since_send_seconds IS NOT NULL;
  
  IF v_click_sessions > 5 THEN
    IF v_first_cta_clicks > v_after_scroll_clicks * 2 OR v_after_scroll_clicks > v_first_cta_clicks * 2 THEN
      v_click_consistency_score := 80;
    ELSE
      v_click_consistency_score := 50;
    END IF;
  ELSE
    v_click_consistency_score := 30;
  END IF;
  
  -- Message Relevance Score
  SELECT 
    COUNT(*) FILTER (WHERE is_quick_response = TRUE),
    COUNT(*) FILTER (WHERE is_quick_response = FALSE AND time_since_send_seconds > 86400)
  INTO v_relevant_opens, v_delayed_opens
  FROM content_interaction_events
  WHERE customer_id = p_customer_id AND interaction_type = 'open';
  
  IF (v_relevant_opens + v_delayed_opens) > 0 THEN
    v_quick_open_rate := (v_relevant_opens::NUMERIC / (v_relevant_opens + v_delayed_opens)) * 100;
  END IF;
  
  v_relevance_score := GREATEST(0, LEAST(100,
    (v_quick_open_rate * 0.4) +
    (v_engagement_depth_score * 0.3) +
    (v_cta_click_rate * 0.3) -
    (v_unsubscribes * 20) -
    (v_spam_reports * 50)
  ));
  
  SELECT EXTRACT(HOUR FROM created_at)::INTEGER INTO v_peak_hour
  FROM content_interaction_events
  WHERE customer_id = p_customer_id
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  SELECT TO_CHAR(created_at, 'Day') INTO v_peak_day
  FROM content_interaction_events
  WHERE customer_id = p_customer_id
  GROUP BY TO_CHAR(created_at, 'Day')
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Upsert metrics
  INSERT INTO customer_content_intent_metrics (
    customer_id, tenant_id,
    total_story_views, total_offer_views, total_story_clicks, total_offer_clicks,
    story_engagement_rate, offer_engagement_rate, preferred_content_type,
    educational_messages_received, educational_messages_engaged,
    promotional_messages_received, promotional_messages_engaged,
    educational_response_rate, promotional_response_rate, edu_promo_ratio, content_preference,
    brand_story_emails_sent, brand_story_emails_opened, brand_story_open_rate, brand_story_avg_read_time_seconds,
    total_ctas_viewed, total_ctas_clicked, cta_click_rate, cta_clicks_last_7d, cta_clicks_last_30d,
    cta_interaction_frequency, most_clicked_cta_type,
    total_messages_received, total_messages_opened, total_messages_read_deeply,
    engagement_depth_score, multi_content_sessions, single_content_sessions, depth_ratio,
    total_click_sessions, clicks_on_first_cta, clicks_after_scrolling,
    avg_ctas_viewed_before_click, click_timing_pattern, click_pattern_consistency_score,
    total_relevant_opens, total_delayed_opens, quick_open_rate,
    total_unsubscribe_requests, total_spam_reports, message_relevance_score,
    peak_engagement_hour, peak_engagement_day,
    updated_at
  ) VALUES (
    p_customer_id, v_tenant_id,
    v_story_views, v_offer_views, v_story_clicks, v_offer_clicks,
    v_story_engagement_rate, v_offer_engagement_rate, v_preferred_content_type,
    v_edu_received, v_edu_engaged,
    v_promo_received, v_promo_engaged,
    v_edu_response_rate, v_promo_response_rate, v_edu_promo_ratio, v_content_preference,
    v_brand_story_sent, v_brand_story_opened, v_brand_story_open_rate, v_brand_story_avg_read_time,
    v_ctas_viewed, v_ctas_clicked, v_cta_click_rate, v_cta_clicks_7d, v_cta_clicks_30d,
    v_cta_interaction_frequency, v_most_clicked_cta,
    v_messages_received, v_messages_opened, v_messages_read_deeply,
    v_engagement_depth_score, v_multi_sessions, v_single_sessions, v_depth_ratio,
    v_click_sessions, v_first_cta_clicks, v_after_scroll_clicks,
    v_avg_ctas_before_click, v_click_timing_pattern, v_click_consistency_score,
    v_relevant_opens, v_delayed_opens, v_quick_open_rate,
    v_unsubscribes, v_spam_reports, v_relevance_score,
    v_peak_hour, v_peak_day,
    NOW()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    total_story_views = EXCLUDED.total_story_views,
    total_offer_views = EXCLUDED.total_offer_views,
    total_story_clicks = EXCLUDED.total_story_clicks,
    total_offer_clicks = EXCLUDED.total_offer_clicks,
    story_engagement_rate = EXCLUDED.story_engagement_rate,
    offer_engagement_rate = EXCLUDED.offer_engagement_rate,
    preferred_content_type = EXCLUDED.preferred_content_type,
    educational_messages_received = EXCLUDED.educational_messages_received,
    educational_messages_engaged = EXCLUDED.educational_messages_engaged,
    promotional_messages_received = EXCLUDED.promotional_messages_received,
    promotional_messages_engaged = EXCLUDED.promotional_messages_engaged,
    educational_response_rate = EXCLUDED.educational_response_rate,
    promotional_response_rate = EXCLUDED.promotional_response_rate,
    edu_promo_ratio = EXCLUDED.edu_promo_ratio,
    content_preference = EXCLUDED.content_preference,
    brand_story_emails_sent = EXCLUDED.brand_story_emails_sent,
    brand_story_emails_opened = EXCLUDED.brand_story_emails_opened,
    brand_story_open_rate = EXCLUDED.brand_story_open_rate,
    brand_story_avg_read_time_seconds = EXCLUDED.brand_story_avg_read_time_seconds,
    total_ctas_viewed = EXCLUDED.total_ctas_viewed,
    total_ctas_clicked = EXCLUDED.total_ctas_clicked,
    cta_click_rate = EXCLUDED.cta_click_rate,
    cta_clicks_last_7d = EXCLUDED.cta_clicks_last_7d,
    cta_clicks_last_30d = EXCLUDED.cta_clicks_last_30d,
    cta_interaction_frequency = EXCLUDED.cta_interaction_frequency,
    most_clicked_cta_type = EXCLUDED.most_clicked_cta_type,
    total_messages_received = EXCLUDED.total_messages_received,
    total_messages_opened = EXCLUDED.total_messages_opened,
    total_messages_read_deeply = EXCLUDED.total_messages_read_deeply,
    engagement_depth_score = EXCLUDED.engagement_depth_score,
    multi_content_sessions = EXCLUDED.multi_content_sessions,
    single_content_sessions = EXCLUDED.single_content_sessions,
    depth_ratio = EXCLUDED.depth_ratio,
    total_click_sessions = EXCLUDED.total_click_sessions,
    clicks_on_first_cta = EXCLUDED.clicks_on_first_cta,
    clicks_after_scrolling = EXCLUDED.clicks_after_scrolling,
    avg_ctas_viewed_before_click = EXCLUDED.avg_ctas_viewed_before_click,
    click_timing_pattern = EXCLUDED.click_timing_pattern,
    click_pattern_consistency_score = EXCLUDED.click_pattern_consistency_score,
    total_relevant_opens = EXCLUDED.total_relevant_opens,
    total_delayed_opens = EXCLUDED.total_delayed_opens,
    quick_open_rate = EXCLUDED.quick_open_rate,
    total_unsubscribe_requests = EXCLUDED.total_unsubscribe_requests,
    total_spam_reports = EXCLUDED.total_spam_reports,
    message_relevance_score = EXCLUDED.message_relevance_score,
    peak_engagement_hour = EXCLUDED.peak_engagement_hour,
    peak_engagement_day = EXCLUDED.peak_engagement_day,
    updated_at = NOW();
  
  -- Calculate and update intent score
  v_intent_result := calculate_content_intent_score(p_customer_id);
  
  UPDATE customer_content_intent_metrics SET
    intent_score = (v_intent_result->>'intent_score')::NUMERIC,
    intent_level = v_intent_result->>'intent_level',
    intent_trend = v_intent_result->>'intent_trend',
    intent_score_components = v_intent_result->'components',
    last_intent_signal_at = CASE 
      WHEN (v_intent_result->>'intent_score')::NUMERIC > 50 THEN NOW() 
      ELSE last_intent_signal_at 
    END
  WHERE customer_id = p_customer_id;
END;
$$;

-- Function to get tenant-level content intent statistics
CREATE OR REPLACE FUNCTION public.get_tenant_content_intent_stats(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'avg_intent_score', ROUND(AVG(intent_score), 2),
    'intent_level_breakdown', jsonb_build_object(
      'high', COUNT(*) FILTER (WHERE intent_level = 'high'),
      'medium', COUNT(*) FILTER (WHERE intent_level = 'medium'),
      'low', COUNT(*) FILTER (WHERE intent_level = 'low'),
      'unknown', COUNT(*) FILTER (WHERE intent_level = 'unknown')
    ),
    'avg_engagement_depth_score', ROUND(AVG(engagement_depth_score), 2),
    'avg_click_pattern_consistency', ROUND(AVG(click_pattern_consistency_score), 2),
    'avg_message_relevance_score', ROUND(AVG(message_relevance_score), 2),
    'content_type_performance', jsonb_build_object(
      'story_avg_engagement', ROUND(AVG(story_engagement_rate), 2),
      'offer_avg_engagement', ROUND(AVG(offer_engagement_rate), 2)
    ),
    'edu_vs_promo_preference', jsonb_build_object(
      'educational_preferred', COUNT(*) FILTER (WHERE content_preference = 'educational'),
      'promotional_preferred', COUNT(*) FILTER (WHERE content_preference = 'promotional'),
      'balanced', COUNT(*) FILTER (WHERE content_preference = 'balanced')
    ),
    'avg_cta_click_rate', ROUND(AVG(cta_click_rate), 2),
    'avg_brand_story_open_rate', ROUND(AVG(brand_story_open_rate), 2)
  ) INTO v_stats
  FROM customer_content_intent_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_stats;
END;
$$;

-- Function to refresh all content intent metrics for a tenant
CREATE OR REPLACE FUNCTION public.refresh_all_content_intent_metrics(p_tenant_id UUID)
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
    SELECT id FROM crm_customers WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM recalculate_content_intent_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;