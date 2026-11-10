-- Auditable, refund-aware POS revenue attribution.
-- One order receives at most one deterministic last-click attribution.

CREATE TABLE public.campaign_revenue_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  email_campaign_id uuid REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  sms_campaign_id uuid REFERENCES public.crm_sms_campaigns(id) ON DELETE CASCADE,
  touch_source text NOT NULL CHECK (
    touch_source IN ('email_governance_email_events', 'sms_link_clicks')
  ),
  touch_event_id uuid NOT NULL,
  touch_at timestamptz NOT NULL,
  order_at timestamptz NOT NULL,
  attribution_model text NOT NULL DEFAULT 'last_click'
    CHECK (attribution_model = 'last_click'),
  attribution_window_days smallint NOT NULL DEFAULT 7
    CHECK (attribution_window_days BETWEEN 1 AND 90),
  gross_revenue numeric NOT NULL DEFAULT 0 CHECK (gross_revenue >= 0),
  refund_amount numeric NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  attributed_revenue numeric NOT NULL DEFAULT 0 CHECK (attributed_revenue >= 0),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id),
  CHECK (
    (channel = 'email' AND email_campaign_id IS NOT NULL AND sms_campaign_id IS NULL)
    OR
    (channel = 'sms' AND sms_campaign_id IS NOT NULL AND email_campaign_id IS NULL)
  )
);

CREATE INDEX idx_campaign_revenue_attributions_email_campaign
  ON public.campaign_revenue_attributions (email_campaign_id, order_at DESC)
  WHERE email_campaign_id IS NOT NULL;
CREATE INDEX idx_campaign_revenue_attributions_sms_campaign
  ON public.campaign_revenue_attributions (sms_campaign_id, order_at DESC)
  WHERE sms_campaign_id IS NOT NULL;
CREATE INDEX idx_campaign_revenue_attributions_customer
  ON public.campaign_revenue_attributions (customer_id, order_at DESC);

ALTER TABLE public.campaign_revenue_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_revenue_attributions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.campaign_revenue_attributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.campaign_revenue_attributions TO service_role;

CREATE POLICY "Tenant users can view campaign revenue attribution"
ON public.campaign_revenue_attributions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.tenant_id = campaign_revenue_attributions.tenant_id
  )
);

CREATE OR REPLACE FUNCTION public.refresh_email_campaign_revenue_metrics(
  p_campaign_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revenue numeric;
  v_orders bigint;
  v_customers bigint;
  v_window_days integer;
  v_currency text;
  v_currency_count integer;
  v_revenue_by_currency jsonb;
BEGIN
  IF p_campaign_id IS NULL THEN RETURN; END IF;

  SELECT
    coalesce(sum(attribution.attributed_revenue), 0),
    count(DISTINCT attribution.order_id),
    count(DISTINCT attribution.customer_id),
    coalesce(max(attribution.attribution_window_days), 7),
    min(attribution.currency),
    count(DISTINCT attribution.currency)
  INTO v_revenue, v_orders, v_customers, v_window_days,
       v_currency, v_currency_count
  FROM public.campaign_revenue_attributions AS attribution
  WHERE attribution.email_campaign_id = p_campaign_id;

  SELECT coalesce(jsonb_object_agg(currency_totals.currency, currency_totals.revenue), '{}'::jsonb)
  INTO v_revenue_by_currency
  FROM (
    SELECT attribution.currency, sum(attribution.attributed_revenue) AS revenue
    FROM public.campaign_revenue_attributions AS attribution
    WHERE attribution.email_campaign_id = p_campaign_id
    GROUP BY attribution.currency
  ) AS currency_totals;

  UPDATE public.crm_campaigns AS campaign
  SET metrics = coalesce(campaign.metrics, '{}'::jsonb) || jsonb_build_object(
        'revenue', v_revenue,
        'attributed_revenue', v_revenue,
        'attributed_orders', v_orders,
        'attributed_customers', v_customers,
        'attribution_model', 'last_click',
        'attribution_window_days', v_window_days,
        'attribution_currency', CASE WHEN v_currency_count = 1 THEN v_currency END,
        'attribution_has_mixed_currencies', v_currency_count > 1,
        'attributed_revenue_by_currency', v_revenue_by_currency
      ),
      updated_at = statement_timestamp()
  WHERE campaign.id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_sms_campaign_revenue_metrics(
  p_campaign_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revenue numeric;
  v_orders bigint;
  v_customers bigint;
  v_window_days integer;
  v_currency text;
  v_currency_count integer;
  v_revenue_by_currency jsonb;
BEGIN
  IF p_campaign_id IS NULL THEN RETURN; END IF;

  SELECT
    coalesce(sum(attribution.attributed_revenue), 0),
    count(DISTINCT attribution.order_id),
    count(DISTINCT attribution.customer_id),
    coalesce(max(attribution.attribution_window_days), 7),
    min(attribution.currency),
    count(DISTINCT attribution.currency)
  INTO v_revenue, v_orders, v_customers, v_window_days,
       v_currency, v_currency_count
  FROM public.campaign_revenue_attributions AS attribution
  WHERE attribution.sms_campaign_id = p_campaign_id;

  SELECT coalesce(jsonb_object_agg(currency_totals.currency, currency_totals.revenue), '{}'::jsonb)
  INTO v_revenue_by_currency
  FROM (
    SELECT attribution.currency, sum(attribution.attributed_revenue) AS revenue
    FROM public.campaign_revenue_attributions AS attribution
    WHERE attribution.sms_campaign_id = p_campaign_id
    GROUP BY attribution.currency
  ) AS currency_totals;

  UPDATE public.crm_sms_campaigns AS campaign
  SET metrics = coalesce(campaign.metrics, '{}'::jsonb) || jsonb_build_object(
        'revenue', v_revenue,
        'attributed_revenue', v_revenue,
        'attributed_orders', v_orders,
        'attributed_customers', v_customers,
        'attribution_model', 'last_click',
        'attribution_window_days', v_window_days,
        'attribution_currency', CASE WHEN v_currency_count = 1 THEN v_currency END,
        'attribution_has_mixed_currencies', v_currency_count > 1,
        'attributed_revenue_by_currency', v_revenue_by_currency
      ),
      updated_at = statement_timestamp()
  WHERE campaign.id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_campaign_revenue_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_email_campaign_revenue_metrics(OLD.email_campaign_id);
    PERFORM public.refresh_sms_campaign_revenue_metrics(OLD.sms_campaign_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_email_campaign_revenue_metrics(NEW.email_campaign_id);
    PERFORM public.refresh_sms_campaign_revenue_metrics(NEW.sms_campaign_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Campaign delivery rollups are recomputed by several independent workers.
-- Preserve the attribution slice on every metrics write so those workers
-- cannot accidentally erase revenue, order, customer, or currency evidence.
CREATE OR REPLACE FUNCTION public.preserve_campaign_revenue_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revenue numeric;
  v_orders bigint;
  v_customers bigint;
  v_window_days integer;
  v_currency text;
  v_currency_count integer;
  v_revenue_by_currency jsonb;
BEGIN
  IF TG_TABLE_NAME = 'crm_campaigns' THEN
    SELECT
      coalesce(sum(attribution.attributed_revenue), 0),
      count(DISTINCT attribution.order_id),
      count(DISTINCT attribution.customer_id),
      coalesce(max(attribution.attribution_window_days), 7),
      min(attribution.currency),
      count(DISTINCT attribution.currency)
    INTO v_revenue, v_orders, v_customers, v_window_days,
         v_currency, v_currency_count
    FROM public.campaign_revenue_attributions AS attribution
    WHERE attribution.email_campaign_id = NEW.id;

    SELECT coalesce(jsonb_object_agg(currency_totals.currency, currency_totals.revenue), '{}'::jsonb)
    INTO v_revenue_by_currency
    FROM (
      SELECT attribution.currency, sum(attribution.attributed_revenue) AS revenue
      FROM public.campaign_revenue_attributions AS attribution
      WHERE attribution.email_campaign_id = NEW.id
      GROUP BY attribution.currency
    ) AS currency_totals;
  ELSE
    SELECT
      coalesce(sum(attribution.attributed_revenue), 0),
      count(DISTINCT attribution.order_id),
      count(DISTINCT attribution.customer_id),
      coalesce(max(attribution.attribution_window_days), 7),
      min(attribution.currency),
      count(DISTINCT attribution.currency)
    INTO v_revenue, v_orders, v_customers, v_window_days,
         v_currency, v_currency_count
    FROM public.campaign_revenue_attributions AS attribution
    WHERE attribution.sms_campaign_id = NEW.id;

    SELECT coalesce(jsonb_object_agg(currency_totals.currency, currency_totals.revenue), '{}'::jsonb)
    INTO v_revenue_by_currency
    FROM (
      SELECT attribution.currency, sum(attribution.attributed_revenue) AS revenue
      FROM public.campaign_revenue_attributions AS attribution
      WHERE attribution.sms_campaign_id = NEW.id
      GROUP BY attribution.currency
    ) AS currency_totals;
  END IF;

  NEW.metrics := coalesce(NEW.metrics, '{}'::jsonb) || jsonb_build_object(
    'revenue', v_revenue,
    'attributed_revenue', v_revenue,
    'attributed_orders', v_orders,
    'attributed_customers', v_customers,
    'attribution_model', 'last_click',
    'attribution_window_days', v_window_days,
    'attribution_currency', CASE WHEN v_currency_count = 1 THEN v_currency END,
    'attribution_has_mixed_currencies', v_currency_count > 1,
    'attributed_revenue_by_currency', v_revenue_by_currency
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_email_campaign_revenue_metrics
BEFORE INSERT OR UPDATE OF metrics ON public.crm_campaigns
FOR EACH ROW EXECUTE FUNCTION public.preserve_campaign_revenue_metrics();

CREATE TRIGGER preserve_sms_campaign_revenue_metrics
BEFORE INSERT OR UPDATE OF metrics ON public.crm_sms_campaigns
FOR EACH ROW EXECUTE FUNCTION public.preserve_campaign_revenue_metrics();

CREATE TRIGGER sync_campaign_revenue_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_revenue_attributions
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_revenue_metrics();

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
      link.campaign_id AS sms_campaign_id,
      'sms_link_clicks'::text AS touch_source,
      link.id AS touch_event_id,
      CASE
        WHEN link.last_clicked_at <= v_order.order_date THEN link.last_clicked_at
        ELSE link.first_clicked_at
      END AS touch_at
    FROM public.sms_link_clicks AS link
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = link.campaign_id
     AND campaign.tenant_id = link.tenant_id
    WHERE link.tenant_id = v_order.resolved_tenant_id
      AND link.customer_id = v_order.crm_customer_id
      AND link.campaign_id IS NOT NULL
      AND link.first_clicked_at IS NOT NULL
      AND link.first_clicked_at <= v_order.order_date
      AND coalesce(
        CASE WHEN link.last_clicked_at <= v_order.order_date THEN link.last_clicked_at END,
        link.first_clicked_at
      ) >= v_order.order_date - make_interval(days => p_window_days)
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

CREATE OR REPLACE FUNCTION public.attribute_pos_order_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.compute_pos_order_revenue_attribution(NEW.id, 7);
  RETURN NEW;
END;
$$;

CREATE TRIGGER attribute_pos_order_after_change
AFTER INSERT OR UPDATE OF
  pos_connection_id, crm_customer_id, order_date, total_amount,
  refund_amount, currency, status
ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.attribute_pos_order_after_change();

CREATE OR REPLACE FUNCTION public.attribute_orders_after_email_click_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_touch_at timestamptz;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.event_type = 'clicked'
     AND OLD.customer_id IS NOT NULL THEN
    v_touch_at := coalesce(OLD.event_ts_provider, OLD.ingested_at, OLD.created_at);
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = OLD.tenant_id
        AND orders.crm_customer_id = OLD.customer_id
        AND orders.order_date >= v_touch_at
        AND orders.order_date <= v_touch_at + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.event_type = 'clicked'
     AND NEW.customer_id IS NOT NULL THEN
    v_touch_at := coalesce(NEW.event_ts_provider, NEW.ingested_at, NEW.created_at);
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = NEW.tenant_id
        AND orders.crm_customer_id = NEW.customer_id
        AND orders.order_date >= v_touch_at
        AND orders.order_date <= v_touch_at + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER attribute_orders_after_email_click_change
AFTER INSERT OR UPDATE OR DELETE ON public.email_governance_email_events
FOR EACH ROW EXECUTE FUNCTION public.attribute_orders_after_email_click_change();

CREATE OR REPLACE FUNCTION public.attribute_orders_after_sms_click_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_first_touch timestamptz;
  v_last_touch timestamptz;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.customer_id IS NOT NULL
     AND OLD.first_clicked_at IS NOT NULL THEN
    v_first_touch := OLD.first_clicked_at;
    v_last_touch := coalesce(OLD.last_clicked_at, OLD.first_clicked_at);
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = OLD.tenant_id
        AND orders.crm_customer_id = OLD.customer_id
        AND orders.order_date >= v_first_touch
        AND orders.order_date <= v_last_touch + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.customer_id IS NOT NULL
     AND NEW.first_clicked_at IS NOT NULL THEN
    v_first_touch := NEW.first_clicked_at;
    v_last_touch := coalesce(NEW.last_clicked_at, NEW.first_clicked_at);
    FOR v_order_id IN
      SELECT orders.id
      FROM public.pos_orders AS orders
      JOIN public.pos_connections AS connection
        ON connection.id = orders.pos_connection_id
      WHERE connection.tenant_id = NEW.tenant_id
        AND orders.crm_customer_id = NEW.customer_id
        AND orders.order_date >= v_first_touch
        AND orders.order_date <= v_last_touch + interval '7 days'
    LOOP
      PERFORM public.compute_pos_order_revenue_attribution(v_order_id, 7);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER attribute_orders_after_sms_click_change
AFTER INSERT OR UPDATE OR DELETE ON public.sms_link_clicks
FOR EACH ROW EXECUTE FUNCTION public.attribute_orders_after_sms_click_change();

CREATE OR REPLACE FUNCTION public.rebuild_campaign_revenue_attribution(
  p_from timestamptz,
  p_to timestamptz,
  p_window_days integer DEFAULT 7,
  p_after_order_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_last_order_id uuid;
  v_result jsonb;
  v_processed integer := 0;
  v_attributed integer := 0;
  v_has_more boolean := false;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'A valid attribution rebuild range is required';
  END IF;
  IF p_to - p_from > interval '5 years' THEN
    RAISE EXCEPTION 'Attribution rebuild range cannot exceed five years';
  END IF;
  IF p_window_days < 1 OR p_window_days > 90 THEN
    RAISE EXCEPTION 'Attribution window must be between 1 and 90 days';
  END IF;
  IF p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'Attribution rebuild limit must be between 1 and 5000';
  END IF;

  FOR v_order_id IN
    SELECT orders.id
    FROM public.pos_orders AS orders
    WHERE orders.order_date >= p_from
      AND orders.order_date < p_to
      AND (p_after_order_id IS NULL OR orders.id > p_after_order_id)
    ORDER BY orders.id
    LIMIT p_limit
  LOOP
    v_result := public.compute_pos_order_revenue_attribution(v_order_id, p_window_days);
    v_processed := v_processed + 1;
    v_last_order_id := v_order_id;
    IF coalesce((v_result->>'attributed')::boolean, false) THEN
      v_attributed := v_attributed + 1;
    END IF;
  END LOOP;

  IF v_last_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.pos_orders AS orders
      WHERE orders.order_date >= p_from
        AND orders.order_date < p_to
        AND orders.id > v_last_order_id
    ) INTO v_has_more;
  END IF;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'attributed', v_attributed,
    'lastOrderId', v_last_order_id,
    'hasMore', v_has_more,
    'model', 'last_click',
    'windowDays', p_window_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_email_campaign_revenue_metrics(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_sms_campaign_revenue_metrics(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_campaign_revenue_metrics()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preserve_campaign_revenue_metrics()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_pos_order_revenue_attribution(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attribute_pos_order_after_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attribute_orders_after_email_click_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attribute_orders_after_sms_click_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_campaign_revenue_attribution(
  timestamptz, timestamptz, integer, uuid, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compute_pos_order_revenue_attribution(uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_campaign_revenue_attribution(
  timestamptz, timestamptz, integer, uuid, integer
) TO service_role;

COMMENT ON TABLE public.campaign_revenue_attributions IS
  'Auditable order-level last-click attribution from verified email or SMS clicks to resolved POS revenue.';
COMMENT ON FUNCTION public.compute_pos_order_revenue_attribution(uuid, integer) IS
  'Idempotently attributes one resolved POS order to its most recent eligible human click.';
