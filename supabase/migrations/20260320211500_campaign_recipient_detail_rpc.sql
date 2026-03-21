-- Milestone 2: single-recipient campaign email detail view.
-- Returns campaign context, sender metadata, recipient delivery state,
-- activity timeline, engagement insights, and previous/next navigation.

CREATE OR REPLACE FUNCTION public.get_campaign_recipient_detail(
  p_campaign_id UUID,
  p_recipient_id UUID,
  p_search TEXT DEFAULT NULL,
  p_event_filter TEXT DEFAULT 'all',
  p_sort_column TEXT DEFAULT 'event_time',
  p_sort_direction TEXT DEFAULT 'desc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_sort_column TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_column), ''), 'event_time'));
  v_sort_direction TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_direction), ''), 'desc'));
  result JSONB;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'recipient', NULL,
      'navigation', NULL,
      'insights', NULL,
      'timeline', '[]'::jsonb,
      'activity_log', '[]'::jsonb,
      'not_found', true
    );
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id
  INTO v_campaign_user_id, v_campaign_tenant_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'recipient', NULL,
      'navigation', NULL,
      'insights', NULL,
      'timeline', '[]'::jsonb,
      'activity_log', '[]'::jsonb,
      'not_found', true
    );
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;

  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id
    INTO v_effective_tenant_id
    FROM public.users u
    WHERE u.id = v_campaign_user_id;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id
    INTO v_effective_tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_campaign_user_id = v_actor_user_id THEN
    NULL;
  ELSIF v_actor_tenant_id IS NOT NULL
    AND v_effective_tenant_id IS NOT NULL
    AND v_actor_tenant_id = v_effective_tenant_id THEN
    NULL;
  ELSE
    RETURN jsonb_build_object(
      'campaign', NULL,
      'recipient', NULL,
      'navigation', NULL,
      'insights', NULL,
      'timeline', '[]'::jsonb,
      'activity_log', '[]'::jsonb,
      'not_found', true
    );
  END IF;

  IF v_sort_column NOT IN ('customer_name', 'email', 'latest_event', 'event_time') THEN
    v_sort_column := 'event_time';
  END IF;

  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
  END IF;

  IF v_event_filter NOT IN (
    'all',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'not_delivered'
  ) THEN
    v_event_filter := 'all';
  END IF;

  WITH campaign_base AS (
    SELECT
      c.id,
      c.name,
      c.subject_line,
      c.content,
      c.status,
      c.scheduled_at,
      c.sent_at,
      c.created_at,
      c.sender_display_name,
      c.actual_sender_email,
      c.delivery_method,
      c.from_email_domain_id,
      d.domain AS domain_name,
      d.default_from_name,
      d.default_from_email,
      d.default_reply_to,
      t.settings AS tenant_settings
    FROM public.crm_campaigns c
    LEFT JOIN public.email_domains d ON d.id = c.from_email_domain_id
    LEFT JOIN public.tenants t ON t.id = v_effective_tenant_id
    WHERE c.id = p_campaign_id
  ),
  segment_rows AS (
    SELECT DISTINCT s.id, s.name
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    UNION
    SELECT DISTINCT s.id, s.name
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = p_campaign_id
  ),
  recipient_base AS (
    SELECT
      m.id AS recipient_id,
      m.customer_id,
      m.domain_id,
      m.email AS customer_email,
      m.payload,
      m.status AS send_status,
      m.resend_id,
      m.attempts,
      m.sent_at,
      m.last_attempt_at,
      m.error_message,
      m.created_at,
      c.first_name,
      c.last_name,
      c.phone,
      c.total_spent,
      c.lifetime_value,
      c.first_purchase_date,
      c.last_purchase_date,
      c.custom_fields
    FROM public.email_messages m
    LEFT JOIN public.crm_customers c ON c.id = m.customer_id
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  ),
  event_rollup AS (
    SELECT
      LOWER(e.customer_email) AS recipient_email,
      BOOL_OR(e.event_type = 'sent') AS has_sent,
      BOOL_OR(e.event_type = 'delivered') AS has_delivered,
      BOOL_OR(e.event_type IN ('open', 'opened')) AS has_opened,
      BOOL_OR(e.event_type IN ('click', 'clicked')) AS has_clicked,
      BOOL_OR(e.event_type IN ('bounce', 'bounced')) AS has_bounced,
      BOOL_OR(e.event_type IN ('complaint', 'complained')) AS has_complained,
      BOOL_OR(e.event_type = 'unsubscribed') AS has_unsubscribed,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'sent') AS sent_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'delivered') AS delivered_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('open', 'opened')) AS opened_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('click', 'clicked')) AS clicked_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('bounce', 'bounced')) AS bounced_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('complaint', 'complained')) AS complained_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribed_event_at
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
    GROUP BY LOWER(e.customer_email)
  ),
  recipient_rows AS (
    SELECT
      rb.recipient_id,
      rb.customer_id,
      rb.domain_id,
      rb.customer_email,
      rb.payload,
      rb.send_status,
      rb.resend_id,
      rb.attempts,
      rb.sent_at,
      rb.last_attempt_at,
      rb.error_message,
      rb.created_at,
      rb.phone,
      rb.total_spent,
      rb.lifetime_value,
      rb.first_purchase_date,
      rb.last_purchase_date,
      rb.custom_fields,
      NULLIF(BTRIM(CONCAT(COALESCE(rb.first_name, ''), ' ', COALESCE(rb.last_name, ''))), '') AS customer_name,
      COALESCE(er.has_sent, false) AS has_sent,
      COALESCE(er.has_delivered, false) AS has_delivered,
      COALESCE(er.has_opened, false) AS has_opened,
      COALESCE(er.has_clicked, false) AS has_clicked,
      COALESCE(er.has_bounced, false) AS has_bounced,
      COALESCE(er.has_complained, false) AS has_complained,
      COALESCE(er.has_unsubscribed, false) AS has_unsubscribed,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 'clicked'
        WHEN COALESCE(er.has_opened, false) THEN 'opened'
        WHEN COALESCE(er.has_delivered, false) THEN 'delivered'
        WHEN COALESCE(er.has_sent, false) THEN 'sent'
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN COALESCE(er.has_unsubscribed, false) THEN 'unsubscribed'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN rb.send_status = 'sending' THEN 'sending'
        WHEN rb.send_status = 'queued' THEN 'queued'
        WHEN rb.send_status = 'skipped' THEN 'skipped'
        ELSE 'sent'
      END AS latest_event,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN er.clicked_event_at
        WHEN COALESCE(er.has_opened, false) THEN er.opened_event_at
        WHEN COALESCE(er.has_delivered, false) THEN er.delivered_event_at
        WHEN COALESCE(er.has_sent, false) THEN er.sent_event_at
        WHEN COALESCE(er.has_bounced, false) THEN er.bounced_event_at
        WHEN COALESCE(er.has_complained, false) THEN er.complained_event_at
        WHEN COALESCE(er.has_unsubscribed, false) THEN er.unsubscribed_event_at
        ELSE COALESCE(rb.sent_at, rb.last_attempt_at, rb.created_at)
      END AS latest_event_at,
      CASE
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(er.has_delivered, false) OR COALESCE(er.has_opened, false) OR COALESCE(er.has_clicked, false) THEN 'delivered'
        WHEN rb.send_status = 'sending' THEN 'delayed'
        WHEN COALESCE(er.has_sent, false) OR rb.send_status = 'sent' THEN 'sent'
        WHEN rb.send_status = 'queued' THEN 'queued'
        ELSE 'unknown'
      END AS delivery_status,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 7
        WHEN COALESCE(er.has_opened, false) THEN 6
        WHEN COALESCE(er.has_delivered, false) THEN 5
        WHEN COALESCE(er.has_sent, false) THEN 4
        WHEN COALESCE(er.has_bounced, false) THEN 3
        WHEN COALESCE(er.has_complained, false) THEN 2
        WHEN COALESCE(er.has_unsubscribed, false) THEN 1
        WHEN rb.send_status = 'failed' THEN 0
        ELSE 4
      END AS latest_event_rank
    FROM recipient_base rb
    LEFT JOIN event_rollup er ON LOWER(rb.customer_email) = er.recipient_email
  ),
  filtered AS (
    SELECT rr.*
    FROM recipient_rows rr
    WHERE (
      v_search IS NULL
      OR LOWER(rr.customer_email) LIKE '%' || LOWER(v_search) || '%'
      OR LOWER(COALESCE(rr.customer_name, '')) LIKE '%' || LOWER(v_search) || '%'
    )
      AND CASE v_event_filter
        WHEN 'delivered' THEN rr.latest_event = 'delivered'
        WHEN 'opened' THEN rr.latest_event = 'opened'
        WHEN 'clicked' THEN rr.latest_event = 'clicked'
        WHEN 'bounced' THEN rr.latest_event = 'bounced'
        WHEN 'complained' THEN rr.latest_event = 'complained'
        WHEN 'not_delivered' THEN
          NOT rr.has_delivered
          AND NOT rr.has_opened
          AND NOT rr.has_clicked
          AND NOT rr.has_bounced
          AND NOT rr.has_complained
          AND (rr.has_sent OR rr.send_status IN ('sent', 'sending'))
        ELSE TRUE
      END
  ),
  ordered_filtered AS (
    SELECT
      f.recipient_id,
      COALESCE(f.customer_name, f.customer_email) AS display_name,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS list_position,
      COUNT(*) OVER () AS total_filtered_count,
      LAG(f.recipient_id) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS previous_recipient_id,
      LAG(COALESCE(f.customer_name, f.customer_email)) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS previous_label,
      LEAD(f.recipient_id) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS next_recipient_id,
      LEAD(COALESCE(f.customer_name, f.customer_email)) OVER (
        ORDER BY
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(f.customer_name, f.customer_email)) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(f.customer_email) END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(f.customer_email) END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN f.latest_event_rank END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN f.latest_event_rank END DESC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN f.latest_event_at END ASC NULLS LAST,
          CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN f.latest_event_at END DESC NULLS LAST,
          f.created_at DESC,
          f.recipient_id ASC
      ) AS next_label
    FROM filtered f
  ),
  detail_row AS (
    SELECT rr.*
    FROM recipient_rows rr
    WHERE rr.recipient_id = p_recipient_id
  ),
  navigation_row AS (
    SELECT *
    FROM ordered_filtered ofr
    WHERE ofr.recipient_id = p_recipient_id
  ),
  event_history AS (
    SELECT
      e.id,
      LOWER(e.event_type) AS event_type,
      COALESCE(e.event_ts_provider, e.created_at) AS event_at,
      e.created_at,
      e.provider_message_id,
      e.webhook_delivery_id,
      e.link_id,
      COALESCE(tl.url, e.event_data ->> 'click_link') AS link_url,
      e.user_agent,
      CASE WHEN e.ip_address IS NULL THEN NULL ELSE e.ip_address::TEXT END AS ip_address,
      COALESCE(e.is_mpp_guess, false) AS is_mpp_guess,
      COALESCE(e.event_data, '{}'::jsonb) AS event_data
    FROM public.email_tracking_events e
    JOIN detail_row d ON LOWER(d.customer_email) = LOWER(e.customer_email)
    LEFT JOIN public.tracked_links tl ON tl.id = e.link_id
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
  ),
  event_insights AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('open', 'opened'))::INTEGER AS open_count,
      COUNT(*) FILTER (WHERE event_type IN ('click', 'clicked'))::INTEGER AS click_count,
      COUNT(*) FILTER (WHERE event_type IN ('bounce', 'bounced'))::INTEGER AS bounce_count,
      COUNT(*) FILTER (WHERE event_type IN ('complaint', 'complained'))::INTEGER AS complaint_count,
      BOOL_OR(event_type IN ('open', 'opened')) AS opened,
      BOOL_OR(event_type IN ('click', 'clicked')) AS clicked,
      BOOL_OR(event_type IN ('bounce', 'bounced')) AS bounced,
      BOOL_OR(event_type IN ('complaint', 'complained')) AS complained,
      BOOL_OR(event_type = 'unsubscribed') AS unsubscribed,
      BOOL_OR(event_type IN ('open', 'opened') AND is_mpp_guess) AS has_mpp_open,
      MIN(event_at) FILTER (WHERE event_type IN ('open', 'opened')) AS first_open_at,
      MAX(event_at) FILTER (WHERE event_type IN ('open', 'opened')) AS last_open_at,
      MIN(event_at) FILTER (WHERE event_type IN ('click', 'clicked')) AS first_click_at,
      MAX(event_at) FILTER (WHERE event_type IN ('click', 'clicked')) AS last_click_at
    FROM event_history
  ),
  timeline_entries AS (
    SELECT
      'queued'::TEXT AS event_type,
      d.created_at AS event_at,
      'Queued for send'::TEXT AS label,
      NULL::JSONB AS metadata,
      0 AS sort_weight
    FROM detail_row d
    UNION ALL
    SELECT
      'attempted'::TEXT AS event_type,
      d.last_attempt_at AS event_at,
      'Latest send attempt'::TEXT AS label,
      jsonb_build_object('attempts', d.attempts) AS metadata,
      1 AS sort_weight
    FROM detail_row d
    WHERE d.last_attempt_at IS NOT NULL
    UNION ALL
    SELECT
      eh.event_type,
      eh.event_at,
      CASE eh.event_type
        WHEN 'sent' THEN 'Sent to provider'
        WHEN 'delivered' THEN 'Delivered'
        WHEN 'open' THEN 'Opened'
        WHEN 'opened' THEN 'Opened'
        WHEN 'click' THEN 'Clicked'
        WHEN 'clicked' THEN 'Clicked'
        WHEN 'bounce' THEN 'Bounced'
        WHEN 'bounced' THEN 'Bounced'
        WHEN 'complaint' THEN 'Complaint'
        WHEN 'complained' THEN 'Complaint'
        WHEN 'unsubscribed' THEN 'Unsubscribed'
        ELSE INITCAP(eh.event_type)
      END AS label,
      jsonb_strip_nulls(jsonb_build_object(
        'provider_message_id', eh.provider_message_id,
        'link_url', eh.link_url,
        'is_mpp_guess', eh.is_mpp_guess,
        'event_data', eh.event_data
      )) AS metadata,
      10 AS sort_weight
    FROM event_history eh
  )
  SELECT jsonb_build_object(
    'campaign', (
      SELECT jsonb_build_object(
        'id', cb.id,
        'name', cb.name,
        'subject_line', cb.subject_line,
        'content', cb.content,
        'status', cb.status,
        'scheduled_at', cb.scheduled_at,
        'sent_at', cb.sent_at,
        'created_at', cb.created_at,
        'tenant_timezone', cb.tenant_settings ->> 'timezone',
        'from_name', COALESCE(cb.sender_display_name, cb.default_from_name, 'BloomSuite'),
        'from_email', COALESCE(cb.actual_sender_email, cb.default_from_email, CASE WHEN cb.domain_name IS NOT NULL THEN 'mail@' || cb.domain_name ELSE NULL END),
        'reply_to', COALESCE(cb.default_reply_to, cb.actual_sender_email, cb.default_from_email, CASE WHEN cb.domain_name IS NOT NULL THEN 'mail@' || cb.domain_name ELSE NULL END),
        'delivery_method', cb.delivery_method,
        'domain_id', cb.from_email_domain_id,
        'domain_name', cb.domain_name,
        'segments', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('id', sr.id, 'name', sr.name)
            ORDER BY sr.name
          )
          FROM segment_rows sr
        ), '[]'::jsonb)
      )
      FROM campaign_base cb
    ),
    'recipient', (
      SELECT jsonb_build_object(
        'recipient_id', d.recipient_id,
        'customer_id', d.customer_id,
        'customer_name', d.customer_name,
        'customer_email', d.customer_email,
        'phone', d.phone,
        'send_status', d.send_status,
        'latest_event', d.latest_event,
        'latest_event_at', d.latest_event_at,
        'delivery_status', d.delivery_status,
        'sent_at', d.sent_at,
        'last_attempt_at', d.last_attempt_at,
        'created_at', d.created_at,
        'attempts', d.attempts,
        'resend_id', d.resend_id,
        'domain_id', d.domain_id,
        'error_message', d.error_message,
        'has_sent', d.has_sent,
        'has_delivered', d.has_delivered,
        'has_opened', d.has_opened,
        'has_clicked', d.has_clicked,
        'has_bounced', d.has_bounced,
        'has_complained', d.has_complained,
        'has_unsubscribed', d.has_unsubscribed,
        'total_spent', d.total_spent,
        'lifetime_value', d.lifetime_value,
        'first_purchase_date', d.first_purchase_date,
        'last_purchase_date', d.last_purchase_date,
        'custom_fields', COALESCE(d.custom_fields, '{}'::jsonb),
        'payload', COALESCE(d.payload, '{}'::jsonb)
      )
      FROM detail_row d
    ),
    'navigation', (
      SELECT jsonb_build_object(
        'position', nr.list_position,
        'total_filtered_count', nr.total_filtered_count,
        'previous_recipient_id', nr.previous_recipient_id,
        'previous_label', nr.previous_label,
        'next_recipient_id', nr.next_recipient_id,
        'next_label', nr.next_label
      )
      FROM navigation_row nr
    ),
    'insights', (
      SELECT jsonb_build_object(
        'opened', COALESCE(ei.opened, false),
        'clicked', COALESCE(ei.clicked, false),
        'bounced', COALESCE(ei.bounced, false),
        'complained', COALESCE(ei.complained, false),
        'unsubscribed', COALESCE(ei.unsubscribed, false),
        'has_mpp_open', COALESCE(ei.has_mpp_open, false),
        'open_count', COALESCE(ei.open_count, 0),
        'click_count', COALESCE(ei.click_count, 0),
        'bounce_count', COALESCE(ei.bounce_count, 0),
        'complaint_count', COALESCE(ei.complaint_count, 0),
        'first_open_at', ei.first_open_at,
        'last_open_at', ei.last_open_at,
        'first_click_at', ei.first_click_at,
        'last_click_at', ei.last_click_at
      )
      FROM event_insights ei
    ),
    'timeline', COALESCE((
      SELECT jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'event_type', te.event_type,
          'event_at', te.event_at,
          'label', te.label,
          'metadata', te.metadata
        ))
        ORDER BY te.event_at ASC NULLS LAST, te.sort_weight ASC
      )
      FROM timeline_entries te
    ), '[]'::jsonb),
    'activity_log', COALESCE((
      SELECT jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', eh.id,
          'event_type', eh.event_type,
          'event_at', eh.event_at,
          'provider_message_id', eh.provider_message_id,
          'webhook_delivery_id', eh.webhook_delivery_id,
          'link_id', eh.link_id,
          'link_url', eh.link_url,
          'user_agent', eh.user_agent,
          'ip_address', eh.ip_address,
          'is_mpp_guess', eh.is_mpp_guess,
          'event_data', eh.event_data
        ))
        ORDER BY eh.event_at DESC NULLS LAST, eh.created_at DESC NULLS LAST
      )
      FROM event_history eh
    ), '[]'::jsonb),
    'not_found', NOT EXISTS (SELECT 1 FROM detail_row)
  )
  INTO result;

  RETURN COALESCE(
    result,
    jsonb_build_object(
      'campaign', NULL,
      'recipient', NULL,
      'navigation', NULL,
      'insights', NULL,
      'timeline', '[]'::jsonb,
      'activity_log', '[]'::jsonb,
      'not_found', true
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_detail(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_detail(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;