-- Bloom (Slack) read-only revenue summary per garden centre.
--
-- Aggregates only: no customer, receipt or line rows leave this function.
-- Owner-level staff only (platform_admin, platform_operator) on a durable Slack
-- conversation; the edge function additionally requires a confirmed private channel,
-- and the known public routes (ask, releases) are refused here as well.
--
-- Sources are the CRM database's recorded sales. Each source is reported in the
-- currency it stores; sources that store no currency say so. Category splits use
-- only fields the source system itself recorded; nothing is mapped or inferred.
--   * IDEAL line items (customer_purchase_line_items, source='ideal'):
--     sales_category, else the store's own department label.
--   * Lightspeed (lightspeed_sales): line product -> lightspeed_products.category,
--     where the product has one; other lines are "Not categorised".
--   * VMX (pos_receipts): receipt totals only; no product category is recorded.
--   * Square (pos_orders, provider='square'): order totals only; no category.
-- Synthetic demo rows (customer_purchase_line_items.source='demo') are excluded.
-- BloomSites online orders, event tickets and fundraising live in the BloomSites
-- (CMS) database and are not reachable from this function; the result says so.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_revenue_by_client(
  p_job uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_category text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; a uuid; v_from date; v_to date; v_cat text; v_pattern text; v_clients jsonb;
BEGIN
 c := public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'role' NOT IN ('platform_admin','platform_operator') THEN
  RAISE EXCEPTION 'An active owner-level Slack identity is required' USING ERRCODE='42501'; END IF;
 IF c->>'route' IN ('ask','releases') THEN
  RAISE EXCEPTION 'Revenue is only available in a private Bloom channel' USING ERRCODE='42501'; END IF;
 a := (c->>'principal_id')::uuid;
 PERFORM bloom_support.require_permission(a,'accounts.read_all');

 v_to := coalesce(p_to, current_date);
 v_from := coalesce(p_from, (v_to - interval '12 months')::date);
 IF v_from > v_to OR v_to - v_from > 3660 THEN
  RAISE EXCEPTION 'Choose a date range of up to ten years, start before end' USING ERRCODE='22023'; END IF;
 v_cat := nullif(btrim(coalesce(p_category,'')),'');
 IF v_cat IS NOT NULL AND length(v_cat) > 60 THEN RAISE EXCEPTION 'Category text is too long' USING ERRCODE='22023'; END IF;
 -- Plain substring match on recorded labels; wildcards in the input are literal.
 v_pattern := CASE WHEN v_cat IS NULL THEN NULL
   ELSE '%'||replace(replace(replace(v_cat,'\','\\'),'%','\%'),'_','\_')||'%' END;

 WITH
 ideal AS (
  SELECT li.tenant_id, 'IDEAL POS'::text AS source_system, li.currency,
   coalesce(nullif(btrim(li.sales_category),''),
     nullif(regexp_replace(regexp_replace(btrim(li.department),'^DPT\s+',''),'\s+',' ','g'),''),
     'Not categorised') AS category,
   li.net_amount AS amount, li.purchased_at AS at, li.external_transaction_id AS txn
  FROM public.customer_purchase_line_items li
  WHERE li.source='ideal' AND li.purchased_at >= v_from AND li.purchased_at < v_to + 1),
 ls_sales AS (
  SELECT s.id, s.tenant_id, s.sale_date, s.total_amount, s.line_items
  FROM public.lightspeed_sales s
  WHERE s.sale_date >= v_from AND s.sale_date < v_to + 1
   AND coalesce(s.status,'') NOT IN ('voided','saved')),
 ls_lines AS (
  SELECT s.tenant_id, s.id AS sale_id, coalesce(nullif(btrim(p.category),''),'Not categorised') AS category,
   -- price_total lines sum exactly to the sale's total_amount (checked 2026-11-25).
   CASE WHEN coalesce(li->>'price_total','') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (li->>'price_total')::numeric
        ELSE 0 END AS amount
  FROM ls_sales s
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.line_items)='array' THEN s.line_items ELSE '[]'::jsonb END) li
  LEFT JOIN public.lightspeed_products p ON p.tenant_id=s.tenant_id AND p.lightspeed_product_id=li->>'product_id'),
 vmx AS (
  SELECT r.tenant_id, r.total AS amount, r.post_date AS at
  FROM public.pos_receipts r
  WHERE r.post_date >= v_from AND r.post_date < v_to + 1),
 square AS (
  SELECT o.tenant_id, o.currency, o.total_amount AS amount, coalesce(o.refund_amount,0) AS refunded, o.order_date AS at
  FROM public.pos_orders o
  WHERE o.provider='square' AND upper(coalesce(o.status,''))='COMPLETED'
   AND o.order_date >= v_from AND o.order_date < v_to + 1),

 -- One row per (garden centre, source system).
 per_source AS (
  -- IDEAL: categories are recorded.
  SELECT i.tenant_id, i.source_system, max(i.currency) AS currency, count(DISTINCT i.currency) AS currencies,
   sum(i.amount) AS total,
   sum(i.amount) FILTER (WHERE v_pattern IS NULL OR i.category ILIKE v_pattern) AS matching_total,
   count(DISTINCT i.txn) AS transactions, min(i.at)::date AS first_sale, max(i.at)::date AS last_sale,
   true AS has_categories, NULL::numeric AS refunded,
   'Net line amounts after discounts, as imported from IDEAL'::text AS measure
  FROM ideal i GROUP BY i.tenant_id, i.source_system
  UNION ALL
  SELECT s.tenant_id, 'Lightspeed', NULL, 0, sum(s.total_amount),
   (SELECT sum(l.amount) FROM ls_lines l WHERE l.tenant_id=s.tenant_id AND (v_pattern IS NULL OR l.category ILIKE v_pattern)),
   count(*), min(s.sale_date)::date, max(s.sale_date)::date, true, NULL,
   'Sale totals, excluding voided and saved (parked) sales'
  FROM ls_sales s GROUP BY s.tenant_id
  UNION ALL
  SELECT v.tenant_id, 'VMX POS', NULL, 0, sum(v.amount), NULL, count(*), min(v.at)::date, max(v.at)::date, false, NULL,
   'Receipt totals including tax'
  FROM vmx v GROUP BY v.tenant_id
  UNION ALL
  SELECT q.tenant_id, 'Square', max(q.currency), count(DISTINCT q.currency), sum(q.amount), NULL, count(*),
   min(q.at)::date, max(q.at)::date, false, sum(q.refunded), 'Completed order totals; refunds shown separately'
  FROM square q GROUP BY q.tenant_id),

 cats AS (
  SELECT tenant_id, source_system, category, sum(amount) AS total FROM ideal GROUP BY 1,2,3
  UNION ALL
  SELECT tenant_id, 'Lightspeed', category, sum(amount) FROM ls_lines GROUP BY 1,3),
 ranked AS (
  SELECT cats.*, row_number() OVER (PARTITION BY tenant_id, source_system ORDER BY total DESC NULLS LAST, category) AS rn
  FROM cats WHERE v_pattern IS NULL OR category ILIKE v_pattern),
 split AS (
  SELECT tenant_id, source_system,
   jsonb_agg(jsonb_build_object('category', category, 'total', round(total,2)) ORDER BY rn) FILTER (WHERE rn <= 8) AS top,
   count(*) AS category_count,
   round(sum(total) FILTER (WHERE rn > 8),2) AS other_total
  FROM ranked GROUP BY 1,2)

 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'garden_centre', coalesce(t.name, 'Unnamed client'),
   'source_system', ps.source_system,
   'currency', CASE WHEN ps.currency IS NULL THEN 'not recorded by this source; do not assume or convert'
                    WHEN ps.currencies > 1 THEN 'mixed currencies recorded; do not total' ELSE ps.currency END,
   'total', round(ps.total,2),
   'measure', ps.measure,
   'refunded', round(ps.refunded,2),
   'transactions', ps.transactions,
   'first_sale_in_range', ps.first_sale, 'last_sale_in_range', ps.last_sale,
   'category_filter_total', CASE WHEN v_pattern IS NULL THEN NULL
       WHEN NOT ps.has_categories THEN to_jsonb('not recorded'::text) ELSE to_jsonb(round(coalesce(ps.matching_total,0),2)) END,
   'categories', CASE WHEN NOT ps.has_categories THEN to_jsonb('not recorded'::text)
       ELSE jsonb_build_object('largest', coalesce(sp.top,'[]'::jsonb), 'recorded_category_count', coalesce(sp.category_count,0),
         'remaining_categories_total', sp.other_total) END
  ) ORDER BY ps.total DESC NULLS LAST), '[]'::jsonb)
 INTO v_clients
 FROM per_source ps
 LEFT JOIN public.tenants t ON t.id=ps.tenant_id
 LEFT JOIN split sp ON sp.tenant_id=ps.tenant_id AND sp.source_system=ps.source_system;

 PERFORM bloom_support.log(NULL,NULL,a,'slack.revenue_by_client.read',
  jsonb_build_object('source_job_id',p_job,'from',v_from,'to',v_to,'category',v_cat));

 RETURN jsonb_build_object(
  'requested_range', jsonb_build_object('from', v_from, 'to', v_to),
  'category_filter', v_cat,
  'clients', v_clients,
  'not_covered', jsonb_build_array(
    'BloomSites online orders, event tickets and fundraising (BloomSites database, not reachable from this tool)',
    'Synthetic demo sales'),
  'interpretation', 'Recorded sales only, per source system and in each source''s stored currency. Never add amounts across sources or currencies. Categories are the labels each system recorded; "not recorded" means that source keeps no category. Lightspeed categories cover only lines whose product has a category. Events and fundraising appear only where a store recorded such a category.'
 );
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_revenue_by_client(uuid,date,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_revenue_by_client(uuid,date,date,text) TO service_role;
