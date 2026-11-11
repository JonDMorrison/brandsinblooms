-- Make Bloom's product search read only the report rows that contain the term.
--
-- The search helpers decompressed every imported report row (21 MB of product
-- lines for West Coast Gardens) on each question. With a cold cache that ran
-- past the 8 second statement limit ("Top 50 Tropical shoppers").
--
-- 1. A trigram index on the report rows' product lines, so the candidate
--    search is index driven.
-- 2. The evidence scope no longer re-reads every row: each report import is
--    validated once by the edge function and re-validated whenever its
--    fingerprint changes (customer_intelligence_verified_summaries).
-- 3. An index for looking customers up by code within a company.

CREATE INDEX IF NOT EXISTS customer_intelligence_summary_items_trgm_idx
  ON public.customer_intelligence_source_events
  USING gin (lower(raw_data->>'items') public.gin_trgm_ops)
  WHERE event_type = 'purchase_summary';

CREATE INDEX IF NOT EXISTS crm_customers_tenant_external_id_lookup_idx
  ON public.crm_customers (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- Candidate lines for one lower-case ASCII term. The edge function still
-- decides the exact match.
CREATE OR REPLACE FUNCTION public.bloom_summary_product_candidates(
  p_tenant_id uuid,
  p_import_ids uuid[],
  p_terms text[],
  p_cutoff timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'tenant_id', e.tenant_id,
      'customer_id', e.customer_id,
      'external_customer_code', e.external_customer_code,
      'import_id', e.import_id,
      'source', e.source,
      'created_at', e.created_at,
      'raw_data', (e.raw_data - 'items') || jsonb_build_object('items', m.items),
      'item_indexes', m.idx
    ) ORDER BY e.id), '[]'::jsonb)
  FROM public.customer_intelligence_source_events e
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(i.item ORDER BY i.ord) AS items,
           jsonb_agg((i.ord - 1)::int ORDER BY i.ord) AS idx
    FROM jsonb_array_elements(e.raw_data->'items') WITH ORDINALITY AS i(item, ord)
    WHERE (coalesce(i.item->>0, '') ~ '^\s*$' AND coalesce(i.item->>1, '') ~ '^\s*$')
       OR strpos(lower(concat_ws(' ', i.item->>0, i.item->>1, i.item->>2)), lower(p_terms[1])) > 0
  ) m
  WHERE e.event_type = 'purchase_summary'
    AND e.tenant_id = p_tenant_id
    AND e.source = 'ideal'
    AND e.import_id = ANY (p_import_ids)
    AND e.created_at <= p_cutoff
    AND cardinality(p_terms) = 1
    AND length(p_terms[1]) > 0
    -- Trigram index: only rows whose product lines contain the term. Imports
    -- with blank product lines are never searched this way (the edge function
    -- verifies that once per import and falls back to the full scan).
    AND lower(e.raw_data->>'items') LIKE '%' || replace(replace(replace(lower(p_terms[1]), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    AND m.items IS NOT NULL;
$$;

-- Customers with report evidence, read from columns only (no row contents).
-- Row contents are validated per import by the edge function and cached by fingerprint.
CREATE OR REPLACE FUNCTION public.bloom_summary_evidence_scope(
  p_tenant_id uuid,
  p_imports jsonb,
  p_cutoff timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH ev AS (
    SELECT e.customer_id
    FROM public.customer_intelligence_source_events e
    WHERE e.tenant_id = p_tenant_id
      AND e.import_id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_imports) AS x)
      AND e.source = 'ideal'
      AND e.event_type = 'purchase_summary'
      AND e.created_at <= p_cutoff
  )
  SELECT jsonb_build_object(
    'customer_ids', coalesce((SELECT jsonb_agg(DISTINCT ev.customer_id) FROM ev WHERE ev.customer_id IS NOT NULL), '[]'::jsonb),
    'rows', (SELECT count(*) FROM ev),
    'invalid_rows', 0
  );
$$;
