ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS retry_sequence SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_of_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retried_at TIMESTAMPTZ;

UPDATE public.email_messages
SET retry_sequence = 0
WHERE retry_sequence IS NULL;

DROP INDEX IF EXISTS public.uq_email_messages_campaign_customer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_campaign_customer_retry_sequence
  ON public.email_messages (campaign_id, customer_id, retry_sequence);

CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_customer_retry_sequence
  ON public.email_messages (campaign_id, customer_id, retry_sequence DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_tracking_events_campaign_recipient_event_time
  ON public.email_tracking_events (
    campaign_id,
    tenant_id,
    lower(customer_email),
    COALESCE(event_ts_provider, created_at) DESC
  );

ALTER TABLE public.email_messages
  DROP CONSTRAINT IF EXISTS email_messages_retry_sequence_check;

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_retry_sequence_check
  CHECK (retry_sequence BETWEEN 0 AND 1);

ALTER TABLE public.email_messages
  DROP CONSTRAINT IF EXISTS email_messages_retry_link_check;

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_retry_link_check
  CHECK (
    (retry_sequence = 0 AND retry_of_message_id IS NULL)
    OR (retry_sequence = 1 AND retry_of_message_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.get_campaign_recipient_matches(
  p_campaign_id UUID,
  p_search TEXT DEFAULT NULL,
  p_event_filters TEXT[] DEFAULT NULL,
  p_event_filter TEXT DEFAULT 'all',
  p_time_range TEXT DEFAULT 'all',
  p_delivery_filter TEXT DEFAULT 'all',
  p_recipient_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  recipient_id UUID,
  current_message_id UUID,
  retry_message_id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  send_status TEXT,
  latest_event TEXT,
  latest_event_at TIMESTAMPTZ,
  delivery_status TEXT,
  sent_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  attempts INTEGER,
  resend_id TEXT,
  error_message TEXT,
  has_sent BOOLEAN,
  has_delivered BOOLEAN,
  has_opened BOOLEAN,
  has_clicked BOOLEAN,
  has_bounced BOOLEAN,
  has_complained BOOLEAN,
  has_unsubscribed BOOLEAN,
  has_hard_bounce BOOLEAN,
  hard_bounce_reason TEXT,
  retry_count INTEGER,
  retry_status TEXT,
  can_retry BOOLEAN,
  engagement_score INTEGER,
  latest_event_rank INTEGER,
  all_events TEXT[]
)
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
  WITH message_rows AS (
    SELECT
      m.id,
      m.customer_id,
      m.domain_id,
      m.email,
      m.payload,
      m.status,
      m.resend_id,
      m.attempts,
      m.sent_at,
      m.last_attempt_at,
      m.error_message,
      m.created_at,
      m.retry_sequence,
      m.retry_of_message_id,
      c.first_name,
      c.last_name
    FROM public.email_messages m
    LEFT JOIN public.crm_customers c ON c.id = m.customer_id
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  ),
  canonical_rows AS (
    SELECT DISTINCT ON (mr.customer_id)
      mr.customer_id,
      mr.id AS recipient_id,
      mr.email AS customer_email,
      mr.created_at,
      mr.first_name,
      mr.last_name
    FROM message_rows mr
    ORDER BY mr.customer_id, mr.retry_sequence ASC, mr.created_at ASC, mr.id ASC
  ),
  latest_rows AS (
    SELECT DISTINCT ON (mr.customer_id)
      mr.customer_id,
      mr.id AS current_message_id,
      mr.domain_id,
      mr.email,
      mr.payload,
      mr.status AS send_status,
      mr.resend_id,
      mr.attempts,
      mr.sent_at,
      mr.last_attempt_at,
      mr.error_message,
      mr.created_at,
      mr.retry_sequence
    FROM message_rows mr
    ORDER BY mr.customer_id, mr.retry_sequence DESC, mr.created_at DESC, mr.id DESC
  ),
  retry_rows AS (
    SELECT
      mr.customer_id,
      COUNT(*) FILTER (WHERE mr.retry_sequence > 0)::INTEGER AS retry_count,
      (ARRAY_AGG(mr.id ORDER BY mr.retry_sequence DESC, mr.created_at DESC, mr.id DESC) FILTER (WHERE mr.retry_sequence > 0))[1] AS retry_message_id,
      (ARRAY_AGG(mr.status ORDER BY mr.retry_sequence DESC, mr.created_at DESC, mr.id DESC) FILTER (WHERE mr.retry_sequence > 0))[1] AS retry_status
    FROM message_rows mr
    GROUP BY mr.customer_id
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
      BOOL_OR(
        e.event_type IN ('bounce', 'bounced')
        AND (
          COALESCE(NULLIF(LOWER(e.bounce_type), ''), '') IN ('hard', 'hard_bounce')
          OR COALESCE(NULLIF(LOWER(e.event_data ->> 'bounce_type'), ''), '') IN ('hard', 'hard_bounce')
        )
      ) AS has_hard_bounce,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'sent') AS sent_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'delivered') AS delivered_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('open', 'opened')) AS opened_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('click', 'clicked')) AS clicked_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('bounce', 'bounced')) AS bounced_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type IN ('complaint', 'complained')) AS complained_event_at,
      MAX(COALESCE(e.event_ts_provider, e.created_at)) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribed_event_at,
      (ARRAY_AGG(
        COALESCE(
          NULLIF(e.bounce_type, ''),
          NULLIF(e.event_data ->> 'reason', ''),
          NULLIF(e.event_data ->> 'message', ''),
          NULLIF(e.event_data ->> 'bounce_type', '')
        )
        ORDER BY COALESCE(e.event_ts_provider, e.created_at) DESC, e.created_at DESC
      ) FILTER (WHERE e.event_type IN ('bounce', 'bounced')))[1] AS hard_bounce_reason,
      array_remove(array_agg(DISTINCT CASE
        WHEN e.event_type IN ('open', 'opened') THEN 'opened'
        WHEN e.event_type IN ('click', 'clicked') THEN 'clicked'
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
  current_attempt_events AS (
    SELECT
      lr.current_message_id,
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
    FROM latest_rows lr
    LEFT JOIN public.email_tracking_events e
      ON e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
      AND LOWER(e.customer_email) = LOWER(lr.email)
      AND (
        lr.retry_sequence = 0
        OR (lr.resend_id IS NOT NULL AND e.provider_message_id = lr.resend_id)
      )
    GROUP BY lr.current_message_id
  ),
  recipient_rows AS (
    SELECT
      cr.recipient_id,
      lr.current_message_id,
      rr.retry_message_id,
      cr.customer_id,
      NULLIF(BTRIM(CONCAT(COALESCE(cr.first_name, ''), ' ', COALESCE(cr.last_name, ''))), '') AS customer_name,
      cr.customer_email,
      lr.send_status,
      CASE
        WHEN lr.retry_sequence > 0 AND lr.send_status = 'queued' THEN 'queued'
        WHEN lr.send_status = 'sending' THEN 'sending'
        WHEN lr.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(cae.has_clicked, false) THEN 'clicked'
        WHEN COALESCE(cae.has_opened, false) THEN 'opened'
        WHEN COALESCE(cae.has_delivered, false) THEN 'delivered'
        WHEN COALESCE(cae.has_sent, false) OR lr.send_status = 'sent' THEN 'sent'
        WHEN COALESCE(er.has_clicked, false) THEN 'clicked'
        WHEN COALESCE(er.has_opened, false) THEN 'opened'
        WHEN COALESCE(er.has_delivered, false) THEN 'delivered'
        WHEN COALESCE(er.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) THEN 'complained'
        WHEN COALESCE(er.has_unsubscribed, false) THEN 'unsubscribed'
        WHEN lr.send_status = 'queued' THEN 'queued'
        WHEN lr.send_status = 'skipped' THEN 'skipped'
        ELSE 'sent'
      END AS latest_event,
      CASE
        WHEN lr.retry_sequence > 0 AND lr.send_status = 'queued' THEN lr.created_at
        WHEN lr.send_status = 'sending' THEN COALESCE(lr.last_attempt_at, lr.created_at)
        WHEN lr.send_status = 'failed' THEN COALESCE(lr.last_attempt_at, lr.created_at)
        WHEN COALESCE(cae.has_clicked, false) THEN cae.clicked_event_at
        WHEN COALESCE(cae.has_opened, false) THEN cae.opened_event_at
        WHEN COALESCE(cae.has_delivered, false) THEN cae.delivered_event_at
        WHEN COALESCE(cae.has_sent, false) THEN cae.sent_event_at
        WHEN COALESCE(er.has_clicked, false) THEN er.clicked_event_at
        WHEN COALESCE(er.has_opened, false) THEN er.opened_event_at
        WHEN COALESCE(er.has_delivered, false) THEN er.delivered_event_at
        WHEN COALESCE(er.has_sent, false) THEN er.sent_event_at
        WHEN COALESCE(er.has_bounced, false) THEN er.bounced_event_at
        WHEN COALESCE(er.has_complained, false) THEN er.complained_event_at
        WHEN COALESCE(er.has_unsubscribed, false) THEN er.unsubscribed_event_at
        ELSE COALESCE(lr.sent_at, lr.last_attempt_at, cr.created_at)
      END AS latest_event_at,
      CASE
        WHEN lr.send_status IN ('queued', 'sending') THEN 'pending'
        WHEN lr.send_status = 'failed' THEN 'failed'
        WHEN COALESCE(cae.has_bounced, false) THEN 'bounced'
        WHEN COALESCE(cae.has_complained, false) THEN 'complained'
        WHEN COALESCE(cae.has_delivered, false) OR COALESCE(cae.has_opened, false) OR COALESCE(cae.has_clicked, false) THEN 'delivered'
        WHEN COALESCE(er.has_bounced, false) AND COALESCE(rr.retry_count, 0) = 0 THEN 'bounced'
        WHEN COALESCE(er.has_complained, false) AND COALESCE(rr.retry_count, 0) = 0 THEN 'complained'
        WHEN lr.send_status = 'sent' OR COALESCE(cae.has_sent, false) THEN 'sent'
        ELSE 'unknown'
      END AS delivery_status,
      lr.sent_at,
      lr.last_attempt_at,
      cr.created_at,
      lr.attempts,
      lr.resend_id,
      lr.error_message,
      COALESCE(er.has_sent, false) AS has_sent,
      COALESCE(er.has_delivered, false) AS has_delivered,
      COALESCE(er.has_opened, false) AS has_opened,
      COALESCE(er.has_clicked, false) AS has_clicked,
      COALESCE(er.has_bounced, false) AS has_bounced,
      COALESCE(er.has_complained, false) AS has_complained,
      COALESCE(er.has_unsubscribed, false) AS has_unsubscribed,
      COALESCE(er.has_hard_bounce, false) AS has_hard_bounce,
      er.hard_bounce_reason,
      COALESCE(rr.retry_count, 0) AS retry_count,
      rr.retry_status,
      (
        COALESCE(rr.retry_count, 0) = 0
        AND (
          lr.send_status = 'failed'
          OR COALESCE(er.has_bounced, false)
        )
      ) AS can_retry,
      CASE
        WHEN COALESCE(er.has_clicked, false) THEN 100
        WHEN COALESCE(er.has_opened, false) THEN 74
        WHEN COALESCE(er.has_delivered, false) THEN 48
        WHEN COALESCE(er.has_sent, false) OR lr.send_status = 'sent' THEN 24
        WHEN lr.send_status IN ('queued', 'sending') THEN 12
        ELSE 0
      END AS engagement_score,
      CASE
        WHEN COALESCE(cae.has_clicked, false) OR COALESCE(er.has_clicked, false) THEN 8
        WHEN COALESCE(cae.has_opened, false) OR COALESCE(er.has_opened, false) THEN 7
        WHEN COALESCE(cae.has_delivered, false) OR COALESCE(er.has_delivered, false) THEN 6
        WHEN lr.send_status = 'sent' OR COALESCE(cae.has_sent, false) OR COALESCE(er.has_sent, false) THEN 5
        WHEN lr.send_status = 'queued' THEN 4
        WHEN lr.send_status = 'sending' THEN 3
        WHEN COALESCE(er.has_bounced, false) THEN 2
        WHEN COALESCE(er.has_complained, false) THEN 1
        WHEN lr.send_status = 'failed' THEN 0
        ELSE 5
      END AS latest_event_rank,
      COALESCE(er.all_events, ARRAY[]::TEXT[]) AS all_events
    FROM canonical_rows cr
    JOIN latest_rows lr ON lr.customer_id = cr.customer_id
    LEFT JOIN retry_rows rr ON rr.customer_id = cr.customer_id
    LEFT JOIN event_rollup er ON LOWER(cr.customer_email) = er.recipient_email
    LEFT JOIN current_attempt_events cae ON cae.current_message_id = lr.current_message_id
  )
  SELECT
    rr.recipient_id,
    rr.current_message_id,
    rr.retry_message_id,
    rr.customer_id,
    rr.customer_name,
    rr.customer_email,
    rr.send_status,
    rr.latest_event,
    rr.latest_event_at,
    rr.delivery_status,
    rr.sent_at,
    rr.last_attempt_at,
    rr.created_at,
    rr.attempts,
    rr.resend_id,
    rr.error_message,
    rr.has_sent,
    rr.has_delivered,
    rr.has_opened,
    rr.has_clicked,
    rr.has_bounced,
    rr.has_complained,
    rr.has_unsubscribed,
    rr.has_hard_bounce,
    rr.hard_bounce_reason,
    rr.retry_count,
    rr.retry_status,
    rr.can_retry,
    rr.engagement_score,
    rr.latest_event_rank,
    rr.all_events
  FROM recipient_rows rr
  WHERE (
      p_recipient_ids IS NULL
      OR cardinality(p_recipient_ids) = 0
      OR rr.recipient_id = ANY(p_recipient_ids)
    )
    AND (
      v_search IS NULL
      OR LOWER(rr.customer_email) LIKE '%' || LOWER(v_search) || '%'
      OR LOWER(COALESCE(rr.customer_name, '')) LIKE '%' || LOWER(v_search) || '%'
    )
    AND (
      v_time_cutoff IS NULL
      OR rr.latest_event_at >= v_time_cutoff
    )
    AND CASE v_delivery_filter
      WHEN 'delivered' THEN rr.delivery_status = 'delivered'
      WHEN 'bounced' THEN rr.has_bounced
      WHEN 'pending' THEN rr.delivery_status = 'pending'
      WHEN 'failed' THEN rr.send_status = 'failed'
      ELSE TRUE
    END
    AND CASE
      WHEN v_event_filter = 'engaged' THEN rr.has_opened OR rr.has_clicked
      WHEN v_event_filter = 'unengaged' THEN rr.has_delivered AND NOT rr.has_opened AND NOT rr.has_clicked AND NOT rr.has_bounced
      WHEN v_event_filter = 'issues' THEN rr.has_bounced OR rr.has_complained OR rr.send_status = 'failed'
      WHEN array_length(v_event_filters, 1) IS NOT NULL THEN
        ('delivered' = ANY(v_event_filters) AND rr.has_delivered)
        OR ('opened' = ANY(v_event_filters) AND rr.has_opened)
        OR ('clicked' = ANY(v_event_filters) AND rr.has_clicked)
        OR ('bounced' = ANY(v_event_filters) AND rr.has_bounced)
        OR ('complained' = ANY(v_event_filters) AND rr.has_complained)
      ELSE TRUE
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_matches(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_matches(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.get_campaign_recipients_page(
  p_campaign_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25,
  p_search TEXT DEFAULT NULL,
  p_event_filter TEXT DEFAULT 'all',
  p_sort_column TEXT DEFAULT 'event_time',
  p_sort_direction TEXT DEFAULT 'desc',
  p_event_filters TEXT[] DEFAULT NULL,
  p_time_range TEXT DEFAULT 'all',
  p_delivery_filter TEXT DEFAULT 'all'
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
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  result JSONB;
BEGIN
  v_actor_user_id := auth.uid();
  v_offset := (v_page - 1) * v_page_size;

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  SELECT u.tenant_id INTO v_actor_tenant_id FROM public.users u WHERE u.id = v_actor_user_id;
  SELECT c.user_id, c.tenant_id INTO v_campaign_user_id, v_campaign_tenant_id FROM public.crm_campaigns c WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id INTO v_effective_tenant_id FROM public.users u WHERE u.id = v_campaign_user_id;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
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
    RETURN jsonb_build_object(
      'campaign', NULL,
      'rows', '[]'::jsonb,
      'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
      'not_found', true
    );
  END IF;

  IF v_sort_column NOT IN ('customer_name', 'email', 'latest_event', 'event_time') THEN
    v_sort_column := 'event_time';
  END IF;
  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
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
  filtered AS (
    SELECT
      rr.*,
      COUNT(*) OVER() AS total_count
    FROM public.get_campaign_recipient_matches(
      p_campaign_id,
      v_search,
      p_event_filters,
      v_event_filter,
      v_time_range,
      v_delivery_filter,
      NULL
    ) rr
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
    SELECT COALESCE(MAX(total_count), 0)::INTEGER AS total_count FROM filtered
  ),
  campaign_recipient_count AS (
    SELECT COUNT(DISTINCT m.customer_id)::INTEGER AS total_recipients
    FROM public.email_messages m
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
      AND m.retry_sequence = 0
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
          SELECT jsonb_agg(jsonb_build_object('id', sr.id, 'name', sr.name) ORDER BY sr.name ASC)
          FROM segment_rows sr
        ), '[]'::jsonb),
        'recipient_count', COALESCE((SELECT total_recipients FROM campaign_recipient_count), 0)
      )
      FROM campaign_base cb
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'recipient_id', p.recipient_id,
        'current_message_id', p.current_message_id,
        'retry_message_id', p.retry_message_id,
        'customer_id', p.customer_id,
        'customer_name', p.customer_name,
        'customer_email', p.customer_email,
        'send_status', p.send_status,
        'latest_event', p.latest_event,
        'latest_event_at', p.latest_event_at,
        'delivery_status', p.delivery_status,
        'sent_at', p.sent_at,
        'last_attempt_at', p.last_attempt_at,
        'created_at', p.created_at,
        'attempts', p.attempts,
        'resend_id', p.resend_id,
        'error_message', p.error_message,
        'retry_count', p.retry_count,
        'retry_status', p.retry_status,
        'can_retry', p.can_retry,
        'has_hard_bounce', p.has_hard_bounce,
        'hard_bounce_reason', p.hard_bounce_reason,
        'engagement_score', p.engagement_score,
        'all_events', COALESCE(to_jsonb(p.all_events), '[]'::jsonb)
      ))
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
      'event_filters', COALESCE(to_jsonb(p_event_filters), '[]'::jsonb),
      'time_range', v_time_range,
      'delivery_filter', v_delivery_filter,
      'sort_column', v_sort_column,
      'sort_direction', v_sort_direction
    ),
    'not_found', false
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object(
    'campaign', NULL,
    'rows', '[]'::jsonb,
    'pagination', jsonb_build_object('page', v_page, 'page_size', v_page_size, 'total_count', 0, 'total_pages', 0),
    'not_found', true
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_recipients_page(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_recipients_page(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_campaign_recipient_detail(
  p_campaign_id UUID,
  p_recipient_id UUID,
  p_search TEXT DEFAULT NULL,
  p_event_filter TEXT DEFAULT 'all',
  p_sort_column TEXT DEFAULT 'event_time',
  p_sort_direction TEXT DEFAULT 'desc',
  p_event_filters TEXT[] DEFAULT NULL,
  p_time_range TEXT DEFAULT 'all',
  p_delivery_filter TEXT DEFAULT 'all'
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
  v_time_range TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_time_range), ''), 'all'));
  v_delivery_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_delivery_filter), ''), 'all'));
  result JSONB;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NULL THEN
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  SELECT u.tenant_id INTO v_actor_tenant_id FROM public.users u WHERE u.id = v_actor_user_id;
  SELECT c.user_id, c.tenant_id INTO v_campaign_user_id, v_campaign_tenant_id FROM public.crm_campaigns c WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  v_effective_tenant_id := v_campaign_tenant_id;
  IF v_effective_tenant_id IS NULL AND v_campaign_user_id IS NOT NULL THEN
    SELECT u.tenant_id INTO v_effective_tenant_id FROM public.users u WHERE u.id = v_campaign_user_id;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
    FROM public.crm_campaigns c
    JOIN public.crm_segments s ON s.id = c.segment_id
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;
  IF v_effective_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_effective_tenant_id
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
    RETURN jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true);
  END IF;

  IF v_sort_column NOT IN ('customer_name', 'email', 'latest_event', 'event_time') THEN
    v_sort_column := 'event_time';
  END IF;
  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
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
  filtered AS (
    SELECT rr.*
    FROM public.get_campaign_recipient_matches(
      p_campaign_id,
      v_search,
      p_event_filters,
      v_event_filter,
      v_time_range,
      v_delivery_filter,
      NULL
    ) rr
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
    FROM filtered rr
    WHERE rr.recipient_id = p_recipient_id
  ),
  latest_message AS (
    SELECT m.*
    FROM public.email_messages m
    JOIN detail_row d ON d.current_message_id = m.id
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  ),
  customer_context AS (
    SELECT
      c.phone,
      c.total_spent,
      c.lifetime_value,
      c.first_purchase_date,
      c.last_purchase_date,
      c.custom_fields
    FROM detail_row d
    LEFT JOIN public.crm_customers c ON c.id = d.customer_id
  ),
  navigation_row AS (
    SELECT * FROM ordered_filtered WHERE recipient_id = p_recipient_id
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
  retry_timeline AS (
    SELECT
      m.created_at AS retry_created_at,
      m.last_attempt_at AS retry_attempted_at,
      m.sent_at AS retry_sent_at,
      m.error_message AS retry_error_message,
      m.attempts AS retry_attempts
    FROM public.email_messages m
    JOIN detail_row d ON d.retry_message_id = m.id
    WHERE m.campaign_id = p_campaign_id
      AND m.tenant_id = v_effective_tenant_id
  ),
  timeline_entries AS (
    SELECT 'queued'::TEXT AS event_type, d.created_at AS event_at, 'Queued for send'::TEXT AS label, NULL::JSONB AS metadata, 0 AS sort_weight
    FROM detail_row d
    UNION ALL
    SELECT 'retry_queued'::TEXT AS event_type, rt.retry_created_at AS event_at, 'Retry queued'::TEXT AS label, jsonb_build_object('attempts', rt.retry_attempts) AS metadata, 1 AS sort_weight
    FROM retry_timeline rt
    WHERE rt.retry_created_at IS NOT NULL
    UNION ALL
    SELECT 'attempted'::TEXT AS event_type, d.last_attempt_at AS event_at, 'Latest send attempt'::TEXT AS label, jsonb_build_object('attempts', d.attempts) AS metadata, 2 AS sort_weight
    FROM detail_row d
    WHERE d.last_attempt_at IS NOT NULL
    UNION ALL
    SELECT 'retry_attempted'::TEXT AS event_type, rt.retry_attempted_at AS event_at, 'Latest retry attempt'::TEXT AS label, jsonb_build_object('attempts', rt.retry_attempts) AS metadata, 3 AS sort_weight
    FROM retry_timeline rt
    WHERE rt.retry_attempted_at IS NOT NULL
    UNION ALL
    SELECT 'failed'::TEXT AS event_type, lm.last_attempt_at AS event_at, 'Latest send failed'::TEXT AS label, jsonb_build_object('error_message', lm.error_message) AS metadata, 4 AS sort_weight
    FROM latest_message lm
    WHERE lm.status = 'failed' AND lm.last_attempt_at IS NOT NULL
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
        'segments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', sr.id, 'name', sr.name) ORDER BY sr.name) FROM segment_rows sr), '[]'::jsonb)
      )
      FROM campaign_base cb
    ),
    'recipient', (
      SELECT jsonb_build_object(
        'recipient_id', d.recipient_id,
        'current_message_id', d.current_message_id,
        'retry_message_id', d.retry_message_id,
        'customer_id', d.customer_id,
        'customer_name', d.customer_name,
        'customer_email', d.customer_email,
        'phone', cc.phone,
        'send_status', d.send_status,
        'latest_event', d.latest_event,
        'latest_event_at', d.latest_event_at,
        'delivery_status', d.delivery_status,
        'sent_at', d.sent_at,
        'last_attempt_at', d.last_attempt_at,
        'created_at', d.created_at,
        'attempts', d.attempts,
        'resend_id', d.resend_id,
        'domain_id', lm.domain_id,
        'error_message', d.error_message,
        'has_sent', d.has_sent,
        'has_delivered', d.has_delivered,
        'has_opened', d.has_opened,
        'has_clicked', d.has_clicked,
        'has_bounced', d.has_bounced,
        'has_complained', d.has_complained,
        'has_unsubscribed', d.has_unsubscribed,
        'has_hard_bounce', d.has_hard_bounce,
        'hard_bounce_reason', d.hard_bounce_reason,
        'retry_count', d.retry_count,
        'retry_status', d.retry_status,
        'can_retry', d.can_retry,
        'engagement_score', d.engagement_score,
        'total_spent', cc.total_spent,
        'lifetime_value', cc.lifetime_value,
        'first_purchase_date', cc.first_purchase_date,
        'last_purchase_date', cc.last_purchase_date,
        'custom_fields', COALESCE(cc.custom_fields, '{}'::jsonb),
        'payload', COALESCE(lm.payload, '{}'::jsonb)
      )
      FROM detail_row d
      LEFT JOIN latest_message lm ON TRUE
      LEFT JOIN customer_context cc ON TRUE
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
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('event_type', te.event_type, 'event_at', te.event_at, 'label', te.label, 'metadata', te.metadata)) ORDER BY te.event_at ASC NULLS LAST, te.sort_weight ASC)
      FROM timeline_entries te
    ), '[]'::jsonb),
    'activity_log', COALESCE((
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', eh.id, 'event_type', eh.event_type, 'event_at', eh.event_at, 'provider_message_id', eh.provider_message_id, 'webhook_delivery_id', eh.webhook_delivery_id, 'link_id', eh.link_id, 'link_url', eh.link_url, 'user_agent', eh.user_agent, 'ip_address', eh.ip_address, 'is_mpp_guess', eh.is_mpp_guess, 'event_data', eh.event_data)) ORDER BY eh.event_at DESC NULLS LAST, eh.created_at DESC NULLS LAST)
      FROM event_history eh
    ), '[]'::jsonb),
    'not_found', NOT EXISTS (SELECT 1 FROM detail_row)
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object('campaign', NULL, 'recipient', NULL, 'navigation', NULL, 'insights', NULL, 'timeline', '[]'::jsonb, 'activity_log', '[]'::jsonb, 'not_found', true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_detail(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_recipient_detail(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_campaign_recipient_message(
  p_campaign_id UUID,
  p_recipient_id UUID
)
RETURNS TABLE (
  retry_message_id UUID,
  jobs_created INTEGER,
  blocked_reason TEXT
)
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
  v_domain_id UUID;
  v_base_message_id UUID;
  v_customer_id UUID;
  v_email TEXT;
  v_payload JSONB;
  v_last_status TEXT;
  v_retry_count INTEGER := 0;
  v_has_bounce BOOLEAN := FALSE;
  v_batch_index INTEGER := 0;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  SELECT c.user_id, c.tenant_id, c.from_email_domain_id
  INTO v_campaign_user_id, v_campaign_tenant_id, v_domain_id
  FROM public.crm_campaigns c
  WHERE c.id = p_campaign_id;

  IF v_campaign_user_id IS NULL AND v_campaign_tenant_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
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
    RETURN QUERY SELECT NULL::UUID, 0, 'forbidden'::TEXT;
    RETURN;
  END IF;

  SELECT
    m.id,
    m.customer_id,
    m.email,
    m.payload
  INTO v_base_message_id, v_customer_id, v_email, v_payload
  FROM public.email_messages m
  WHERE m.id = p_recipient_id
    AND m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.retry_sequence = 0
  LIMIT 1;

  IF v_base_message_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_found'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_retry_count
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
    AND m.retry_sequence > 0;

  IF v_retry_count > 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'already_retried'::TEXT;
    RETURN;
  END IF;

  SELECT m.status
  INTO v_last_status
  FROM public.email_messages m
  WHERE m.campaign_id = p_campaign_id
    AND m.tenant_id = v_effective_tenant_id
    AND m.customer_id = v_customer_id
  ORDER BY m.retry_sequence DESC, m.created_at DESC, m.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.email_tracking_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.tenant_id = v_effective_tenant_id
      AND LOWER(e.customer_email) = LOWER(v_email)
      AND e.event_type IN ('bounce', 'bounced')
  )
  INTO v_has_bounce;

  IF COALESCE(v_last_status, '') <> 'failed' AND NOT v_has_bounce THEN
    RETURN QUERY SELECT NULL::UUID, 0, 'not_retryable'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(j.batch_index), -1) + 1
  INTO v_batch_index
  FROM public.email_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  INSERT INTO public.email_messages (
    tenant_id,
    campaign_id,
    customer_id,
    domain_id,
    email,
    payload,
    status,
    resend_id,
    attempts,
    last_attempt_at,
    sent_at,
    error_message,
    claimed_at,
    claimed_by,
    claim_token,
    dead_lettered_at,
    retry_sequence,
    retry_of_message_id,
    retried_at
  )
  VALUES (
    v_effective_tenant_id,
    p_campaign_id,
    v_customer_id,
    v_domain_id,
    v_email,
    COALESCE(v_payload, '{}'::jsonb),
    'queued',
    NULL,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    v_base_message_id,
    NOW()
  )
  RETURNING id INTO retry_message_id;

  INSERT INTO public.email_send_jobs (
    campaign_id,
    tenant_id,
    domain_id,
    status,
    recipient_emails,
    recipient_message_ids,
    batch_index,
    error_message,
    attempts,
    emails_sent,
    emails_failed,
    created_at,
    updated_at
  )
  VALUES (
    p_campaign_id,
    v_effective_tenant_id,
    v_domain_id,
    'pending',
    jsonb_build_array(jsonb_build_object('customerId', v_customer_id, 'email', v_email)),
    ARRAY[retry_message_id],
    v_batch_index,
    NULL,
    0,
    0,
    0,
    NOW(),
    NOW()
  );

  UPDATE public.crm_campaigns c
  SET
    status = CASE WHEN c.status IN ('sent', 'failed', 'sent_with_errors') THEN 'sending' ELSE c.status END,
    send_error = NULL,
    send_blocked_reason = NULL,
    updated_at = NOW()
  WHERE c.id = p_campaign_id;

  jobs_created := 1;
  blocked_reason := NULL;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_campaign_recipient_message(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_campaign_recipient_message(UUID, UUID) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;