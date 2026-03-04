-- Milestone 3: Remove warmup/limit counters from domain email stats RPC output

DROP FUNCTION IF EXISTS public.get_domain_email_stats_30d(uuid);

CREATE OR REPLACE FUNCTION public.get_domain_email_stats_30d(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  domain_id uuid,
  domain_name text,
  tenant_id uuid,
  verification_status text,
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

NOTIFY pgrst, 'reload schema';
