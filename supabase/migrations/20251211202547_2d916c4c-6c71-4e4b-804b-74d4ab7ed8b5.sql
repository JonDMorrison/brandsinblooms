-- Create deliverability summary view with campaign-level trends
CREATE OR REPLACE VIEW deliverability_summary_30d AS
WITH campaign_stats AS (
  SELECT 
    c.from_email_domain_id as domain_id,
    c.id as campaign_id,
    c.sent_at,
    COUNT(*) FILTER (WHERE e.event_type = 'sent') as sent,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE e.event_type = 'opened') as opened,
    COUNT(*) FILTER (WHERE e.event_type = 'clicked') as clicked,
    COUNT(*) FILTER (WHERE e.event_type = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE e.event_type = 'complained') as complained
  FROM crm_campaigns c
  LEFT JOIN email_tracking_events e ON e.campaign_id = c.id
  WHERE c.sent_at >= NOW() - INTERVAL '30 days'
    AND c.from_email_domain_id IS NOT NULL
  GROUP BY c.from_email_domain_id, c.id, c.sent_at
),
domain_aggregates AS (
  SELECT 
    domain_id,
    SUM(sent) as total_sent,
    SUM(delivered) as total_delivered,
    SUM(opened) as total_opened,
    SUM(clicked) as total_clicked,
    SUM(bounced) as total_bounced,
    SUM(complained) as total_complained,
    COUNT(DISTINCT campaign_id) as campaign_count
  FROM campaign_stats
  GROUP BY domain_id
),
recent_campaigns AS (
  SELECT 
    domain_id,
    campaign_id,
    sent_at,
    CASE WHEN delivered > 0 THEN (opened::numeric / delivered::numeric) * 100 ELSE 0 END as open_rate,
    ROW_NUMBER() OVER (PARTITION BY domain_id ORDER BY sent_at DESC) as rn
  FROM campaign_stats
  WHERE sent > 0
)
SELECT 
  d.id as domain_id,
  d.domain as domain_name,
  d.tenant_id,
  d.status as verification_status,
  d.warmup_stage,
  d.daily_limit,
  COALESCE(da.total_sent, 0)::bigint as sent_30d,
  COALESCE(da.total_delivered, 0)::bigint as delivered_30d,
  COALESCE(da.total_opened, 0)::bigint as opened_30d,
  COALESCE(da.total_clicked, 0)::bigint as clicked_30d,
  COALESCE(da.total_bounced, 0)::bigint as bounced_30d,
  COALESCE(da.total_complained, 0)::bigint as complained_30d,
  COALESCE(da.campaign_count, 0)::integer as campaign_count_30d,
  -- Rates
  CASE WHEN COALESCE(da.total_sent, 0) > 0 
    THEN ROUND((da.total_bounced::numeric / da.total_sent::numeric) * 100, 3)
    ELSE 0 
  END as bounce_rate,
  CASE WHEN COALESCE(da.total_sent, 0) > 0 
    THEN ROUND((da.total_complained::numeric / da.total_sent::numeric) * 100, 3)
    ELSE 0 
  END as complaint_rate,
  CASE WHEN COALESCE(da.total_delivered, 0) > 0 
    THEN ROUND((da.total_opened::numeric / da.total_delivered::numeric) * 100, 2)
    ELSE 0 
  END as open_rate,
  CASE WHEN COALESCE(da.total_delivered, 0) > 0 
    THEN ROUND((da.total_clicked::numeric / da.total_delivered::numeric) * 100, 2)
    ELSE 0 
  END as click_rate,
  -- Recent campaign open rates for trend analysis (last 3 campaigns)
  (SELECT open_rate FROM recent_campaigns rc WHERE rc.domain_id = d.id AND rc.rn = 1) as campaign_1_open_rate,
  (SELECT open_rate FROM recent_campaigns rc WHERE rc.domain_id = d.id AND rc.rn = 2) as campaign_2_open_rate,
  (SELECT open_rate FROM recent_campaigns rc WHERE rc.domain_id = d.id AND rc.rn = 3) as campaign_3_open_rate
FROM email_domains d
LEFT JOIN domain_aggregates da ON da.domain_id = d.id;

-- Grant access
GRANT SELECT ON deliverability_summary_30d TO authenticated;

-- Create RPC function for deliverability status with analysis
CREATE OR REPLACE FUNCTION get_deliverability_status(p_domain_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_summary record;
  v_status text := 'healthy';
  v_warnings jsonb := '[]'::jsonb;
  v_trend_declining boolean := false;
BEGIN
  -- Get summary data
  SELECT * INTO v_summary
  FROM deliverability_summary_30d
  WHERE domain_id = p_domain_id;
  
  IF v_summary IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Domain not found',
      'domain_id', p_domain_id
    );
  END IF;
  
  -- Analyze bounce rate
  IF v_summary.bounce_rate > 5 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'bounce_rate',
      'severity', 'critical',
      'message', format('Bounce rate is critically high at %s%%. Stop sending and clean your list.', v_summary.bounce_rate),
      'value', v_summary.bounce_rate
    );
  ELSIF v_summary.bounce_rate > 2 THEN
    IF v_status = 'healthy' THEN v_status := 'warning'; END IF;
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'bounce_rate',
      'severity', 'warning',
      'message', format('Bounce rate is elevated at %s%%. Consider slowing down sending.', v_summary.bounce_rate),
      'value', v_summary.bounce_rate
    );
  END IF;
  
  -- Analyze complaint rate
  IF v_summary.complaint_rate > 0.2 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'complaint_rate',
      'severity', 'critical',
      'message', format('Complaint rate is critically high at %s%%. Pause sending immediately.', v_summary.complaint_rate),
      'value', v_summary.complaint_rate
    );
  ELSIF v_summary.complaint_rate > 0.1 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'complaint_rate',
      'severity', 'critical',
      'message', format('Complaint rate is concerning at %s%%. Review content and list quality.', v_summary.complaint_rate),
      'value', v_summary.complaint_rate
    );
  END IF;
  
  -- Check open rate trend (declining 3 campaigns in a row)
  IF v_summary.campaign_1_open_rate IS NOT NULL 
     AND v_summary.campaign_2_open_rate IS NOT NULL 
     AND v_summary.campaign_3_open_rate IS NOT NULL THEN
    IF v_summary.campaign_1_open_rate < v_summary.campaign_2_open_rate 
       AND v_summary.campaign_2_open_rate < v_summary.campaign_3_open_rate THEN
      v_trend_declining := true;
      IF v_status = 'healthy' THEN v_status := 'warning'; END IF;
      v_warnings := v_warnings || jsonb_build_object(
        'type', 'open_rate_trend',
        'severity', 'warning',
        'message', format('Open rates declining: %s%% → %s%% → %s%%. Review subject lines and content.', 
          ROUND(v_summary.campaign_3_open_rate::numeric, 1),
          ROUND(v_summary.campaign_2_open_rate::numeric, 1),
          ROUND(v_summary.campaign_1_open_rate::numeric, 1)),
        'trend', jsonb_build_array(
          v_summary.campaign_3_open_rate,
          v_summary.campaign_2_open_rate,
          v_summary.campaign_1_open_rate
        )
      );
    END IF;
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'domain_id', v_summary.domain_id,
    'domain_name', v_summary.domain_name,
    'tenant_id', v_summary.tenant_id,
    'status', v_status,
    'verification_status', v_summary.verification_status,
    'warmup_stage', v_summary.warmup_stage,
    'daily_limit', v_summary.daily_limit,
    'metrics', jsonb_build_object(
      'sent_30d', v_summary.sent_30d,
      'delivered_30d', v_summary.delivered_30d,
      'opened_30d', v_summary.opened_30d,
      'clicked_30d', v_summary.clicked_30d,
      'bounced_30d', v_summary.bounced_30d,
      'complained_30d', v_summary.complained_30d,
      'campaign_count_30d', v_summary.campaign_count_30d
    ),
    'rates', jsonb_build_object(
      'bounce_rate', v_summary.bounce_rate,
      'complaint_rate', v_summary.complaint_rate,
      'open_rate', v_summary.open_rate,
      'click_rate', v_summary.click_rate
    ),
    'trend', jsonb_build_object(
      'declining', v_trend_declining,
      'recent_open_rates', jsonb_build_array(
        v_summary.campaign_1_open_rate,
        v_summary.campaign_2_open_rate,
        v_summary.campaign_3_open_rate
      )
    ),
    'warnings', v_warnings,
    'recommendation', CASE 
      WHEN v_status = 'critical' THEN 'Pause sending and address issues immediately'
      WHEN v_status = 'warning' THEN 'Slow down sending and monitor closely'
      ELSE 'Continue normal sending'
    END
  );
  
  RETURN v_result;
END;
$$;