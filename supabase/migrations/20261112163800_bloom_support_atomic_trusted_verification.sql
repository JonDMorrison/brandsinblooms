-- Close the provider-read -> verified-write hold race for trusted browser proof.
-- This trigger adds no read capability and never accepts a browser report itself.
CREATE OR REPLACE FUNCTION bloom_support.guard_trusted_browser_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request jsonb := OLD.verification->'trusted_browser_request';
  checks jsonb := CASE WHEN jsonb_typeof(NEW.verification->'checks')='array' THEN NEW.verification->'checks' ELSE '[]'::jsonb END;
  ids jsonb; claimed jsonb; assignment jsonb; binding text; started timestamptz; requested timestamptz;
  t bloom_support.tickets; account_row bloom_support.accounts; setting_row bloom_support.settings;
  count_tickets integer := 0; count_settings integer := 0;
BEGIN
  IF NEW.status <> 'verified' OR OLD.status = 'verified' OR
     (request IS NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(checks) c WHERE c ? 'trusted_browser')) THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'verifying' OR NEW.version <> OLD.version + 1 OR
     NEW.pr_number IS DISTINCT FROM OLD.pr_number OR NEW.product IS DISTINCT FROM OLD.product OR
     NEW.evidence->'github_issue' IS DISTINCT FROM OLD.evidence->'github_issue' OR
     NEW.head_sha IS DISTINCT FROM OLD.head_sha OR NEW.merge_sha IS DISTINCT FROM OLD.merge_sha OR
     NEW.deployment IS DISTINCT FROM OLD.deployment OR NEW.repository IS DISTINCT FROM OLD.repository OR
     NEW.repository <> 'JonDMorrison/brandsinblooms' OR NEW.product <> 'crm' OR
     request->>'engineering_issue_id' IS DISTINCT FROM OLD.id::text OR
     request->'issue_version' IS DISTINCT FROM to_jsonb(OLD.version) OR
     request->>'head_sha' IS DISTINCT FROM OLD.head_sha OR request->'pr_number' IS DISTINCT FROM to_jsonb(OLD.pr_number) OR
     request->>'deployed_sha' IS DISTINCT FROM coalesce(OLD.deployment->>'production_sha', OLD.merge_sha) OR
     NEW.verification->>'scope' IS DISTINCT FROM 'ticket_flow' OR NEW.verification->'passed' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'blocked: stale trusted browser verification binding' USING ERRCODE='23514';
  END IF;
  -- Upgrade the issue lock: FOR UPDATE conflicts with the FK KEY SHARE taken
  -- by a new ticket link, closing the phantom-ticket window during this commit.
  -- NOWAIT also rejects a link already in flight instead of deadlocking it.
  PERFORM id FROM bloom_support.engineering_issues WHERE id=OLD.id FOR UPDATE NOWAIT;
  -- Existing callers may acquire ticket/account locks before the issue lock.
  -- NOWAIT fails closed instead of introducing an inverse-order deadlock wait.
  FOR t IN SELECT * FROM bloom_support.tickets WHERE engineering_issue_id=OLD.id ORDER BY id FOR UPDATE NOWAIT LOOP
    count_tickets := count_tickets + 1;
    IF count_tickets>50 OR t.status='resolved' OR t.merged_into IS NOT NULL OR t.spam OR t.redacted_at IS NOT NULL OR
       t.automation<>'auto' OR t.executor<>'bloom' OR t.kind NOT IN ('bug','incident') OR t.product<>'crm' OR
       split_part(split_part(t.context->>'page_url','?',1),'#',1) IS DISTINCT FROM 'https://bloomsuite.app/support/contact' THEN
      RAISE EXCEPTION 'blocked: trusted browser ticket hold or scope changed' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF count_tickets=0 THEN RAISE EXCEPTION 'blocked: trusted browser ticket scope empty' USING ERRCODE='23514'; END IF;
  FOR account_row IN SELECT * FROM bloom_support.accounts WHERE id IN
    (SELECT account_id FROM bloom_support.tickets WHERE engineering_issue_id=OLD.id) ORDER BY id FOR UPDATE NOWAIT LOOP
    IF account_row.automation_paused OR account_row.merged_into IS NOT NULL THEN
      RAISE EXCEPTION 'blocked: trusted browser account hold' USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOR setting_row IN SELECT * FROM bloom_support.settings WHERE key IN
    ('automation_enabled','auto_release_enabled','automation_scopes','release_policy') ORDER BY key FOR UPDATE NOWAIT LOOP
    count_settings := count_settings + 1;
    IF (setting_row.key IN ('automation_enabled','auto_release_enabled') AND setting_row.value IS DISTINCT FROM 'true'::jsonb) OR
       (setting_row.key='automation_scopes' AND setting_row.value ? 'engineering' AND setting_row.value->'engineering' IS DISTINCT FROM 'true'::jsonb) THEN
      RAISE EXCEPTION 'blocked: trusted browser global hold' USING ERRCODE='23514';
    END IF;
    IF setting_row.key='release_policy' THEN assignment := setting_row.value->'trustedReproductionIssues'->OLD.id::text; END IF;
  END LOOP;
  IF count_settings<>4 THEN RAISE EXCEPTION 'blocked: trusted browser settings unavailable' USING ERRCODE='23514'; END IF;
  SELECT jsonb_agg(id::text ORDER BY id), encode(sha256(convert_to('[' || string_agg(to_jsonb(id::text)::text,',' ORDER BY id) || ']','UTF8')),'hex')
    INTO ids,binding FROM bloom_support.tickets WHERE engineering_issue_id=OLD.id;
  SELECT jsonb_agg(value ORDER BY value) INTO claimed FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(NEW.verification->'ticket_ids')='array' THEN NEW.verification->'ticket_ids' ELSE '[]'::jsonb END);
  IF claimed IS DISTINCT FROM ids OR request->>'ticket_binding' IS DISTINCT FROM binding OR
     assignment->>'recipe' IS DISTINCT FROM 'public-support-attachment-name-v1' OR
     assignment->'github_issue' IS DISTINCT FROM OLD.evidence#>'{github_issue,number}' OR
     NOT ((assignment->'ticket_ids') @> ids AND ids @> (assignment->'ticket_ids')) OR
     jsonb_array_length(assignment->'ticket_ids') IS DISTINCT FROM count_tickets THEN
    RAISE EXCEPTION 'blocked: trusted browser assignment or ticket binding changed' USING ERRCODE='23514';
  END IF;
  FOR t IN SELECT * FROM bloom_support.tickets WHERE engineering_issue_id=OLD.id ORDER BY id LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(checks) c WHERE c->>'ticket_id'=t.id::text AND c ? 'trusted_browser')<>1 OR
       NOT EXISTS (SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'ticket_id'=t.id::text
         AND c->>'check_scope'='ticket_flow' AND c->'pass'='true'::jsonb
         AND c->>'url'='https://bloomsuite.app/support/contact' AND c->>'flow_path'='/support/contact'
         AND c#>>'{trusted_browser,nonce}'=request->>'nonce'
         AND c#>>'{trusted_browser,head_sha}'=OLD.head_sha
         AND c#>>'{trusted_browser,deployed_sha}'=request->>'deployed_sha'
         AND c#>>'{trusted_browser,deployment_id}'=request->>'deployment_id'
         AND c#>>'{trusted_browser,ticket_binding}'=binding
         AND c#>>'{trusted_browser,started_at}'=NEW.verification->>'started_at') THEN
      RAISE EXCEPTION 'blocked: trusted browser per-ticket evidence mismatch' USING ERRCODE='23514';
    END IF;
  END LOOP;
  -- Freshness uses the actual browser observation start, never the later poll.
  BEGIN
    started := (NEW.verification->>'started_at')::timestamptz;
    requested := (request->>'created_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN started := NULL; END;
  IF started IS NULL OR requested IS NULL OR NOT isfinite(started) OR NOT isfinite(requested) OR started<requested OR started>statement_timestamp() OR requested<statement_timestamp()-interval '30 minutes' THEN RAISE EXCEPTION 'blocked: trusted browser observation timestamp' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloom_support.guard_trusted_browser_verification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bloom_support_atomic_trusted_verification ON bloom_support.engineering_issues;
CREATE TRIGGER bloom_support_atomic_trusted_verification BEFORE UPDATE ON bloom_support.engineering_issues
FOR EACH ROW EXECUTE FUNCTION bloom_support.guard_trusted_browser_verification();
