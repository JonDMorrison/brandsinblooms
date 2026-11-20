\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
 \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261108133500_bloom_support_slack_diagnostic_staff.sql
\ir ../../supabase/migrations/20261108162000_bloom_support_slack_ticket_threads.sql
\ir ../../supabase/migrations/20261112165850_bloom_support_slack_conversations.sql
\ir ../../supabase/migrations/20261120115401_bloom_support_slack_release_evidence.sql
DO $$
DECLARE a uuid; j uuid; notice uuid; r jsonb; n bigint;
BEGIN
 INSERT INTO bloom_support.settings(key,value) VALUES('slack','{"enabled":true}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
 INSERT INTO bloom_support.principals(kind,role,display_name) VALUES('user','platform_admin','Release fixture') RETURNING id INTO a;
 INSERT INTO bloom_support.slack_staff_principals(slack_user_id,principal_id) VALUES('URELEASE001',a);
 r:=public.bloom_support_enqueue_slack_conversation('EvRelease01','C0CFYDVE4A0','URELEASE001','How do recent merges help customers?','1795141661.807849','1795141661.807849',true);
 j:=(r->>'job_id')::uuid;
 IF j IS NULL THEN RAISE EXCEPTION 'fixture not queued: %',r; END IF;
 INSERT INTO bloom_support.jobs(kind,lane,payload,status,result) VALUES('notify','slack:external:github',
 '{"slack":true,"kind":"github.pr_merged","github_url":"https://github.com/Brands-In-Blooms/bloomtill/pull/695"}',
 'succeeded','{"note":"delivered to releases (Slack ts: 1795141661.807849)"}') RETURNING id INTO notice;
 INSERT INTO bloom_support.github_release_receipts(event_id,kind,source_url,category,result,created_at)
 VALUES('release-evidence-fixture','github.pr_merged','https://github.com/Brands-In-Blooms/bloomtill/pull/695','pos',jsonb_build_object('job_id',notice),now()-interval '40 seconds');
 SELECT count(*) INTO n FROM bloom_support.jobs;
 r:=public.bloom_support_slack_release_evidence(j);
 IF r->>'scope'<>'recent_sample' THEN RAISE EXCEPTION 'legacy note inferred exact channel'; END IF;
 UPDATE bloom_support.jobs SET result=result||'{"slack_delivery":{"route":"releases","channel":"C0CFYDVE4A0","ts":"1795141661.807849"}}' WHERE id=notice;
 r:=public.bloom_support_slack_release_evidence(j);
 IF r->>'scope'<>'notification' OR jsonb_array_length(r->'records')<>1 THEN RAISE EXCEPTION 'exact receipt missed'; END IF;
 UPDATE bloom_support.jobs SET result=jsonb_set(result,'{slack_delivery,channel}','"CWRONG0001"') WHERE id=notice;
 IF public.bloom_support_slack_release_evidence(j)->>'scope'<>'recent_sample' THEN RAISE EXCEPTION 'wrong channel matched'; END IF;
 UPDATE bloom_support.jobs SET result=jsonb_set(result,'{slack_delivery,channel}','"C0CFYDVE4A0"') WHERE id=notice;
 INSERT INTO bloom_support.github_release_receipts SELECT 'release-evidence-ambiguous',kind,source_url,category,result,created_at FROM bloom_support.github_release_receipts WHERE event_id='release-evidence-fixture';
 IF public.bloom_support_slack_release_evidence(j)->>'scope'<>'recent_sample' THEN RAISE EXCEPTION 'ambiguous receipt inferred exact'; END IF;
 DELETE FROM bloom_support.github_release_receipts WHERE event_id='release-evidence-ambiguous';
 UPDATE bloom_support.github_release_receipts SET created_at=now()-interval '8 days' WHERE event_id='release-evidence-fixture';
 r:=public.bloom_support_slack_release_evidence(j);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'records') x WHERE x->>'url'='https://github.com/Brands-In-Blooms/bloomtill/pull/695') THEN RAISE EXCEPTION 'stale evidence returned'; END IF;
 UPDATE bloom_support.slack_staff_principals SET enabled=false WHERE slack_user_id='URELEASE001';
 BEGIN
  PERFORM public.bloom_support_slack_release_evidence(j);RAISE EXCEPTION 'revoked actor accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE bloom_support.slack_staff_principals SET enabled=true WHERE slack_user_id='URELEASE001';
 UPDATE bloom_support.jobs SET payload=jsonb_set(payload,'{channel_id}','"CWRONG0001"') WHERE id=j;
 BEGIN
  PERFORM public.bloom_support_slack_release_evidence(j);RAISE EXCEPTION 'wrong conversation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM bloom_support.jobs)<>n THEN RAISE EXCEPTION 'read queued work'; END IF;
 IF has_function_privilege('anon','public.bloom_support_slack_release_evidence(uuid)','execute') OR has_function_privilege('authenticated','public.bloom_support_slack_release_evidence(uuid)','execute') THEN RAISE EXCEPTION 'public access'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-slack-release-evidence: all assertions passed'
