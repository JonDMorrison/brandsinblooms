-- Match the campaign report's exclusion of classified machine clicks.
CREATE OR REPLACE FUNCTION public.get_campaign_recipient_matches(p_campaign_id uuid, p_search text DEFAULT NULL::text, p_event_filters text[] DEFAULT NULL::text[], p_event_filter text DEFAULT 'all'::text, p_time_range text DEFAULT 'all'::text, p_delivery_filter text DEFAULT 'all'::text, p_recipient_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(recipient_id uuid, customer_id uuid, customer_name text, customer_email text, send_status text, latest_event text, latest_event_at timestamp with time zone, delivery_status text, sent_at timestamp with time zone, created_at timestamp with time zone, has_sent boolean, has_delivered boolean, has_opened boolean, has_clicked boolean, has_bounced boolean, has_complained boolean, has_unsubscribed boolean, latest_event_rank integer, all_events text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_campaign_user_id UUID;
  v_campaign_tenant_id UUID;
  v_effective_tenant_id UUID;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_event_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_event_filter), ''), 'all'));
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  v_time_cutoff TIMESTAMPTZ := NULL;
  v_event_filters TEXT[] := ARRAY[]::TEXT[];
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NULL THEN
    RETURN;
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
    RETURN;
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

  IF NOT (
    v_campaign_user_id = v_actor_user_id
    OR (
      v_actor_tenant_id IS NOT NULL
      AND v_effective_tenant_id IS NOT NULL
      AND v_actor_tenant_id = v_effective_tenant_id
    )
  ) THEN
    RETURN;
  END IF;

  IF p_event_filters IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT normalized_event), ARRAY[]::TEXT[])
    INTO v_event_filters
    FROM (
      SELECT LOWER(BTRIM(event_value)) AS normalized_event
      FROM unnest(p_event_filters) AS event_value
    ) normalized
    WHERE normalized_event IN ('delivered', 'opened', 'clicked', 'bounced', 'complained');
  END IF;

  IF array_length(v_event_filters, 1) IS NULL
    AND v_event_filter IN ('delivered', 'opened', 'clicked', 'bounced', 'complained') THEN
    v_event_filters := ARRAY[v_event_filter];
    v_event_filter := 'all';
  END IF;

  CASE v_time_range
    WHEN '1h' THEN v_time_cutoff := NOW() - INTERVAL '1 hour';
    WHEN '24h' THEN v_time_cutoff := NOW() - INTERVAL '24 hours';
    WHEN '7d' THEN v_time_cutoff := NOW() - INTERVAL '7 days';
    ELSE v_time_cutoff := NULL;
  END CASE;

  RETURN QUERY
  WITH recipient_base AS (
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
      AND (
        p_recipient_ids IS NULL
        OR cardinality(p_recipient_ids) = 0
        OR m.id = ANY(p_recipient_ids)
      )
  ),
  event_rollup AS (
    SELECT
      LOWER(e.customer_email) AS recipient_email,
      BOOL_OR(e.event_type = 'sent') AS has_sent,
      BOOL_OR(e.event_type = 'delivered') AS has_delivered,
      BOOL_OR(e.event_type IN ('open', 'opened')) AS has_opened,
      BOOL_OR((e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false))) AS has_clicked,
      BOOL_OR(e.event_type IN ('bounce', 'bounced')) AS has_bounced,
      BOOL_OR(e.event_type IN ('complaint', 'complained')) AS has_complained,
      BOOL_OR(e.event_type = 'unsubscribed') AS has_unsubscribed,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'sent') AS sent_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'delivered') AS delivered_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('open', 'opened')) AS opened_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE (e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false))) AS clicked_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('bounce', 'bounced')) AS bounced_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('complaint', 'complained')) AS complained_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribed_event_at,
      array_remove(array_agg(DISTINCT CASE
        WHEN e.event_type IN ('open', 'opened') THEN 'opened'
        WHEN (e.event_type IN ('click', 'clicked') AND NOT COALESCE(e.is_mpp_guess, false)) THEN 'clicked'
        WHEN e.event_type IN ('bounce', 'bounced') THEN 'bounced'
        WHEN e.event_type IN ('complaint', 'complained') THEN 'complained'
        WHEN e.event_type IN ('sent', 'delivered', 'unsubscribed') THEN LOWER(e.event_type)
        ELSE NULL
      END), NULL) AS all_events
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
    GROUP BY LOWER(e.customer_email)
  ),
  recipient_rows AS (
    SELECT
      rb.recipient_id,
      rb.customer_id,
      NULLIF(BTRIM(CONCAT(COALESCE(rb.first_name, ''), ' ', COALESCE(rb.last_name, ''))), '') AS customer_name,
      rb.customer_email,
      rb.send_status,
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
        WHEN rb.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(er.has_delivered, false) OR COALESCE(er.has_opened, false) OR COALESCE(er.has_clicked, false) OR COALESCE(er.has_complained, false) THEN 'delivered'
        WHEN rb.send_status = 'sent' AND NOT COALESCE(er.has_delivered, false) AND NOT COALESCE(er.has_bounced, false) THEN 'pending'
        WHEN rb.send_status = 'sending' THEN 'pending'
        WHEN rb.send_status = 'queued' THEN 'pending'
        ELSE 'unknown'
      END AS delivery_status,
      rb.sent_at,
      rb.created_at,
      COALESCE(er.has_sent, false) AS has_sent,
      COALESCE(er.has_delivered, false) AS has_delivered,
      COALESCE(er.has_opened, false) AS has_opened,
      COALESCE(er.has_clicked, false) AS has_clicked,
      COALESCE(er.has_bounced, false) AS has_bounced,
      COALESCE(er.has_complained, false) AS has_complained,
      COALESCE(er.has_unsubscribed, false) AS has_unsubscribed,
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
      END AS latest_event_rank,
      COALESCE(er.all_events, ARRAY[]::TEXT[]) AS all_events
    FROM recipient_base rb
    LEFT JOIN event_rollup er ON LOWER(rb.customer_email) = er.recipient_email
  )
  SELECT
    rr.recipient_id,
    rr.customer_id,
    rr.customer_name,
    rr.customer_email,
    rr.send_status,
    rr.latest_event,
    rr.latest_event_at,
    rr.delivery_status,
    rr.sent_at,
    rr.created_at,
    rr.has_sent,
    rr.has_delivered,
    rr.has_opened,
    rr.has_clicked,
    rr.has_bounced,
    rr.has_complained,
    rr.has_unsubscribed,
    rr.latest_event_rank,
    rr.all_events
  FROM recipient_rows rr
  WHERE (
      v_search IS NULL
      OR LOWER(rr.customer_email) LIKE '%' || LOWER(v_search) || '%'
      OR LOWER(COALESCE(rr.customer_name, '')) LIKE '%' || LOWER(v_search) || '%'
    )
    AND (
      v_time_cutoff IS NULL
      OR rr.latest_event_at >= v_time_cutoff
    )
    AND CASE v_delivery_filter
      WHEN 'delivered' THEN rr.has_delivered
      WHEN 'bounced' THEN rr.has_bounced
      WHEN 'pending' THEN rr.send_status IN ('sent', 'sending', 'queued') AND NOT rr.has_delivered AND NOT rr.has_bounced
      WHEN 'failed' THEN rr.send_status = 'failed'
      ELSE TRUE
    END
    AND CASE
      WHEN v_event_filter = 'engaged' THEN rr.has_opened OR rr.has_clicked
      WHEN v_event_filter = 'unengaged' THEN rr.has_delivered AND NOT rr.has_opened AND NOT rr.has_clicked AND NOT rr.has_bounced
      WHEN v_event_filter = 'issues' THEN rr.has_bounced OR rr.has_complained
      WHEN array_length(v_event_filters, 1) IS NOT NULL THEN
        ('delivered' = ANY(v_event_filters) AND rr.has_delivered)
        OR ('opened' = ANY(v_event_filters) AND rr.has_opened)
        OR ('clicked' = ANY(v_event_filters) AND rr.has_clicked)
        OR ('bounced' = ANY(v_event_filters) AND rr.has_bounced)
        OR ('complained' = ANY(v_event_filters) AND rr.has_complained)
      ELSE TRUE
    END;
END;
$function$
;
