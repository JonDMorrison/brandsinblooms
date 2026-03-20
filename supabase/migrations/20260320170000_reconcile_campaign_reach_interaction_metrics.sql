-- Milestone 3: make campaign analytics derive Reach/Interaction from the send ledger
-- and the canonical event tables.

CREATE OR REPLACE FUNCTION public.get_campaign_derived_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH send_ledger AS (
    SELECT
      COUNT(*) FILTER (WHERE status <> 'skipped')::int AS total_sent,
      COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
    FROM public.email_messages
    WHERE campaign_id = p_campaign_id
  ),
  event_recipients AS (
    SELECT
      lower(customer_email) AS recipient_email,
      BOOL_OR(event_type = 'sent') AS sent,
      BOOL_OR(event_type = 'delivered') AS delivered,
      BOOL_OR(event_type IN ('open', 'opened')) AS opened,
      BOOL_OR(event_type IN ('click', 'clicked')) AS clicked,
      BOOL_OR(event_type IN ('bounce', 'bounced')) AS bounced,
      BOOL_OR(
        event_type IN ('bounce', 'bounced')
        AND (
          COALESCE(event_data->>'bounce_severity', '') = 'hard'
          OR COALESCE(event_data->>'bounce_type', '') IN ('hard', 'hard_bounce')
        )
      ) AS hard_bounced,
      BOOL_OR(event_type IN ('complaint', 'complained')) AS complained,
      BOOL_OR(event_type = 'unsubscribed') AS unsubscribed,
      BOOL_OR(event_type IN ('open', 'opened') AND NOT COALESCE(is_mpp_guess, false)) AS opened_non_mpp
    FROM public.email_tracking_events
    WHERE campaign_id = p_campaign_id
    GROUP BY lower(customer_email)
  ),
  event_counts AS (
    SELECT
      COUNT(*)::int AS observed_recipients,
      COUNT(*) FILTER (WHERE sent)::int AS sent_events,
      COUNT(*) FILTER (WHERE delivered)::int AS delivered,
      COUNT(*) FILTER (WHERE opened)::int AS opens,
      COUNT(*) FILTER (WHERE clicked)::int AS clicks,
      COUNT(*) FILTER (WHERE bounced)::int AS bounces,
      COUNT(*) FILTER (WHERE hard_bounced)::int AS hard_bounces,
      COUNT(*) FILTER (WHERE complained)::int AS complaints,
      COUNT(*) FILTER (WHERE unsubscribed)::int AS unsubscribes,
      COUNT(*) FILTER (WHERE opened_non_mpp)::int AS opens_non_mpp,
      COUNT(*) FILTER (WHERE opened OR clicked)::int AS unique_engaged,
      GREATEST(
        COUNT(*) FILTER (WHERE delivered)::int - COUNT(*) FILTER (WHERE hard_bounced)::int,
        0
      )::int AS successful_reach,
      COUNT(*) FILTER (WHERE opened AND NOT delivered)::int AS opens_without_delivery,
      COUNT(*) FILTER (WHERE clicked AND NOT delivered)::int AS clicks_without_delivery
    FROM event_recipients
  ),
  metric_totals AS (
    SELECT
      CASE
        WHEN COALESCE(sl.total_sent, 0) > 0 THEN sl.total_sent
        ELSE COALESCE(ec.observed_recipients, 0)
      END AS sent,
      COALESCE(ec.sent_events, 0) AS sent_events,
      COALESCE(ec.observed_recipients, 0) AS observed_recipients,
      COALESCE(ec.delivered, 0) AS delivered,
      COALESCE(ec.opens, 0) AS opens,
      COALESCE(ec.clicks, 0) AS clicks,
      COALESCE(ec.bounces, 0) AS bounces,
      COALESCE(ec.hard_bounces, 0) AS hard_bounces,
      COALESCE(ec.complaints, 0) AS complaints,
      COALESCE(ec.unsubscribes, 0) AS unsubscribes,
      COALESCE(ec.opens_non_mpp, 0) AS opens_non_mpp,
      COALESCE(ec.unique_engaged, 0) AS unique_engaged,
      COALESCE(ec.successful_reach, 0) AS successful_reach,
      COALESCE(ec.opens_without_delivery, 0) AS opens_without_delivery,
      COALESCE(ec.clicks_without_delivery, 0) AS clicks_without_delivery,
      COALESCE(sl.skipped, 0) AS skipped
    FROM event_counts ec
    CROSS JOIN send_ledger sl
  ),
  backfill_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE LOWER(COALESCE(event_data->>'backfilled', 'false')) = 'true')::int AS backfilled_events,
      MAX(ingested_at) FILTER (WHERE LOWER(COALESCE(event_data->>'backfilled', 'false')) = 'true') AS last_backfilled_at
    FROM public.email_tracking_events
    WHERE campaign_id = p_campaign_id
  ),
  link_stats AS (
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object('link_id', link_id, 'url', url, 'clicks', click_count)
          ORDER BY click_count DESC
        ),
        '[]'::jsonb
      ) AS top_links
    FROM (
      SELECT
        COALESCE(e.link_id::text, e.event_data->>'click_link', 'unknown') AS link_id,
        COALESCE(tl.url, e.event_data->>'click_link', 'Unknown') AS url,
        COUNT(DISTINCT lower(e.customer_email)) AS click_count
      FROM public.email_tracking_events e
      LEFT JOIN public.tracked_links tl ON tl.id = e.link_id
      WHERE e.campaign_id = p_campaign_id
        AND e.event_type IN ('click', 'clicked')
      GROUP BY 1, 2
      ORDER BY click_count DESC
      LIMIT 5
    ) top
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'sent', mt.sent,
      'sent_events', mt.sent_events,
      'observed_recipients', mt.observed_recipients,
      'delivered', mt.delivered,
      'successful_reach', mt.successful_reach,
      'opens', mt.opens,
      'clicks', mt.clicks,
      'bounces', mt.bounces,
      'hard_bounces', mt.hard_bounces,
      'complaints', mt.complaints,
      'unsubscribes', mt.unsubscribes,
      'opens_non_mpp', mt.opens_non_mpp,
      'unique_engaged', mt.unique_engaged,
      'skipped', mt.skipped
    ),
    'scores', jsonb_build_object(
      'reach', CASE
        WHEN mt.sent > 0 THEN ROUND((mt.successful_reach::numeric / mt.sent::numeric) * 100, 2)
        ELSE 0
      END,
      'interaction', CASE
        WHEN mt.successful_reach > 0 THEN ROUND((mt.unique_engaged::numeric / mt.successful_reach::numeric) * 100, 2)
        ELSE 0
      END
    ),
    'rates', jsonb_build_object(
      'delivery', CASE
        WHEN mt.sent > 0 THEN ROUND((mt.delivered::numeric / mt.sent::numeric) * 100, 2)
        ELSE 0
      END,
      'open_reported', CASE
        WHEN mt.successful_reach > 0 THEN ROUND((mt.opens::numeric / mt.successful_reach::numeric) * 100, 2)
        ELSE 0
      END,
      'open_adjusted', CASE
        WHEN mt.successful_reach > 0 THEN ROUND((mt.opens_non_mpp::numeric / mt.successful_reach::numeric) * 100, 2)
        ELSE 0
      END,
      'click', CASE
        WHEN mt.successful_reach > 0 THEN ROUND((mt.clicks::numeric / mt.successful_reach::numeric) * 100, 2)
        ELSE 0
      END,
      'bounce', CASE
        WHEN mt.sent > 0 THEN ROUND((mt.hard_bounces::numeric / mt.sent::numeric) * 100, 2)
        ELSE 0
      END,
      'complaint', CASE
        WHEN mt.sent > 0 THEN ROUND((mt.complaints::numeric / mt.sent::numeric) * 100, 2)
        ELSE 0
      END,
      'click_to_open', CASE
        WHEN mt.opens > 0 THEN ROUND((mt.clicks::numeric / mt.opens::numeric) * 100, 2)
        ELSE 0
      END
    ),
    'diagnostics', jsonb_build_object(
      'opens_without_delivery', mt.opens_without_delivery,
      'clicks_without_delivery', mt.clicks_without_delivery,
      'missing_send_ledger', (mt.sent_events > 0 AND mt.sent = mt.observed_recipients)
    ),
    'reconciliation', jsonb_build_object(
      'backfill_applied', COALESCE(bs.backfilled_events, 0) > 0,
      'backfilled_events', COALESCE(bs.backfilled_events, 0),
      'last_backfilled_at', bs.last_backfilled_at
    ),
    'links', ls.top_links,
    'computed_at', NOW()
  ) INTO result
  FROM metric_totals mt
  CROSS JOIN backfill_stats bs
  CROSS JOIN link_stats ls;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_campaign_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  derived_metrics jsonb;
BEGIN
  derived_metrics := public.get_campaign_derived_metrics(p_campaign_id);

  UPDATE public.crm_campaigns
  SET
    metrics = derived_metrics,
    total_sent = COALESCE((derived_metrics->'totals'->>'sent')::int, 0),
    total_opens = COALESCE((derived_metrics->'totals'->>'opens')::int, 0),
    total_clicks = COALESCE((derived_metrics->'totals'->>'clicks')::int, 0),
    open_rate = COALESCE((derived_metrics->'rates'->>'open_reported')::numeric, 0),
    click_rate = COALESCE((derived_metrics->'rates'->>'click')::numeric, 0),
    rollup_refreshed_at = NOW()
  WHERE id = p_campaign_id;

  RETURN derived_metrics;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_derived_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_campaign_metrics(uuid) TO authenticated;