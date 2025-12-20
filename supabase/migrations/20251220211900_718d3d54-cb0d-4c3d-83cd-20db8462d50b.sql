-- First drop the existing view to avoid column rename issues
DROP VIEW IF EXISTS public.customer_360_enriched;

-- =====================================================
-- PHASE 1: Create Dedicated Metrics Tables
-- =====================================================

-- 1.1 Customer Identity Metrics Table
CREATE TABLE IF NOT EXISTS public.customer_identity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Source/acquisition
  signup_source TEXT,
  signup_campaign TEXT,
  signup_referrer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  
  -- Channel preference
  preferred_channel TEXT CHECK (preferred_channel IN ('email', 'sms', 'both', 'none')),
  
  -- Geographic
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  country_code TEXT,
  lat NUMERIC,
  lon NUMERIC,
  timezone TEXT,
  
  -- Store association
  store_id TEXT,
  store_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Customer Email Metrics Table
CREATE TABLE IF NOT EXISTS public.customer_email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Counters
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  soft_bounces INTEGER DEFAULT 0,
  hard_bounces INTEGER DEFAULT 0,
  total_unsubscribes INTEGER DEFAULT 0,
  
  -- Rates (computed/stored)
  open_rate NUMERIC DEFAULT 0,
  click_rate NUMERIC DEFAULT 0,
  ctor NUMERIC DEFAULT 0,
  bounce_rate NUMERIC DEFAULT 0,
  
  -- Time metrics
  avg_time_to_open_minutes INTEGER,
  avg_time_to_click_minutes INTEGER,
  
  -- Timestamps
  last_sent_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  last_bounced_at TIMESTAMPTZ,
  
  -- Score
  engagement_score NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Customer SMS Metrics Table
CREATE TABLE IF NOT EXISTS public.customer_sms_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Counters
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  
  -- Rates
  delivery_rate NUMERIC DEFAULT 0,
  click_rate NUMERIC DEFAULT 0,
  reply_rate NUMERIC DEFAULT 0,
  
  -- Timestamps
  last_sent_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Customer Engagement Summary Table
CREATE TABLE IF NOT EXISTS public.customer_engagement_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Overall engagement
  overall_engagement_score NUMERIC DEFAULT 0,
  engagement_tier TEXT CHECK (engagement_tier IN ('hot', 'warm', 'cold', 'dormant')) DEFAULT 'cold',
  
  -- Channel scores
  email_score NUMERIC DEFAULT 0,
  sms_score NUMERIC DEFAULT 0,
  purchase_score NUMERIC DEFAULT 0,
  
  -- Activity
  last_engagement_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PHASE 2: Create Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customer_identity_metrics_customer_id ON public.customer_identity_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_identity_metrics_tenant_id ON public.customer_identity_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_identity_metrics_city ON public.customer_identity_metrics(city);
CREATE INDEX IF NOT EXISTS idx_customer_identity_metrics_postal_code ON public.customer_identity_metrics(postal_code);

CREATE INDEX IF NOT EXISTS idx_customer_email_metrics_customer_id ON public.customer_email_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_email_metrics_tenant_id ON public.customer_email_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_email_metrics_engagement_score ON public.customer_email_metrics(engagement_score);
CREATE INDEX IF NOT EXISTS idx_customer_email_metrics_open_rate ON public.customer_email_metrics(open_rate);

CREATE INDEX IF NOT EXISTS idx_customer_sms_metrics_customer_id ON public.customer_sms_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sms_metrics_tenant_id ON public.customer_sms_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_customer_engagement_summary_customer_id ON public.customer_engagement_summary(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_engagement_summary_tenant_id ON public.customer_engagement_summary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_engagement_summary_tier ON public.customer_engagement_summary(engagement_tier);
CREATE INDEX IF NOT EXISTS idx_customer_engagement_summary_score ON public.customer_engagement_summary(overall_engagement_score);

-- =====================================================
-- PHASE 3: Enable RLS and Create Policies
-- =====================================================

ALTER TABLE public.customer_identity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_email_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sms_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_engagement_summary ENABLE ROW LEVEL SECURITY;

-- Identity Metrics Policies
DROP POLICY IF EXISTS "Users can view their tenant's identity metrics" ON public.customer_identity_metrics;
CREATE POLICY "Users can view their tenant's identity metrics"
  ON public.customer_identity_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_identity_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their tenant's identity metrics" ON public.customer_identity_metrics;
CREATE POLICY "Users can insert their tenant's identity metrics"
  ON public.customer_identity_metrics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_identity_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their tenant's identity metrics" ON public.customer_identity_metrics;
CREATE POLICY "Users can update their tenant's identity metrics"
  ON public.customer_identity_metrics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_identity_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their tenant's identity metrics" ON public.customer_identity_metrics;
CREATE POLICY "Users can delete their tenant's identity metrics"
  ON public.customer_identity_metrics FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_identity_metrics.tenant_id AND u.id = auth.uid()));

-- Email Metrics Policies
DROP POLICY IF EXISTS "Users can view their tenant's email metrics" ON public.customer_email_metrics;
CREATE POLICY "Users can view their tenant's email metrics"
  ON public.customer_email_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_email_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their tenant's email metrics" ON public.customer_email_metrics;
CREATE POLICY "Users can insert their tenant's email metrics"
  ON public.customer_email_metrics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_email_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their tenant's email metrics" ON public.customer_email_metrics;
CREATE POLICY "Users can update their tenant's email metrics"
  ON public.customer_email_metrics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_email_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their tenant's email metrics" ON public.customer_email_metrics;
CREATE POLICY "Users can delete their tenant's email metrics"
  ON public.customer_email_metrics FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_email_metrics.tenant_id AND u.id = auth.uid()));

-- SMS Metrics Policies
DROP POLICY IF EXISTS "Users can view their tenant's sms metrics" ON public.customer_sms_metrics;
CREATE POLICY "Users can view their tenant's sms metrics"
  ON public.customer_sms_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_sms_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their tenant's sms metrics" ON public.customer_sms_metrics;
CREATE POLICY "Users can insert their tenant's sms metrics"
  ON public.customer_sms_metrics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_sms_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their tenant's sms metrics" ON public.customer_sms_metrics;
CREATE POLICY "Users can update their tenant's sms metrics"
  ON public.customer_sms_metrics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_sms_metrics.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their tenant's sms metrics" ON public.customer_sms_metrics;
CREATE POLICY "Users can delete their tenant's sms metrics"
  ON public.customer_sms_metrics FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_sms_metrics.tenant_id AND u.id = auth.uid()));

-- Engagement Summary Policies
DROP POLICY IF EXISTS "Users can view their tenant's engagement summary" ON public.customer_engagement_summary;
CREATE POLICY "Users can view their tenant's engagement summary"
  ON public.customer_engagement_summary FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_engagement_summary.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their tenant's engagement summary" ON public.customer_engagement_summary;
CREATE POLICY "Users can insert their tenant's engagement summary"
  ON public.customer_engagement_summary FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_engagement_summary.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their tenant's engagement summary" ON public.customer_engagement_summary;
CREATE POLICY "Users can update their tenant's engagement summary"
  ON public.customer_engagement_summary FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_engagement_summary.tenant_id AND u.id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their tenant's engagement summary" ON public.customer_engagement_summary;
CREATE POLICY "Users can delete their tenant's engagement summary"
  ON public.customer_engagement_summary FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.tenant_id = customer_engagement_summary.tenant_id AND u.id = auth.uid()));

-- =====================================================
-- PHASE 4: Create Unified View
-- =====================================================

CREATE OR REPLACE VIEW public.customer_360_enriched AS
SELECT 
  -- Core customer fields
  c.id,
  c.tenant_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.email_opt_in,
  c.sms_opt_in,
  c.persona_id,
  c.persona,
  c.tags,
  c.is_vip,
  c.suppressed,
  c.created_at,
  c.updated_at,
  
  -- Lifetime value from core table
  c.lifetime_value,
  c.total_spent,
  c.first_purchase_date,
  c.last_purchase_date,
  
  -- Identity metrics (with fallback to legacy columns)
  COALESCE(im.signup_source, c.signup_source) AS signup_source,
  COALESCE(im.signup_campaign, c.signup_campaign) AS signup_campaign,
  COALESCE(im.preferred_channel, c.preferred_channel) AS preferred_channel,
  COALESCE(im.city, c.city) AS city,
  COALESCE(im.state_region, c.state_region) AS state_region,
  COALESCE(im.postal_code, c.postal_code) AS postal_code,
  COALESCE(im.country_code, c.country_code) AS country_code,
  COALESCE(im.store_id, c.store_id) AS store_id,
  COALESCE(im.store_name, c.store_name) AS store_name,
  COALESCE(im.lat, c.lat) AS lat,
  COALESCE(im.lon, c.lon) AS lon,
  COALESCE(im.timezone, c.timezone) AS timezone,
  
  -- Email metrics (with fallback to legacy columns)
  COALESCE(em.total_sent, c.total_emails_sent, 0) AS total_emails_sent,
  COALESCE(em.total_delivered, c.total_emails_delivered, 0) AS total_emails_delivered,
  COALESCE(em.total_opened, c.total_emails_opened, 0) AS total_emails_opened,
  COALESCE(em.total_clicked, c.total_emails_clicked, 0) AS total_emails_clicked,
  COALESCE(em.total_bounced, c.total_emails_bounced, 0) AS total_emails_bounced,
  COALESCE(em.soft_bounces, c.total_soft_bounces, 0) AS total_soft_bounces,
  COALESCE(em.hard_bounces, c.total_hard_bounces, 0) AS total_hard_bounces,
  COALESCE(em.total_unsubscribes, c.total_unsubscribes, 0) AS total_unsubscribes,
  COALESCE(em.open_rate, c.email_open_rate, 0) AS email_open_rate,
  COALESCE(em.click_rate, c.email_click_rate, 0) AS email_click_rate,
  COALESCE(em.ctor, c.email_ctor, 0) AS email_ctor,
  COALESCE(em.bounce_rate, c.email_bounce_rate, 0) AS email_bounce_rate,
  COALESCE(em.avg_time_to_open_minutes, c.avg_time_to_open_minutes) AS avg_time_to_open_minutes,
  COALESCE(em.avg_time_to_click_minutes, c.avg_time_to_click_minutes) AS avg_time_to_click_minutes,
  COALESCE(em.last_sent_at, c.last_email_sent_at) AS last_email_sent_at,
  COALESCE(em.last_delivered_at, c.last_email_delivered_at) AS last_email_delivered_at,
  COALESCE(em.last_opened_at, c.last_open_at) AS last_email_opened_at,
  COALESCE(em.last_clicked_at, c.last_email_clicked_at) AS last_email_clicked_at,
  COALESCE(em.last_bounced_at, c.last_email_bounced_at) AS last_email_bounced_at,
  COALESCE(em.engagement_score, c.email_engagement_score, 0) AS email_engagement_score,
  
  -- SMS metrics
  COALESCE(sm.total_sent, 0) AS sms_total_sent,
  COALESCE(sm.total_delivered, 0) AS sms_total_delivered,
  COALESCE(sm.total_clicked, 0) AS sms_total_clicked,
  COALESCE(sm.total_replied, 0) AS sms_total_replied,
  COALESCE(sm.total_failed, 0) AS sms_total_failed,
  COALESCE(sm.delivery_rate, 0) AS sms_delivery_rate,
  COALESCE(sm.click_rate, 0) AS sms_click_rate,
  COALESCE(sm.reply_rate, 0) AS sms_reply_rate,
  sm.last_sent_at AS sms_last_sent_at,
  sm.last_replied_at AS sms_last_replied_at,
  
  -- Engagement summary
  COALESCE(es.overall_engagement_score, 0) AS overall_engagement_score,
  COALESCE(es.engagement_tier, 'cold') AS engagement_tier,
  COALESCE(es.email_score, 0) AS channel_email_score,
  COALESCE(es.sms_score, 0) AS channel_sms_score,
  COALESCE(es.purchase_score, 0) AS channel_purchase_score,
  es.last_engagement_at,
  es.last_calculated_at AS engagement_last_calculated_at,
  
  -- Computed fields for segment builder
  EXTRACT(DAY FROM NOW() - COALESCE(es.last_engagement_at, c.created_at))::INTEGER AS days_since_last_engagement,
  EXTRACT(DAY FROM NOW() - c.last_purchase_date)::INTEGER AS days_since_last_purchase,
  EXTRACT(DAY FROM NOW() - COALESCE(em.last_opened_at, c.last_open_at))::INTEGER AS days_since_last_email_open,
  
  -- Structured engagement metrics as JSONB for flexible querying
  jsonb_build_object(
    'email', jsonb_build_object(
      'total_sent', COALESCE(em.total_sent, c.total_emails_sent, 0),
      'total_opened', COALESCE(em.total_opened, c.total_emails_opened, 0),
      'total_clicked', COALESCE(em.total_clicked, c.total_emails_clicked, 0),
      'open_rate', COALESCE(em.open_rate, c.email_open_rate, 0),
      'click_rate', COALESCE(em.click_rate, c.email_click_rate, 0),
      'engagement_score', COALESCE(em.engagement_score, c.email_engagement_score, 0)
    ),
    'sms', jsonb_build_object(
      'total_sent', COALESCE(sm.total_sent, 0),
      'total_delivered', COALESCE(sm.total_delivered, 0),
      'total_replied', COALESCE(sm.total_replied, 0),
      'reply_rate', COALESCE(sm.reply_rate, 0)
    ),
    'overall', jsonb_build_object(
      'engagement_score', COALESCE(es.overall_engagement_score, 0),
      'engagement_tier', COALESCE(es.engagement_tier, 'cold'),
      'email_score', COALESCE(es.email_score, 0),
      'sms_score', COALESCE(es.sms_score, 0),
      'purchase_score', COALESCE(es.purchase_score, 0)
    )
  ) AS engagement_metrics

FROM public.crm_customers c
LEFT JOIN public.customer_identity_metrics im ON im.customer_id = c.id
LEFT JOIN public.customer_email_metrics em ON em.customer_id = c.id
LEFT JOIN public.customer_sms_metrics sm ON sm.customer_id = c.id
LEFT JOIN public.customer_engagement_summary es ON es.customer_id = c.id;

-- =====================================================
-- PHASE 5: Create Trigger for Auto-Creating Metric Rows
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_customer_metric_rows()
RETURNS TRIGGER AS $$
BEGIN
  -- Create identity metrics row
  INSERT INTO public.customer_identity_metrics (customer_id, tenant_id, signup_source, city, state_region, postal_code, country_code, store_id, store_name, preferred_channel, lat, lon, timezone)
  VALUES (NEW.id, NEW.tenant_id, NEW.signup_source, NEW.city, NEW.state_region, NEW.postal_code, NEW.country_code, NEW.store_id, NEW.store_name, NEW.preferred_channel, NEW.lat, NEW.lon, NEW.timezone)
  ON CONFLICT (customer_id) DO NOTHING;
  
  -- Create email metrics row
  INSERT INTO public.customer_email_metrics (customer_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  -- Create SMS metrics row
  INSERT INTO public.customer_sms_metrics (customer_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  -- Create engagement summary row
  INSERT INTO public.customer_engagement_summary (customer_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_create_customer_metric_rows ON public.crm_customers;
CREATE TRIGGER trg_create_customer_metric_rows
  AFTER INSERT ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.create_customer_metric_rows();

-- =====================================================
-- PHASE 6: Create Engagement Recalculation Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.recalculate_customer_engagement(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_email_score NUMERIC := 0;
  v_sms_score NUMERIC := 0;
  v_purchase_score NUMERIC := 0;
  v_overall_score NUMERIC;
  v_tier TEXT;
  v_last_engagement TIMESTAMPTZ;
BEGIN
  -- Calculate email score (weighted: opens 30%, clicks 50%, recency 20%)
  SELECT 
    LEAST(100, (
      (COALESCE(open_rate, 0) * 0.3) + 
      (COALESCE(click_rate, 0) * 0.5) + 
      (CASE WHEN last_opened_at > NOW() - INTERVAL '7 days' THEN 20 
            WHEN last_opened_at > NOW() - INTERVAL '30 days' THEN 10 
            ELSE 0 END)
    ))
  INTO v_email_score
  FROM public.customer_email_metrics 
  WHERE customer_id = p_customer_id;
  
  -- Calculate SMS score
  SELECT 
    LEAST(100, (
      (COALESCE(reply_rate, 0) * 0.6) + 
      (COALESCE(click_rate, 0) * 0.4)
    ))
  INTO v_sms_score
  FROM public.customer_sms_metrics 
  WHERE customer_id = p_customer_id;
  
  -- Calculate purchase score from crm_customers
  SELECT 
    LEAST(100, (
      CASE WHEN lifetime_value > 1000 THEN 40 
           WHEN lifetime_value > 500 THEN 30 
           WHEN lifetime_value > 100 THEN 20 
           WHEN lifetime_value > 0 THEN 10 
           ELSE 0 END +
      CASE WHEN last_purchase_date > NOW() - INTERVAL '30 days' THEN 30 
           WHEN last_purchase_date > NOW() - INTERVAL '90 days' THEN 20 
           WHEN last_purchase_date > NOW() - INTERVAL '180 days' THEN 10 
           ELSE 0 END
    ))
  INTO v_purchase_score
  FROM public.crm_customers 
  WHERE id = p_customer_id;
  
  -- Calculate overall score (weighted average)
  v_overall_score := (COALESCE(v_email_score, 0) * 0.4) + 
                     (COALESCE(v_sms_score, 0) * 0.2) + 
                     (COALESCE(v_purchase_score, 0) * 0.4);
  
  -- Determine engagement tier
  v_tier := CASE 
    WHEN v_overall_score >= 70 THEN 'hot'
    WHEN v_overall_score >= 40 THEN 'warm'
    WHEN v_overall_score >= 10 THEN 'cold'
    ELSE 'dormant'
  END;
  
  -- Get last engagement timestamp
  SELECT GREATEST(
    em.last_opened_at,
    em.last_clicked_at,
    sm.last_replied_at,
    c.last_purchase_date
  ) INTO v_last_engagement
  FROM public.crm_customers c
  LEFT JOIN public.customer_email_metrics em ON em.customer_id = c.id
  LEFT JOIN public.customer_sms_metrics sm ON sm.customer_id = c.id
  WHERE c.id = p_customer_id;
  
  -- Upsert engagement summary
  INSERT INTO public.customer_engagement_summary (
    customer_id, 
    tenant_id,
    email_score,
    sms_score,
    purchase_score,
    overall_engagement_score,
    engagement_tier,
    last_engagement_at,
    last_calculated_at
  )
  SELECT 
    p_customer_id,
    tenant_id,
    COALESCE(v_email_score, 0),
    COALESCE(v_sms_score, 0),
    COALESCE(v_purchase_score, 0),
    COALESCE(v_overall_score, 0),
    v_tier,
    v_last_engagement,
    NOW()
  FROM public.crm_customers WHERE id = p_customer_id
  ON CONFLICT (customer_id) DO UPDATE SET
    email_score = EXCLUDED.email_score,
    sms_score = EXCLUDED.sms_score,
    purchase_score = EXCLUDED.purchase_score,
    overall_engagement_score = EXCLUDED.overall_engagement_score,
    engagement_tier = EXCLUDED.engagement_tier,
    last_engagement_at = EXCLUDED.last_engagement_at,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- PHASE 7: Create Updated_at Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_customer_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_identity_metrics_updated_at ON public.customer_identity_metrics;
CREATE TRIGGER update_customer_identity_metrics_updated_at
  BEFORE UPDATE ON public.customer_identity_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_metrics_updated_at();

DROP TRIGGER IF EXISTS update_customer_email_metrics_updated_at ON public.customer_email_metrics;
CREATE TRIGGER update_customer_email_metrics_updated_at
  BEFORE UPDATE ON public.customer_email_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_metrics_updated_at();

DROP TRIGGER IF EXISTS update_customer_sms_metrics_updated_at ON public.customer_sms_metrics;
CREATE TRIGGER update_customer_sms_metrics_updated_at
  BEFORE UPDATE ON public.customer_sms_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_metrics_updated_at();

DROP TRIGGER IF EXISTS update_customer_engagement_summary_updated_at ON public.customer_engagement_summary;
CREATE TRIGGER update_customer_engagement_summary_updated_at
  BEFORE UPDATE ON public.customer_engagement_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_metrics_updated_at();