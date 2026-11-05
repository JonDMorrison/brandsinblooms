-- pg_cron runs each command under the database's two-minute statement limit,
-- so one CALL cannot process a whole journal year. This stepper does one
-- bounded unit per call and records it, and a cron job calls it each minute.
-- Units: open the import; apply one slice of one staged chunk; finish the
-- year; write one batch of annual totals; complete the annual totals.
CREATE TABLE IF NOT EXISTS public.ideal_journal_progress (
  batch_id text NOT NULL,
  unit text NOT NULL,
  result jsonb,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, unit)
);
ALTER TABLE public.ideal_journal_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_journal_progress FROM PUBLIC, anon, authenticated;

-- One slice of one chunk: receipts whose position in the chunk falls in the slice.
CREATE OR REPLACE FUNCTION public.ideal_journal_apply_slice(p_batch_id text, p_seq integer, p_slice integer, p_slices integer)
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
    WHERE s.batch_id = p_batch_id AND s.seq = p_seq AND r.value LIKE '[%' AND mod(r.n, p_slices) = p_slice
  ), customers AS (
    SELECT external_id, min(id::text)::uuid AS id, count(*) AS n
    FROM public.crm_customers
    WHERE tenant_id = v_import.tenant_id AND deleted_at IS NULL AND merged_into_customer_id IS NULL AND external_id IS NOT NULL
    GROUP BY external_id
  ), departments AS (
    SELECT product_code, department FROM public.ideal_product_department_map WHERE tenant_id = v_import.tenant_id
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

CREATE OR REPLACE FUNCTION public.ideal_journal_next_step(p_batches text[], p_slices integer, p_parts integer)
RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_batch text; v_import uuid; v_seq integer; v_slice integer; v_part integer; v_unit text; v_result jsonb;
  v_has_staging boolean; v_journal_done boolean; v_totals_done boolean;
BEGIN
  FOREACH v_batch IN ARRAY p_batches LOOP
    SELECT id, status = 'completed' INTO v_import, v_journal_done FROM public.customer_intelligence_imports
    WHERE report_type = 'journal' AND reconciliation->>'staging_batch' = v_batch;
    v_has_staging := EXISTS (SELECT 1 FROM public.ideal_journal_staging WHERE batch_id = v_batch);
    IF v_import IS NULL THEN
      IF NOT v_has_staging THEN RAISE EXCEPTION 'Batch % is neither staged nor imported', v_batch; END IF;
      v_import := public.ideal_journal_open_import(v_batch);
      INSERT INTO public.ideal_journal_progress(batch_id, unit) VALUES (v_batch, 'open') ON CONFLICT DO NOTHING;
      RETURN v_batch || ' open';
    END IF;
    IF NOT v_journal_done THEN
      FOR v_seq IN SELECT seq FROM public.ideal_journal_staging WHERE batch_id = v_batch ORDER BY seq LOOP
        FOR v_slice IN 0 .. p_slices - 1 LOOP
          v_unit := format('apply %s/%s of %s', v_seq, v_slice, p_slices);
          IF NOT EXISTS (SELECT 1 FROM public.ideal_journal_progress WHERE batch_id = v_batch AND unit = v_unit) THEN
            v_result := to_jsonb(public.ideal_journal_apply_slice(v_batch, v_seq, v_slice, p_slices));
            INSERT INTO public.ideal_journal_progress(batch_id, unit, result) VALUES (v_batch, v_unit, v_result);
            RETURN v_batch || ' ' || v_unit || ' -> ' || v_result::text;
          END IF;
        END LOOP;
      END LOOP;
      v_result := public.ideal_journal_finish(v_batch, false);
      INSERT INTO public.ideal_journal_progress(batch_id, unit, result) VALUES (v_batch, 'finish', v_result) ON CONFLICT DO NOTHING;
      RETURN v_batch || ' finish -> ' || v_result::text;
    END IF;
    SELECT status = 'completed' INTO v_totals_done FROM public.customer_intelligence_imports
    WHERE report_type = 'customer_sales_summary'
      AND source_sha256 = (SELECT source_sha256 FROM public.customer_intelligence_imports WHERE id = v_import);
    IF coalesce(v_totals_done, false) THEN CONTINUE; END IF;
    FOR v_part IN 0 .. p_parts - 1 LOOP
      v_unit := format('totals %s of %s', v_part, p_parts);
      IF NOT EXISTS (SELECT 1 FROM public.ideal_journal_progress WHERE batch_id = v_batch AND unit = v_unit) THEN
        v_result := to_jsonb(public.ideal_journal_write_annual_totals(v_import, v_part, p_parts));
        INSERT INTO public.ideal_journal_progress(batch_id, unit, result) VALUES (v_batch, v_unit, v_result);
        RETURN v_batch || ' ' || v_unit || ' -> ' || v_result::text;
      END IF;
    END LOOP;
    v_result := public.ideal_journal_complete_annual_totals(v_import);
    INSERT INTO public.ideal_journal_progress(batch_id, unit, result) VALUES (v_batch, 'totals complete', v_result) ON CONFLICT DO NOTHING;
    RETURN v_batch || ' totals complete -> ' || v_result::text;
  END LOOP;
  RETURN 'done';
END $$;

ALTER FUNCTION public.ideal_journal_next_step(text[], integer, integer) SET enable_indexscan = off;
REVOKE ALL ON FUNCTION public.ideal_journal_apply_slice(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_next_step(text[], integer, integer) FROM PUBLIC, anon, authenticated;
DROP PROCEDURE IF EXISTS public.ideal_journal_process(text[], boolean[], integer);
