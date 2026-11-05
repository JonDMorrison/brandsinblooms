-- Bound the input BEFORE inspecting JSON. Authenticated RLS plans cannot
-- necessarily push substring predicates into the existing trigram index.
-- No policy, authority, source data or existing RPC is changed.
-- Existing (tenant,id) keyset indexes omit cutoff/location columns, causing
-- random heap reads on cold pages. Cover the predicates and RLS location input.
CREATE INDEX IF NOT EXISTS crm_customers_bloom_population_page_idx
  ON public.crm_customers(tenant_id,id) INCLUDE(created_at,primary_location_id)
  WHERE deleted_at IS NULL AND merged_into_customer_id IS NULL;

CREATE FUNCTION public.bloom_summary_search_page(
  p_tenant_id uuid, p_import_id uuid, p_cutoff timestamptz,
  p_after uuid, p_term text
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH page AS MATERIALIZED (
    SELECT e.id,e.tenant_id,e.customer_id,e.external_customer_code,e.import_id,e.source,e.created_at,e.raw_data
    FROM public.customer_intelligence_source_events e
    WHERE e.tenant_id=p_tenant_id AND e.import_id=p_import_id
      AND e.source='ideal' AND e.event_type='purchase_summary'
      AND e.created_at<=p_cutoff
      -- Keep an indexable range even if PostgreSQL chooses a generic plan.
      -- The second predicate excludes only the previous boundary row.
      AND e.id>=coalesce(p_after,'00000000-0000-0000-0000-000000000000'::uuid)
      AND (p_after IS NULL OR e.id<>p_after)
    ORDER BY e.id LIMIT 250
  ), candidates AS (
    SELECT jsonb_build_object('id',e.id,'tenant_id',e.tenant_id,'customer_id',e.customer_id,
      'external_customer_code',e.external_customer_code,'import_id',e.import_id,'source',e.source,
      'created_at',e.created_at,'raw_data',(e.raw_data-'items')||jsonb_build_object('items',m.items),
      'item_indexes',m.idx) AS value,e.id
    FROM page e CROSS JOIN LATERAL (
      SELECT jsonb_agg(i.item ORDER BY i.ord) AS items,jsonb_agg((i.ord-1)::int ORDER BY i.ord) AS idx
      FROM jsonb_array_elements(e.raw_data->'items') WITH ORDINALITY AS i(item,ord)
      WHERE (btrim(coalesce(i.item->>0,''))='' AND btrim(coalesce(i.item->>1,''))='')
        OR strpos(lower(concat_ws(' ',i.item->>0,i.item->>1,i.item->>2)),lower(p_term))>0
    ) m WHERE m.items IS NOT NULL AND length(p_term)>0
  ) SELECT jsonb_build_object(
    'scanned',(SELECT count(*) FROM page),
    'last_id',(SELECT id FROM page ORDER BY id DESC LIMIT 1),
    'provenance',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'tenant_id',tenant_id,
      'import_id',import_id,'source',source,'created_at',created_at,'raw_data',jsonb_build_object(
        'period_start',raw_data->'period_start','period_end',raw_data->'period_end','source_sha256',raw_data->'source_sha256')) ORDER BY id) FROM page),'[]'::jsonb),
    'customer_ids',coalesce((SELECT jsonb_agg(DISTINCT customer_id) FROM page WHERE customer_id IS NOT NULL),'[]'::jsonb),
    'candidates',coalesce((SELECT jsonb_agg(value ORDER BY id) FROM candidates),'[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.bloom_summary_search_page(uuid,uuid,timestamptz,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bloom_summary_search_page(uuid,uuid,timestamptz,uuid,text) TO authenticated,service_role;
