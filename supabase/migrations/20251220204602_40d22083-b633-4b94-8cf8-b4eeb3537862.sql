-- =====================================================
-- EMAIL ENGAGEMENT METRICS - Customer Level Tracking
-- =====================================================

-- Add email engagement counters to crm_customers
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_emails_delivered INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_emails_opened INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_emails_clicked INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_emails_bounced INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_soft_bounces INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_hard_bounces INTEGER DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS total_unsubscribes INTEGER DEFAULT 0;

-- Calculated engagement rates (stored as decimals, e.g., 0.25 = 25%)
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS email_open_rate NUMERIC(5,4) DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS email_click_rate NUMERIC(5,4) DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS email_ctor NUMERIC(5,4) DEFAULT 0;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS email_bounce_rate NUMERIC(5,4) DEFAULT 0;

-- Time-based metrics (averages in minutes)
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS avg_time_to_open_minutes INTEGER;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS avg_time_to_click_minutes INTEGER;

-- Timestamp tracking
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS last_email_delivered_at TIMESTAMPTZ;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS last_email_clicked_at TIMESTAMPTZ;
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS last_email_bounced_at TIMESTAMPTZ;

-- Overall engagement score (0-100)
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS email_engagement_score NUMERIC(5,2) DEFAULT 0;

-- =====================================================
-- Enhance email_tracking_events for time calculations
-- =====================================================

ALTER TABLE public.email_tracking_events ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.email_tracking_events ADD COLUMN IF NOT EXISTS time_to_event_seconds INTEGER;
ALTER TABLE public.email_tracking_events ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL;
ALTER TABLE public.email_tracking_events ADD COLUMN IF NOT EXISTS bounce_type TEXT; -- 'soft' or 'hard'

-- Index for customer lookups
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_customer_id 
ON public.email_tracking_events(customer_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_created_at 
ON public.email_tracking_events(created_at DESC);

-- =====================================================
-- Customer email metrics indexes for segmentation
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_crm_customers_email_open_rate 
ON public.crm_customers(email_open_rate) WHERE email_open_rate > 0;

CREATE INDEX IF NOT EXISTS idx_crm_customers_email_engagement_score 
ON public.crm_customers(email_engagement_score) WHERE email_engagement_score > 0;

CREATE INDEX IF NOT EXISTS idx_crm_customers_total_emails_sent 
ON public.crm_customers(total_emails_sent) WHERE total_emails_sent > 0;

-- =====================================================
-- Function to update customer email engagement metrics
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_customer_email_metrics(p_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent INTEGER;
  v_delivered INTEGER;
  v_opened INTEGER;
  v_clicked INTEGER;
  v_bounced INTEGER;
  v_soft_bounces INTEGER;
  v_hard_bounces INTEGER;
  v_unsubscribed INTEGER;
  v_open_rate NUMERIC(5,4);
  v_click_rate NUMERIC(5,4);
  v_ctor NUMERIC(5,4);
  v_bounce_rate NUMERIC(5,4);
  v_avg_time_to_open INTEGER;
  v_avg_time_to_click INTEGER;
  v_engagement_score NUMERIC(5,2);
  v_last_sent TIMESTAMPTZ;
  v_last_delivered TIMESTAMPTZ;
  v_last_clicked TIMESTAMPTZ;
  v_last_bounced TIMESTAMPTZ;
  v_last_opened TIMESTAMPTZ;
BEGIN
  -- Get aggregated counts from email_tracking_events
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent'),
    COUNT(*) FILTER (WHERE event_type = 'delivered'),
    COUNT(DISTINCT CASE WHEN event_type = 'opened' THEN campaign_id END),
    COUNT(DISTINCT CASE WHEN event_type = 'clicked' THEN campaign_id END),
    COUNT(*) FILTER (WHERE event_type = 'bounced'),
    COUNT(*) FILTER (WHERE event_type = 'bounced' AND bounce_type = 'soft'),
    COUNT(*) FILTER (WHERE event_type = 'bounced' AND bounce_type = 'hard'),
    COUNT(*) FILTER (WHERE event_type = 'unsubscribed'),
    MAX(created_at) FILTER (WHERE event_type = 'sent'),
    MAX(created_at) FILTER (WHERE event_type = 'delivered'),
    MAX(created_at) FILTER (WHERE event_type = 'clicked'),
    MAX(created_at) FILTER (WHERE event_type = 'bounced'),
    MAX(created_at) FILTER (WHERE event_type = 'opened')
  INTO 
    v_sent, v_delivered, v_opened, v_clicked, v_bounced,
    v_soft_bounces, v_hard_bounces, v_unsubscribed,
    v_last_sent, v_last_delivered, v_last_clicked, v_last_bounced, v_last_opened
  FROM public.email_tracking_events
  WHERE customer_id = p_customer_id;

  -- Calculate rates (avoid division by zero)
  v_open_rate := CASE WHEN COALESCE(v_delivered, 0) > 0 
    THEN LEAST(v_opened::NUMERIC / v_delivered, 1.0) 
    ELSE 0 END;
  
  v_click_rate := CASE WHEN COALESCE(v_delivered, 0) > 0 
    THEN LEAST(v_clicked::NUMERIC / v_delivered, 1.0) 
    ELSE 0 END;
  
  v_ctor := CASE WHEN COALESCE(v_opened, 0) > 0 
    THEN LEAST(v_clicked::NUMERIC / v_opened, 1.0) 
    ELSE 0 END;
  
  v_bounce_rate := CASE WHEN COALESCE(v_sent, 0) > 0 
    THEN LEAST(v_bounced::NUMERIC / v_sent, 1.0) 
    ELSE 0 END;

  -- Calculate average time to open/click (in minutes)
  SELECT 
    AVG(time_to_event_seconds) / 60
  INTO v_avg_time_to_open
  FROM public.email_tracking_events
  WHERE customer_id = p_customer_id 
    AND event_type = 'opened' 
    AND time_to_event_seconds IS NOT NULL;

  SELECT 
    AVG(time_to_event_seconds) / 60
  INTO v_avg_time_to_click
  FROM public.email_tracking_events
  WHERE customer_id = p_customer_id 
    AND event_type = 'clicked' 
    AND time_to_event_seconds IS NOT NULL;

  -- Calculate engagement score (0-100)
  -- Weighted: open_rate (30%) + click_rate (40%) + recency (30%)
  v_engagement_score := (
    (COALESCE(v_open_rate, 0) * 30) +
    (COALESCE(v_click_rate, 0) * 40) +
    (CASE 
      WHEN v_last_opened IS NOT NULL AND v_last_opened > NOW() - INTERVAL '30 days' THEN 30
      WHEN v_last_opened IS NOT NULL AND v_last_opened > NOW() - INTERVAL '90 days' THEN 20
      WHEN v_last_opened IS NOT NULL AND v_last_opened > NOW() - INTERVAL '180 days' THEN 10
      ELSE 0
    END)
  );

  -- Update customer record
  UPDATE public.crm_customers
  SET 
    total_emails_sent = COALESCE(v_sent, 0),
    total_emails_delivered = COALESCE(v_delivered, 0),
    total_emails_opened = COALESCE(v_opened, 0),
    total_emails_clicked = COALESCE(v_clicked, 0),
    total_emails_bounced = COALESCE(v_bounced, 0),
    total_soft_bounces = COALESCE(v_soft_bounces, 0),
    total_hard_bounces = COALESCE(v_hard_bounces, 0),
    total_unsubscribes = COALESCE(v_unsubscribed, 0),
    email_open_rate = COALESCE(v_open_rate, 0),
    email_click_rate = COALESCE(v_click_rate, 0),
    email_ctor = COALESCE(v_ctor, 0),
    email_bounce_rate = COALESCE(v_bounce_rate, 0),
    avg_time_to_open_minutes = v_avg_time_to_open,
    avg_time_to_click_minutes = v_avg_time_to_click,
    last_email_sent_at = v_last_sent,
    last_email_delivered_at = v_last_delivered,
    last_email_clicked_at = v_last_clicked,
    last_email_bounced_at = v_last_bounced,
    last_open_at = v_last_opened,
    email_engagement_score = COALESCE(v_engagement_score, 0),
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$;