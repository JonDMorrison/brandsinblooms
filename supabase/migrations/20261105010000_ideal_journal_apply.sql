-- Apply staged IdealPOS journal receipts.
--
-- Operator-only (postgres / service role). Each staged batch is one journal
-- workbook year. The first line of chunk 0 is a header with the source hash,
-- printed period and expected receipt, line and cent totals. Receipts are
-- JSON arrays: [customer code, local ISO time, receipt key, source cell,
-- [[product code, name, qty, gross cents, discount cents, net cents, kind, source cell], ...]].
--
-- 1. ideal_journal_open_import    creates the journal ledger row.
-- 2. ideal_journal_apply_chunk    writes that chunk's dated lines (idempotent).
-- 3. ideal_journal_finish         checks every total against the header, then
--                                 optionally writes per-customer annual product
--                                 totals in the established report shape, and
--                                 completes the ledger. Any mismatch aborts.
--
-- Dated Ideal lines stay outside Bloom's product facts (source = 'ideal' is
-- excluded there), so the annual totals are never counted twice.

CREATE OR REPLACE FUNCTION public.ideal_journal_header(p_batch_id text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT split_part(payload, E'\n', 1)::jsonb
  FROM public.ideal_journal_staging WHERE batch_id = p_batch_id AND seq = 0;
$$;

-- Department label for a product code, taken from the newest reconciled report that lists it.
CREATE OR REPLACE FUNCTION public.ideal_product_departments(p_tenant_id uuid)
RETURNS TABLE(product_code text, department text)
LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT DISTINCT ON (item->>0) item->>0, item->>2
  FROM public.customer_intelligence_source_events e
  JOIN public.customer_intelligence_imports i ON i.id = e.import_id AND i.status = 'completed'
  CROSS JOIN LATERAL jsonb_array_elements(e.raw_data->'items') AS item
  WHERE e.tenant_id = p_tenant_id AND e.event_type = 'purchase_summary' AND e.source = 'ideal'
    AND coalesce(i.reconciliation->>'evidence_kind', '') NOT LIKE '%journal%'
    AND coalesce(item->>0, '') <> '' AND coalesce(item->>2, '') <> ''
  ORDER BY item->>0, i.source_period_end DESC, i.completed_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.ideal_journal_open_import(p_batch_id text)
RETURNS uuid LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_head jsonb; v_tenant uuid; v_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.ideal_journal_staging WHERE batch_id = p_batch_id AND seq = 0;
  v_head := public.ideal_journal_header(p_batch_id);
  IF v_tenant IS NULL OR v_head IS NULL OR v_head->>'sha256' !~ '^[0-9a-f]{64}$'
     OR p_batch_id NOT LIKE '%-' || left(v_head->>'sha256', 12) THEN
    RAISE EXCEPTION 'Staged journal header is missing or does not match its batch';
  END IF;
  INSERT INTO public.customer_intelligence_imports(
    tenant_id, source, report_type, source_filename, source_period_start, source_period_end,
    source_sha256, status, source_row_count, reconciliation, started_at)
  VALUES (v_tenant, 'ideal', 'journal', v_head->>'file', (v_head->>'period_start')::date,
    (v_head->>'period_end')::date, v_head->>'sha256', 'processing', (v_head->>'receipts')::int,
    jsonb_build_object('basis', 'Dated customer receipts from the IdealPOS Customer Journal History',
      'timezone', v_head->>'timezone', 'expected', v_head, 'staging_batch', p_batch_id,
      'rules', jsonb_build_array(
        'A VOID marker excludes the item that follows it; inline VOID rows are excluded.',
        'REFUND lines are kept as negative quantity and amount.',
        'Per-item discount notes are applied to the item above them; the matching summary discount line is not counted again.',
        'Coupons, gift voucher and credit note redemptions are payments, not sales.',
        'Gift card and credit note issuance are not merchandise.')),
    now())
  ON CONFLICT (tenant_id, source, report_type, source_sha256) DO NOTHING;
  SELECT id INTO v_id FROM public.customer_intelligence_imports
  WHERE tenant_id = v_tenant AND source = 'ideal' AND report_type = 'journal' AND source_sha256 = v_head->>'sha256';
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ideal_journal_apply_chunk(p_batch_id text, p_seq integer)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_head jsonb; v_import public.customer_intelligence_imports%ROWTYPE; v_count integer;
BEGIN
  v_head := public.ideal_journal_header(p_batch_id);
  SELECT * INTO v_import FROM public.customer_intelligence_imports
  WHERE source = 'ideal' AND report_type = 'journal' AND source_sha256 = v_head->>'sha256'
    AND reconciliation->>'staging_batch' = p_batch_id;
  IF v_import.id IS NULL OR v_import.status <> 'processing' THEN
    RAISE EXCEPTION 'Open the journal import before applying chunks';
  END IF;
  WITH receipts AS (
    SELECT r.value::jsonb AS rec
    FROM public.ideal_journal_staging s
    CROSS JOIN LATERAL regexp_split_to_table(s.payload, E'\n') WITH ORDINALITY AS r(value, n)
    WHERE s.batch_id = p_batch_id AND s.seq = p_seq AND r.value LIKE '[%'
  ), customers AS (
    SELECT external_id, min(id::text)::uuid AS id, count(*) AS n
    FROM public.crm_customers
    WHERE tenant_id = v_import.tenant_id AND deleted_at IS NULL AND merged_into_customer_id IS NULL AND external_id IS NOT NULL
    GROUP BY external_id
  ), departments AS (
    SELECT * FROM public.ideal_product_departments(v_import.tenant_id)
  ), ins AS (
    INSERT INTO public.customer_purchase_line_items(
      tenant_id, customer_id, import_id, source, external_transaction_id, external_line_id,
      external_customer_code, product_code, product_name, department, quantity,
      gross_amount, discount_amount, net_amount, currency, purchased_at,
      source_period_start, source_period_end, source_fingerprint, raw_data)
    SELECT v_import.tenant_id, CASE WHEN c.n = 1 THEN c.id END, v_import.id, 'ideal',
      rec->>2, line->>7, rec->>0, nullif(line->>0, ''), line->>1, d.department,
      coalesce((line->>2)::numeric, 0), (line->>3)::numeric / 100, (line->>4)::numeric / 100,
      (line->>5)::numeric / 100, 'CAD', (rec->>1)::timestamptz,
      v_import.source_period_start, v_import.source_period_end,
      encode(extensions.digest(convert_to(v_import.source_sha256 || ':' || (line->>7), 'UTF8'), 'sha256'), 'hex'),
      jsonb_build_object('kind', line->>6, 'receipt_source', rec->>3, 'journal_import', v_import.id)
    FROM receipts
    CROSS JOIN LATERAL jsonb_array_elements(rec->4) AS line
    LEFT JOIN customers c ON c.external_id = rec->>0
    LEFT JOIN departments d ON d.product_code = line->>0
    ON CONFLICT (tenant_id, source, source_fingerprint) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.ideal_journal_finish(p_batch_id text, p_write_annual_totals boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
  v_head jsonb; v_import public.customer_intelligence_imports%ROWTYPE;
  v_lines bigint; v_cents numeric; v_receipts bigint; v_customers bigint; v_matched bigint;
  v_summary uuid; v_rows bigint := 0; v_result jsonb;
BEGIN
  v_head := public.ideal_journal_header(p_batch_id);
  SELECT * INTO v_import FROM public.customer_intelligence_imports
  WHERE source = 'ideal' AND report_type = 'journal' AND source_sha256 = v_head->>'sha256'
    AND reconciliation->>'staging_batch' = p_batch_id;
  IF v_import.id IS NULL OR v_import.status <> 'processing' THEN RAISE EXCEPTION 'No open journal import for this batch'; END IF;

  SELECT count(*), coalesce(round(sum(net_amount) * 100), 0), count(DISTINCT external_transaction_id),
         count(DISTINCT external_customer_code), count(DISTINCT external_customer_code) FILTER (WHERE customer_id IS NOT NULL)
    INTO v_lines, v_cents, v_receipts, v_customers, v_matched
  FROM public.customer_purchase_line_items WHERE import_id = v_import.id;

  IF v_lines <> (v_head->>'lines')::bigint OR v_cents <> (v_head->>'net_cents')::numeric THEN
    RAISE EXCEPTION 'Journal lines do not reconcile: % lines / % cents, expected % / %', v_lines, v_cents, v_head->>'lines', v_head->>'net_cents';
  END IF;
  IF v_receipts > (v_head->>'receipts')::bigint OR v_customers <> (v_head->>'customers')::bigint THEN
    RAISE EXCEPTION 'Journal receipts or customers do not reconcile';
  END IF;

  IF p_write_annual_totals THEN
    INSERT INTO public.customer_intelligence_imports(
      tenant_id, source, report_type, source_filename, source_period_start, source_period_end,
      source_sha256, status, source_row_count, reconciliation, started_at)
    VALUES (v_import.tenant_id, 'ideal', 'customer_sales_summary', v_import.source_filename,
      v_import.source_period_start, v_import.source_period_end, v_import.source_sha256, 'processing', v_lines,
      jsonb_build_object('basis', 'Annual customer-product totals built from the dated journal receipts',
        'evidence_kind', 'annual product totals from dated journal receipts', 'journal_import_id', v_import.id), now())
    RETURNING id INTO v_summary;

    WITH per_item AS (
      SELECT li.customer_id, li.external_customer_code,
             coalesce(li.product_code, '') AS code, li.product_name AS name, coalesce(max(li.department), '') AS dept,
             sum(li.quantity) AS qty, round(sum(li.net_amount), 2) AS amount,
             min((split_part(li.external_line_id, ':', 2))::int + 100000 * (regexp_replace(split_part(li.external_line_id, ':', 1), '\D', '', 'g'))::int) AS row_no
      FROM public.customer_purchase_line_items li
      WHERE li.import_id = v_import.id AND li.customer_id IS NOT NULL
      GROUP BY 1, 2, 3, 4
    ), per_customer AS (
      SELECT customer_id, external_customer_code,
             jsonb_agg(jsonb_build_array(code, name, dept, qty, amount, row_no) ORDER BY dept, code, name) AS items
      FROM per_item GROUP BY 1, 2
    ), ins AS (
      INSERT INTO public.customer_intelligence_source_events(
        tenant_id, customer_id, import_id, source, event_type, external_customer_code, amount, source_fingerprint, raw_data)
      SELECT v_import.tenant_id, customer_id, v_summary, 'ideal', 'purchase_summary', external_customer_code,
        (SELECT round(sum((i->>4)::numeric), 2) FROM jsonb_array_elements(items) i),
        encode(extensions.digest(convert_to(v_import.source_sha256 || ':summary:' || external_customer_code, 'UTF8'), 'sha256'), 'hex'),
        jsonb_build_object('kind', 'purchase_summary', 'currency', 'CAD',
          'period_start', v_import.source_period_start::text, 'period_end', v_import.source_period_end::text,
          'source_sha256', v_import.source_sha256, 'items', items,
          'source_row_numbering', 'sheet number x 100000 + first source row of the product')
      FROM per_customer
      RETURNING 1
    ) SELECT count(*) INTO v_rows FROM ins;

    UPDATE public.customer_intelligence_imports SET status = 'completed', completed_at = now(),
      accepted_row_count = v_rows, duplicate_row_count = 0, rejected_row_count = v_customers - v_matched,
      reconciliation = reconciliation || jsonb_build_object('customers', v_rows,
        'cents', (SELECT round(sum(amount) * 100) FROM public.customer_intelligence_source_events WHERE import_id = v_summary))
    WHERE id = v_summary;
  END IF;

  v_result := jsonb_build_object('lines', v_lines, 'net_cents', v_cents, 'receipts', v_receipts,
    'customers', v_customers, 'matched_customers', v_matched, 'annual_totals_import', v_summary, 'annual_total_rows', v_rows);
  UPDATE public.customer_intelligence_imports SET status = 'completed', completed_at = now(),
    accepted_row_count = v_receipts, duplicate_row_count = 0, rejected_row_count = 0,
    reconciliation = reconciliation || jsonb_build_object('applied', v_result)
  WHERE id = v_import.id;
  DELETE FROM public.ideal_journal_staging WHERE batch_id = p_batch_id;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.ideal_journal_header(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_product_departments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_open_import(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_apply_chunk(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_finish(text, boolean) FROM PUBLIC, anon, authenticated;
