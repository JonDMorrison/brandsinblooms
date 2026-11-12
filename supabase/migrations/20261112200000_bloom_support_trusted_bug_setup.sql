-- Narrow administrator setup; no new role, credential, release approval or hold bypass.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE OR REPLACE FUNCTION public.bloom_support_configure_trusted_bug(
  p_actor uuid, p_issue_id uuid, p_github_issue integer, p_ticket_ids uuid[], p_expected_policy jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e bloom_support.engineering_issues;
  previous jsonb;
  updated jsonb;
  linked uuid[];
  paths jsonb;
  path text;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.policy');
  IF NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id = p_actor AND active AND kind = 'user')
     OR bloom_support.principal_role(p_actor) = 'service' THEN
    RAISE EXCEPTION 'forbidden: a signed-in administrator must configure verification' USING ERRCODE = '42501';
  END IF;
  IF p_expected_policy IS NULL OR jsonb_typeof(p_expected_policy) <> 'object'
     OR p_github_issue IS NULL OR p_github_issue < 1 OR p_ticket_ids IS NULL
     OR cardinality(p_ticket_ids) NOT BETWEEN 1 AND 50
     OR EXISTS (SELECT 1 FROM unnest(p_ticket_ids) t WHERE t IS NULL)
     OR cardinality(p_ticket_ids) <> (SELECT count(DISTINCT t) FROM unnest(p_ticket_ids) t) THEN
    RAISE EXCEPTION 'invalid: exact issue and ticket bindings are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF e.repository IS DISTINCT FROM 'JonDMorrison/brandsinblooms' OR e.product IS DISTINCT FROM 'crm'
     OR e.status IN ('verified','closed','merging','merged','deploying','deployed','verifying','rolled_back')
     OR e.evidence->'github_issue'->'number' IS DISTINCT FROM to_jsonb(p_github_issue) THEN
    RAISE EXCEPTION 'invalid: expected active CRM issue and recorded GitHub issue' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM bloom_support.tickets WHERE engineering_issue_id = e.id ORDER BY id FOR UPDATE;
  SELECT array_agg(id ORDER BY id) INTO linked FROM bloom_support.tickets WHERE engineering_issue_id = e.id;
  IF linked IS DISTINCT FROM (SELECT array_agg(t ORDER BY t) FROM unnest(p_ticket_ids) t) THEN
    RAISE EXCEPTION 'conflict: linked ticket set changed' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bloom_support.tickets t LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
    WHERE t.engineering_issue_id = e.id AND (
      t.kind NOT IN ('bug','incident') OR t.product <> 'crm' OR t.feature_request_id IS NOT NULL
      OR t.status = 'resolved' OR t.merged_into IS NOT NULL OR t.spam OR t.redacted_at IS NOT NULL
      OR t.automation <> 'auto' OR t.executor <> 'bloom' OR coalesce(a.automation_paused,false) OR a.merged_into IS NOT NULL
      OR t.context->>'page_url' IS DISTINCT FROM 'https://bloomsuite.app/support/contact'
    )
  ) THEN RAISE EXCEPTION 'blocked: tickets must be unheld CRM bugs for the exact public contact flow' USING ERRCODE = '22023'; END IF;
  SELECT value INTO previous FROM bloom_support.settings WHERE key = 'release_policy' FOR UPDATE;
  IF previous IS DISTINCT FROM p_expected_policy THEN
    RAISE EXCEPTION 'conflict: release policy changed; reload and review again' USING ERRCODE = '40001';
  END IF;
  IF jsonb_typeof(previous) IS DISTINCT FROM 'object' OR jsonb_typeof(previous->'approvedPaths') IS DISTINCT FROM 'object'
     OR jsonb_typeof(previous->'approvedPaths'->'JonDMorrison/brandsinblooms') IS DISTINCT FROM 'array'
     OR (previous ? 'trustedReproductionIssues' AND jsonb_typeof(previous->'trustedReproductionIssues') <> 'object') THEN
    RAISE EXCEPTION 'invalid: existing policy has no compatible CRM path configuration' USING ERRCODE = '22023';
  END IF;
  paths := previous->'approvedPaths'->'JonDMorrison/brandsinblooms';
  FOREACH path IN ARRAY ARRAY['src/lib/bloomSupport/constants.ts','src/lib/bloomSupport/constants.test.ts'] LOOP
    IF NOT paths @> jsonb_build_array(path) THEN paths := paths || jsonb_build_array(path); END IF;
  END LOOP;
  updated := jsonb_set(previous, ARRAY['approvedPaths','JonDMorrison/brandsinblooms'], paths);
  updated := jsonb_set(updated, ARRAY['trustedReproductionIssues'], coalesce(previous->'trustedReproductionIssues','{}'::jsonb) ||
    jsonb_build_object(e.id::text, jsonb_build_object('recipe','public-support-attachment-name-v1','github_issue',p_github_issue,'ticket_ids',to_jsonb(linked))));
  IF updated IS DISTINCT FROM previous THEN
    UPDATE bloom_support.settings SET value = updated, updated_by = p_actor, updated_at = now() WHERE key = 'release_policy';
    PERFORM bloom_support.log(NULL,NULL,p_actor,'setting.trusted_bug_configured',jsonb_build_object(
      'engineering_issue_id',e.id,'github_issue',p_github_issue,'ticket_ids',to_jsonb(linked),'recipe','public-support-attachment-name-v1'));
  END IF;
  RETURN jsonb_build_object('configured',true,'issue_id',e.id,'release_policy',updated);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_configure_trusted_bug(uuid,uuid,integer,uuid[],jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_configure_trusted_bug(uuid,uuid,integer,uuid[],jsonb) TO service_role;
