\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing trusted bug setup tests outside disposable bloom_support_test'
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261112200000_bloom_support_trusted_bug_setup.sql
DO $$
DECLARE a uuid; nonadmin uuid; svc uuid; e uuid; c uuid; t uuid; original jsonb; result jsonb; saved jsonb; audits bigint;
BEGIN
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('user','platform_admin','Trusted setup fixture') RETURNING id INTO a;
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('user','support','Denied setup fixture') RETURNING id INTO nonadmin;
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('service','service','Denied setup service') RETURNING id INTO svc;
 INSERT INTO bloom_support.engineering_issues(title,product,repository,evidence)
 VALUES('Filename boundary fixture','crm','JonDMorrison/brandsinblooms','{"github_issue":{"number":42}}') RETURNING id INTO e;
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Internal fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,engineering_issue_id,product,kind,channel,subject,summary,automation,executor,context)
 VALUES(c,e,'crm','bug','staff','Internal fixture','Synthetic real-bug regression','auto','bloom','{"page_url":"https://bloomsuite.app/support/contact"}') RETURNING id INTO t;
 original := '{"approvedPaths":{"JonDMorrison/brandsinblooms":["src/components/**","src/pages/**"],"other/repo":["keep/**"]},"requiredChecks":{"JonDMorrison/brandsinblooms":["verify","expect"]},"maxChangedFiles":6,"maxChangedLines":200,"sensitivePaths":["supabase/**"],"unrelated":{"hold":true},"trustedReproductionIssues":{"preserve":{"recipe":"other"}}}'::jsonb;
 INSERT INTO bloom_support.settings(key,value) VALUES('release_policy',original) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(nonadmin,e,42,ARRAY[t],original); RAISE EXCEPTION 'nonadmin accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(svc,e,42,ARRAY[t],original); RAISE EXCEPTION 'service accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t,t],original); RAISE EXCEPTION 'duplicate tickets accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,43,ARRAY[t],original); RAISE EXCEPTION 'wrong GitHub issue accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[gen_random_uuid()],original); RAISE EXCEPTION 'wrong ticket set accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],original || '{"changed":true}'); RAISE EXCEPTION 'stale policy accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE bloom_support.tickets SET context='{"page_url":"https://bloomsuite.app/campaigns"}' WHERE id=t;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],original); RAISE EXCEPTION 'wrong route accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 UPDATE bloom_support.tickets SET context='{"page_url":"https://bloomsuite.app/support/contact"}',kind='feature' WHERE id=t;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],original); RAISE EXCEPTION 'feature accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 UPDATE bloom_support.tickets SET kind='bug',automation='paused' WHERE id=t;
 BEGIN PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],original); RAISE EXCEPTION 'hold accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 UPDATE bloom_support.tickets SET automation='auto' WHERE id=t;
 result := public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],original);
 saved := result->'release_policy';
 IF result->>'configured' IS DISTINCT FROM 'true' OR saved-'approvedPaths'-'trustedReproductionIssues' IS DISTINCT FROM original-'approvedPaths'-'trustedReproductionIssues' THEN RAISE EXCEPTION 'unrelated policy changed'; END IF;
 IF saved->'approvedPaths'->'other/repo' IS DISTINCT FROM original->'approvedPaths'->'other/repo' THEN RAISE EXCEPTION 'other repository changed'; END IF;
 IF saved->'approvedPaths'->'JonDMorrison/brandsinblooms' IS DISTINCT FROM '["src/components/**","src/pages/**","src/lib/bloomSupport/constants.ts","src/lib/bloomSupport/constants.test.ts"]'::jsonb THEN RAISE EXCEPTION 'unexpected approved paths'; END IF;
 IF saved->'trustedReproductionIssues'->e::text IS DISTINCT FROM jsonb_build_object('recipe','public-support-attachment-name-v1','github_issue',42,'ticket_ids',jsonb_build_array(t)) THEN RAISE EXCEPTION 'wrong exact assignment'; END IF;
 IF saved->'trustedReproductionIssues'->'preserve' IS DISTINCT FROM original->'trustedReproductionIssues'->'preserve' THEN RAISE EXCEPTION 'existing assignment changed'; END IF;
 SELECT count(*) INTO audits FROM bloom_support.activity WHERE action='setting.trusted_bug_configured' AND detail->>'engineering_issue_id'=e::text;
 PERFORM public.bloom_support_configure_trusted_bug(a,e,42,ARRAY[t],saved);
 IF audits<>1 OR (SELECT count(*) FROM bloom_support.activity WHERE action='setting.trusted_bug_configured' AND detail->>'engineering_issue_id'=e::text)<>1 THEN RAISE EXCEPTION 'repeat duplicated audit'; END IF;
 IF (SELECT status<>'open' OR repair_started_by IS NOT NULL FROM bloom_support.engineering_issues WHERE id=e) THEN RAISE EXCEPTION 'setup started repair'; END IF;
 IF EXISTS(SELECT 1 FROM bloom_support.jobs WHERE engineering_issue_id=e) THEN RAISE EXCEPTION 'setup dispatched job'; END IF;
 IF has_function_privilege('anon','public.bloom_support_configure_trusted_bug(uuid,uuid,integer,uuid[],jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.bloom_support_configure_trusted_bug(uuid,uuid,integer,uuid[],jsonb)','EXECUTE') THEN RAISE EXCEPTION 'public setup permission'; END IF;
END $$;
ROLLBACK;
