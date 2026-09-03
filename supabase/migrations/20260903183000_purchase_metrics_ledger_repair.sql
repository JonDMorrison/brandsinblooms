-- Rebuild customer purchase intelligence from the actual normalized order
-- ledger. The legacy implementation referenced pos_orders.customer_id and
-- pos_orders.discount_amount, neither of which exists, so every invocation
-- failed before it could persist a metric row.

CREATE INDEX IF NOT EXISTS pos_orders_tenant_crm_customer_date_idx
  ON public.pos_orders(tenant_id, crm_customer_id, order_date)
  WHERE crm_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.recalculate_purchase_metrics(
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_total_purchases integer := 0;
  v_first_purchase date;
  v_last_purchase date;
  v_total_amount numeric := 0;
  v_avg_order_value numeric := 0;
  v_months_active numeric := 1;
  v_purchase_frequency numeric := 0;
  v_days_between_avg numeric;
  v_days_between_min integer;
  v_days_between_max integer;
  v_days_since_last integer;
  v_seasonal jsonb := '{}'::jsonb;
  v_peak_month text;
  v_category_affinity jsonb := '{}'::jsonb;
  v_top_categories text[] := ARRAY[]::text[];
  v_favorite_products text[] := ARRAY[]::text[];
  v_recent_90d_spend numeric := 0;
  v_prev_90d_spend numeric := 0;
  v_velocity numeric := 0;
  v_engagement_score numeric := 0;
  v_customer_tier text := 'new';
  v_access jsonb;
BEGIN
  SELECT customer.tenant_id
  INTO v_tenant_id
  FROM public.crm_customers AS customer
  WHERE customer.id = p_customer_id
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.role() = 'authenticated' THEN
    v_access := public.get_current_crm_access();
    IF (v_access->>'tenantId')::uuid IS DISTINCT FROM v_tenant_id
       OR v_access->>'role' NOT IN ('owner_admin', 'marketing') THEN
      RAISE EXCEPTION 'Purchase metric recalculation is not authorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role'
        AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Purchase metric recalculation requires authorization'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer,
    min(order_row.order_date::date),
    max(order_row.order_date::date),
    round(sum(greatest(
      coalesce(order_row.total_amount, 0) -
      coalesce(order_row.refund_amount, 0), 0
    )), 2)
  INTO v_total_purchases, v_first_purchase, v_last_purchase, v_total_amount
  FROM public.pos_orders AS order_row
  WHERE order_row.tenant_id = v_tenant_id
    AND order_row.crm_customer_id = p_customer_id
    AND upper(coalesce(order_row.status, '')) IN
      ('COMPLETED', 'REFUNDED', 'PAID');

  v_total_purchases := coalesce(v_total_purchases, 0);
  v_total_amount := coalesce(v_total_amount, 0);

  IF v_total_purchases > 0 THEN
    v_avg_order_value := round(v_total_amount / v_total_purchases, 2);
    v_months_active := greatest(1,
      extract(epoch FROM (now() - v_first_purchase::timestamp)) /
        (30.44 * 24 * 60 * 60));
    v_purchase_frequency := round(v_total_purchases / v_months_active, 2);
    v_days_since_last := (current_date - v_last_purchase)::integer;
  END IF;

  WITH purchase_gaps AS (
    SELECT order_row.order_date,
      lag(order_row.order_date) OVER (ORDER BY order_row.order_date) AS previous_at
    FROM public.pos_orders AS order_row
    WHERE order_row.tenant_id = v_tenant_id
      AND order_row.crm_customer_id = p_customer_id
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
  )
  SELECT round(avg(extract(epoch FROM (order_date - previous_at)) / 86400), 1),
    floor(min(extract(epoch FROM (order_date - previous_at)) / 86400))::integer,
    ceil(max(extract(epoch FROM (order_date - previous_at)) / 86400))::integer
  INTO v_days_between_avg, v_days_between_min, v_days_between_max
  FROM purchase_gaps
  WHERE previous_at IS NOT NULL;

  SELECT coalesce(jsonb_object_agg(month_name, purchase_count), '{}'::jsonb)
  INTO v_seasonal
  FROM (
    SELECT to_char(order_row.order_date, 'Mon') AS month_name,
      count(*) AS purchase_count,
      extract(month FROM order_row.order_date) AS month_number
    FROM public.pos_orders AS order_row
    WHERE order_row.tenant_id = v_tenant_id
      AND order_row.crm_customer_id = p_customer_id
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
    GROUP BY to_char(order_row.order_date, 'Mon'),
      extract(month FROM order_row.order_date)
    ORDER BY month_number
  ) AS monthly;

  SELECT trim(to_char(order_row.order_date, 'Month'))
  INTO v_peak_month
  FROM public.pos_orders AS order_row
  WHERE order_row.tenant_id = v_tenant_id
    AND order_row.crm_customer_id = p_customer_id
    AND upper(coalesce(order_row.status, '')) IN
      ('COMPLETED', 'REFUNDED', 'PAID')
  GROUP BY to_char(order_row.order_date, 'Month'),
    extract(month FROM order_row.order_date)
  ORDER BY count(*) DESC, extract(month FROM order_row.order_date)
  LIMIT 1;

  WITH item_categories AS (
    SELECT coalesce(nullif(item->>'category', ''),
      nullif(item->>'name', ''), 'Other') AS category
    FROM public.pos_orders AS order_row
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(order_row.items) = 'array'
        THEN order_row.items ELSE '[]'::jsonb END
    ) AS item
    WHERE order_row.tenant_id = v_tenant_id
      AND order_row.crm_customer_id = p_customer_id
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
  ), category_counts AS (
    SELECT category, count(*) AS item_count
    FROM item_categories GROUP BY category
    ORDER BY item_count DESC, category LIMIT 10
  )
  SELECT coalesce(jsonb_object_agg(category, item_count), '{}'::jsonb)
  INTO v_category_affinity
  FROM category_counts;

  WITH item_categories AS (
    SELECT coalesce(nullif(item->>'category', ''), 'Other') AS category
    FROM public.pos_orders AS order_row
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(order_row.items) = 'array'
        THEN order_row.items ELSE '[]'::jsonb END
    ) AS item
    WHERE order_row.tenant_id = v_tenant_id
      AND order_row.crm_customer_id = p_customer_id
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
  ), category_counts AS (
    SELECT category, count(*) AS item_count
    FROM item_categories GROUP BY category
    ORDER BY item_count DESC, category LIMIT 3
  )
  SELECT coalesce(array_agg(category ORDER BY item_count DESC, category),
    ARRAY[]::text[])
  INTO v_top_categories
  FROM category_counts;

  WITH product_counts AS (
    SELECT item->>'name' AS product_name, count(*) AS item_count
    FROM public.pos_orders AS order_row
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(order_row.items) = 'array'
        THEN order_row.items ELSE '[]'::jsonb END
    ) AS item
    WHERE order_row.tenant_id = v_tenant_id
      AND order_row.crm_customer_id = p_customer_id
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
      AND nullif(item->>'name', '') IS NOT NULL
    GROUP BY item->>'name'
    ORDER BY item_count DESC, product_name LIMIT 5
  )
  SELECT coalesce(array_agg(product_name ORDER BY item_count DESC, product_name),
    ARRAY[]::text[])
  INTO v_favorite_products
  FROM product_counts;

  SELECT round(coalesce(sum(greatest(
      coalesce(order_row.total_amount, 0) -
      coalesce(order_row.refund_amount, 0), 0
    )), 0), 2)
  INTO v_recent_90d_spend
  FROM public.pos_orders AS order_row
  WHERE order_row.tenant_id = v_tenant_id
    AND order_row.crm_customer_id = p_customer_id
    AND upper(coalesce(order_row.status, '')) IN
      ('COMPLETED', 'REFUNDED', 'PAID')
    AND order_row.order_date >= now() - interval '90 days';

  SELECT round(coalesce(sum(greatest(
      coalesce(order_row.total_amount, 0) -
      coalesce(order_row.refund_amount, 0), 0
    )), 0), 2)
  INTO v_prev_90d_spend
  FROM public.pos_orders AS order_row
  WHERE order_row.tenant_id = v_tenant_id
    AND order_row.crm_customer_id = p_customer_id
    AND upper(coalesce(order_row.status, '')) IN
      ('COMPLETED', 'REFUNDED', 'PAID')
    AND order_row.order_date >= now() - interval '180 days'
    AND order_row.order_date < now() - interval '90 days';

  IF v_prev_90d_spend > 0 THEN
    v_velocity := greatest(-100, least(100,
      round(((v_recent_90d_spend - v_prev_90d_spend) /
        v_prev_90d_spend) * 100, 2)));
  ELSIF v_recent_90d_spend > 0 THEN
    v_velocity := 100;
  END IF;

  IF v_total_purchases > 0 THEN
    v_engagement_score := greatest(0,
      30 - (coalesce(v_days_since_last, 365) * 30.0 / 365));
    v_engagement_score := v_engagement_score +
      least(25, v_purchase_frequency * 10);
    v_engagement_score := v_engagement_score +
      least(25, (v_total_amount / 1000) * 25);
    v_engagement_score := v_engagement_score + CASE
      WHEN v_velocity > 50 THEN 10
      WHEN v_velocity > 0 THEN 5 + (v_velocity / 10)
      WHEN v_velocity > -50 THEN 5
      ELSE 0 END;
    IF v_total_purchases > 1 THEN
      v_engagement_score := v_engagement_score + least(10, v_total_purchases);
    END IF;
    v_engagement_score := round(least(100, v_engagement_score), 1);
  END IF;

  v_customer_tier := CASE
    WHEN v_engagement_score >= 80 THEN 'vip'
    WHEN v_engagement_score >= 60 THEN 'loyal'
    WHEN v_engagement_score >= 40 THEN 'regular'
    WHEN v_engagement_score >= 20 THEN 'occasional'
    ELSE 'new' END;

  INSERT INTO public.customer_purchase_metrics(
    customer_id, tenant_id, total_purchases, first_purchase_date,
    last_purchase_date, purchase_frequency, avg_days_between_purchases,
    min_days_between_purchases, max_days_between_purchases,
    average_order_value, lifetime_value, revenue_per_month,
    repeat_purchase_rate, purchase_velocity, days_since_last_purchase,
    total_discounted_purchases, total_full_price_purchases,
    discount_driven_ratio, total_discount_amount, seasonal_patterns,
    peak_purchase_month, product_category_affinity,
    top_product_categories, favorite_products,
    purchase_engagement_score, customer_tier, updated_at
  ) VALUES (
    p_customer_id, v_tenant_id, v_total_purchases, v_first_purchase,
    v_last_purchase, v_purchase_frequency, v_days_between_avg,
    v_days_between_min, v_days_between_max, v_avg_order_value,
    v_total_amount, round(v_total_amount / v_months_active, 2),
    CASE WHEN v_total_purchases > 1 THEN
      round((v_total_purchases - 1)::numeric / v_total_purchases * 100, 1)
      ELSE 0 END,
    v_velocity, v_days_since_last,
    -- pos_orders has no normalized discount amount. Zero means unavailable;
    -- it must not be inferred from provider-specific raw JSON.
    0, 0, 0, 0, v_seasonal, v_peak_month, v_category_affinity,
    v_top_categories, v_favorite_products,
    v_engagement_score, v_customer_tier, now()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    total_purchases = excluded.total_purchases,
    first_purchase_date = excluded.first_purchase_date,
    last_purchase_date = excluded.last_purchase_date,
    purchase_frequency = excluded.purchase_frequency,
    avg_days_between_purchases = excluded.avg_days_between_purchases,
    min_days_between_purchases = excluded.min_days_between_purchases,
    max_days_between_purchases = excluded.max_days_between_purchases,
    average_order_value = excluded.average_order_value,
    lifetime_value = excluded.lifetime_value,
    revenue_per_month = excluded.revenue_per_month,
    repeat_purchase_rate = excluded.repeat_purchase_rate,
    purchase_velocity = excluded.purchase_velocity,
    days_since_last_purchase = excluded.days_since_last_purchase,
    total_discounted_purchases = excluded.total_discounted_purchases,
    total_full_price_purchases = excluded.total_full_price_purchases,
    discount_driven_ratio = excluded.discount_driven_ratio,
    total_discount_amount = excluded.total_discount_amount,
    seasonal_patterns = excluded.seasonal_patterns,
    peak_purchase_month = excluded.peak_purchase_month,
    product_category_affinity = excluded.product_category_affinity,
    top_product_categories = excluded.top_product_categories,
    favorite_products = excluded.favorite_products,
    purchase_engagement_score = excluded.purchase_engagement_score,
    customer_tier = excluded.customer_tier,
    updated_at = now();

  UPDATE public.customer_engagement_summary
  SET purchase_score = v_engagement_score, updated_at = now()
  WHERE customer_id = p_customer_id AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_purchase_metrics(
  p_customer_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_event_type text DEFAULT 'purchase'
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.recalculate_purchase_metrics(p_customer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_purchase_metrics(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer record;
  v_count integer := 0;
  v_access jsonb;
  v_effective_tenant uuid := p_tenant_id;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_access := public.get_current_crm_access();
    IF v_access->>'role' NOT IN ('owner_admin', 'marketing') THEN
      RAISE EXCEPTION 'Purchase metric refresh is not authorized'
        USING ERRCODE = '42501';
    END IF;
    IF v_effective_tenant IS NULL THEN
      v_effective_tenant := (v_access->>'tenantId')::uuid;
    ELSIF v_effective_tenant IS DISTINCT FROM
          (v_access->>'tenantId')::uuid THEN
      RAISE EXCEPTION 'Purchase metric refresh is not authorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role'
        AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Purchase metric refresh requires authorization'
      USING ERRCODE = '42501';
  END IF;

  FOR v_customer IN
    SELECT DISTINCT order_row.crm_customer_id AS id
    FROM public.pos_orders AS order_row
    JOIN public.crm_customers AS customer
      ON customer.id = order_row.crm_customer_id
     AND customer.tenant_id = order_row.tenant_id
     AND customer.deleted_at IS NULL
     AND customer.merged_into_customer_id IS NULL
    WHERE order_row.crm_customer_id IS NOT NULL
      AND (v_effective_tenant IS NULL OR
        order_row.tenant_id = v_effective_tenant)
      AND upper(coalesce(order_row.status, '')) IN
        ('COMPLETED', 'REFUNDED', 'PAID')
    ORDER BY order_row.crm_customer_id
  LOOP
    PERFORM public.recalculate_purchase_metrics(v_customer.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_customer_purchase_data_from_pos(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  v_updated := public.refresh_all_purchase_metrics(p_tenant_id);
  RETURN jsonb_build_object(
    'success', true,
    'customers_updated', v_updated,
    'tenant_id', p_tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_purchase_metrics(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_customer_purchase_metrics(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_all_purchase_metrics(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.recalculate_purchase_metrics(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_customer_purchase_metrics(uuid, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_purchase_metrics(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_customer_purchase_data_from_pos(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.recalculate_purchase_metrics(uuid) IS
  'Rebuilds customer purchase intelligence from tenant-scoped resolved POS orders using refund-adjusted net amounts.';
