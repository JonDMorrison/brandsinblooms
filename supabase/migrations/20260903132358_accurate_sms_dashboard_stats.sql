-- Compute SMS dashboard totals at the database boundary. The previous browser
-- query downloaded at most ten campaigns and at most the PostgREST row cap of
-- customers, so its "all time" totals and audience size were not trustworthy.

CREATE INDEX IF NOT EXISTS idx_crm_customers_sms_sendable_tenant
ON public.crm_customers (tenant_id)
WHERE sms_opt_in = true
  AND deleted_at IS NULL
  AND merged_into_customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_created_at
ON public.sms_messages (tenant_id, created_at)
WHERE tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_sms_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_subscribers bigint := 0;
  v_sent bigint := 0;
  v_delivered bigint := 0;
  v_clicks bigint := 0;
  v_queued bigint := 0;
  v_current_sent bigint := 0;
  v_current_delivered bigint := 0;
  v_current_clicks bigint := 0;
  v_previous_sent bigint := 0;
  v_previous_delivered bigint := 0;
  v_previous_clicks bigint := 0;
  v_now timestamptz := statement_timestamp();
  v_current_start timestamptz;
  v_previous_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT app_user.tenant_id
  INTO v_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id;

  v_current_start := v_now - interval '30 days';
  v_previous_start := v_now - interval '60 days';

  SELECT count(*)
  INTO v_subscribers
  FROM public.crm_customers AS customer
  WHERE (
      (v_tenant_id IS NOT NULL AND customer.tenant_id = v_tenant_id)
      OR (v_tenant_id IS NULL AND customer.user_id = v_user_id)
    )
    AND customer.sms_opt_in = true
    AND coalesce(customer.opt_out, false) = false
    AND coalesce(customer.suppressed, false) = false
    AND customer.sms_consent IS DISTINCT FROM false
    AND customer.sms_opt_in_at IS NOT NULL
    AND nullif(trim(customer.sms_consent_source), '') IS NOT NULL
    AND nullif(trim(customer.phone), '') IS NOT NULL
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_consents AS consent
      WHERE consent.customer_id = customer.id
        AND consent.channel = 'sms'
        AND consent.status <> 'opted_in'
    );

  WITH scoped_messages AS (
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    LEFT JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NOT NULL
      AND message.tenant_id = v_tenant_id
      AND (campaign.id IS NULL OR campaign.source IS DISTINCT FROM 'segment_send')

    UNION ALL

    -- Legacy rows predate sms_messages.tenant_id and remain attributable
    -- through their campaign without forcing an OR across the indexed path.
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NOT NULL
      AND message.tenant_id IS NULL
      AND campaign.tenant_id = v_tenant_id
      AND campaign.source IS DISTINCT FROM 'segment_send'

    UNION ALL

    -- Preserve the legacy pre-tenant user fallback during onboarding.
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NULL
      AND campaign.user_id = v_user_id
      AND campaign.source IS DISTINCT FROM 'segment_send'
  )
  SELECT
    count(*) FILTER (WHERE status IN ('sent', 'delivered', 'failed')),
    count(*) FILTER (WHERE status = 'delivered'),
    coalesce(sum(links_clicked), 0),
    count(*) FILTER (WHERE status = 'queued'),
    count(*) FILTER (
      WHERE status IN ('sent', 'delivered', 'failed')
        AND created_at >= v_current_start
    ),
    count(*) FILTER (
      WHERE status = 'delivered'
        AND created_at >= v_current_start
    ),
    coalesce(sum(links_clicked) FILTER (WHERE created_at >= v_current_start), 0),
    count(*) FILTER (
      WHERE status IN ('sent', 'delivered', 'failed')
        AND created_at >= v_previous_start
        AND created_at < v_current_start
    ),
    count(*) FILTER (
      WHERE status = 'delivered'
        AND created_at >= v_previous_start
        AND created_at < v_current_start
    ),
    coalesce(sum(links_clicked) FILTER (
      WHERE created_at >= v_previous_start
        AND created_at < v_current_start
    ), 0)
  INTO
    v_sent,
    v_delivered,
    v_clicks,
    v_queued,
    v_current_sent,
    v_current_delivered,
    v_current_clicks,
    v_previous_sent,
    v_previous_delivered,
    v_previous_clicks
  FROM scoped_messages;

  RETURN jsonb_build_object(
    'subscribers', v_subscribers,
    'sent', v_sent,
    'delivered', v_delivered,
    'clicks', v_clicks,
    'queued_messages', v_queued,
    'current_sent', v_current_sent,
    'current_delivered', v_current_delivered,
    'current_clicks', v_current_clicks,
    'previous_sent', v_previous_sent,
    'previous_delivered', v_previous_delivered,
    'previous_clicks', v_previous_clicks,
    'generated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sms_dashboard_stats()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sms_dashboard_stats()
TO authenticated, service_role;

COMMENT ON FUNCTION public.get_sms_dashboard_stats() IS
  'Returns exact tenant-scoped SMS audience, delivery, click, and queue totals for the authenticated dashboard.';
