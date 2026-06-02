CREATE OR REPLACE FUNCTION public.get_resource_insights(
  p_tenant_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  v_actor_user_id UUID;
  v_actor_tenant_id UUID;
  v_customer public.crm_customers%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_campaign public.crm_campaigns%ROWTYPE;
  v_days_since_last NUMERIC;
  v_avg_gap_days NUMERIC;
  v_recent_orders INT;
  v_prior_orders INT;
  v_recent_revenue NUMERIC;
  v_prior_revenue NUMERIC;
  v_recent_aov NUMERIC;
  v_prior_aov NUMERIC;
  v_segment_name TEXT;
  v_last_engagement_at TIMESTAMPTZ;
  v_last30_qty NUMERIC;
  v_prev30_qty NUMERIC;
  v_avg_daily_sales NUMERIC;
  v_days_until_stockout NUMERIC;
  v_velocity_change NUMERIC;
  v_order_source TEXT;
  v_order_customer_id UUID;
  v_order_pos_customer_id UUID;
  v_order_total NUMERIC;
  v_order_at TIMESTAMPTZ;
  v_prior_order_count INT;
  v_avg_order_total NUMERIC;
  v_current_open_rate NUMERIC;
  v_current_click_rate NUMERIC;
  v_average_open_rate NUMERIC;
  v_average_click_rate NUMERIC;
  v_open_delta NUMERIC;
  v_click_delta NUMERIC;
  v_best_hour INT;
  v_sent_hour INT;
  v_hour_delta INT;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RETURN result;
  END IF;

  SELECT u.tenant_id
  INTO v_actor_tenant_id
  FROM public.users u
  WHERE u.id = v_actor_user_id;

  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id <> p_tenant_id THEN
    RETURN result;
  END IF;

  IF p_resource_type = 'customer' THEN
    SELECT *
    INTO v_customer
    FROM public.crm_customers
    WHERE id = p_resource_id
      AND tenant_id = p_tenant_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN result;
    END IF;

    BEGIN
      IF v_customer.first_purchase_date IS NOT NULL
        AND v_customer.last_purchase_date IS NOT NULL
        AND COALESCE(v_customer.pos_order_count, 0) >= 3 THEN
        v_days_since_last := EXTRACT(
          EPOCH FROM (NOW() - v_customer.last_purchase_date::TIMESTAMPTZ)
        ) / 86400.0;
        v_avg_gap_days := (
          EXTRACT(
            EPOCH FROM (
              v_customer.last_purchase_date::TIMESTAMPTZ
              - v_customer.first_purchase_date::TIMESTAMPTZ
            )
          ) / 86400.0
        ) / NULLIF(v_customer.pos_order_count - 1, 0);

        IF v_avg_gap_days IS NOT NULL
          AND v_avg_gap_days > 0
          AND v_days_since_last > v_avg_gap_days * 2 THEN
          result := result || jsonb_build_array(
            jsonb_build_object(
              'id', 'customer-order-frequency',
              'type', 'warning',
              'title', 'Purchasing frequency declining',
              'body', format(
                'Last order was %s days ago - average gap is %s days.',
                ROUND(v_days_since_last),
                ROUND(v_avg_gap_days)
              ),
              'suggestedPrompt', 'What can I do to re-engage this customer?'
            )
          );
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      WITH timeline AS (
        SELECT *
        FROM public.get_customer_purchase_timeline(p_resource_id, 6)
      ),
      rollup AS (
        SELECT
          COALESCE(
            SUM(order_count) FILTER (
              WHERE period_date >= (date_trunc('month', NOW()) - INTERVAL '2 months')::DATE
            ),
            0
          )::INT AS recent_orders,
          COALESCE(
            SUM(total_revenue) FILTER (
              WHERE period_date >= (date_trunc('month', NOW()) - INTERVAL '2 months')::DATE
            ),
            0
          ) AS recent_revenue,
          COALESCE(
            SUM(order_count) FILTER (
              WHERE period_date >= (date_trunc('month', NOW()) - INTERVAL '5 months')::DATE
                AND period_date < (date_trunc('month', NOW()) - INTERVAL '2 months')::DATE
            ),
            0
          )::INT AS prior_orders,
          COALESCE(
            SUM(total_revenue) FILTER (
              WHERE period_date >= (date_trunc('month', NOW()) - INTERVAL '5 months')::DATE
                AND period_date < (date_trunc('month', NOW()) - INTERVAL '2 months')::DATE
            ),
            0
          ) AS prior_revenue
        FROM timeline
      )
      SELECT
        recent_orders,
        recent_revenue,
        prior_orders,
        prior_revenue
      INTO
        v_recent_orders,
        v_recent_revenue,
        v_prior_orders,
        v_prior_revenue
      FROM rollup;

      IF COALESCE(v_recent_orders, 0) > 0 AND COALESCE(v_prior_orders, 0) > 0 THEN
        v_recent_aov := v_recent_revenue / NULLIF(v_recent_orders, 0);
        v_prior_aov := v_prior_revenue / NULLIF(v_prior_orders, 0);

        IF v_prior_aov IS NOT NULL
          AND v_prior_aov > 0
          AND ABS((v_recent_aov - v_prior_aov) / v_prior_aov) >= 0.2 THEN
          result := result || jsonb_build_array(
            jsonb_build_object(
              'id', 'customer-aov-trend',
              'type', CASE WHEN v_recent_aov > v_prior_aov THEN 'positive' ELSE 'warning' END,
              'title', CASE
                WHEN v_recent_aov > v_prior_aov THEN 'Average order value increasing'
                ELSE 'Average order value declining'
              END,
              'body', format(
                'AOV moved from $%s to $%s over the last two quarters.',
                TO_CHAR(COALESCE(v_prior_aov, 0), 'FM999999990.00'),
                TO_CHAR(COALESCE(v_recent_aov, 0), 'FM999999990.00')
              ),
              'suggestedPrompt', CASE
                WHEN v_recent_aov > v_prior_aov THEN NULL
                ELSE 'How can I increase this customer''s average order value?'
              END
            )
          );
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      SELECT s.name
      INTO v_segment_name
      FROM public.customer_segments cs
      JOIN public.crm_segments s
        ON s.id = cs.segment_id
      WHERE cs.customer_id = p_resource_id
        AND s.tenant_id = p_tenant_id
        AND (
          LOWER(s.name) LIKE '%at risk%'
          OR LOWER(s.name) LIKE '%churn%'
          OR LOWER(s.name) LIKE '%inactive%'
          OR LOWER(s.name) LIKE '%lapsed%'
        )
      ORDER BY cs.assigned_at DESC
      LIMIT 1;

      IF v_segment_name IS NOT NULL THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'customer-segment-risk',
            'type', 'warning',
            'title', 'Customer is flagged as at risk',
            'body', format(
              'This customer currently belongs to the "%s" segment.',
              v_segment_name
            ),
            'suggestedPrompt', 'What retention actions make sense for this customer right now?'
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      SELECT MAX(ts)
      INTO v_last_engagement_at
      FROM (
        VALUES
          (v_customer.last_open_at::TIMESTAMPTZ),
          (v_customer.last_email_clicked_at::TIMESTAMPTZ)
      ) AS engagement(ts);

      IF v_last_engagement_at IS NOT NULL
        AND v_last_engagement_at < NOW() - INTERVAL '60 days' THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'customer-engagement-recency',
            'type', 'info',
            'title', 'No campaign engagement in 60+ days',
            'body', format(
              'Last tracked open or click was %s days ago.',
              ROUND(EXTRACT(EPOCH FROM (NOW() - v_last_engagement_at)) / 86400.0)
            ),
            'suggestedPrompt', 'What campaign or message should I send to win this customer back?'
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  ELSIF p_resource_type = 'product' THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = p_resource_id
      AND tenant_id = p_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN result;
    END IF;

    BEGIN
      WITH variant_ids AS (
        SELECT pv.external_id
        FROM public.product_variations pv
        WHERE pv.product_id = p_resource_id
          AND pv.external_id IS NOT NULL
      ),
      normalized_sales AS (
        SELECT
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (item->>'quantity')::NUMERIC
            ELSE 1::NUMERIC
          END AS quantity,
          COALESCE(so.order_date, so.created_at)::TIMESTAMPTZ AS occurred_at
        FROM public.shopify_orders so
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(so.line_items, '[]'::JSONB)) AS item
        WHERE so.tenant_id = p_tenant_id
          AND COALESCE(so.order_date, so.created_at) >= NOW() - INTERVAL '60 days'
          AND (
            (v_product.external_id IS NOT NULL AND item->>'product_id' = v_product.external_id)
            OR (item->>'variant_id') IN (SELECT external_id FROM variant_ids)
            OR (v_product.sku IS NOT NULL AND item->>'sku' = v_product.sku)
            OR LOWER(COALESCE(item->>'name', item->>'title', '')) = LOWER(v_product.name)
          )

        UNION ALL

        SELECT
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (item->>'quantity')::NUMERIC
            ELSE 1::NUMERIC
          END AS quantity,
          ls.sale_date AS occurred_at
        FROM public.lightspeed_sales ls
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ls.line_items, '[]'::JSONB)) AS item
        WHERE ls.tenant_id = p_tenant_id
          AND ls.sale_date >= NOW() - INTERVAL '60 days'
          AND (
            (v_product.external_id IS NOT NULL AND COALESCE(
              item->>'product_id',
              item->>'item_id',
              item->>'catalog_object_id'
            ) = v_product.external_id)
            OR COALESCE(item->>'variant_id', item->>'variation_id') IN (
              SELECT external_id FROM variant_ids
            )
            OR (v_product.sku IS NOT NULL AND item->>'sku' = v_product.sku)
            OR LOWER(COALESCE(item->>'name', item->>'title', item->>'product_name', '')) = LOWER(v_product.name)
          )

        UNION ALL

        SELECT
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (item->>'quantity')::NUMERIC
            ELSE 1::NUMERIC
          END AS quantity,
          po.order_date AS occurred_at
        FROM public.pos_orders po
        JOIN public.pos_connections pc
          ON pc.id = po.pos_connection_id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(po.items, '[]'::JSONB)) AS item
        WHERE pc.tenant_id = p_tenant_id
          AND po.order_date >= NOW() - INTERVAL '60 days'
          AND (
            (v_product.external_id IS NOT NULL AND COALESCE(
              item->>'catalog_object_id',
              item->>'product_id',
              item->>'item_id'
            ) = v_product.external_id)
            OR COALESCE(item->>'variant_id', item->>'variation_id') IN (
              SELECT external_id FROM variant_ids
            )
            OR (v_product.sku IS NOT NULL AND item->>'sku' = v_product.sku)
            OR LOWER(COALESCE(item->>'name', item->>'title', item->>'product_name', '')) = LOWER(v_product.name)
          )
      ),
      aggregated AS (
        SELECT
          COALESCE(
            SUM(quantity) FILTER (WHERE occurred_at >= NOW() - INTERVAL '30 days'),
            0
          ) AS last30_qty,
          COALESCE(
            SUM(quantity) FILTER (
              WHERE occurred_at < NOW() - INTERVAL '30 days'
                AND occurred_at >= NOW() - INTERVAL '60 days'
            ),
            0
          ) AS prev30_qty
        FROM normalized_sales
      )
      SELECT last30_qty, prev30_qty
      INTO v_last30_qty, v_prev30_qty
      FROM aggregated;

      IF COALESCE(v_product.track_inventory, FALSE)
        AND COALESCE(v_product.inventory_count, 0) > 0
        AND COALESCE(v_last30_qty, 0) > 0 THEN
        v_avg_daily_sales := v_last30_qty / 30.0;
        v_days_until_stockout := COALESCE(v_product.inventory_count, 0) / NULLIF(v_avg_daily_sales, 0);

        IF v_days_until_stockout IS NOT NULL AND v_days_until_stockout < 14 THEN
          result := result || jsonb_build_array(
            jsonb_build_object(
              'id', 'product-stock-runway',
              'type', 'warning',
              'title', 'Stock may run out soon',
              'body', format(
                'At the current sell-through rate, inventory covers about %s more days.',
                ROUND(v_days_until_stockout)
              ),
              'suggestedPrompt', 'What reorder quantity would you recommend for this product?'
            )
          );
        END IF;
      END IF;

      IF COALESCE(v_prev30_qty, 0) > 0 THEN
        v_velocity_change := ((COALESCE(v_last30_qty, 0) - v_prev30_qty) / v_prev30_qty) * 100.0;

        IF ABS(v_velocity_change) >= 30 THEN
          result := result || jsonb_build_array(
            jsonb_build_object(
              'id', 'product-sales-velocity',
              'type', CASE WHEN v_velocity_change > 0 THEN 'positive' ELSE 'warning' END,
              'title', CASE
                WHEN v_velocity_change > 0 THEN 'Sales velocity is accelerating'
                ELSE 'Sales velocity is slowing down'
              END,
              'body', format(
                'Unit sales changed by %s%% compared with the previous 30-day window.',
                ROUND(v_velocity_change)
              ),
              'suggestedPrompt', CASE
                WHEN v_velocity_change > 0 THEN NULL
                ELSE 'How can I improve demand for this product?'
              END
            )
          );
        END IF;
      END IF;

      IF COALESCE(v_product.track_inventory, FALSE)
        AND COALESCE(v_product.low_stock_threshold, 0) > 0
        AND COALESCE(v_product.inventory_count, 0) <= COALESCE(v_product.low_stock_threshold, 0) THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'product-low-stock-threshold',
            'type', 'action',
            'title', 'Inventory is already at the low-stock threshold',
            'body', format(
              'Current inventory is %s units against a threshold of %s.',
              COALESCE(v_product.inventory_count, 0),
              COALESCE(v_product.low_stock_threshold, 0)
            ),
            'suggestedPrompt', 'Help me plan the next restock for this product.'
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  ELSIF p_resource_type = 'order' THEN
    BEGIN
      WITH order_lookup AS (
        SELECT
          'shopify'::TEXT AS order_source,
          id,
          contact_id AS customer_id,
          NULL::UUID AS pos_customer_id,
          COALESCE(total_price, 0)::NUMERIC AS total_amount,
          COALESCE(order_date, created_at)::TIMESTAMPTZ AS order_at
        FROM public.shopify_orders
        WHERE id = p_resource_id
          AND tenant_id = p_tenant_id

        UNION ALL

        SELECT
          'lightspeed'::TEXT AS order_source,
          id,
          contact_id AS customer_id,
          NULL::UUID AS pos_customer_id,
          COALESCE(total_amount, 0)::NUMERIC AS total_amount,
          sale_date AS order_at
        FROM public.lightspeed_sales
        WHERE id = p_resource_id
          AND tenant_id = p_tenant_id

        UNION ALL

        SELECT
          'pos'::TEXT AS order_source,
          po.id,
          NULL::UUID AS customer_id,
          po.pos_customer_id,
          COALESCE(po.total_amount, 0)::NUMERIC AS total_amount,
          po.order_date AS order_at
        FROM public.pos_orders po
        JOIN public.pos_connections pc
          ON pc.id = po.pos_connection_id
        WHERE po.id = p_resource_id
          AND pc.tenant_id = p_tenant_id
      )
      SELECT
        order_source,
        customer_id,
        pos_customer_id,
        total_amount,
        order_at
      INTO
        v_order_source,
        v_order_customer_id,
        v_order_pos_customer_id,
        v_order_total,
        v_order_at
      FROM order_lookup
      LIMIT 1;

      IF v_order_source IS NULL THEN
        RETURN result;
      END IF;

      IF v_order_customer_id IS NOT NULL THEN
        SELECT COALESCE(COUNT(*), 0)::INT
        INTO v_prior_order_count
        FROM (
          SELECT COALESCE(order_date, created_at)::TIMESTAMPTZ AS order_at
          FROM public.shopify_orders
          WHERE tenant_id = p_tenant_id
            AND contact_id = v_order_customer_id

          UNION ALL

          SELECT sale_date AS order_at
          FROM public.lightspeed_sales
          WHERE tenant_id = p_tenant_id
            AND contact_id = v_order_customer_id
        ) customer_orders
        WHERE customer_orders.order_at < v_order_at;
      ELSIF v_order_pos_customer_id IS NOT NULL THEN
        SELECT COALESCE(COUNT(*), 0)::INT
        INTO v_prior_order_count
        FROM public.pos_orders po
        JOIN public.pos_connections pc
          ON pc.id = po.pos_connection_id
        WHERE pc.tenant_id = p_tenant_id
          AND po.pos_customer_id = v_order_pos_customer_id
          AND po.order_date < v_order_at;
      ELSE
        v_prior_order_count := 0;
      END IF;

      IF COALESCE(v_prior_order_count, 0) > 3 THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'order-repeat-customer',
            'type', 'positive',
            'title', 'Repeat customer order',
            'body', format(
              'This customer placed %s orders before this one.',
              v_prior_order_count
            ),
            'suggestedPrompt', 'How does this order compare with the customer''s previous purchases?'
          )
        );
      END IF;

      WITH tenant_orders AS (
        SELECT COALESCE(total_price, 0)::NUMERIC AS total_amount
        FROM public.shopify_orders
        WHERE tenant_id = p_tenant_id

        UNION ALL

        SELECT COALESCE(total_amount, 0)::NUMERIC AS total_amount
        FROM public.lightspeed_sales
        WHERE tenant_id = p_tenant_id

        UNION ALL

        SELECT COALESCE(po.total_amount, 0)::NUMERIC AS total_amount
        FROM public.pos_orders po
        JOIN public.pos_connections pc
          ON pc.id = po.pos_connection_id
        WHERE pc.tenant_id = p_tenant_id
      )
      SELECT AVG(total_amount)
      INTO v_avg_order_total
      FROM tenant_orders
      WHERE total_amount > 0;

      IF v_avg_order_total IS NOT NULL
        AND v_avg_order_total > 0
        AND COALESCE(v_order_total, 0) > v_avg_order_total * 2 THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'order-high-value',
            'type', 'info',
            'title', 'Above-average order value',
            'body', format(
              'This order totals $%s versus a tenant average of $%s.',
              TO_CHAR(COALESCE(v_order_total, 0), 'FM999999990.00'),
              TO_CHAR(COALESCE(v_avg_order_total, 0), 'FM999999990.00')
            ),
            'suggestedPrompt', 'What follow-up should I send after this high-value order?'
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  ELSIF p_resource_type = 'campaign' THEN
    SELECT *
    INTO v_campaign
    FROM public.crm_campaigns
    WHERE id = p_resource_id
      AND tenant_id = p_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN result;
    END IF;

    BEGIN
      SELECT
        COALESCE(
          v_campaign.open_rate,
          NULLIF(v_campaign.metrics->'rates'->>'open_reported', '')::NUMERIC
        ),
        COALESCE(
          v_campaign.click_rate,
          NULLIF(v_campaign.metrics->'rates'->>'click', '')::NUMERIC
        )
      INTO v_current_open_rate, v_current_click_rate;

      SELECT
        AVG(
          COALESCE(
            c.open_rate,
            NULLIF(c.metrics->'rates'->>'open_reported', '')::NUMERIC
          )
        ) FILTER (
          WHERE COALESCE(
            c.open_rate,
            NULLIF(c.metrics->'rates'->>'open_reported', '')::NUMERIC
          ) IS NOT NULL
        ),
        AVG(
          COALESCE(
            c.click_rate,
            NULLIF(c.metrics->'rates'->>'click', '')::NUMERIC
          )
        ) FILTER (
          WHERE COALESCE(
            c.click_rate,
            NULLIF(c.metrics->'rates'->>'click', '')::NUMERIC
          ) IS NOT NULL
        )
      INTO v_average_open_rate, v_average_click_rate
      FROM public.crm_campaigns c
      WHERE c.tenant_id = p_tenant_id
        AND c.id <> p_resource_id
        AND c.sent_at IS NOT NULL;

      v_open_delta := CASE
        WHEN v_average_open_rate IS NOT NULL AND v_average_open_rate > 0 AND v_current_open_rate IS NOT NULL
          THEN ((v_current_open_rate - v_average_open_rate) / v_average_open_rate) * 100.0
        ELSE NULL
      END;
      v_click_delta := CASE
        WHEN v_average_click_rate IS NOT NULL AND v_average_click_rate > 0 AND v_current_click_rate IS NOT NULL
          THEN ((v_current_click_rate - v_average_click_rate) / v_average_click_rate) * 100.0
        ELSE NULL
      END;

      IF COALESCE(ABS(v_open_delta), 0) >= 20 OR COALESCE(ABS(v_click_delta), 0) >= 20 THEN
        result := result || jsonb_build_array(
          jsonb_build_object(
            'id', 'campaign-performance-vs-average',
            'type', CASE
              WHEN COALESCE(ABS(v_open_delta), 0) >= COALESCE(ABS(v_click_delta), 0)
                THEN CASE WHEN COALESCE(v_open_delta, 0) >= 0 THEN 'positive' ELSE 'warning' END
              ELSE CASE WHEN COALESCE(v_click_delta, 0) >= 0 THEN 'positive' ELSE 'warning' END
            END,
            'title', CASE
              WHEN COALESCE(ABS(v_open_delta), 0) >= COALESCE(ABS(v_click_delta), 0)
                THEN 'Open rate is moving away from tenant average'
              ELSE 'Click rate is moving away from tenant average'
            END,
            'body', CASE
              WHEN COALESCE(ABS(v_open_delta), 0) >= COALESCE(ABS(v_click_delta), 0)
                THEN format(
                  'Open rate is %s%% versus a tenant average of %s%%.',
                  TO_CHAR(COALESCE(v_current_open_rate, 0), 'FM999990.00'),
                  TO_CHAR(COALESCE(v_average_open_rate, 0), 'FM999990.00')
                )
              ELSE format(
                'Click rate is %s%% versus a tenant average of %s%%.',
                TO_CHAR(COALESCE(v_current_click_rate, 0), 'FM999990.00'),
                TO_CHAR(COALESCE(v_average_click_rate, 0), 'FM999990.00')
              )
            END,
            'suggestedPrompt', 'How should I improve the next campaign based on this performance?'
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      SELECT ranked.hour_bucket
      INTO v_best_hour
      FROM (
        SELECT
          EXTRACT(HOUR FROM ete.created_at)::INT AS hour_bucket,
          COUNT(*) FILTER (WHERE ete.event_type IN ('click', 'clicked')) * 2
            + COUNT(*) FILTER (WHERE ete.event_type IN ('open', 'opened')) AS score
        FROM public.email_tracking_events ete
        WHERE ete.tenant_id = p_tenant_id
          AND ete.campaign_id <> p_resource_id
        GROUP BY 1
        HAVING COUNT(*) > 0
        ORDER BY score DESC, hour_bucket ASC
        LIMIT 1
      ) ranked;

      v_sent_hour := CASE
        WHEN COALESCE(v_campaign.sent_at, v_campaign.scheduled_at) IS NOT NULL
          THEN EXTRACT(HOUR FROM COALESCE(v_campaign.sent_at, v_campaign.scheduled_at))::INT
        ELSE NULL
      END;

      IF v_best_hour IS NOT NULL AND v_sent_hour IS NOT NULL THEN
        v_hour_delta := LEAST(
          ABS(v_best_hour - v_sent_hour),
          24 - ABS(v_best_hour - v_sent_hour)
        );

        IF v_hour_delta >= 2 THEN
          result := result || jsonb_build_array(
            jsonb_build_object(
              'id', 'campaign-send-time-window',
              'type', 'info',
              'title', 'A different send window may perform better',
              'body', format(
                'Similar campaigns have stronger engagement around %s:00, while this campaign went out around %s:00.',
                v_best_hour,
                v_sent_hour
              ),
              'suggestedPrompt', 'What send time should I test for the next version of this campaign?'
            )
          );
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[]'::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_resource_insights(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_resource_insights(UUID, TEXT, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
