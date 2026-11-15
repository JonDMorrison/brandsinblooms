\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261115191247_bloom_support_release_ticket_links.sql
INSERT INTO bloom_support.settings(key,value) VALUES('slack','{"enabled":true}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
DO $$
DECLARE a uuid; c uuid; t uuid; other uuid; eng uuid; other_eng uuid; first jsonb; second jsonb; before_t jsonb; before_e jsonb; legacy uuid;
BEGIN
 INSERT INTO bloom_support.principals(kind,auth_user_id,product,email,role) VALUES('user',gen_random_uuid(),'crm',gen_random_uuid()::text||'@example.test','platform_admin') RETURNING id INTO a;
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Release linkage fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.engineering_issues(title,product,status,repository,pr_number,deployment)
 VALUES('Linked fixture','crm','escalated','JonDMorrison/brandsinblooms',42,'{"state":"rollback_point_unproven","deployment_id":123,"deployments":[{"deployment_id":124}]}') RETURNING id INTO eng;
 INSERT INTO bloom_support.engineering_issues(title,product,status,repository,pr_number,deployment)
 VALUES('Other repository','pos','escalated','Brands-In-Blooms/bloomtill',42,'{"deployment_id":123}') RETURNING id INTO other_eng;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,engineering_issue_id) VALUES(c,'crm','staff','Linked fixture','','working',eng) RETURNING id INTO t;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,engineering_issue_id) VALUES(c,'pos','staff','Other repository','','working',other_eng) RETURNING id INTO other;
 SELECT to_jsonb(x) INTO before_t FROM bloom_support.tickets x WHERE id=t;
 SELECT to_jsonb(x) INTO before_e FROM bloom_support.engineering_issues x WHERE id=eng;
 first:=public.bloom_support_enqueue_slack_github('fixture-release-one','github.deployment_succeeded','https://github.com/JonDMorrison/brandsinblooms/deployments/123');
 IF first->>'linked_tickets'<>'1' THEN RAISE EXCEPTION 'exact deployment did not correlate once'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bloom_support.jobs WHERE ticket_id=t AND engineering_issue_id=eng AND payload->>'kind'='engineering.release_observed' AND payload->>'github_url'='https://github.com/JonDMorrison/brandsinblooms/deployments/123') THEN RAISE EXCEPTION 'private thread job missing'; END IF;
 IF EXISTS(SELECT 1 FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-release-one%' AND (ticket_id IS NULL OR ticket_id=other)) THEN RAISE EXCEPTION 'wrong public/other-repository delivery'; END IF;
 second:=public.bloom_support_enqueue_slack_github('fixture-release-one','github.deployment_succeeded','https://github.com/JonDMorrison/brandsinblooms/deployments/123');
 IF second IS DISTINCT FROM first OR (SELECT count(*) FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-release-one%')<>1 THEN RAISE EXCEPTION 'replay duplicated'; END IF;
 IF (SELECT to_jsonb(x) FROM bloom_support.tickets x WHERE id=t) IS DISTINCT FROM before_t OR (SELECT to_jsonb(x) FROM bloom_support.engineering_issues x WHERE id=eng) IS DISTINCT FROM before_e THEN RAISE EXCEPTION 'release changed customer/engineering state'; END IF;
 UPDATE bloom_support.tickets SET engineering_issue_id=NULL WHERE id=t;
 second:=public.bloom_support_enqueue_slack_github('fixture-release-one','github.deployment_succeeded','https://github.com/JonDMorrison/brandsinblooms/deployments/123');
 IF second IS DISTINCT FROM first OR (SELECT count(*) FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-release-one%')<>1 THEN RAISE EXCEPTION 'replay changed routing after unlink'; END IF;
 BEGIN
  PERFORM public.bloom_support_enqueue_slack_github('fixture-release-one','github.deployment_failed','https://github.com/JonDMorrison/brandsinblooms/deployments/123');
  RAISE EXCEPTION 'changed event identity accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 first:=public.bloom_support_enqueue_slack_github('fixture-unmatched','github.pr_merged','https://github.com/JonDMorrison/brandsinblooms/pull/99','support');
 IF first->>'support_linkage'<>'unmatched' OR jsonb_array_length(bloom_support.unlinked_release_report(a,now()-interval '1 day'))<>1 THEN RAISE EXCEPTION 'unlinked review candidate missing'; END IF;
 UPDATE bloom_support.tickets SET engineering_issue_id=eng WHERE id=t;
 UPDATE bloom_support.engineering_issues SET pr_number=99 WHERE id=eng;
 IF jsonb_array_length(bloom_support.unlinked_release_report(a,now()-interval '1 day'))<>0 THEN RAISE EXCEPTION 'now-linked candidate remains in audit'; END IF;
 first:=public.bloom_support_enqueue_slack_github('fixture-nested-deploy','github.deployment_succeeded','https://github.com/JonDMorrison/brandsinblooms/deployments/124');
 IF first->>'linked_tickets'<>'1' THEN RAISE EXCEPTION 'nested provider identity lost'; END IF;
 legacy:=bloom_support.enqueue_job('notify',NULL,NULL,'slack:external:github',jsonb_build_object('slack',true,'kind','github.pr_merged','github_url','https://github.com/JonDMorrison/brandsinblooms/pull/99','release_category','support'),'slack:external:github:fixture-legacy');
 first:=public.bloom_support_enqueue_slack_github('fixture-legacy','github.pr_merged','https://github.com/JonDMorrison/brandsinblooms/pull/99','support');
 IF first->>'job_id'<>legacy::text OR first->>'support_linkage'<>'legacy_unchecked' THEN RAISE EXCEPTION 'legacy event not adopted'; END IF;
 IF (SELECT count(*) FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-legacy%')<>1 THEN RAISE EXCEPTION 'legacy replay produced private duplicate'; END IF;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,engineering_issue_id)
 SELECT c,'crm','staff','Bounded release fanout','','working',eng FROM generate_series(1,51);
 first:=public.bloom_support_enqueue_slack_github('fixture-many-links','github.pr_merged','https://github.com/JonDMorrison/brandsinblooms/pull/99','support');
 IF first->>'support_linkage'<>'review_many_links' OR (SELECT count(*) FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-many-links%')<>1 THEN RAISE EXCEPTION 'unbounded notification fanout'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(bloom_support.unlinked_release_report(a,now()-interval '1 day')) x WHERE x->>'linkage_at_reception'='review_many_links') THEN RAISE EXCEPTION 'large linkage review missing'; END IF;
 UPDATE bloom_support.principals SET role='client' WHERE id=a;
 BEGIN PERFORM bloom_support.unlinked_release_report(a,now()-interval '1 day'); RAISE EXCEPTION 'client audit allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('authenticated','public.bloom_support_enqueue_slack_github(text,text,text,text)','execute') OR has_function_privilege('service_role','bloom_support.unlinked_release_report(uuid,timestamptz)','execute') OR has_table_privilege('authenticated','bloom_support.github_release_receipts','select') THEN RAISE EXCEPTION 'release boundary exposed'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-release-links: all assertions passed'
