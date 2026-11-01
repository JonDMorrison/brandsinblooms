-- Staff review controls the same knowledge used by the public help centre and Bloom.
-- No ticket, account, requester, approval identity or internal article is public.
CREATE OR REPLACE FUNCTION public.bloom_support_public_knowledge(p_product text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'product', k.product,
    'title', k.title, 'body', k.body, 'updated_at', k.updated_at) ORDER BY k.title), '[]'::jsonb)
  FROM (SELECT id, product, title, body, updated_at FROM bloom_support.knowledge
    WHERE approved AND audience = 'client'
      AND (p_product IS NULL OR product IN (p_product, 'platform'))
    ORDER BY title LIMIT 100) k
$$;
REVOKE ALL ON FUNCTION public.bloom_support_public_knowledge(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_public_knowledge(text) TO service_role;

CREATE OR REPLACE FUNCTION bloom_support.upsert_knowledge(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k bloom_support.knowledge;
  can_approve boolean := bloom_support.has_permission(p_actor, 'admin.policy') OR bloom_support.principal_role(p_actor) = 'platform_operator';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF NOT bloom_support.is_staff(p_actor) THEN
    RAISE EXCEPTION 'forbidden: only staff may author knowledge' USING ERRCODE = '42501';
  END IF;
  IF p->>'id' IS NOT NULL THEN
    SELECT * INTO k FROM bloom_support.knowledge WHERE id = (p->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found: article' USING ERRCODE = 'P0002'; END IF;
    IF p ? 'expected_updated_at' AND k.updated_at IS DISTINCT FROM (p->>'expected_updated_at')::timestamptz THEN
      RAISE EXCEPTION 'conflict: article changed; reload and review the latest version' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF length(btrim(coalesce(p->>'title', k.title, ''))) NOT BETWEEN 1 AND 200
     OR length(btrim(coalesce(p->>'body', k.body, ''))) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'invalid: title (1-200 characters) and answer (1-20000 characters) are required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p->>'product', k.product, '') NOT IN ('cms','crm','pos','platform')
     OR coalesce(p->>'audience', k.audience, 'internal') NOT IN ('client','internal') THEN
    RAISE EXCEPTION 'invalid: product or audience' USING ERRCODE = '22023';
  END IF;
  IF k.id IS NULL THEN
    INSERT INTO bloom_support.knowledge(product, title, body, audience, approved, approved_by)
    VALUES (p->>'product', p->>'title', p->>'body', coalesce(p->>'audience', 'internal'),
      can_approve AND coalesce((p->>'approved')::boolean, false),
      CASE WHEN can_approve AND coalesce((p->>'approved')::boolean, false) THEN p_actor END)
    RETURNING * INTO k;
  ELSE
    UPDATE bloom_support.knowledge SET title = coalesce(p->>'title', title), body = coalesce(p->>'body', body),
      product = coalesce(p->>'product', product), audience = coalesce(p->>'audience', audience),
      approved = can_approve AND coalesce((p->>'approved')::boolean, false),
      approved_by = CASE WHEN can_approve AND coalesce((p->>'approved')::boolean, false) THEN p_actor END,
      updated_at = clock_timestamp()
    WHERE id = k.id RETURNING * INTO k;
  END IF;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'knowledge.saved', jsonb_build_object('id', k.id, 'approved', k.approved));
  RETURN to_jsonb(k) - 'search';
END $$;

-- Natural questions rarely share every word with an article. Retrieve bounded
-- OR candidates, rank exact matches first, and let the existing grounded answer
-- step refuse answers that the approved articles do not establish.
CREATE OR REPLACE FUNCTION bloom_support.search_knowledge(p_product text, p_q text, p_limit int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE exact_query tsquery := websearch_to_tsquery('english', left(coalesce(p_q, ''), 2000));
  broad_query tsquery; term_query tsquery; term text;
BEGIN
  FOR term IN SELECT unnest(tsvector_to_array(to_tsvector('english', left(coalesce(p_q, ''), 2000)))) LIMIT 64 LOOP
    term_query := plainto_tsquery('english', term);
    IF numnode(term_query) > 0 THEN
      broad_query := CASE WHEN broad_query IS NULL THEN term_query ELSE broad_query || term_query END;
    END IF;
  END LOOP;
  IF broad_query IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'body', k.body,
      'product', k.product, 'rank', k.r) ORDER BY k.r DESC, k.title), '[]'::jsonb)
    FROM (SELECT id, title, body, product,
        ts_rank(search, broad_query) + CASE WHEN search @@ exact_query THEN 1 ELSE 0 END AS r
      FROM bloom_support.knowledge WHERE approved AND audience = 'client'
        AND (p_product IS NULL OR product IN (p_product, 'platform')) AND search @@ broad_query
      ORDER BY r DESC, title LIMIT greatest(1, least(coalesce(p_limit, 5), 10))) k);
END $$;

REVOKE ALL ON FUNCTION bloom_support.upsert_knowledge(uuid,jsonb), bloom_support.search_knowledge(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.upsert_knowledge(uuid,jsonb), bloom_support.search_knowledge(text,text,integer) TO service_role;
