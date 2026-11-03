-- Fast company-wide product search for Bloom ("who bought sea soil").
--
-- The search used to page every customer and every imported report row
-- (30 MB for West Coast Gardens) through the API on each question, and
-- re-hash the reconciled October snapshot each time. Large companies timed out.
--
-- These read-only helpers run as the caller (SECURITY INVOKER), so row level
-- security still decides what each user can see. They only narrow what is
-- returned; every returned row is still validated and matched exactly in the
-- edge function. Nothing here changes customer or import data.

-- 1. Live customer IDs in one call instead of one request per 1,000 customers.
CREATE OR REPLACE FUNCTION public.bloom_live_customer_ids(
  p_tenant_id uuid,
  p_cutoff timestamptz
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(c.id ORDER BY c.id), '{}'::uuid[])
  FROM public.crm_customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND c.merged_into_customer_id IS NULL
    AND c.created_at <= p_cutoff;
$$;

-- 2. Which customers have product report evidence, and whether any report row
--    disagrees with its completed import ledger. Customers with evidence but no
--    matching product are "did not buy it" rather than "unknown".
--    p_imports: [{id, sha, start, end, legacy}] for the active report imports.
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
  WITH imp AS (
    SELECT (x->>'id')::uuid AS id,
           x->>'sha' AS sha,
           x->>'start' AS period_start,
           x->>'end' AS period_end,
           coalesce((x->>'legacy')::boolean, false) AS legacy
    FROM jsonb_array_elements(p_imports) AS x
  ),
  ev AS (
    SELECT e.customer_id, e.raw_data, imp.sha, imp.period_start, imp.period_end, imp.legacy
    FROM public.customer_intelligence_source_events e
    JOIN imp ON imp.id = e.import_id
    WHERE e.tenant_id = p_tenant_id
      AND e.source = 'ideal'
      AND e.event_type = 'purchase_summary'
      AND e.created_at <= p_cutoff
  )
  SELECT jsonb_build_object(
    'customer_ids', coalesce((SELECT jsonb_agg(DISTINCT ev.customer_id) FROM ev WHERE ev.customer_id IS NOT NULL), '[]'::jsonb),
    'rows', (SELECT count(*) FROM ev),
    'invalid_rows', (
      SELECT count(*) FROM ev
      WHERE ev.raw_data->>'kind' IS DISTINCT FROM 'purchase_summary'
         OR jsonb_typeof(ev.raw_data->'items') IS DISTINCT FROM 'array'
         OR ev.raw_data->>'period_start' IS DISTINCT FROM ev.period_start
         OR ev.raw_data->>'period_end' IS DISTINCT FROM ev.period_end
         OR (NOT ev.legacy AND ev.raw_data->>'source_sha256' IS DISTINCT FROM ev.sha)
    )
  );
$$;

-- 3. Report rows that could match the search, with only their candidate
--    product lines (and each line's original position, so evidence IDs stay
--    stable). Terms are lower-case ASCII; the edge function decides the exact
--    match. Lines with no name and no code are always returned because they
--    make a customer "unknown" rather than "did not buy".
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
       OR EXISTS (
         SELECT 1 FROM unnest(p_terms) AS t(term)
         WHERE strpos(lower(concat_ws(' ', i.item->>0, i.item->>1, i.item->>2)), t.term) > 0
       )
  ) m
  WHERE e.tenant_id = p_tenant_id
    AND e.source = 'ideal'
    AND e.event_type = 'purchase_summary'
    AND e.import_id = ANY (p_import_ids)
    AND e.created_at <= p_cutoff
    AND jsonb_typeof(e.raw_data->'items') = 'array'
    -- Cheap whole-row pre-check before expanding product lines.
    AND (
      EXISTS (SELECT 1 FROM unnest(p_terms) AS t(term) WHERE strpos(lower(e.raw_data->>'items'), t.term) > 0)
      OR (e.raw_data->>'items') ~ '\["(\s|\\[tnr])*", "(\s|\\[tnr])*",'
    )
    AND m.items IS NOT NULL;
$$;

-- 4. A fingerprint of a whole report import plus the customer identities it is
--    reconciled against. When it equals the fingerprint recorded after a full
--    verification, the snapshot is byte-for-byte what was verified, so the
--    expensive re-verification can be skipped.
CREATE OR REPLACE FUNCTION public.customer_intelligence_summary_fingerprint(
  p_tenant_id uuid,
  p_import_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH codes AS (
    -- How many live customers share each code (must stay exactly one).
    SELECT d.external_id, count(*) AS n
    FROM public.crm_customers d
    WHERE d.tenant_id = p_tenant_id
      AND d.external_id IS NOT NULL
      AND d.deleted_at IS NULL
      AND d.merged_into_customer_id IS NULL
    GROUP BY d.external_id
  )
  SELECT count(*)::text || ':' || coalesce(md5(string_agg(
    jsonb_build_array(
      e.id, e.tenant_id, e.customer_id, e.external_customer_code, e.import_id,
      e.source, e.event_type, e.created_at, e.raw_data,
      c.external_id,
      (c.id IS NOT NULL AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL),
      coalesce(k.n, 0)
    )::text, chr(30) ORDER BY e.id)), '')
  FROM public.customer_intelligence_source_events e
  LEFT JOIN public.crm_customers c ON c.id = e.customer_id AND c.tenant_id = e.tenant_id
  LEFT JOIN codes k ON k.external_id = e.external_customer_code
  WHERE e.tenant_id = p_tenant_id
    AND e.import_id = p_import_id;
$$;

-- Fingerprints recorded only by the edge function (service role) after a full
-- verification succeeded. Not readable or writable by app users.
CREATE TABLE IF NOT EXISTS public.customer_intelligence_verified_summaries (
  import_id uuid PRIMARY KEY REFERENCES public.customer_intelligence_imports(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  fingerprint text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_intelligence_verified_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_intelligence_verified_summaries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_intelligence_verified_summaries TO service_role;

REVOKE ALL ON FUNCTION public.bloom_live_customer_ids(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bloom_summary_evidence_scope(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bloom_summary_product_candidates(uuid, uuid[], text[], timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_intelligence_summary_fingerprint(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bloom_live_customer_ids(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bloom_summary_evidence_scope(uuid, jsonb, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bloom_summary_product_candidates(uuid, uuid[], text[], timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_intelligence_summary_fingerprint(uuid, uuid) TO authenticated, service_role;
