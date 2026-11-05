-- Journal receipts read product departments from a prebuilt map; the per-chunk
-- lookup re-read every report row and timed out.

-- Department label for each product code, taken from the newest reconciled
-- report that lists it. Built once per company before applying receipts, so
-- every chunk does not re-read every report row.
CREATE TABLE IF NOT EXISTS public.ideal_product_department_map (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  department text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, product_code)
);
ALTER TABLE public.ideal_product_department_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ideal_product_department_map FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ideal_build_department_map(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.ideal_product_department_map WHERE tenant_id = p_tenant_id;
  INSERT INTO public.ideal_product_department_map(tenant_id, product_code, department)
  SELECT DISTINCT ON (item->>0) p_tenant_id, item->>0, item->>2
  FROM (
    SELECT id, source_period_end, completed_at FROM public.customer_intelligence_imports
    WHERE tenant_id = p_tenant_id AND source = 'ideal' AND report_type = 'customer_sales_summary'
      AND status = 'completed' AND coalesce(reconciliation->>'evidence_kind', '') NOT LIKE '%journal%'
  ) i
  JOIN public.customer_intelligence_source_events e ON e.import_id = i.id AND e.event_type = 'purchase_summary'
  CROSS JOIN LATERAL jsonb_array_elements(e.raw_data->'items') AS item
  WHERE coalesce(item->>0, '') <> '' AND coalesce(item->>2, '') <> ''
  ORDER BY item->>0, i.source_period_end DESC, i.completed_at DESC;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
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

DROP FUNCTION IF EXISTS public.ideal_product_departments(uuid);
REVOKE ALL ON FUNCTION public.ideal_build_department_map(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ideal_journal_apply_chunk(text, integer) FROM PUBLIC, anon, authenticated;
