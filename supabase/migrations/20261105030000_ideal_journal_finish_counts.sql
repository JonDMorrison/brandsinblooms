-- Customers whose receipts carried no sales lines are not stored; compare as an upper bound.

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
  -- Receipts and customers whose only lines were zero-value or excluded carry no lines, so stored counts may be lower.
  IF v_receipts > (v_head->>'receipts')::bigint OR v_customers > (v_head->>'customers')::bigint THEN
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

REVOKE ALL ON FUNCTION public.ideal_journal_finish(text, boolean) FROM PUBLIC, anon, authenticated;
