-- Release verification receives only the linked page selector, never the private ticket.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION public.bloom_support_ticket_flow_context(
  p_actor uuid, p_issue_id uuid, p_head_sha text, p_version integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e bloom_support.engineering_issues;
  projected jsonb;
  tickets_automatic boolean;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.release');
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue_id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p_head_sha IS NULL OR p_head_sha !~ '^[0-9a-f]{40}$' OR p_version IS NULL
     OR e.status <> 'verifying' OR e.version IS DISTINCT FROM p_version
     OR e.head_sha IS DISTINCT FROM p_head_sha THEN
    RAISE EXCEPTION 'conflict: stale verification context' USING ERRCODE = '40001';
  END IF;
  IF (SELECT count(*) FROM bloom_support.tickets WHERE engineering_issue_id = e.id) > 50 THEN
    RAISE EXCEPTION 'invalid: too many linked verification tickets' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'kind', t.kind, 'product', t.product,
    -- Permit only a credential-free HTTPS hostname/path. Discard query/fragment
    -- before projection. All actual fetched URLs still come from release policy.
    'page_url', CASE WHEN NOT t.spam AND t.redacted_at IS NULL
      AND length(t.context->>'page_url') <= 2000
      AND t.context->>'page_url' ~ '^https://[A-Za-z0-9.-]+(/[^?#[:space:]\\]*)?([?#].*)?$'
      THEN split_part(split_part(t.context->>'page_url', '?', 1), '#', 1)
      ELSE NULL END
  ) ORDER BY t.id), '[]'::jsonb) INTO projected
  FROM bloom_support.tickets t WHERE t.engineering_issue_id = e.id;
  SELECT count(*) > 0 AND coalesce(bool_and(
    t.status <> 'resolved' AND t.merged_into IS NULL AND NOT t.spam
    AND t.redacted_at IS NULL AND t.automation = 'auto'
    AND t.executor = 'bloom' AND NOT coalesce(a.automation_paused, false)
    AND a.merged_into IS NULL
  ), false) INTO tickets_automatic
  FROM bloom_support.tickets t LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
  WHERE t.engineering_issue_id = e.id;
  tickets_automatic := tickets_automatic
    AND coalesce(bloom_support.setting('automation_enabled') = 'true'::jsonb, false)
    AND coalesce(bloom_support.setting('auto_release_enabled') = 'true'::jsonb, false)
    AND coalesce(bloom_support.setting('automation_scopes')->'engineering' = 'true'::jsonb, true);
  RETURN jsonb_build_object('issue_id', e.id, 'head_sha', e.head_sha,
    'version', e.version, 'tickets_automatic', tickets_automatic, 'tickets', projected);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_ticket_flow_context(uuid,uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_ticket_flow_context(uuid,uuid,text,integer) TO service_role;
