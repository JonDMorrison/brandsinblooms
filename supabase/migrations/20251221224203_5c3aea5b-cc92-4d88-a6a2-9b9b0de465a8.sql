-- Function to get customer engagement timeline (weekly aggregation)
CREATE OR REPLACE FUNCTION get_customer_engagement_timeline(
  p_customer_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE(
  period_date DATE,
  email_events INT,
  sms_events INT,
  engagement_score NUMERIC
) AS $$
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
    JOIN crm_campaigns cc ON cc.id = ete.campaign_id
    JOIN crm_customers c ON c.email = ete.recipient_email AND c.tenant_id = cc.tenant_id
    WHERE c.id = p_customer_id
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', ete.created_at)::DATE
  ),
  sms_data AS (
    SELECT 
      date_trunc('week', sm.created_at)::DATE AS week_start,
      COUNT(*) AS cnt
    FROM sms_messages sm
    JOIN crm_customers c ON c.phone = sm.recipient_phone AND c.tenant_id = sm.tenant_id
    WHERE c.id = p_customer_id
      AND sm.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('week', sm.created_at)::DATE
  )
  SELECT 
    ds.week_start AS period_date,
    COALESCE(ed.cnt, 0)::INT AS email_events,
    COALESCE(sd.cnt, 0)::INT AS sms_events,
    -- Simple engagement score: weighted sum of activities
    LEAST(100, (COALESCE(ed.cnt, 0) * 10 + COALESCE(sd.cnt, 0) * 15))::NUMERIC AS engagement_score
  FROM date_series ds
  LEFT JOIN email_data ed ON ed.week_start = ds.week_start
  LEFT JOIN sms_data sd ON sd.week_start = ds.week_start
  ORDER BY ds.week_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get customer purchase timeline (monthly aggregation)
CREATE OR REPLACE FUNCTION get_customer_purchase_timeline(
  p_customer_id UUID,
  p_months INT DEFAULT 12
)
RETURNS TABLE(
  period_date DATE,
  order_count INT,
  total_revenue NUMERIC
) AS $$
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
  -- Match pos_customers to crm_customer
  matched_pos_customer AS (
    SELECT pc.id AS pos_customer_id
    FROM pos_customers pc
    JOIN customer_info ci ON 
      pc.tenant_id = ci.tenant_id AND
      (pc.email = ci.email OR pc.phone = ci.phone)
    LIMIT 1
  ),
  order_data AS (
    SELECT 
      date_trunc('month', po.order_date)::DATE AS month_start,
      COUNT(*)::INT AS cnt,
      COALESCE(SUM(po.total_amount), 0) AS revenue
    FROM pos_orders po
    JOIN matched_pos_customer mpc ON po.customer_id = mpc.pos_customer_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get customer activity heatmap (day/hour aggregation)
CREATE OR REPLACE FUNCTION get_customer_activity_heatmap(
  p_customer_id UUID,
  p_channel TEXT DEFAULT 'email'
)
RETURNS TABLE(
  day_of_week INT,
  hour_of_day INT,
  event_count INT
) AS $$
BEGIN
  IF p_channel = 'email' THEN
    RETURN QUERY
    SELECT 
      EXTRACT(DOW FROM ete.created_at)::INT AS day_of_week,
      EXTRACT(HOUR FROM ete.created_at)::INT AS hour_of_day,
      COUNT(*)::INT AS event_count
    FROM email_tracking_events ete
    JOIN crm_campaigns cc ON cc.id = ete.campaign_id
    JOIN crm_customers c ON c.email = ete.recipient_email AND c.tenant_id = cc.tenant_id
    WHERE c.id = p_customer_id
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
    JOIN crm_customers c ON c.phone = sm.recipient_phone AND c.tenant_id = sm.tenant_id
    WHERE c.id = p_customer_id
      AND sm.status IN ('delivered', 'clicked', 'replied')
      AND sm.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM sm.created_at), EXTRACT(HOUR FROM sm.created_at);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get customer engagement decay (last 10 weeks)
CREATE OR REPLACE FUNCTION get_customer_engagement_decay(
  p_customer_id UUID
)
RETURNS TABLE(
  week_number INT,
  engagement_percentage NUMERIC
) AS $$
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
    JOIN crm_campaigns cc ON cc.id = ete.campaign_id
    JOIN crm_customers c ON c.email = ete.recipient_email AND c.tenant_id = cc.tenant_id
    WHERE c.id = p_customer_id
      AND ete.event_type IN ('open', 'click')
      AND ete.created_at >= NOW() - INTERVAL '10 weeks'
    GROUP BY CEIL(EXTRACT(EPOCH FROM (NOW() - ete.created_at)) / (7 * 24 * 3600))::INT
  ),
  max_engagement AS (
    SELECT GREATEST(MAX(event_count), 1) AS max_count FROM weekly_engagement
  )
  SELECT 
    w.week_num AS week_number,
    COALESCE(
      ROUND((we.event_count::NUMERIC / me.max_count) * 100, 1),
      0
    ) AS engagement_percentage
  FROM weeks w
  CROSS JOIN max_engagement me
  LEFT JOIN weekly_engagement we ON we.weeks_ago = w.week_num
  ORDER BY w.week_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get channel preference trend
CREATE OR REPLACE FUNCTION get_customer_channel_trend(
  p_customer_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE(
  month_label TEXT,
  preferred_channel TEXT
) AS $$
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
    JOIN crm_campaigns cc ON cc.id = ete.campaign_id
    JOIN crm_customers c ON c.email = ete.recipient_email AND c.tenant_id = cc.tenant_id
    WHERE c.id = p_customer_id
      AND ete.event_type IN ('open', 'click')
      AND ete.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY date_trunc('month', ete.created_at)
  ),
  sms_monthly AS (
    SELECT 
      date_trunc('month', sm.created_at) AS month_start,
      COUNT(*) AS cnt
    FROM sms_messages sm
    JOIN crm_customers c ON c.phone = sm.recipient_phone AND c.tenant_id = sm.tenant_id
    WHERE c.id = p_customer_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;