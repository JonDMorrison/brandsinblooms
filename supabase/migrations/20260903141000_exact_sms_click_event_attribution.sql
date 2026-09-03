-- Preserve every SMS redirect click so last-click revenue attribution can use
-- the actual click immediately preceding an order, not an aggregate first/last
-- approximation from sms_link_clicks.

CREATE TABLE public.sms_link_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.crm_sms_campaigns(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  link_id uuid NOT NULL REFERENCES public.sms_link_clicks(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE INDEX idx_sms_link_click_events_customer_time
  ON public.sms_link_click_events (tenant_id, customer_id, clicked_at DESC)
  WHERE customer_id IS NOT NULL AND campaign_id IS NOT NULL;
CREATE INDEX idx_sms_link_click_events_campaign_time
  ON public.sms_link_click_events (campaign_id, clicked_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_sms_link_click_events_link_time
  ON public.sms_link_click_events (link_id, clicked_at DESC);

CREATE INDEX idx_email_gov_events_attribution_customer_time
  ON public.email_governance_email_events (
    tenant_id,
    customer_id,
    (coalesce(event_ts_provider, ingested_at, created_at)) DESC
  )
  WHERE event_type = 'clicked'
    AND customer_id IS NOT NULL
    AND campaign_id IS NOT NULL
    AND NOT is_mpp_guess
    AND NOT is_spam_trap;

ALTER TABLE public.sms_link_click_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sms_link_click_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.sms_link_click_events TO service_role;

CREATE OR REPLACE FUNCTION public.validate_sms_link_click_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.sms_link_clicks AS link
    WHERE link.id = NEW.link_id
      AND link.tenant_id = NEW.tenant_id
      AND link.message_id = NEW.message_id
      AND link.campaign_id IS NOT DISTINCT FROM NEW.campaign_id
      AND link.customer_id IS NOT DISTINCT FROM NEW.customer_id
  ) THEN
    RAISE EXCEPTION 'SMS click event does not match its registered link';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_sms_link_click_event
BEFORE INSERT ON public.sms_link_click_events
FOR EACH ROW EXECUTE FUNCTION public.validate_sms_link_click_event();

-- Retain the first and last historical observations when upgrading an
-- installation that already has aggregate link data. The production table is
-- currently empty, but this keeps the migration safe and portable.
INSERT INTO public.sms_link_click_events (
  tenant_id, campaign_id, message_id, customer_id, link_id,
  clicked_at, user_agent
)
SELECT
  link.tenant_id, link.campaign_id, link.message_id, link.customer_id, link.id,
  link.first_clicked_at, link.last_user_agent
FROM public.sms_link_clicks AS link
WHERE link.first_clicked_at IS NOT NULL;

INSERT INTO public.sms_link_click_events (
  tenant_id, campaign_id, message_id, customer_id, link_id,
  clicked_at, user_agent
)
SELECT
  link.tenant_id, link.campaign_id, link.message_id, link.customer_id, link.id,
  link.last_clicked_at, link.last_user_agent
FROM public.sms_link_clicks AS link
WHERE link.last_clicked_at IS NOT NULL
  AND link.last_clicked_at IS DISTINCT FROM link.first_clicked_at;

ALTER TABLE public.campaign_revenue_attributions
  DROP CONSTRAINT campaign_revenue_attributions_touch_source_check;
ALTER TABLE public.campaign_revenue_attributions
  ADD CONSTRAINT campaign_revenue_attributions_touch_source_check CHECK (
    touch_source IN (
      'email_governance_email_events',
      'sms_link_clicks',
      'sms_link_click_events'
    )
  );

CREATE OR REPLACE FUNCTION public.record_sms_link_click(
  p_tracking_code text,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  original_url text,
  campaign_id uuid,
  message_id uuid,
  customer_id uuid,
  first_message_click boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.sms_link_clicks%ROWTYPE;
  v_first_message_click boolean;
  v_now timestamptz := statement_timestamp();
  v_metrics jsonb;
  v_user_agent text := left(p_user_agent, 512);
BEGIN
  UPDATE public.sms_link_clicks AS link
  SET click_count = link.click_count + 1,
      first_clicked_at = coalesce(link.first_clicked_at, v_now),
      last_clicked_at = v_now,
      last_user_agent = v_user_agent
  WHERE link.tracking_code = p_tracking_code
  RETURNING link.* INTO v_link;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT message.first_clicked_at IS NULL
  INTO v_first_message_click
  FROM public.sms_messages AS message
  WHERE message.id = v_link.message_id
  FOR UPDATE;

  INSERT INTO public.sms_link_click_events (
    tenant_id, campaign_id, message_id, customer_id, link_id,
    clicked_at, user_agent
  ) VALUES (
    v_link.tenant_id, v_link.campaign_id, v_link.message_id,
    v_link.customer_id, v_link.id, v_now, v_user_agent
  );

  UPDATE public.sms_messages AS message
  SET links_clicked = message.links_clicked + 1,
      unique_links_clicked = message.unique_links_clicked +
        CASE WHEN v_link.click_count = 1 THEN 1 ELSE 0 END,
      first_clicked_at = coalesce(message.first_clicked_at, v_now),
      last_clicked_at = v_now,
      updated_at = v_now
  WHERE message.id = v_link.message_id;

  IF v_link.campaign_id IS NOT NULL THEN
    SELECT coalesce(campaign.metrics, '{}'::jsonb)
    INTO v_metrics
    FROM public.crm_sms_campaigns AS campaign
    WHERE campaign.id = v_link.campaign_id
    FOR UPDATE;

    UPDATE public.crm_sms_campaigns AS campaign
    SET metrics = v_metrics || jsonb_build_object(
          'clicked',
          CASE WHEN coalesce(v_metrics->>'clicked', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'clicked')::bigint ELSE 0 END +
            CASE WHEN v_first_message_click THEN 1 ELSE 0 END,
          'unique_clicked',
          CASE WHEN coalesce(v_metrics->>'unique_clicked', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'unique_clicked')::bigint ELSE 0 END +
            CASE WHEN v_first_message_click THEN 1 ELSE 0 END,
          'total_clicks',
          CASE WHEN coalesce(v_metrics->>'total_clicks', '') ~ '^[0-9]+$'
            THEN (v_metrics->>'total_clicks')::bigint ELSE 0 END + 1
        ),
        updated_at = v_now
    WHERE campaign.id = v_link.campaign_id;
  END IF;

  RETURN QUERY SELECT
    v_link.original_url,
    v_link.campaign_id,
    v_link.message_id,
    v_link.customer_id,
    v_first_message_click;
END;
$$;

-- Rebuild the order attribution function with exact SMS click events.
CREATE OR REPLACE FUNCTION public.compute_pos_order_revenue_attribution(
  p_order_id uuid,
  p_window_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_touch record;
  v_gross numeric;
  v_refund numeric;
  v_net numeric;
  v_currency text;
BEGIN
  IF p_window_days < 1 OR p_window_days > 90 THEN
    RAISE EXCEPTION 'Attribution window must be between 1 and 90 days';
  END IF;

  SELECT
    orders.*,
    connection.tenant_id AS resolved_tenant_id,
    customer.tenant_id AS customer_tenant_id
  INTO v_order
  FROM public.pos_orders AS orders
  JOIN public.pos_connections AS connection
    ON connection.id = orders.pos_connection_id
  LEFT JOIN public.crm_customers AS customer
    ON customer.id = orders.crm_customer_id
  WHERE orders.id = p_order_id
  FOR UPDATE OF orders;

  IF NOT FOUND THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object('attributed', false, 'reason', 'order_not_found');
  END IF;

  v_gross := greatest(coalesce(v_order.total_amount, 0), 0);
  v_refund := greatest(coalesce(v_order.refund_amount, 0), 0);
  v_net := greatest(v_gross - v_refund, 0);
  v_currency := coalesce(nullif(upper(trim(v_order.currency)), ''), 'USD');

  IF lower(coalesce(v_order.status, '')) IN (
    'cancelled', 'canceled', 'void', 'voided', 'deleted'
  ) THEN
    v_net := 0;
  END IF;

  IF v_order.crm_customer_id IS NULL
     OR v_order.customer_tenant_id IS DISTINCT FROM v_order.resolved_tenant_id
     OR v_net <= 0 THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object(
      'attributed', false,
      'reason', CASE WHEN v_net <= 0 THEN 'no_net_revenue' ELSE 'unresolved_customer' END
    );
  END IF;

  SELECT candidate.*
  INTO v_touch
  FROM (
    SELECT
      'email'::text AS channel,
      event.campaign_id AS email_campaign_id,
      NULL::uuid AS sms_campaign_id,
      'email_governance_email_events'::text AS touch_source,
      event.id AS touch_event_id,
      coalesce(event.event_ts_provider, event.ingested_at, event.created_at) AS touch_at
    FROM public.email_governance_email_events AS event
    JOIN public.crm_campaigns AS campaign
      ON campaign.id = event.campaign_id
     AND campaign.tenant_id = event.tenant_id
    WHERE event.tenant_id = v_order.resolved_tenant_id
      AND event.customer_id = v_order.crm_customer_id
      AND event.campaign_id IS NOT NULL
      AND event.event_type = 'clicked'
      AND NOT event.is_mpp_guess
      AND NOT event.is_spam_trap
      AND coalesce(event.event_ts_provider, event.ingested_at, event.created_at) <= v_order.order_date
      AND coalesce(event.event_ts_provider, event.ingested_at, event.created_at) >=
        v_order.order_date - make_interval(days => p_window_days)

    UNION ALL

    SELECT
      'sms'::text AS channel,
      NULL::uuid AS email_campaign_id,
      click_event.campaign_id AS sms_campaign_id,
      'sms_link_click_events'::text AS touch_source,
      click_event.id AS touch_event_id,
      click_event.clicked_at AS touch_at
    FROM public.sms_link_click_events AS click_event
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = click_event.campaign_id
     AND campaign.tenant_id = click_event.tenant_id
    WHERE click_event.tenant_id = v_order.resolved_tenant_id
      AND click_event.customer_id = v_order.crm_customer_id
      AND click_event.campaign_id IS NOT NULL
      AND click_event.clicked_at <= v_order.order_date
      AND click_event.clicked_at >=
        v_order.order_date - make_interval(days => p_window_days)
  ) AS candidate
  WHERE candidate.touch_at IS NOT NULL
  ORDER BY candidate.touch_at DESC, candidate.channel, candidate.touch_event_id
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM public.campaign_revenue_attributions
    WHERE order_id = p_order_id;
    RETURN jsonb_build_object('attributed', false, 'reason', 'no_eligible_click');
  END IF;

  INSERT INTO public.campaign_revenue_attributions (
    tenant_id, order_id, customer_id, channel, email_campaign_id,
    sms_campaign_id, touch_source, touch_event_id, touch_at, order_at,
    attribution_window_days, gross_revenue, refund_amount,
    attributed_revenue, currency, updated_at
  ) VALUES (
    v_order.resolved_tenant_id, v_order.id, v_order.crm_customer_id,
    v_touch.channel, v_touch.email_campaign_id, v_touch.sms_campaign_id,
    v_touch.touch_source, v_touch.touch_event_id, v_touch.touch_at,
    v_order.order_date, p_window_days, v_gross, v_refund, v_net,
    v_currency, statement_timestamp()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    customer_id = excluded.customer_id,
    channel = excluded.channel,
    email_campaign_id = excluded.email_campaign_id,
    sms_campaign_id = excluded.sms_campaign_id,
    touch_source = excluded.touch_source,
    touch_event_id = excluded.touch_event_id,
    touch_at = excluded.touch_at,
    order_at = excluded.order_at,
    attribution_window_days = excluded.attribution_window_days,
    gross_revenue = excluded.gross_revenue,
    refund_amount = excluded.refund_amount,
    attributed_revenue = excluded.attributed_revenue,
    currency = excluded.currency,
    updated_at = statement_timestamp();

  RETURN jsonb_build_object(
    'attributed', true,
    'channel', v_touch.channel,
    'campaignId', coalesce(v_touch.email_campaign_id, v_touch.sms_campaign_id),
    'attributedRevenue', v_net,
    'currency', v_currency
  );
END;
$$;

DROP TRIGGER IF EXISTS attribute_orders_after_sms_click_change
  ON public.sms_link_clicks;
DROP FUNCTION IF EXISTS public.attribute_orders_after_sms_click_change();

CREATE OR REPLACE FUNCTION public.attribute_orders_after_sms_click_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.customer_id IS NOT NULL THEN
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = OLD.tenant_id
        AND orders.crm_customer_id = OLD.customer_id
        AND orders.order_date >= OLD.clicked_at
        AND orders.order_date <= OLD.clicked_at + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.customer_id IS NOT NULL THEN
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = NEW.tenant_id
        AND orders.crm_customer_id = NEW.customer_id
        AND orders.order_date >= NEW.clicked_at
        AND orders.order_date <= NEW.clicked_at + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER attribute_orders_after_sms_click_event_change
AFTER INSERT OR UPDATE OR DELETE ON public.sms_link_click_events
FOR EACH ROW EXECUTE FUNCTION public.attribute_orders_after_sms_click_event_change();

-- Re-evaluate any SMS ledger rows created by the aggregate implementation.
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT attribution.order_id
    FROM public.campaign_revenue_attributions AS attribution
    WHERE attribution.channel = 'sms'
  LOOP
    PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_link_click(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_link_click(text, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.attribute_orders_after_sms_click_event_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_sms_link_click_event()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.sms_link_click_events IS
  'Immutable service-only ledger of individual SMS redirect clicks for exact engagement and revenue attribution.';
COMMENT ON FUNCTION public.compute_pos_order_revenue_attribution(uuid, integer) IS
  'Idempotently attributes one resolved POS order to its most recent eligible email or exact SMS click.';
