-- Campaign sending progress aggregation (UI support)

CREATE OR REPLACE FUNCTION public.get_email_campaign_progress(p_campaign_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  total INT,
  queued INT,
  sending INT,
  sent INT,
  failed INT,
  skipped INT,
  last_message_updated_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  is_stuck BOOLEAN,
  stuck_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_campaign_status TEXT;
  v_last_activity TIMESTAMPTZ;
  v_total INT;
  v_processed INT;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT c.status INTO v_campaign_status
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id
    AND c.tenant_id = v_tenant_id;

  IF v_campaign_status IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH m AS (
    SELECT status, updated_at, last_attempt_at, sent_at
    FROM public.email_messages
    WHERE campaign_id = p_campaign_id
      AND tenant_id = v_tenant_id
  ),
  agg AS (
    SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE status = 'queued')::INT AS queued,
      COUNT(*) FILTER (WHERE status = 'sending')::INT AS sending,
      COUNT(*) FILTER (WHERE status = 'sent')::INT AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::INT AS failed,
      COUNT(*) FILTER (WHERE status = 'skipped')::INT AS skipped,
      MAX(updated_at) AS last_message_updated_at,
      MAX(last_attempt_at) AS last_attempt_at,
      MAX(sent_at) AS last_sent_at
    FROM m
  )
  SELECT
    p_campaign_id AS campaign_id,
    a.total,
    a.queued,
    a.sending,
    a.sent,
    a.failed,
    a.skipped,
    a.last_message_updated_at,
    a.last_attempt_at,
    a.last_sent_at,
    (
      v_campaign_status = 'sending'
      AND COALESCE(a.total, 0) > 0
      AND COALESCE(a.last_message_updated_at, NOW() - INTERVAL '100 years') < (NOW() - INTERVAL '10 minutes')
      AND (COALESCE(a.sent, 0) + COALESCE(a.failed, 0) + COALESCE(a.skipped, 0)) < COALESCE(a.total, 0)
    ) AS is_stuck,
    (
      CASE
        WHEN (
          v_campaign_status = 'sending'
          AND COALESCE(a.total, 0) > 0
          AND COALESCE(a.last_message_updated_at, NOW() - INTERVAL '100 years') < (NOW() - INTERVAL '10 minutes')
          AND (COALESCE(a.sent, 0) + COALESCE(a.failed, 0) + COALESCE(a.skipped, 0)) < COALESCE(a.total, 0)
        )
        THEN 'No message updates in 10+ minutes'
        ELSE NULL
      END
    ) AS stuck_reason
  FROM agg a;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_campaign_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_campaign_progress(UUID) TO service_role;
