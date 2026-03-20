-- Milestone 1: campaign recipients drill-down page
-- Returns campaign metadata, aggregate metrics context, and paginated recipient rows.

CREATE OR REPLACE FUNCTION public.get_campaign_recipients_page(
  p_campaign_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25,
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
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_offset INTEGER;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_sort_column TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_column), ''), 'event_time'));
  v_sort_direction TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_direction), ''), 'desc'));
  result JSONB;
BEGIN
  v_actor_user_id := auth.uid();
  v_offset := (v_page - 1) * v_page_size;

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'page', v_page,
        'page_size', v_page_size,
        'total_count', 0,
        'total_pages', 0
      ),
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
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'page', v_page,
        'page_size', v_page_size,
        'total_count', 0,
        'total_pages', 0
      ),
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
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'page', v_page,
        'page_size', v_page_size,
        'total_count', 0,
        'total_pages', 0
      ),
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
      c.status,
      c.scheduled_at,
      c.sent_at,
      c.created_at,
      c.segment_id,
      CASE
        WHEN c.metrics IS NULL OR c.metrics = '{}'::jsonb THEN public.get_campaign_derived_metrics(c.id)
        ELSE c.metrics
      END AS metrics,
      t.settings AS tenant_settings
    FROM public.crm_campaigns c
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
      m.email AS customer_email,
      m.status AS send_status,
      m.sent_at,
      m.last_attempt_at,
      m.created_at,
      c.first_name,
      c.last_name
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
      rb.customer_email,
      rb.send_status,
      rb.sent_at,
      rb.last_attempt_at,
      rb.created_at,
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
    SELECT
      rr.*,
      COUNT(*) OVER() AS total_count
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
  paginated AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'asc' THEN LOWER(COALESCE(customer_name, customer_email)) END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'customer_name' AND v_sort_direction = 'desc' THEN LOWER(COALESCE(customer_name, customer_email)) END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'asc' THEN LOWER(customer_email) END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'email' AND v_sort_direction = 'desc' THEN LOWER(customer_email) END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'asc' THEN latest_event_rank END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'latest_event' AND v_sort_direction = 'desc' THEN latest_event_rank END DESC NULLS LAST,
      CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'asc' THEN latest_event_at END ASC NULLS LAST,
      CASE WHEN v_sort_column = 'event_time' AND v_sort_direction = 'desc' THEN latest_event_at END DESC NULLS LAST,
      created_at DESC,
      recipient_id ASC
    LIMIT v_page_size OFFSET v_offset
  ),
  total_rows AS (
    SELECT COALESCE(MAX(total_count), 0)::INTEGER AS total_count
    FROM filtered
  )
  SELECT jsonb_build_object(
    'campaign', (
      SELECT jsonb_build_object(
        'id', cb.id,
        'name', cb.name,
        'subject_line', cb.subject_line,
        'status', cb.status,
        'scheduled_at', cb.scheduled_at,
        'sent_at', cb.sent_at,
        'created_at', cb.created_at,
        'metrics', cb.metrics,
        'tenant_timezone', NULLIF(cb.tenant_settings->>'timezone', ''),
        'segments', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('id', sr.id, 'name', sr.name)
            ORDER BY sr.name ASC
          )
          FROM segment_rows sr
        ), '[]'::jsonb),
        'recipient_count', COALESCE((SELECT COUNT(*)::INTEGER FROM recipient_base), 0)
      )
      FROM campaign_base cb
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'recipient_id', p.recipient_id,
          'customer_id', p.customer_id,
          'customer_name', p.customer_name,
          'customer_email', p.customer_email,
          'send_status', p.send_status,
          'latest_event', p.latest_event,
          'latest_event_at', p.latest_event_at,
          'delivery_status', p.delivery_status,
          'sent_at', p.sent_at,
          'created_at', p.created_at
        )
      )
      FROM paginated p
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'page_size', v_page_size,
      'total_count', COALESCE((SELECT total_count FROM total_rows), 0),
      'total_pages', CASE
        WHEN COALESCE((SELECT total_count FROM total_rows), 0) = 0 THEN 0
        ELSE CEIL(COALESCE((SELECT total_count FROM total_rows), 0)::NUMERIC / v_page_size::NUMERIC)::INTEGER
      END
    ),
    'filters', jsonb_build_object(
      'search', v_search,
      'event_filter', v_event_filter,
      'sort_column', v_sort_column,
      'sort_direction', v_sort_direction
    ),
    'not_found', false
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object(
    'campaign', NULL,
    'rows', '[]'::jsonb,
    'pagination', jsonb_build_object(
      'page', v_page,
      'page_size', v_page_size,
      'total_count', 0,
      'total_pages', 0
    ),
    'not_found', true
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_recipients_page(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_recipients_page(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;