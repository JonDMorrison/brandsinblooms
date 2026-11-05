-- Annual product totals from journal receipts are written in customer batches.
-- One statement for a whole year updated the report search index for every
-- row at once and ran past the statement limit. Lines are also indexed by
-- import so each batch reads only its own journal year.

CREATE INDEX IF NOT EXISTS customer_purchase_line_items_import_idx
  ON public.customer_purchase_line_items (import_id, customer_id);

CREATE OR REPLACE FUNCTION public.ideal_journal_write_annual_totals(p_journal_import uuid, p_part integer, p_parts integer)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_journal public.customer_intelligence_imports%ROWTYPE; v_summary uuid; v_rows integer;
BEGIN
  SELECT * INTO v_journal FROM public.customer_intelligence_imports
  WHERE id = p_journal_import AND source = 'ideal' AND report_type = 'journal' AND status = 'completed';
  IF v_journal.id IS NULL THEN RAISE EXCEPTION 'Finish the journal import before writing annual totals'; END IF;
  IF p_parts < 1 OR p_part < 0 OR p_part >= p_parts THEN RAISE EXCEPTION 'Invalid batch'; END IF;

  INSERT INTO public.customer_intelligence_imports(
    tenant_id, source, report_type, source_filename, source_period_start, source_period_end,
    source_sha256, status, source_row_count, reconciliation, started_at)
  VALUES (v_journal.tenant_id, 'ideal', 'customer_sales_summary', v_journal.source_filename,
    v_journal.source_period_start, v_journal.source_period_end, v_journal.source_sha256, 'processing',
    (v_journal.reconciliation->'applied'->>'lines')::int,
    jsonb_build_object('basis', 'Annual customer-product totals built from the dated journal receipts',
      'evidence_kind', 'annual product totals from dated journal receipts', 'journal_import_id', v_journal.id), now())
  ON CONFLICT (tenant_id, source, report_type, source_sha256) DO NOTHING;
  SELECT id INTO v_summary FROM public.customer_intelligence_imports
  WHERE tenant_id = v_journal.tenant_id AND source = 'ideal' AND report_type = 'customer_sales_summary'
    AND source_sha256 = v_journal.source_sha256 AND status = 'processing';
  IF v_summary IS NULL THEN RAISE EXCEPTION 'Annual totals for this journal are already complete'; END IF;

  WITH per_item AS (
    SELECT li.customer_id, li.external_customer_code,
           coalesce(li.product_code, '') AS code, li.product_name AS name, coalesce(max(li.department), '') AS dept,
           sum(li.quantity) AS qty, round(sum(li.net_amount), 2) AS amount,
           min((split_part(li.external_line_id, ':', 2))::int + 100000 * (regexp_replace(split_part(li.external_line_id, ':', 1), '\D', '', 'g'))::int) AS row_no
    FROM public.customer_purchase_line_items li
    WHERE li.import_id = v_journal.id AND li.customer_id IS NOT NULL
      AND mod(abs(hashtext(li.external_customer_code)), p_parts) = p_part
    GROUP BY 1, 2, 3, 4
  ), per_customer AS (
    SELECT customer_id, external_customer_code,
           jsonb_agg(jsonb_build_array(code, name, dept, qty, amount, row_no) ORDER BY dept, code, name) AS items
    FROM per_item GROUP BY 1, 2
  ), ins AS (
    INSERT INTO public.customer_intelligence_source_events(
      tenant_id, customer_id, import_id, source, event_type, external_customer_code, amount, source_fingerprint, raw_data)
    SELECT v_journal.tenant_id, customer_id, v_summary, 'ideal', 'purchase_summary', external_customer_code,
      (SELECT round(sum((i->>4)::numeric), 2) FROM jsonb_array_elements(items) i),
      encode(extensions.digest(convert_to(v_journal.source_sha256 || ':summary:' || external_customer_code, 'UTF8'), 'sha256'), 'hex'),
      jsonb_build_object('kind', 'purchase_summary', 'currency', 'CAD',
        'period_start', v_journal.source_period_start::text, 'period_end', v_journal.source_period_end::text,
        'source_sha256', v_journal.source_sha256, 'items', items,
        'source_row_numbering', 'sheet number x 100000 + first source row of the product')
    FROM per_customer
    ON CONFLICT (tenant_id, source, source_fingerprint) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_rows FROM ins;
  RETURN v_rows;
END $$;

-- Completes the annual totals only when every matched customer and cent of the journal is present.
CREATE OR REPLACE FUNCTION public.ideal_journal_complete_annual_totals(p_journal_import uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_journal public.customer_intelligence_imports%ROWTYPE; v_summary uuid;
  v_expected_customers bigint; v_expected_cents numeric; v_rows bigint; v_cents numeric;
BEGIN
  SELECT * INTO v_journal FROM public.customer_intelligence_imports
  WHERE id = p_journal_import AND source = 'ideal' AND report_type = 'journal' AND status = 'completed';
  SELECT id INTO v_summary FROM public.customer_intelligence_imports
  WHERE tenant_id = v_journal.tenant_id AND source = 'ideal' AND report_type = 'customer_sales_summary'
    AND source_sha256 = v_journal.source_sha256 AND status = 'processing';
  IF v_summary IS NULL THEN RAISE EXCEPTION 'No open annual totals for this journal'; END IF;
  SELECT count(DISTINCT external_customer_code), round(sum(net_amount) * 100)
    INTO v_expected_customers, v_expected_cents
  FROM public.customer_purchase_line_items WHERE import_id = v_journal.id AND customer_id IS NOT NULL;
  SELECT count(*), round(sum(amount) * 100) INTO v_rows, v_cents
  FROM public.customer_intelligence_source_events WHERE import_id = v_summary;
  IF v_rows <> v_expected_customers OR v_cents <> v_expected_cents THEN
    RAISE EXCEPTION 'Annual totals do not reconcile: % customers / % cents, expected % / %', v_rows, v_cents, v_expected_customers, v_expected_cents;
  END IF;
  UPDATE public.customer_intelligence_imports SET status = 'completed', completed_at = now(),
    accepted_row_count = v_rows, duplicate_row_count = 0, rejected_row_count = 0,
    reconciliation = reconciliation || jsonb_build_object('customers', v_rows, 'cents', v_cents)
  WHERE id = v_summary;
  RETURN jsonb_build_object('import_id', v_summary, 'customers', v_rows, 'cents', v_cents);
END $$;

REVOKE ALL ON FUNCTION public.ideal_journal_write_annual_totals(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_complete_annual_totals(uuid) FROM PUBLIC, anon, authenticated;
