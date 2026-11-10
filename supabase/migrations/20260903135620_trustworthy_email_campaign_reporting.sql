-- Return one tenant-authorized reporting snapshot from the uncapped message
-- and event ledgers. Browser-side PostgREST queries are capped and cannot be
-- used to calculate campaign totals safely.

CREATE OR REPLACE FUNCTION public.get_email_campaign_reporting_snapshot(
  p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_tenant_id uuid;
  v_campaign_sent_at timestamptz;
  v_campaign_created_at timestamptz;
  v_result jsonb;
BEGIN
  SELECT campaign.tenant_id, campaign.sent_at, campaign.created_at
  INTO v_tenant_id, v_campaign_sent_at, v_campaign_created_at
  FROM public.crm_campaigns AS campaign
  WHERE campaign.id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF v_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = v_user_id
        AND app_user.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'Campaign access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH message_state AS (
    SELECT
      lower(trim(message.email)) AS recipient_key,
      bool_or(message.status = 'sent') AS accepted,
      bool_or(
        message.status = 'failed'
        OR message.dead_lettered_at IS NOT NULL
      ) AS failed,
      bool_or(message.status = 'skipped') AS skipped,
      bool_or(message.status IN ('queued', 'sending', 'paused')) AS pending,
      min(coalesce(message.sent_at, message.created_at)) AS first_message_at
    FROM public.email_messages AS message
    WHERE message.campaign_id = p_campaign_id
    GROUP BY lower(trim(message.email))
  ),
  message_presence AS (
    SELECT EXISTS (SELECT 1 FROM message_state) AS has_messages
  ),
  raw_event_rows AS (
    SELECT
      coalesce(
        nullif(lower(trim(coalesce(
          substring(event.customer_email FROM '<([^>]+)>'),
          event.customer_email
        ))), ''),
        event.customer_id::text,
        event.id::text
      ) AS recipient_key,
      CASE
        WHEN event.event_type IN ('open', 'opened') THEN 'opened'
        WHEN event.event_type IN ('click', 'clicked') THEN 'clicked'
        WHEN event.event_type IN ('bounce', 'bounced') THEN 'bounced'
        WHEN event.event_type IN ('complaint', 'complained') THEN 'complained'
        WHEN event.event_type IN ('unsubscribe', 'unsubscribed') THEN 'unsubscribed'
        ELSE event.event_type
      END AS event_type,
      coalesce(event.event_ts_provider, event.created_at) AS event_at,
      coalesce(event.is_mpp_guess, false) AS is_mpp_guess,
      (
        coalesce(event.bounce_type, '') IN ('hard', 'hard_bounce')
        OR coalesce(event.event_data->>'bounce_severity', '') = 'hard'
        OR coalesce(event.event_data->>'bounce_type', '') IN ('hard', 'hard_bounce')
      ) AS is_hard_bounce
    FROM public.email_tracking_events AS event
    WHERE event.campaign_id = p_campaign_id
  ),
  event_rows AS (
    SELECT event.*
    FROM raw_event_rows AS event
    CROSS JOIN message_presence AS presence
    WHERE NOT presence.has_messages
      OR EXISTS (
        SELECT 1
        FROM message_state AS message
        WHERE message.recipient_key = event.recipient_key
      )
  ),
  event_state AS (
    SELECT
      event.recipient_key,
      bool_or(event.event_type = 'sent') AS sent,
      bool_or(event.event_type = 'delivered') AS delivered,
      bool_or(event.event_type = 'opened') AS opened,
      bool_or(event.event_type = 'opened' AND NOT event.is_mpp_guess) AS opened_non_mpp,
      -- Clicks flagged by the governance classifier are machine activity and
      -- are excluded from the customer engagement count.
      bool_or(event.event_type = 'clicked' AND NOT event.is_mpp_guess) AS clicked,
      bool_or(event.event_type = 'bounced') AS bounced,
      bool_or(event.event_type = 'bounced' AND event.is_hard_bounce) AS hard_bounced,
      bool_or(event.event_type = 'complained') AS complained,
      bool_or(event.event_type = 'unsubscribed') AS unsubscribed,
      bool_or(event.event_type IN (
        'sent', 'delivered', 'opened', 'clicked', 'bounced',
        'complained', 'unsubscribed'
      )) AS send_evidence
    FROM event_rows AS event
    GROUP BY event.recipient_key
  ),
  recipient_keys AS (
    SELECT recipient_key FROM message_state
    UNION
    SELECT recipient_key FROM event_state
  ),
  recipient_state AS (
    SELECT
      recipient.recipient_key,
      coalesce(message.accepted, false) OR coalesce(event.send_evidence, false) AS sent,
      coalesce(event.delivered, false) AS delivered,
      coalesce(event.opened, false) AS opened,
      coalesce(event.opened_non_mpp, false) AS opened_non_mpp,
      coalesce(event.clicked, false) AS clicked,
      coalesce(event.bounced, false) AS bounced,
      coalesce(event.hard_bounced, false) AS hard_bounced,
      coalesce(event.complained, false) AS complained,
      coalesce(event.unsubscribed, false) AS unsubscribed,
      coalesce(message.failed, false)
        AND NOT (coalesce(message.accepted, false) OR coalesce(event.send_evidence, false)) AS failed,
      coalesce(message.skipped, false)
        AND NOT coalesce(message.accepted, false)
        AND NOT coalesce(event.send_evidence, false)
        AND NOT coalesce(message.failed, false) AS skipped,
      coalesce(message.pending, false)
        AND NOT coalesce(message.accepted, false)
        AND NOT coalesce(event.send_evidence, false)
        AND NOT coalesce(message.failed, false)
        AND NOT coalesce(message.skipped, false) AS pending
    FROM recipient_keys AS recipient
    LEFT JOIN message_state AS message USING (recipient_key)
    LEFT JOIN event_state AS event USING (recipient_key)
  ),
  totals AS (
    SELECT
      count(*)::bigint AS recipients,
      count(*) FILTER (WHERE sent)::bigint AS sent,
      count(*) FILTER (WHERE delivered)::bigint AS delivered,
      count(*) FILTER (
        WHERE (delivered OR opened OR clicked) AND NOT hard_bounced
      )::bigint AS successful_reach,
      count(*) FILTER (WHERE bounced)::bigint AS bounces,
      count(*) FILTER (WHERE hard_bounced)::bigint AS hard_bounces,
      count(*) FILTER (WHERE opened)::bigint AS unique_opens,
      count(*) FILTER (WHERE opened_non_mpp)::bigint AS unique_opens_non_mpp,
      count(*) FILTER (WHERE clicked)::bigint AS unique_clicks,
      count(*) FILTER (WHERE opened_non_mpp OR clicked)::bigint AS unique_engaged,
      count(*) FILTER (WHERE complained)::bigint AS complaints,
      count(*) FILTER (WHERE unsubscribed)::bigint AS unsubscribes,
      count(*) FILTER (WHERE failed)::bigint AS failed,
      count(*) FILTER (WHERE skipped)::bigint AS skipped,
      count(*) FILTER (WHERE pending)::bigint AS pending
    FROM recipient_state
  ),
  event_totals AS (
    SELECT
      count(*) FILTER (WHERE event_type = 'opened')::bigint AS total_opens,
      count(*) FILTER (
        WHERE event_type = 'opened' AND NOT is_mpp_guess
      )::bigint AS total_opens_non_mpp,
      count(*) FILTER (
        WHERE event_type = 'clicked' AND NOT is_mpp_guess
      )::bigint AS total_clicks,
      max(event_at) AS latest_event_at,
      min(event_at) AS first_event_at
    FROM event_rows
  ),
  report_clock AS (
    SELECT coalesce(
      v_campaign_sent_at,
      (SELECT min(first_message_at) FROM message_state),
      event_totals.first_event_at,
      v_campaign_created_at
    ) AS sent_at
    FROM event_totals
  ),
  first_engagement AS (
    SELECT
      event.recipient_key,
      min(event.event_at) FILTER (WHERE event.event_type = 'opened') AS first_open_at,
      min(event.event_at) FILTER (
        WHERE event.event_type = 'clicked' AND NOT event.is_mpp_guess
      ) AS first_click_at
    FROM event_rows AS event
    GROUP BY event.recipient_key
  ),
  engagement_buckets AS (
    SELECT
      floor(extract(epoch FROM (first_open_at - clock.sent_at)) / 3600)::integer AS hour,
      count(*)::bigint AS opens,
      0::bigint AS clicks
    FROM first_engagement
    CROSS JOIN report_clock AS clock
    WHERE first_open_at >= clock.sent_at
      AND first_open_at < clock.sent_at + interval '72 hours'
    GROUP BY 1

    UNION ALL

    SELECT
      floor(extract(epoch FROM (first_click_at - clock.sent_at)) / 3600)::integer AS hour,
      0::bigint AS opens,
      count(*)::bigint AS clicks
    FROM first_engagement
    CROSS JOIN report_clock AS clock
    WHERE first_click_at >= clock.sent_at
      AND first_click_at < clock.sent_at + interval '72 hours'
    GROUP BY 1
  ),
  hourly_increments AS (
    SELECT
      hour,
      coalesce(sum(bucket.opens), 0)::bigint AS opens,
      coalesce(sum(bucket.clicks), 0)::bigint AS clicks
    FROM generate_series(0, 71) AS hour
    LEFT JOIN engagement_buckets AS bucket USING (hour)
    GROUP BY hour
    ORDER BY hour
  ),
  timeline_points AS (
    SELECT
      hour,
      sum(opens) OVER (ORDER BY hour) AS opens,
      sum(clicks) OVER (ORDER BY hour) AS clicks
    FROM hourly_increments
  ),
  timeline AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('hour', hour, 'opens', opens, 'clicks', clicks)
        ORDER BY hour
      ),
      '[]'::jsonb
    ) AS points
    FROM timeline_points
  ),
  failure_reasons AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('reason', reason, 'count', failures)
        ORDER BY failures DESC, reason
      ),
      '[]'::jsonb
    ) AS reasons
    FROM (
      SELECT
        final_failure.reason,
        count(*)::bigint AS failures
      FROM (
        SELECT DISTINCT ON (lower(trim(message.email)))
          lower(trim(message.email)) AS recipient_key,
          coalesce(
            nullif(trim(message.error_message), ''),
            'Unknown failure'
          ) AS reason
        FROM public.email_messages AS message
        INNER JOIN recipient_state AS state
          ON state.recipient_key = lower(trim(message.email))
          AND state.failed
        WHERE message.campaign_id = p_campaign_id
          AND (
            message.status = 'failed'
            OR message.dead_lettered_at IS NOT NULL
          )
        ORDER BY
          lower(trim(message.email)),
          message.retry_sequence DESC,
          coalesce(
            message.last_attempt_at,
            message.updated_at,
            message.created_at
          ) DESC
      ) AS final_failure
      GROUP BY final_failure.reason
      ORDER BY failures DESC, reason
      LIMIT 5
    ) AS top_reasons
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'totals', jsonb_build_object(
        'recipients', totals.recipients,
        'sent', totals.sent,
        'sent_events', totals.sent,
        'observed_recipients', totals.recipients,
        'delivered', totals.delivered,
        'successful_reach', totals.successful_reach,
        'opens', totals.unique_opens,
        'total_opens', event_totals.total_opens,
        'opens_non_mpp', totals.unique_opens_non_mpp,
        'total_opens_non_mpp', event_totals.total_opens_non_mpp,
        'clicks', totals.unique_clicks,
        'total_clicks', event_totals.total_clicks,
        'unique_engaged', totals.unique_engaged,
        'bounces', totals.bounces,
        'hard_bounces', totals.hard_bounces,
        'complaints', totals.complaints,
        'unsubscribes', totals.unsubscribes,
        'failed', totals.failed,
        'skipped', totals.skipped,
        'pending', totals.pending
      ),
      'scores', jsonb_build_object(
        'reach', CASE WHEN totals.sent > 0
          THEN round((totals.successful_reach::numeric / totals.sent) * 100, 2)
          ELSE 0 END,
        'interaction', CASE WHEN totals.successful_reach > 0
          THEN round((totals.unique_engaged::numeric / totals.successful_reach) * 100, 2)
          ELSE 0 END
      ),
      'rates', jsonb_build_object(
        'delivery', CASE WHEN totals.sent > 0
          THEN round((totals.delivered::numeric / totals.sent) * 100, 2)
          ELSE 0 END,
        'open_reported', CASE WHEN totals.successful_reach > 0
          THEN round((totals.unique_opens::numeric / totals.successful_reach) * 100, 2)
          ELSE 0 END,
        'open_adjusted', CASE WHEN totals.successful_reach > 0
          THEN round((totals.unique_opens_non_mpp::numeric / totals.successful_reach) * 100, 2)
          ELSE 0 END,
        'click', CASE WHEN totals.successful_reach > 0
          THEN round((totals.unique_clicks::numeric / totals.successful_reach) * 100, 2)
          ELSE 0 END,
        'bounce', CASE WHEN totals.sent > 0
          THEN round((totals.bounces::numeric / totals.sent) * 100, 2)
          ELSE 0 END,
        'complaint', CASE WHEN totals.sent > 0
          THEN round((totals.complaints::numeric / totals.sent) * 100, 2)
          ELSE 0 END,
        'click_to_open', CASE WHEN totals.unique_opens > 0
          THEN round((totals.unique_clicks::numeric / totals.unique_opens) * 100, 2)
          ELSE 0 END
      ),
      'diagnostics', jsonb_build_object(
        'missing_send_ledger', NOT EXISTS (
          SELECT 1 FROM public.email_messages WHERE campaign_id = p_campaign_id
        ),
        'partial_send', totals.failed + totals.skipped + totals.pending > 0,
        'delivery_complete', totals.pending = 0,
        'source', 'email_messages+email_tracking_events_uncapped'
      ),
      'computed_at', statement_timestamp()
    ),
    'timeline', timeline.points,
    'failure_reasons', failure_reasons.reasons,
    'sent_at', report_clock.sent_at,
    'latest_event_at', event_totals.latest_event_at
  )
  INTO v_result
  FROM totals
  CROSS JOIN event_totals
  CROSS JOIN report_clock
  CROSS JOIN timeline
  CROSS JOIN failure_reasons;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_campaign_reporting_snapshot(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_email_campaign_reporting_snapshot(uuid)
TO authenticated, service_role;

COMMENT ON FUNCTION public.get_email_campaign_reporting_snapshot(uuid) IS
  'Returns an uncapped tenant-authorized email campaign delivery, engagement, failure, and 72-hour timeline snapshot.';
