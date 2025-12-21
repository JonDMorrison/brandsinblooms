-- Fix get_customer_activity_heatmap: correct column names
CREATE OR REPLACE FUNCTION public.get_customer_activity_heatmap(
  p_customer_id UUID,
  p_channel TEXT DEFAULT 'email'
)
RETURNS TABLE(
  day_of_week INT,
  hour_of_day INT,
  event_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_channel = 'email' THEN
    RETURN QUERY
    SELECT 
      EXTRACT(DOW FROM ete.created_at)::INT AS day_of_week,
      EXTRACT(HOUR FROM ete.created_at)::INT AS hour_of_day,
      COUNT(*)::INT AS event_count
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'click')
      AND ete.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM ete.created_at), EXTRACT(HOUR FROM ete.created_at);
  ELSE
    RETURN QUERY
    SELECT 
      EXTRACT(DOW FROM sm.created_at)::INT AS day_of_week,
      EXTRACT(HOUR FROM sm.created_at)::INT AS hour_of_day,
      COUNT(*)::INT AS event_count
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.status IN ('delivered', 'clicked', 'replied')
      AND sm.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM sm.created_at), EXTRACT(HOUR FROM sm.created_at);
  END IF;
END;
$$;

-- Fix get_customer_engagement_decay: correct column names
CREATE OR REPLACE FUNCTION public.get_customer_engagement_decay(
  p_customer_id UUID
)
RETURNS TABLE(
  week_number INT,
  engagement_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH weeks AS (
    SELECT generate_series(1, 10) AS week_num
  ),
  weekly_engagement AS (
    SELECT 
      CEIL(EXTRACT(EPOCH FROM (NOW() - ete.created_at)) / (7 * 24 * 3600))::INT AS weeks_ago,
      COUNT(*) AS event_count
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'click')
      AND ete.created_at >= NOW() - INTERVAL '10 weeks'
    GROUP BY CEIL(EXTRACT(EPOCH FROM (NOW() - ete.created_at)) / (7 * 24 * 3600))::INT
  ),
  max_engagement AS (
    SELECT GREATEST(MAX(event_count), 1) AS max_count FROM weekly_engagement
  )
  SELECT 
    w.week_num::INT AS week_number,
    COALESCE(
      ROUND((we.event_count::NUMERIC / me.max_count) * 100, 1),
      0
    ) AS engagement_percentage
  FROM weeks w
  CROSS JOIN max_engagement me
  LEFT JOIN weekly_engagement we ON we.weeks_ago = w.week_num
  ORDER BY w.week_num;
END;
$$;

-- Fix get_customer_purchase_timeline: correct join logic
CREATE OR REPLACE FUNCTION public.get_customer_purchase_timeline(
  p_customer_id UUID,
  p_months INT DEFAULT 12
)
RETURNS TABLE(
  period_date DATE,
  order_count INT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('month', NOW() - (p_months || ' months')::INTERVAL),
      date_trunc('month', NOW()),
      '1 month'::INTERVAL
    )::DATE AS month_start
  ),
  -- Get customer info for matching
  customer_info AS (
    SELECT email, phone, tenant_id FROM crm_customers WHERE id = p_customer_id
  ),
  -- Match pos_customers to crm_customer via email/phone
  matched_pos_customer AS (
    SELECT pc.id AS pos_customer_id
    FROM pos_customers pc, customer_info ci
    WHERE pc.email = ci.email OR pc.phone = ci.phone
    LIMIT 1
  ),
  order_data AS (
    SELECT 
      date_trunc('month', po.order_date)::DATE AS month_start,
      COUNT(*)::INT AS cnt,
      COALESCE(SUM(po.total_amount), 0) AS revenue
    FROM pos_orders po
    JOIN matched_pos_customer mpc ON po.pos_customer_id = mpc.pos_customer_id
    WHERE po.order_date >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('month', po.order_date)::DATE
  )
  SELECT 
    ds.month_start AS period_date,
    COALESCE(od.cnt, 0)::INT AS order_count,
    COALESCE(od.revenue, 0)::NUMERIC AS total_revenue
  FROM date_series ds
  LEFT JOIN order_data od ON od.month_start = ds.month_start
  ORDER BY ds.month_start;
END;
$$;

-- Fix get_customer_engagement_timeline: correct column names
CREATE OR REPLACE FUNCTION public.get_customer_engagement_timeline(
  p_customer_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE(
  period_date DATE,
  email_events INT,
  sms_events INT,
  engagement_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('week', NOW() - (p_months || ' months')::INTERVAL),
      date_trunc('week', NOW()),
      '1 week'::INTERVAL
    )::DATE AS week_start
  ),
  email_data AS (
    SELECT 
      date_trunc('week', ete.created_at)::DATE AS week_start,
      COUNT(*) AS cnt
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', ete.created_at)::DATE
  ),
  sms_data AS (
    SELECT 
      date_trunc('week', sm.created_at)::DATE AS week_start,
      COUNT(*) AS cnt
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', sm.created_at)::DATE
  )
  SELECT 
    ds.week_start AS period_date,
    COALESCE(ed.cnt, 0)::INT AS email_events,
    COALESCE(sd.cnt, 0)::INT AS sms_events,
    LEAST(100, (COALESCE(ed.cnt, 0) * 10 + COALESCE(sd.cnt, 0) * 15))::NUMERIC AS engagement_score
  FROM date_series ds
  LEFT JOIN email_data ed ON ed.week_start = ds.week_start
  LEFT JOIN sms_data sd ON sd.week_start = ds.week_start
  ORDER BY ds.week_start;
END;
$$;

-- Fix get_customer_channel_trend: correct column names
CREATE OR REPLACE FUNCTION public.get_customer_channel_trend(
  p_customer_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE(
  month_label TEXT,
  preferred_channel TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT 
      generate_series(
        date_trunc('month', NOW() - (p_months || ' months')::INTERVAL),
        date_trunc('month', NOW()),
        '1 month'::INTERVAL
      ) AS month_start
  ),
  email_monthly AS (
    SELECT 
      date_trunc('month', ete.created_at) AS month_start,
      COUNT(*) AS cnt
    FROM email_tracking_events ete
    WHERE ete.customer_id = p_customer_id
      AND ete.event_type IN ('open', 'click')
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('month', ete.created_at)
  ),
  sms_monthly AS (
    SELECT 
      date_trunc('month', sm.created_at) AS month_start,
      COUNT(*) AS cnt
    FROM sms_messages sm
    WHERE sm.customer_id = p_customer_id
      AND sm.status IN ('delivered', 'clicked', 'replied')
      AND sm.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('month', sm.created_at)
  )
  SELECT 
    TO_CHAR(ds.month_start, 'Mon') AS month_label,
    CASE 
      WHEN COALESCE(em.cnt, 0) >= COALESCE(sm.cnt, 0) THEN 'email'
      ELSE 'sms'
    END AS preferred_channel
  FROM date_series ds
  LEFT JOIN email_monthly em ON em.month_start = ds.month_start
  LEFT JOIN sms_monthly sm ON sm.month_start = ds.month_start
  ORDER BY ds.month_start;
END;
$$;

-- Fix get_customer_unified_timeline: correct column names and join logic
CREATE OR REPLACE FUNCTION public.get_customer_unified_timeline(
  p_customer_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_event_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  event_category TEXT,
  title TEXT,
  description TEXT,
  impact TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_events AS (
    -- Purchases from pos_orders (joined with pos_customers to get customer_id mapping)
    SELECT 
      po.id,
      'purchase'::TEXT as event_type,
      'purchase'::TEXT as event_category,
      COALESCE('Order #' || po.external_id, 'Purchase')::TEXT as title,
      ('$' || COALESCE(po.total_amount, 0)::TEXT || ' purchase')::TEXT as description,
      'positive'::TEXT as impact,
      jsonb_build_object(
        'total_amount', po.total_amount,
        'order_number', po.external_id,
        'items_count', COALESCE(jsonb_array_length(po.items), 0)
      ) as metadata,
      po.created_at
    FROM pos_orders po
    INNER JOIN pos_customers pc ON po.pos_customer_id = pc.id
    INNER JOIN crm_customers c ON (pc.email = c.email OR pc.phone = c.phone)
    WHERE c.id = p_customer_id
    
    UNION ALL
    
    -- SMS Messages
    SELECT 
      s.id,
      'sms'::TEXT as event_type,
      'sms'::TEXT as event_category,
      COALESCE(sc.name, 'SMS Message')::TEXT as title,
      LEFT(COALESCE(s.content, 'Message sent'), 100)::TEXT as description,
      'neutral'::TEXT as impact,
      jsonb_build_object(
        'status', s.status
      ) as metadata,
      s.created_at
    FROM sms_messages s
    LEFT JOIN crm_sms_campaigns sc ON s.campaign_id = sc.id
    WHERE s.customer_id = p_customer_id
    
    UNION ALL
    
    -- Email Events from email_tracking_events
    SELECT 
      e.id,
      e.event_type::TEXT as event_type,
      'email'::TEXT as event_category,
      COALESCE(c.subject_line, 'Email ' || e.event_type)::TEXT as title,
      ('Email ' || e.event_type)::TEXT as description,
      CASE 
        WHEN e.event_type IN ('open', 'click') THEN 'positive'
        WHEN e.event_type IN ('bounce', 'complaint', 'unsubscribe') THEN 'negative'
        ELSE 'neutral'
      END::TEXT as impact,
      jsonb_build_object(
        'event_type', e.event_type,
        'campaign_id', e.campaign_id
      ) as metadata,
      e.created_at
    FROM email_tracking_events e
    LEFT JOIN crm_campaigns c ON e.campaign_id = c.id
    WHERE e.customer_id = p_customer_id
    
    UNION ALL
    
    -- Loyalty Points Transactions
    SELECT 
      l.id,
      l.transaction_type::TEXT as event_type,
      'loyalty'::TEXT as event_category,
      (CASE 
        WHEN l.points_amount > 0 THEN 'Earned ' || l.points_amount || ' points'
        ELSE 'Redeemed ' || ABS(l.points_amount) || ' points'
      END)::TEXT as title,
      COALESCE(l.description, l.source_type || ' transaction')::TEXT as description,
      CASE WHEN l.points_amount > 0 THEN 'positive' ELSE 'neutral' END::TEXT as impact,
      jsonb_build_object(
        'points_amount', l.points_amount,
        'points_balance_after', l.points_balance_after,
        'source_type', l.source_type,
        'redemption_value', l.redemption_value
      ) as metadata,
      l.created_at
    FROM loyalty_points_transactions l
    WHERE l.customer_id = p_customer_id
    
    UNION ALL
    
    -- Negative Behavior Events (risk signals)
    SELECT 
      n.id,
      n.event_type::TEXT as event_type,
      'risk'::TEXT as event_category,
      (n.event_type || ' detected')::TEXT as title,
      COALESCE(n.bounce_reason, n.event_subtype, 'Risk event recorded')::TEXT as description,
      'negative'::TEXT as impact,
      jsonb_build_object(
        'event_subtype', n.event_subtype,
        'risk_score_impact', n.risk_score_impact,
        'channel', n.channel
      ) as metadata,
      n.created_at
    FROM negative_behavior_events n
    WHERE n.customer_id = p_customer_id
  )
  SELECT 
    ae.id,
    ae.event_type,
    ae.event_category,
    ae.title,
    ae.description,
    ae.impact,
    ae.metadata,
    ae.created_at
  FROM all_events ae
  WHERE (p_event_types IS NULL OR ae.event_category = ANY(p_event_types))
  ORDER BY ae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;