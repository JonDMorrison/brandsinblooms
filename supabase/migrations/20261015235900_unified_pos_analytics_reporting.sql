-- All supported POS providers write to public.pos_orders. Aggregate in Postgres
-- so dashboard totals cannot silently truncate at PostgREST's response limit.
-- SECURITY INVOKER deliberately retains the location-scoped POS RLS policy.
CREATE OR REPLACE FUNCTION public.get_pos_analytics_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_tenant_id uuid;
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_period_end timestamptz := now();
  v_current_start timestamptz;
  v_previous_start timestamptz;
  v_result jsonb;
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_access := public.get_current_crm_access();
  v_tenant_id := nullif(v_access->>'tenantId', '')::uuid;
  IF v_tenant_id IS NULL
     OR NOT coalesce(v_access->'permissions' ? 'reports.read', false) THEN
    RAISE EXCEPTION 'Reporting access required' USING ERRCODE = '42501';
  END IF;

  v_current_start := v_period_end - make_interval(days => v_days);
  v_previous_start := v_current_start - make_interval(days => v_days);

  WITH eligible_orders AS (
    SELECT
      order_date,
      COALESCE(NULLIF(upper(btrim(currency)), ''), 'UNKNOWN') AS currency,
      COALESCE(NULLIF(lower(btrim(provider)), ''), 'unknown') AS provider,
      COALESCE(total_amount, 0) AS total_amount
    FROM public.pos_orders
    WHERE tenant_id = v_tenant_id
      AND order_date >= v_previous_start
      AND order_date < v_period_end
      AND lower(coalesce(status, '')) IN
        ('completed', 'paid', 'shipped', 'fulfilled', 'closed')
  ),
  current_orders AS (
    SELECT * FROM eligible_orders WHERE order_date >= v_current_start
  ),
  previous_orders AS (
    SELECT * FROM eligible_orders WHERE order_date < v_current_start
  ),
  current_currency AS (
    SELECT currency, count(*)::integer AS orders,
      round(sum(total_amount), 2) AS revenue
    FROM current_orders GROUP BY currency
  ),
  previous_currency AS (
    SELECT currency, count(*)::integer AS orders,
      round(sum(total_amount), 2) AS revenue
    FROM previous_orders GROUP BY currency
  ),
  daily_currency AS (
    SELECT to_char(order_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      currency, count(*)::integer AS orders,
      round(sum(total_amount), 2) AS revenue
    FROM current_orders
    GROUP BY to_char(order_date AT TIME ZONE 'UTC', 'YYYY-MM-DD'), currency
  )
  SELECT jsonb_build_object(
    'periodDays', v_days,
    'totalOrders', (SELECT count(*) FROM current_orders),
    'revenueByCurrency', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'currency', currency, 'orders', orders, 'revenue', revenue
      ) ORDER BY currency) FROM current_currency), '[]'::jsonb
    ),
    'previousRevenueByCurrency', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'currency', currency, 'orders', orders, 'revenue', revenue
      ) ORDER BY currency) FROM previous_currency), '[]'::jsonb
    ),
    'dailySales', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'date', day, 'currency', currency, 'orders', orders, 'revenue', revenue
      ) ORDER BY day, currency) FROM daily_currency), '[]'::jsonb
    ),
    'providers', COALESCE(
      (SELECT jsonb_agg(provider ORDER BY provider)
       FROM (SELECT DISTINCT provider FROM current_orders) providers), '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pos_analytics_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_analytics_summary(integer) TO authenticated;
