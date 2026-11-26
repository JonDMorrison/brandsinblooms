-- Bloom Slack: owners can get revenue and Stripe answers in any internal staff channel.
--
-- Before: revenue_by_client answered only in private channels, and refused the
-- ask and releases routes outright. The workspace has two members, both owners,
-- and they were told to go and ask somewhere else.
--
-- slack_agent.owner_financials_in_any_staff_channel = true lets owner-level
-- staff get revenue and Stripe figures in public internal channels as well.
-- It only has effect while slack_agent.allow_any_staff_channel is also true.
-- Channels shared outside the workspace are still refused by the worker.
-- To turn it off: set the key to false. The function below is otherwise
-- identical to 20261125220000.

UPDATE bloom_support.settings
SET value = value || '{"owner_financials_in_any_staff_channel": true}'::jsonb,
    updated_at = now()
WHERE key = 'slack_agent'
  AND NOT (value ? 'owner_financials_in_any_staff_channel');

CREATE OR REPLACE FUNCTION public.bloom_support_slack_revenue_by_client(
  p_job uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_category text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; a uuid; v_from date; v_to date; v_cat text; v_terms text[]; v_clients jsonb;
BEGIN
 c := public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'role' NOT IN ('platform_admin','platform_operator') THEN
  RAISE EXCEPTION 'An active owner-level Slack identity is required' USING ERRCODE='42501'; END IF;
 -- The ask and releases channels are public. Owners may open them to revenue
 -- answers with slack_agent.owner_financials_in_any_staff_channel; the worker
 -- still verifies the channel is an unshared internal channel before calling.
 IF c->>'route' IN ('ask','releases') AND coalesce((
   SELECT s.value->>'owner_financials_in_any_staff_channel' FROM bloom_support.settings s WHERE s.key='slack_agent'
 ),'false') <> 'true' THEN
  RAISE EXCEPTION 'Revenue is only available in a private Bloom channel' USING ERRCODE='42501'; END IF;
 a := (c->>'principal_id')::uuid;
 PERFORM bloom_support.require_permission(a,'accounts.read_all');

 v_to := coalesce(p_to, current_date);
 v_from := coalesce(p_from, (v_to - interval '12 months')::date);
 IF v_from > v_to OR v_to - v_from > 3660 THEN
  RAISE EXCEPTION 'Choose a date range of up to ten years, start before end' USING ERRCODE='22023'; END IF;
 v_cat := nullif(btrim(coalesce(p_category,'')),'');
 IF v_cat IS NOT NULL AND length(v_cat) > 60 THEN RAISE EXCEPTION 'Category text is too long' USING ERRCODE='22023'; END IF;
 SELECT array_agg(t ORDER BY o) INTO v_terms FROM (
   SELECT btrim(t) AS t, o FROM unnest(string_to_array(coalesce(v_cat,''), ',')) WITH ORDINALITY u(t,o)
   WHERE btrim(t) <> '') s;
 IF coalesce(array_length(v_terms,1),0) > 5 THEN
  RAISE EXCEPTION 'Ask for at most five categories at once' USING ERRCODE='22023'; END IF;

 WITH
 terms AS (
  -- Whole-word match on recorded labels (case-insensitive). A stem may take a
  -- plural or -ing/-er ending, so "event" matches "Events" but "plant" never
  -- matches "Planters". "plant"/"plant sales" expands to the departments garden
  -- centres sell living plants under; decor, pots and artificial stock are excluded.
  SELECT t AS term, o AS ord,
   CASE WHEN lower(t) ~ '^plants?( sales)?$' THEN
     '\m(plants?|houseplants?|annuals?|perennials?|trees?|shrubs?|tropicals?|poinsettias?|roses?|vegetables?|veggies?|herbs?|bulbs?|succulents?|cactus|cacti|evergreens?|conifers?|hedg(e|es|ing)|bedding|hanging baskets?|orchids?|ferns?|grasses|groundcovers?|vines?|seedlings?|nursery|mums?)\M'
   ELSE '\m'||regexp_replace(m,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'(s|es|ing|ings|er|ers)?\M' END AS pattern,
   CASE WHEN lower(t) ~ '^plants?( sales)?$' THEN
     '\m(artificial|faux|silk|planters?|pots?|ornaments?|decor|lights?|garlands?|candles?|stands?|accn|accessor(y|ies)|suppl(y|ies)|skirts?|toppers?|wreaths?|cut)\M'
   END AS exclude
  FROM unnest(coalesce(v_terms, ARRAY[]::text[])) WITH ORDINALITY u(t,o)
  CROSS JOIN LATERAL (SELECT CASE
    WHEN t !~ '\s' AND length(regexp_replace(lower(t), '(ings?|ers?|es|s)$', '')) >= 4
    THEN regexp_replace(lower(t), '(ings?|ers?|es|s)$', '') ELSE lower(t) END AS m) stem),
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
  SELECT s.tenant_id, coalesce(nullif(btrim(p.category),''),'Not categorised') AS category,
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
  SELECT i.tenant_id, i.source_system, max(i.currency) AS currency, count(DISTINCT i.currency) AS currencies,
   sum(i.amount) AS total, count(DISTINCT i.txn) AS transactions,
   min(i.at)::date AS first_sale, max(i.at)::date AS last_sale,
   true AS has_categories, NULL::numeric AS refunded,
   'Net line amounts after discounts, as imported from IDEAL'::text AS measure
  FROM ideal i GROUP BY i.tenant_id, i.source_system
  UNION ALL
  SELECT s.tenant_id, 'Lightspeed', NULL, 0, sum(s.total_amount), count(*),
   min(s.sale_date)::date, max(s.sale_date)::date, true, NULL,
   'Sale totals, excluding voided and saved (parked) sales'
  FROM ls_sales s GROUP BY s.tenant_id
  UNION ALL
  SELECT v.tenant_id, 'VMX POS', NULL, 0, sum(v.amount), count(*), min(v.at)::date, max(v.at)::date, false, NULL,
   'Receipt totals including tax'
  FROM vmx v GROUP BY v.tenant_id
  UNION ALL
  SELECT q.tenant_id, 'Square', max(q.currency), count(DISTINCT q.currency), sum(q.amount), count(*),
   min(q.at)::date, max(q.at)::date, false, sum(q.refunded), 'Completed order totals; refunds shown separately'
  FROM square q GROUP BY q.tenant_id),

 cats AS (
  SELECT tenant_id, source_system, category, sum(amount) AS total FROM ideal GROUP BY 1,2,3
  UNION ALL
  SELECT tenant_id, 'Lightspeed', category, sum(amount) FROM ls_lines GROUP BY 1,3),

 -- Without a filter: the largest recorded categories per client.
 ranked AS (
  SELECT cats.*, row_number() OVER (PARTITION BY tenant_id, source_system ORDER BY total DESC NULLS LAST, category) AS rn
  FROM cats),
 uncategorised AS (
  SELECT tenant_id, source_system, sum(total) AS total FROM cats
  WHERE category='Not categorised' GROUP BY 1,2),
 split AS (
  SELECT tenant_id, source_system,
   jsonb_agg(jsonb_build_object('category', category, 'total', round(total,2)) ORDER BY rn) FILTER (WHERE rn <= 8) AS top,
   count(*) AS category_count,
   round(sum(total) FILTER (WHERE rn > 8),2) AS other_total
  FROM ranked GROUP BY 1,2),

 -- With a filter: one entry per requested term per client.
 term_hits AS (
  SELECT ps.tenant_id, ps.source_system, t.term, t.ord, ps.has_categories,
   sum(c.total) AS total,
   jsonb_agg(jsonb_build_object('label', c.category, 'total', round(c.total,2)) ORDER BY c.total DESC)
     FILTER (WHERE c.category IS NOT NULL) AS labels
  FROM per_source ps CROSS JOIN terms t
  LEFT JOIN cats c ON ps.has_categories AND c.tenant_id=ps.tenant_id AND c.source_system=ps.source_system
   AND c.category ~* t.pattern AND (t.exclude IS NULL OR c.category !~* t.exclude)
  GROUP BY 1,2,3,4,5),
 term_out AS (
  SELECT tenant_id, source_system, jsonb_agg(CASE
    WHEN NOT has_categories THEN jsonb_build_object('requested', term,
      'total', 'not recorded by this source', 'matched_labels', '[]'::jsonb)
    ELSE jsonb_build_object('requested', term, 'total', round(coalesce(total,0),2),
      'matched_labels', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(labels) WITH ORDINALITY e(x,n) WHERE n <= 6),'[]'::jsonb),
      'matched_label_count', coalesce(jsonb_array_length(labels),0))
    END ORDER BY ord) AS requested
  FROM term_hits GROUP BY 1,2)

 SELECT coalesce(jsonb_agg(
   jsonb_build_object(
    'garden_centre', coalesce(t.name, 'Unnamed client'),
    'source_system', ps.source_system,
    'currency', CASE WHEN ps.currency IS NULL THEN 'not recorded by this source; do not assume or convert'
                     WHEN ps.currencies > 1 THEN 'mixed currencies recorded; do not total' ELSE ps.currency END,
    'period_with_sales', jsonb_build_object('first', ps.first_sale, 'last', ps.last_sale),
    'all_sales_total', round(ps.total,2),
    'all_sales_measure', ps.measure,
    'refunded', round(ps.refunded,2),
    'transactions', ps.transactions,
    'categories_recorded', ps.has_categories,
    'uncategorised_total', CASE WHEN ps.has_categories THEN round(coalesce(uc.total,0),2) END)
   || CASE WHEN v_terms IS NOT NULL THEN jsonb_build_object('requested_categories', coalesce(tr.requested,'[]'::jsonb))
      WHEN ps.has_categories THEN jsonb_build_object('largest_categories', jsonb_build_object(
        'largest', coalesce(sp.top,'[]'::jsonb), 'recorded_category_count', coalesce(sp.category_count,0),
        'remaining_categories_total', sp.other_total))
      ELSE jsonb_build_object('largest_categories', 'not recorded by this source') END
  ORDER BY ps.total DESC NULLS LAST), '[]'::jsonb)
 INTO v_clients
 FROM per_source ps
 LEFT JOIN public.tenants t ON t.id=ps.tenant_id
 LEFT JOIN split sp ON sp.tenant_id=ps.tenant_id AND sp.source_system=ps.source_system
 LEFT JOIN term_out tr ON tr.tenant_id=ps.tenant_id AND tr.source_system=ps.source_system
 LEFT JOIN uncategorised uc ON uc.tenant_id=ps.tenant_id AND uc.source_system=ps.source_system;

 PERFORM bloom_support.log(NULL,NULL,a,'slack.revenue_by_client.read',
  jsonb_build_object('source_job_id',p_job,'from',v_from,'to',v_to,'category',v_cat));

 RETURN jsonb_build_object(
  'requested_range', jsonb_build_object('from', v_from, 'to', v_to),
  'requested_categories', to_jsonb(v_terms),
  'clients', v_clients,
  'not_covered', jsonb_build_array(
    'BloomSites online orders, event tickets and fundraising (BloomSites database, not reachable from this tool)',
    'Synthetic demo sales'),
  'how_to_read', 'all_sales_total is every recorded sale in the period. It is never an events, fundraising or plant figure. A requested category''s revenue is only its requested_categories total; "not recorded by this source" means that store''s system keeps no category, so say so and give all_sales_total as total sales. Name the matched labels. Keep each source''s currency; never add across sources or currencies. Lightspeed categories cover only lines whose product has a category. uncategorised_total is sales with no recorded category: when it is a large share of all_sales_total, say category figures cover only part of that store''s sales.'
 );
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_revenue_by_client(uuid,date,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_revenue_by_client(uuid,date,date,text) TO service_role;
