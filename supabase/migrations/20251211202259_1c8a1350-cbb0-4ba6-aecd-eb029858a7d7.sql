-- Create a view for 30-day domain email stats
-- Join through crm_campaigns to get domain association
CREATE OR REPLACE VIEW email_domain_stats_30d AS
SELECT 
  d.id as domain_id,
  d.domain as domain_name,
  d.tenant_id,
  d.status as verification_status,
  d.warmup_stage,
  d.daily_limit,
  d.total_sent_30d as daily_used,
  COALESCE(stats.emails_sent_30d, 0) as emails_sent_30d,
  COALESCE(stats.emails_delivered_30d, 0) as emails_delivered_30d,
  COALESCE(stats.emails_opened_30d, 0) as emails_opened_30d,
  COALESCE(stats.emails_clicked_30d, 0) as emails_clicked_30d,
  COALESCE(stats.emails_bounced_30d, 0) as emails_bounced_30d,
  COALESCE(stats.emails_complained_30d, 0) as emails_complained_30d,
  -- Derived rates (as percentages)
  CASE 
    WHEN COALESCE(stats.emails_delivered_30d, 0) > 0 
    THEN ROUND((COALESCE(stats.emails_opened_30d, 0)::numeric / stats.emails_delivered_30d::numeric) * 100, 2)
    ELSE 0 
  END as open_rate_30d,
  CASE 
    WHEN COALESCE(stats.emails_delivered_30d, 0) > 0 
    THEN ROUND((COALESCE(stats.emails_clicked_30d, 0)::numeric / stats.emails_delivered_30d::numeric) * 100, 2)
    ELSE 0 
  END as click_rate_30d,
  CASE 
    WHEN COALESCE(stats.emails_sent_30d, 0) > 0 
    THEN ROUND((COALESCE(stats.emails_bounced_30d, 0)::numeric / stats.emails_sent_30d::numeric) * 100, 2)
    ELSE 0 
  END as bounce_rate_30d,
  CASE 
    WHEN COALESCE(stats.emails_sent_30d, 0) > 0 
    THEN ROUND((COALESCE(stats.emails_complained_30d, 0)::numeric / stats.emails_sent_30d::numeric) * 100, 2)
    ELSE 0 
  END as complaint_rate_30d
FROM email_domains d
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) FILTER (WHERE e.event_type = 'sent') as emails_sent_30d,
    COUNT(*) FILTER (WHERE e.event_type = 'delivered') as emails_delivered_30d,
    COUNT(*) FILTER (WHERE e.event_type = 'opened') as emails_opened_30d,
    COUNT(*) FILTER (WHERE e.event_type = 'clicked') as emails_clicked_30d,
    COUNT(*) FILTER (WHERE e.event_type = 'bounced') as emails_bounced_30d,
    COUNT(*) FILTER (WHERE e.event_type = 'complained') as emails_complained_30d
  FROM email_tracking_events e
  JOIN crm_campaigns c ON c.id = e.campaign_id
  WHERE c.from_email_domain_id = d.id
    AND e.created_at >= NOW() - INTERVAL '30 days'
) stats ON true;

-- Grant access to authenticated users
GRANT SELECT ON email_domain_stats_30d TO authenticated;

-- Create an RPC function for easier querying with tenant filtering
CREATE OR REPLACE FUNCTION get_domain_email_stats_30d(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  domain_id uuid,
  domain_name text,
  tenant_id uuid,
  verification_status text,
  warmup_stage integer,
  daily_limit integer,
  daily_used integer,
  emails_sent_30d bigint,
  emails_delivered_30d bigint,
  emails_opened_30d bigint,
  emails_clicked_30d bigint,
  emails_bounced_30d bigint,
  emails_complained_30d bigint,
  open_rate_30d numeric,
  click_rate_30d numeric,
  bounce_rate_30d numeric,
  complaint_rate_30d numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.domain_id,
    s.domain_name,
    s.tenant_id,
    s.verification_status,
    s.warmup_stage,
    s.daily_limit,
    s.daily_used,
    s.emails_sent_30d,
    s.emails_delivered_30d,
    s.emails_opened_30d,
    s.emails_clicked_30d,
    s.emails_bounced_30d,
    s.emails_complained_30d,
    s.open_rate_30d,
    s.click_rate_30d,
    s.bounce_rate_30d,
    s.complaint_rate_30d
  FROM email_domain_stats_30d s
  WHERE p_tenant_id IS NULL OR s.tenant_id = p_tenant_id;
END;
$$;