-- Annual totals and customer purchase dates straight from staged receipts.
--
-- Writing every dated line for a year costs about eight random index reads
-- per line, and the database disk is throttled. Bloom does not read dated
-- Ideal lines yet, so for the remaining years only the two things that are
-- used are written: per-customer annual product totals (Bloom's product
-- evidence) and per-customer first/last receipt dates and receipt counts
-- (segments). Both are computed from the same staged receipts and checked
-- against the staged header before the year is marked complete.

CREATE TABLE IF NOT EXISTS public.ideal_journal_customer_years (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_sha256 text NOT NULL,
  external_customer_code text NOT NULL,
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  receipts integer NOT NULL,
  net_cents bigint NOT NULL,
  PRIMARY KEY (tenant_id, source_sha256, external_customer_code)
);
ALTER TABLE public.ideal_journal_customer_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_journal_customer_years FROM PUBLIC, anon, authenticated;

-- Staged receipt lines for one batch, optionally one customer partition.
CREATE OR REPLACE FUNCTION public.ideal_journal_staged_lines(p_batch_id text, p_part integer, p_parts integer)
RETURNS TABLE(code text, at timestamptz, receipt text, product_code text, product_name text, qty numeric, net_cents bigint, src text)
LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT rec->>0, (rec->>1)::timestamptz, rec->>2, coalesce(line->>0, ''), line->>1,
         coalesce((line->>2)::numeric, 0), (line->>5)::bigint, line->>7
  FROM public.ideal_journal_staging s
  CROSS JOIN LATERAL regexp_split_to_table(s.payload, E'\n') AS r(value)
  CROSS JOIN LATERAL (SELECT r.value::jsonb AS rec) x
  CROSS JOIN LATERAL jsonb_array_elements(rec->4) AS line
  WHERE s.batch_id = p_batch_id AND r.value LIKE '[%'
    AND (p_parts IS NULL OR mod(abs(hashtext(rec->>0)), p_parts) = p_part);
$$;

CREATE OR REPLACE FUNCTION public.ideal_journal_write_part_from_staging(p_batch_id text, p_part integer, p_parts integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_head jsonb; v_tenant uuid; v_summary uuid; v_rows integer; v_dates integer;
BEGIN
  v_head := public.ideal_journal_header(p_batch_id);
  SELECT tenant_id INTO v_tenant FROM public.ideal_journal_staging WHERE batch_id = p_batch_id AND seq = 0;
  IF v_head IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'Batch % is not staged', p_batch_id; END IF;

  INSERT INTO public.customer_intelligence_imports(
    tenant_id, source, report_type, source_filename, source_period_start, source_period_end,
    source_sha256, status, source_row_count, reconciliation, started_at)
  VALUES (v_tenant, 'ideal', 'customer_sales_summary', v_head->>'file', (v_head->>'period_start')::date,
    (v_head->>'period_end')::date, v_head->>'sha256', 'processing', (v_head->>'lines')::int,
    jsonb_build_object('basis', 'Annual customer-product totals built from the dated journal receipts',
      'evidence_kind', 'annual product totals from dated journal receipts', 'staging_batch', p_batch_id), now())
  ON CONFLICT (tenant_id, source, report_type, source_sha256) DO NOTHING;
  SELECT id INTO v_summary FROM public.customer_intelligence_imports
  WHERE tenant_id = v_tenant AND source = 'ideal' AND report_type = 'customer_sales_summary'
    AND source_sha256 = v_head->>'sha256' AND status = 'processing';
  IF v_summary IS NULL THEN RAISE EXCEPTION 'Annual totals for % are already complete', p_batch_id; END IF;

  CREATE TEMP TABLE part_lines ON COMMIT DROP AS
  SELECT l.*, m.customer_id, d.department
  FROM public.ideal_journal_staged_lines(p_batch_id, p_part, p_parts) l
  JOIN public.ideal_customer_code_map m ON m.tenant_id = v_tenant AND m.external_id = l.code AND m.matches = 1
  LEFT JOIN public.ideal_product_department_map d ON d.tenant_id = v_tenant AND d.product_code = l.product_code;

  WITH per_item AS (
    SELECT customer_id, code, product_code, product_name, coalesce(max(department), '') AS dept,
           sum(qty) AS qty, round(sum(net_cents) / 100.0, 2) AS amount,
           min(split_part(src, ':', 2)::int + 100000 * regexp_replace(split_part(src, ':', 1), '\D', '', 'g')::int) AS row_no
    FROM part_lines GROUP BY 1, 2, 3, 4
  ), per_customer AS (
    SELECT customer_id, code, jsonb_agg(jsonb_build_array(product_code, product_name, dept, qty, amount, row_no) ORDER BY dept, product_code, product_name) AS items
    FROM per_item GROUP BY 1, 2
  ), ins AS (
    INSERT INTO public.customer_intelligence_source_events(
      tenant_id, customer_id, import_id, source, event_type, external_customer_code, amount, source_fingerprint, raw_data)
    SELECT v_tenant, customer_id, v_summary, 'ideal', 'purchase_summary', code,
      (SELECT round(sum((i->>4)::numeric), 2) FROM jsonb_array_elements(items) i),
      encode(extensions.digest(convert_to((v_head->>'sha256') || ':summary:' || code, 'UTF8'), 'sha256'), 'hex'),
      jsonb_build_object('kind', 'purchase_summary', 'currency', 'CAD',
        'period_start', v_head->>'period_start', 'period_end', v_head->>'period_end',
        'source_sha256', v_head->>'sha256', 'items', items,
        'source_row_numbering', 'sheet number x 100000 + first source row of the product')
    FROM per_customer
    ON CONFLICT (tenant_id, source, source_fingerprint) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_rows FROM ins;

  INSERT INTO public.ideal_journal_customer_years(tenant_id, source_sha256, external_customer_code, customer_id, first_at, last_at, receipts, net_cents)
  SELECT v_tenant, v_head->>'sha256', code, min(customer_id::text)::uuid, min(at), max(at), count(DISTINCT receipt), sum(net_cents)
  FROM part_lines GROUP BY code
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_dates = ROW_COUNT;
  RETURN jsonb_build_object('summary_rows', v_rows, 'customer_years', v_dates);
END $$;

-- Completes a year only when every matched customer and cent in the staged
-- receipts is present in both outputs; then records the journal itself.
CREATE OR REPLACE FUNCTION public.ideal_journal_complete_from_staging(p_batch_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_head jsonb; v_tenant uuid; v_summary uuid; v_customers bigint; v_cents bigint; v_all_cents bigint;
  v_rows bigint; v_sum_cents bigint; v_years bigint; v_year_cents bigint; v_result jsonb;
BEGIN
  v_head := public.ideal_journal_header(p_batch_id);
  SELECT tenant_id INTO v_tenant FROM public.ideal_journal_staging WHERE batch_id = p_batch_id AND seq = 0;
  SELECT id INTO v_summary FROM public.customer_intelligence_imports
  WHERE tenant_id = v_tenant AND report_type = 'customer_sales_summary' AND source_sha256 = v_head->>'sha256' AND status = 'processing';
  IF v_summary IS NULL THEN RAISE EXCEPTION 'No open annual totals for %', p_batch_id; END IF;

  SELECT sum(l.net_cents), count(DISTINCT l.code) FILTER (WHERE m.customer_id IS NOT NULL), sum(l.net_cents) FILTER (WHERE m.customer_id IS NOT NULL)
    INTO v_all_cents, v_customers, v_cents
  FROM public.ideal_journal_staged_lines(p_batch_id, NULL, NULL) l
  LEFT JOIN public.ideal_customer_code_map m ON m.tenant_id = v_tenant AND m.external_id = l.code AND m.matches = 1;
  IF v_all_cents <> (v_head->>'net_cents')::bigint THEN RAISE EXCEPTION 'Staged receipts do not match their header'; END IF;

  SELECT count(*), round(sum(amount) * 100) INTO v_rows, v_sum_cents FROM public.customer_intelligence_source_events WHERE import_id = v_summary;
  SELECT count(*), sum(net_cents) INTO v_years, v_year_cents FROM public.ideal_journal_customer_years
  WHERE tenant_id = v_tenant AND source_sha256 = v_head->>'sha256';
  IF v_rows <> v_customers OR v_sum_cents <> v_cents OR v_years <> v_customers OR v_year_cents <> v_cents THEN
    RAISE EXCEPTION 'Year does not reconcile: % / % customers, % / % / % cents', v_rows, v_customers, v_sum_cents, v_year_cents, v_cents;
  END IF;

  v_result := jsonb_build_object('receipt_lines', v_head->'lines', 'net_cents', v_all_cents, 'matched_customers', v_customers,
    'matched_cents', v_cents, 'dated_lines_stored', false, 'annual_totals_import', v_summary);
  UPDATE public.customer_intelligence_imports SET status = 'completed', completed_at = now(),
    accepted_row_count = v_rows, duplicate_row_count = 0, rejected_row_count = 0,
    reconciliation = reconciliation || jsonb_build_object('customers', v_rows, 'cents', v_sum_cents)
  WHERE id = v_summary;

  INSERT INTO public.customer_intelligence_imports(
    tenant_id, source, report_type, source_filename, source_period_start, source_period_end,
    source_sha256, status, source_row_count, reconciliation, started_at)
  VALUES (v_tenant, 'ideal', 'journal', v_head->>'file', (v_head->>'period_start')::date, (v_head->>'period_end')::date,
    v_head->>'sha256', 'processing', (v_head->>'receipts')::int,
    jsonb_build_object('basis', 'Dated customer receipts from the IdealPOS Customer Journal History',
      'timezone', v_head->>'timezone', 'expected', v_head, 'staging_batch', p_batch_id), now())
  ON CONFLICT (tenant_id, source, report_type, source_sha256) DO NOTHING;
  UPDATE public.customer_intelligence_imports SET status = 'completed', completed_at = now(),
    accepted_row_count = (v_head->>'receipts')::int, duplicate_row_count = 0, rejected_row_count = 0,
    reconciliation = reconciliation || jsonb_build_object('applied', v_result)
  WHERE tenant_id = v_tenant AND report_type = 'journal' AND source_sha256 = v_head->>'sha256';

  DELETE FROM public.ideal_journal_staging WHERE batch_id = p_batch_id;
  RETURN v_result;
END $$;

-- Purchase dates now come from per-customer journal years, which cover the
-- years whose dated lines were stored as well as the ones that were not.
CREATE OR REPLACE FUNCTION public.ideal_journal_backfill_customer_years(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' SET enable_indexscan = off AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.ideal_journal_customer_years(tenant_id, source_sha256, external_customer_code, customer_id, first_at, last_at, receipts, net_cents)
  SELECT p_tenant_id, i.source_sha256, li.external_customer_code, min(li.customer_id::text)::uuid,
         min(li.purchased_at), max(li.purchased_at), count(DISTINCT li.external_transaction_id), round(sum(li.net_amount) * 100)
  FROM public.customer_intelligence_imports i
  JOIN public.customer_purchase_line_items li ON li.import_id = i.id
  WHERE i.tenant_id = p_tenant_id AND i.report_type = 'journal' AND i.status = 'completed'
  GROUP BY i.source_sha256, li.external_customer_code
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.ideal_journal_refresh_customer_dates(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_journal_end date; v_dated integer; v_later integer;
BEGIN
  SELECT max(source_period_end) INTO v_journal_end FROM public.customer_intelligence_imports
  WHERE tenant_id = p_tenant_id AND source = 'ideal' AND report_type = 'journal' AND status = 'completed';
  IF v_journal_end IS NULL THEN RAISE EXCEPTION 'No completed journal import'; END IF;

  WITH dated AS (
    SELECT customer_id, min(first_at) AS first_at, max(last_at) AS last_at, sum(receipts) AS receipts
    FROM public.ideal_journal_customer_years
    WHERE tenant_id = p_tenant_id AND customer_id IS NOT NULL
    GROUP BY customer_id
  ), later AS (
    SELECT DISTINCT e.customer_id
    FROM public.customer_intelligence_imports i
    JOIN public.customer_intelligence_source_events e ON e.import_id = i.id
    WHERE i.tenant_id = p_tenant_id AND i.source = 'ideal' AND i.status = 'completed'
      AND i.report_type IN ('customer_spending', 'customer_sales_summary')
      AND i.source_period_end > v_journal_end AND e.customer_id IS NOT NULL
      AND coalesce(e.amount, 1) <> 0
  ), upd AS (
    UPDATE public.crm_customers c
    SET first_purchase_date = (d.first_at AT TIME ZONE 'America/Vancouver')::date,
        last_purchase_date = CASE WHEN l.customer_id IS NULL THEN (d.last_at AT TIME ZONE 'America/Vancouver')::date END,
        last_visit_date = CASE WHEN l.customer_id IS NULL THEN d.last_at END,
        pos_order_count = d.receipts
    FROM dated d LEFT JOIN later l ON l.customer_id = d.customer_id
    WHERE c.id = d.customer_id AND c.tenant_id = p_tenant_id AND c.deleted_at IS NULL
    RETURNING (l.customer_id IS NOT NULL) AS has_later
  ) SELECT count(*), count(*) FILTER (WHERE has_later) INTO v_dated, v_later FROM upd;

  RETURN jsonb_build_object('customers_dated', v_dated, 'last_purchase_unknown_after', v_journal_end, 'later_activity_customers', v_later);
END $$;

REVOKE ALL ON FUNCTION public.ideal_journal_staged_lines(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_write_part_from_staging(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_complete_from_staging(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_backfill_customer_years(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_refresh_customer_dates(uuid) FROM PUBLIC, anon, authenticated;
