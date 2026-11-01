\set ON_ERROR_STOP on
-- Disposable-database contract test for the Bloom Support schema.
-- Run: createdb bloom_support_test && psql -d bloom_support_test -f scripts/tests/bloom-support-db.sql
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_support_test'
  \quit 3
\endif

-- Minimal Supabase surface.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\ir ../../supabase/migrations/20261031120000_bloom_support_core.sql
\ir ../../supabase/migrations/20261031120100_bloom_support_functions.sql
\ir ../../supabase/migrations/20261031120200_bloom_support_gateway.sql
\ir ../../supabase/migrations/20261031120300_bloom_support_campaign_ops.sql
\ir ../../supabase/migrations/20261031140000_bloom_support_operations_hardening.sql
\ir ../../supabase/migrations/20261031150000_bloom_support_desk.sql
\ir ../../supabase/migrations/20261101030000_bloom_support_delivery_readiness.sql
\ir ../../supabase/migrations/20261101035144_bloom_support_knowledge_publication.sql

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_fragment text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected error containing "%" but statement succeeded: %', p_fragment, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF position(p_fragment IN SQLERRM) = 0 THEN
    RAISE EXCEPTION 'expected "%", got "%" for %', p_fragment, SQLERRM, p_sql;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.rpc(p_fn text, p jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.bloom_support_rpc(p_fn, p) $$;
CREATE OR REPLACE FUNCTION pg_temp.assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(p_ok,false) THEN RAISE EXCEPTION 'assertion failed: %', p_msg; END IF; END $$;

-- Privilege boundary: no client role may reach the schema or the gateway.
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'authenticated cannot call gateway');
SELECT pg_temp.assert(NOT has_function_privilege('anon', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'anon cannot call gateway');
SELECT pg_temp.assert(has_function_privilege('service_role', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'service_role can call gateway');
SELECT pg_temp.assert(NOT has_schema_privilege('authenticated', 'bloom_support', 'usage'), 'authenticated has no schema usage');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated', 'bloom_support.tickets', 'select'), 'authenticated cannot read tickets');

-- People.
INSERT INTO bloom_support.principals(id, kind, auth_user_id, product, email, display_name, role) VALUES
 ('00000000-0000-4000-8000-000000000001','user','10000000-0000-4000-8000-000000000001','crm','jon@example.test','Jon','platform_admin'),
 ('00000000-0000-4000-8000-000000000002','user','10000000-0000-4000-8000-000000000002','crm','jeff@example.test','Jeff','platform_operator'),
 ('00000000-0000-4000-8000-000000000003','user','10000000-0000-4000-8000-000000000003','crm','sam@example.test','Sam Support','support');
UPDATE bloom_support.settings SET value = '{"jon":["jon@example.test"],"jeff":["jeff@example.test"]}'::jsonb WHERE key = 'owners';
\set jon '00000000-0000-4000-8000-000000000001'
\set jeff '00000000-0000-4000-8000-000000000002'
\set sam '00000000-0000-4000-8000-000000000003'

-- Service identities with one scope each.
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom intake', 'grants', '["intake"]'::jsonb))#>>'{}' AS intake \gset
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom automation', 'grants', '["automation"]'::jsonb))#>>'{}' AS bot \gset
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom repair', 'grants', '["investigation"]'::jsonb))#>>'{}' AS repair \gset
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom release', 'grants', '["release"]'::jsonb))#>>'{}' AS release \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('create_service_principal', '{"actor":"%s","name":"x","grants":["intake"]}'::jsonb)$q$, :'jeff'), 'admin.roles');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('create_service_principal', '{"actor":"%s","name":"x","grants":["intake","release"]}'::jsonb)$q$, :'jon'), 'one scope');

-- 1. Reports from all three products.
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000a1','email','owner@greenleaf.test','name','Gail','tenant_id','30000000-0000-4000-8000-0000000000a1','tenant_name','Greenleaf'))#>>'{}' AS gail \gset
SELECT pg_temp.rpc('resolve_product_user', '{"product":"cms","external_user_id":"cms-user-1","email":"web@greenleaf.test","name":"Will","external_account_id":"site-greenleaf","account_name":"Greenleaf Website"}'::jsonb) AS r \gset
SELECT (:'r'::jsonb)->>'principal_id' AS will, (:'r'::jsonb)->>'account_id' AS greenleaf_site_acct \gset
SELECT pg_temp.rpc('resolve_product_user', '{"product":"pos","external_user_id":"pos-user-9","email":"till@rosehill.test","name":"Rosa","external_account_id":"pos-tenant-rose","account_name":"Rose Hill"}'::jsonb) AS r \gset
SELECT (:'r'::jsonb)->>'principal_id' AS rosa, (:'r'::jsonb)->>'account_id' AS rose \gset
SELECT account_id AS greenleaf FROM bloom_support.account_members WHERE principal_id = :'gail' \gset

SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','channel','crm','subject','Campaign stuck','body','My campaign is stuck in sending','account_id', :'greenleaf','dedupe_key','crm:abc'))) AS t1 \gset
SELECT (:'t1'::jsonb)->>'ticket_id' AS t1id \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'will', 'ticket', jsonb_build_object('product','cms','channel','cms','body','Checkout button does nothing on mobile','account_id', :'greenleaf_site_acct','context', '{"page_url":"https://x.test/checkout"}'::jsonb))) AS t2 \gset
SELECT (:'t2'::jsonb)->>'ticket_id' AS t2id \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'rosa', 'ticket', jsonb_build_object('product','pos','channel','pos','body','Receipt printer offline after update','account_id', :'rose'))) AS t3 \gset
SELECT (:'t3'::jsonb)->>'ticket_id' AS t3id \gset
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.tickets) = 3, 'three product tickets');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE kind = 'triage') = 3, 'triage queued for each');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.notifications WHERE principal_id IN (:'jon', :'jeff')) = 6, 'Jon and Jeff notified');

-- 2. Duplicate delivery is idempotent.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','channel','crm','subject','Campaign stuck','body','My campaign is stuck in sending','account_id', :'greenleaf','dedupe_key','crm:abc'))) AS dup \gset
SELECT pg_temp.assert((:'dup'::jsonb->>'duplicate_delivery')::boolean AND :'dup'::jsonb->>'ticket_id' = :'t1id', 'duplicate delivery returns original');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.tickets) = 3, 'no duplicate ticket');

-- 3. Cross-client restrictions (403 on another client''s ticket and account).
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('get_ticket', '{"actor":"%s","ticket_id":"%s"}'::jsonb)$q$, :'rosa', :'t1id'), 'forbidden: ticket');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('get_account', '{"actor":"%s","account_id":"%s"}'::jsonb)$q$, :'rosa', :'greenleaf'), 'forbidden: account');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('create_ticket', '{"actor":"%s","ticket":{"body":"sneaky request","account_id":"%s"}}'::jsonb)$q$, :'rosa', :'greenleaf'), 'forbidden: account');
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'rosa'))) = 1, 'Rosa lists only her ticket');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"hi","visibility":"internal"}}'::jsonb)$q$, :'rosa', :'t3id'), 'tickets.internal');

-- Internal notes never reach clients.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'sam', 'ticket_id', :'t3id', 'message', '{"body":"Printer firmware 2.1 suspected","visibility":"internal"}'::jsonb));
SELECT pg_temp.assert(NOT (pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'rosa', 'ticket_id', :'t3id'))::text LIKE '%firmware%'), 'client cannot see internal note');
SELECT pg_temp.assert(pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'t3id'))::text LIKE '%firmware%', 'support sees internal note');
SELECT pg_temp.assert(NOT (pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'rosa', 'ticket_id', :'t3id')) ? 'activity'), 'client gets no activity log');

-- 4. Jeff (operator) has universal authority; Support needs opt-ins.
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'jeff'))) = 3, 'Jeff sees every client');
SELECT pg_temp.assert(bloom_support.has_permission(:'jeff', 'ops.site.publish') AND bloom_support.has_permission(:'jeff', 'ops.campaign.send') AND bloom_support.has_permission(:'jeff','ops.site.create'), 'Jeff can publish/send/create');
SELECT pg_temp.assert(NOT bloom_support.has_permission(:'jeff', 'admin.roles') AND NOT bloom_support.has_permission(:'jeff', 'engineering.release') AND NOT bloom_support.has_permission(:'jeff', 'admin.policy'), 'Jeff has no role/policy/release authority');
SELECT pg_temp.assert(NOT bloom_support.has_permission(:'sam', 'ops.site.publish') AND NOT bloom_support.has_permission(:'sam', 'ops.campaign.send'), 'Support cannot publish/send by default');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('set_principal_role', '{"actor":"%s","principal":{"principal_id":"%s","grants":["publish"]}}'::jsonb)$q$, :'jeff', :'sam'), 'admin.roles');
SELECT pg_temp.rpc('set_principal_role', jsonb_build_object('actor', :'jon', 'principal', jsonb_build_object('principal_id', :'sam', 'grants', '["publish"]'::jsonb)));
SELECT pg_temp.assert(bloom_support.has_permission(:'sam', 'ops.site.publish') AND NOT bloom_support.has_permission(:'sam', 'ops.campaign.send'), 'publish opt-in only');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('set_principal_role', '{"actor":"%s","principal":{"principal_id":"%s","role":"platform_admin"}}'::jsonb)$q$, :'jon', :'rosa'), 'BloomSuite sign-in');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('set_setting', '{"actor":"%s","key":"auto_release_enabled","value":true}'::jsonb)$q$, :'jeff'), 'admin.policy');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('set_setting', '{"actor":"%s","key":"auto_release_enabled","value":true}'::jsonb)$q$, :'bot'), 'admin.policy');

-- Operations: preview → claim once → finish; scope enforced.
SELECT pg_temp.rpc('record_operation_preview', jsonb_build_object('actor', :'jeff', 'operation', jsonb_build_object('account_id', :'greenleaf','ticket_id', :'t1id','kind','campaign.send','permission','ops.campaign.send','inputs','{"campaign_id":"c1"}'::jsonb,'preview','{"recipients":120}'::jsonb,'idempotency_key','op-1'))) AS op \gset
SELECT (:'op'::jsonb)->>'id' AS opid \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('claim_operation', '{"actor":"%s","operation_id":"%s"}'::jsonb)$q$, :'sam', :'opid'), 'ops.campaign.send');
SELECT pg_temp.assert(pg_temp.rpc('claim_operation', jsonb_build_object('actor', :'jeff', 'operation_id', :'opid'))->>'status' = 'executing', 'claimed');
SELECT pg_temp.assert((pg_temp.rpc('claim_operation', jsonb_build_object('actor', :'jeff', 'operation_id', :'opid'))->>'already')::boolean, 'second claim is a no-op');
SELECT pg_temp.rpc('finish_operation', jsonb_build_object('actor', :'jeff', 'operation_id', :'opid', 'outcome', '{"status":"succeeded","result":{"scheduled":true},"verification":{"checked":true}}'::jsonb));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('record_operation_preview', '{"actor":"%s","operation":{"account_id":"%s","kind":"site.publish","permission":"ops.site.publish","inputs":{}}}'::jsonb)$q$, :'rosa', :'rose'), 'ops.site.publish');

-- 5. Multi-request conversation + linking.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','channel','crm','body','Also: can I add a second location?','account_id', :'greenleaf','conversation_id', (:'t1'::jsonb)->>'conversation_id'))) AS t4 \gset
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.ticket_links WHERE kind='same_conversation' AND from_ticket = ((:'t4'::jsonb)->>'ticket_id')::uuid), 'second request in same conversation linked');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('create_ticket', '{"actor":"%s","ticket":{"body":"hijack conversation","conversation_id":"%s"}}'::jsonb)$q$, :'rosa', (:'t1'::jsonb)->>'conversation_id'), 'forbidden: conversation');

-- 6. Human takeover blocks Bloom; client reply wakes the ticket.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'message', '{"body":"Thanks — looking into it.","visibility":"public","idempotency_key":"bot-ack-1"}'::jsonb));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE kind='send_email' AND ticket_id = :'t2id') = 1, 'Bloom reply queues email');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'message', '{"body":"Thanks — looking into it.","visibility":"public","idempotency_key":"bot-ack-1"}'::jsonb));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.messages WHERE idempotency_key='bot-ack-1') = 1, 'duplicate Bloom reply suppressed');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'jeff', 'ticket_id', :'t2id', 'message', '{"body":"Jeff here, I will call you."}'::jsonb));
SELECT pg_temp.assert((SELECT automation FROM bloom_support.tickets WHERE id = :'t2id') = 'human', 'public staff reply takes over');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Bloom again","visibility":"public"}}'::jsonb)$q$, :'bot', :'t2id'), 'human control');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"waiting"}}'::jsonb)$q$, :'bot', :'t2id'), 'human control');
SELECT pg_temp.assert(pg_temp.rpc('queue_outbound_email', jsonb_build_object('email', jsonb_build_object('ticket_id', :'t2id','purpose','progress','to','web@greenleaf.test','subject','s','body','b','rfc_message_id','<x1@bloom>','idempotency_key','prog-1','bloom_initiated',true)))->>'status' = 'suppressed', 'Bloom email suppressed after takeover');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('set_automation', '{"actor":"%s","ticket_id":"%s","mode":"auto"}'::jsonb)$q$, :'bot', :'t2id'), 'cannot reclaim');
SELECT pg_temp.rpc('set_automation', jsonb_build_object('actor', :'jeff', 'ticket_id', :'t2id', 'mode', 'auto'));

-- 7. Interrupted job recovery, bounded retries, lane isolation, kill switch.
UPDATE bloom_support.jobs SET status = 'cancelled' WHERE kind <> 'triage';
SELECT count(*) AS claimed FROM bloom_support.claim_jobs('worker-a', 10) \gset
SELECT pg_temp.assert(:claimed >= 2, 'claimed jobs across lanes');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE status='running' GROUP BY lane ORDER BY 1 DESC LIMIT 1) = 1, 'at most one running job per lane');
UPDATE bloom_support.jobs SET lease_until = now() - interval '1 second' WHERE status = 'running';
SELECT count(*) AS reclaimed FROM bloom_support.claim_jobs('worker-b', 10) \gset
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE last_error LIKE '%lease expired%') >= 2, 'expired leases recovered');
UPDATE bloom_support.jobs SET run_after = now() WHERE status = 'queued';
SELECT id AS jid FROM bloom_support.claim_jobs('worker-b', 1) \gset
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.complete_job('%s','worker-z','{}')$q$, :'jid'), 'lease lost');
UPDATE bloom_support.jobs SET max_attempts = attempts WHERE id = :'jid';
SELECT pg_temp.assert(bloom_support.fail_job(:'jid', 'worker-b', 'provider 500') = 'dead', 'retries are bounded');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.escalations WHERE dedupe_key = 'job-dead:' || :'jid'), 'dead job escalates');
UPDATE bloom_support.settings SET value = 'false' WHERE key = 'automation_enabled';
UPDATE bloom_support.jobs SET status='queued', run_after = now(), lease_until = NULL, locked_by = NULL WHERE status = 'running';
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.claim_jobs('worker-c', 10)) = 0, 'kill switch stops claiming');
UPDATE bloom_support.settings SET value = 'true' WHERE key = 'automation_enabled';

-- 8. Engineering: repair identity cannot self-certify; release needs eligibility or approval.
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'issue', '{"repository":"brands-in-blooms/cms-brandsinblooms"}'::jsonb))->>'engineering_issue_id' AS eng \gset
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng', 'update', '{"status":"investigating"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng', 'update', '{"status":"reproduced","patch":{"reproduction":{"steps":["open checkout on 375px"],"failing_test":"checkout.mobile.test.ts"}}}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng', 'update', '{"status":"fixing"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng', 'update', '{"status":"in_review","patch":{"pr_number":42,"pr_url":"https://github.com/x/y/pull/42","head_sha":"abc"}}'::jsonb));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"patch":{"eligibility":{"eligible":true}}}}'::jsonb)$q$, :'repair', :'eng'), 'release identity');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"merging"}}'::jsonb)$q$, :'repair', :'eng'), 'engineering.release');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"merging"}}'::jsonb)$q$, :'release', :'eng'), 'not eligible');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"merging"}}'::jsonb)$q$, :'jeff', :'eng'), 'engineering.release');
-- Eligible path.
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"merging","patch":{"eligibility":{"eligible":true,"reasons":[]}}}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"merged","patch":{"merge_sha":"def"}}'::jsonb));
-- Merged is not resolved: Bloom cannot resolve until verified.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed","resolution_verified":true}}'::jsonb)$q$, :'bot', :'t2id'), 'not verified in production');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"deploying"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"deployed","patch":{"deployment":{"state":"success","sha":"def"}}}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"verifying"}'::jsonb));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"verified"}}'::jsonb)$q$, :'release', :'eng'), 'verification evidence');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng', 'update', '{"status":"verified","patch":{"verification":{"passed":true,"checks":["GET /checkout 200"]}}}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind='verify_resolution' AND ticket_id = :'t2id'), 'verified fix queues resolution verification');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed"}}'::jsonb)$q$, :'bot', :'t2id'), 'after verifying');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed","resolution_verified":true}}'::jsonb)$q$, :'bot', :'t2id'), 'evidence required');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed","resolution_verified":true,"resolution_evidence":{"deployment":{"state":"success"},"verification":{"passed":false}}}}'::jsonb)$q$, :'bot', :'t2id'), 'affected-flow verification');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'patch', '{"status":"resolved","resolution_summary":"Checkout fixed and verified on production","resolution_verified":true,"resolution_evidence":{"deployment":{"state":"success","sha":"def"},"verification":{"passed":true,"checks":[{"url":"https://x/checkout","pass":true}]}}}'::jsonb));
SELECT pg_temp.assert((SELECT resolution_evidence->>'resolved_by' = 'bloom' AND resolution_evidence->'deployment'->>'state' = 'success' FROM bloom_support.tickets WHERE id = :'t2id'), 'evidence stored with resolution');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind='send_email' AND idempotency_key = 'email:resolution:' || :'t2id' || ':0'), 'resolution email queued');

-- Sensitive repair → awaiting approval escalates to Jon; deployment failure escalates to both.
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'sam', 'ticket_id', :'t1id', 'issue', '{}'))->>'engineering_issue_id' AS eng2 \gset
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng2', 'update', '{"status":"in_review"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng2', 'update', '{"status":"awaiting_approval","note":"touches payment amounts"}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND audience='jon' AND reason='engineering_awaiting_approval'), 'sensitive fix escalated to Jon');
SELECT pg_temp.assert((SELECT status FROM bloom_support.tickets WHERE id = :'t1id') = 'needs_owner', 'ticket shows Needs Jon/Jeff');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"approved"}}'::jsonb)$q$, :'jeff', :'eng2'), 'engineering.approve');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon', 'issue_id', :'eng2', 'update', '{"status":"approved"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng2', 'update', '{"status":"merging"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng2', 'update', '{"status":"merged"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng2', 'update', '{"status":"deploying"}'::jsonb));
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'release', 'issue_id', :'eng2', 'update', '{"status":"rolled_back","note":"deployment failed health check","patch":{"deployment":{"state":"failure"}}}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND audience='both' AND reason='engineering_rolled_back'), 'deployment failure escalated');

-- 9. Reopening: client reply on resolved ticket reopens it.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'will', 'ticket_id', :'t2id', 'message', '{"body":"Still broken on my iPhone"}'::jsonb))->>'message_id' AS rm1 \gset
SELECT pg_temp.assert((SELECT status = 'resolved' AND pending_review = 'reply_after_resolution' FROM bloom_support.tickets WHERE id = :'t2id'), 'reply routed for a decision');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind = 'post_resolution_reply' AND ticket_id = :'t2id'), 'decision job queued');
SELECT pg_temp.rpc('resolve_post_reply', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'decision', 'reopen', 'message_id', :'rm1'));
SELECT pg_temp.assert((SELECT status = 'working' AND reopen_count = 1 AND NOT resolution_verified FROM bloom_support.tickets WHERE id = :'t2id'), 'client reopened resolved ticket');

-- 10. Feature requests go to Jon with evidence; only Jon decides.
SELECT pg_temp.rpc('route_feature_request', jsonb_build_object('actor', :'bot', 'ticket_id', ((:'t4'::jsonb)->>'ticket_id'), 'feature', '{"title":"Multi-location accounts"}'::jsonb))->>'feature_request_id' AS fr \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('decide_feature_request', '{"actor":"%s","feature_request_id":"%s","decision":"accepted"}'::jsonb)$q$, :'jeff', :'fr'), 'features.decide');
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object('actor', :'jon', 'feature_request_id', :'fr', 'decision', 'planned', 'note', 'Q1'));
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_features', jsonb_build_object('actor', :'jeff'))->0->'evidence') = 1, 'feature evidence linked');

-- 11. Email sender resolution never grants staff authority; domain match stays unverified.
UPDATE bloom_support.accounts SET email_domains = '{greenleaf.test}' WHERE id = :'greenleaf';
SELECT pg_temp.rpc('resolve_email_sender', '{"email":"jon@example.test","name":"Spoof"}'::jsonb) AS spoof \gset
SELECT pg_temp.assert((:'spoof'::jsonb)->>'principal_id' <> :'jon', 'email never resolves to a staff principal');
SELECT pg_temp.rpc('resolve_email_sender', '{"email":"manager@greenleaf.test","name":"Manager"}'::jsonb) AS mgr \gset
SELECT pg_temp.assert((:'mgr'::jsonb)->>'match' = 'domain' AND (:'mgr'::jsonb)->>'account_id' = :'greenleaf', 'domain match links account');
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_tickets', jsonb_build_object('actor', (:'mgr'::jsonb)->>'principal_id'))) = 0, 'domain-matched sender cannot read account tickets');
SELECT pg_temp.assert(pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt1","outcome":"received"}'::jsonb)::boolean, 'first email event new');
SELECT pg_temp.assert(NOT pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt1","outcome":"received"}'::jsonb)::boolean, 'duplicate email event detected');

-- Activity is append-only.
SELECT pg_temp.expect_error('DELETE FROM bloom_support.activity', 'append-only');

-- Tracking links show public messages only.
SELECT pg_temp.rpc('issue_tracking_token', jsonb_build_object('ticket_id', :'t3id', 'hash', 'h1'));
SELECT pg_temp.assert(NOT (pg_temp.rpc('ticket_by_tracking_token', '{"hash":"h1"}'::jsonb)::text LIKE '%firmware%'), 'tracking page excludes internal notes');
SELECT pg_temp.assert(pg_temp.rpc('ticket_by_tracking_token', '{"hash":"nope"}'::jsonb) IS NULL, 'unknown token yields nothing');


-- 12. Campaign operations: Jeff schedules for any linked tenant; Support cannot; cross-tenant blocked.
CREATE TABLE public.tenants(id uuid PRIMARY KEY, name text);
INSERT INTO public.tenants VALUES ('30000000-0000-4000-8000-0000000000a1','Greenleaf'),('30000000-0000-4000-8000-0000000000ff','Other');
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY, tenant_id uuid, name text);
CREATE TABLE public.campaign_segments(campaign_id uuid, segment_id uuid);
INSERT INTO public.crm_segments VALUES ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-0000000000a1','Rose lovers');
CREATE TABLE public.crm_campaigns(id uuid PRIMARY KEY, tenant_id uuid, name text, subject_line text, status text, scheduled_at timestamptz, sent_at timestamptz,
  projected_recipient_count int, total_recipients int, send_blocked_reason text, send_error text, send_started_at timestamptz, metadata jsonb, updated_at timestamptz,
  content text, preheader_text text, sender_name text, sender_email text, delivery_method text DEFAULT 'email', include_all_customers boolean, additional_customer_ids uuid[], segment_id uuid);
INSERT INTO public.crm_campaigns(id, tenant_id, name, status, subject_line, content, segment_id, projected_recipient_count) VALUES
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-0000000000a1','Spring sale','draft','Spring is here','<p>Roses 20% off</p>','50000000-0000-4000-8000-000000000001',120),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-0000000000ff','Other tenant','draft','x','y',NULL,0),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-0000000000a1','Already sent','sent','x','y',NULL,0),
  ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-0000000000a1','No audience','draft','Hi','Body',NULL,0);
SELECT public.bloom_support_ops_rpc('campaign_facts', jsonb_build_object('actor', :'jeff', 'account_id', :'greenleaf', 'campaign_id', '40000000-0000-4000-8000-000000000001')) AS facts \gset
SELECT pg_temp.assert((:'facts'::jsonb)->'client'->>'name' = 'Greenleaf' AND (:'facts'::jsonb)->'audience'->'segments'->0->>'name' = 'Rose lovers'
  AND (:'facts'::jsonb)->'content'->>'subject' = 'Spring is here' AND (:'facts'::jsonb)->'content'->>'excerpt' LIKE '%Roses 20%', 'preview shows client, audience, content');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_schedule', '{"actor":"%s","account_id":"%s","campaign_id":"40000000-0000-4000-8000-000000000001","scheduled_at":"2099-01-01T00:00:00Z","fingerprint":"stale"}'::jsonb)$q$, :'jeff', :'greenleaf'), 'changed after the preview');
SELECT public.bloom_support_ops_rpc('campaign_facts', jsonb_build_object('actor', :'jeff', 'account_id', :'greenleaf', 'campaign_id', '40000000-0000-4000-8000-000000000004'))->>'fingerprint' AS fp4 \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_schedule', '{"actor":"%s","account_id":"%s","campaign_id":"40000000-0000-4000-8000-000000000004","scheduled_at":"2099-01-01T00:00:00Z","fingerprint":"%s"}'::jsonb)$q$, :'jeff', :'greenleaf', :'fp4'), 'no audience');
SELECT pg_temp.assert(public.bloom_support_ops_rpc('campaign_schedule', jsonb_build_object('actor', :'jeff', 'account_id', :'greenleaf', 'campaign_id', '40000000-0000-4000-8000-000000000001', 'scheduled_at', (now() + interval '1 day')::text, 'fingerprint', (:'facts'::jsonb)->>'fingerprint'))->'after'->>'status' = 'scheduled', 'Jeff schedules client campaign');
SELECT pg_temp.assert((SELECT status FROM public.crm_campaigns WHERE id = '40000000-0000-4000-8000-000000000001') = 'scheduled', 'campaign row scheduled');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_schedule', '{"actor":"%s","account_id":"%s","campaign_id":"40000000-0000-4000-8000-000000000002","scheduled_at":"2099-01-01T00:00:00Z"}'::jsonb)$q$, :'jeff', :'greenleaf'), 'another tenant');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_schedule', '{"actor":"%s","account_id":"%s","campaign_id":"40000000-0000-4000-8000-000000000003","scheduled_at":"2099-01-01T00:00:00Z"}'::jsonb)$q$, :'jeff', :'greenleaf'), 'locked');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_schedule', '{"actor":"%s","account_id":"%s","campaign_id":"40000000-0000-4000-8000-000000000001","scheduled_at":"2099-01-01T00:00:00Z"}'::jsonb)$q$, :'sam', :'greenleaf'), 'ops.campaign.send');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ops_rpc('campaign_list', '{"actor":"%s","account_id":"%s"}'::jsonb)$q$, :'gail', :'greenleaf'), 'ops.campaign.edit');
SELECT pg_temp.assert(jsonb_array_length(public.bloom_support_ops_rpc('campaign_list', jsonb_build_object('actor', :'sam', 'account_id', :'greenleaf'))) = 3, 'Support reads tenant campaigns only');
SELECT pg_temp.assert(public.bloom_support_ops_rpc('campaign_unschedule', jsonb_build_object('actor', :'jeff', 'account_id', :'greenleaf', 'campaign_id', '40000000-0000-4000-8000-000000000001'))->'after'->>'status' = 'draft', 'undo schedule');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'public.bloom_support_ops_rpc(text,jsonb)', 'execute'), 'ops gateway is service-only');

-- 13. Service identities resolve server-side, idempotently, one scope each.
SELECT pg_temp.rpc('ensure_service_principal', '{"scope":"automation"}'::jsonb)#>>'{}' AS svc1 \gset
SELECT pg_temp.assert(pg_temp.rpc('ensure_service_principal', '{"scope":"automation"}'::jsonb)#>>'{}' = :'svc1', 'service principal is stable');
SELECT pg_temp.expect_error($q$SELECT public.bloom_support_rpc('ensure_service_principal', '{"scope":"admin"}'::jsonb)$q$, 'invalid service scope');

-- 14. Escalations get an owner and a deadline; an unanswered one falls back to the other owner, then alerts.
SELECT id AS esc FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND reason = 'engineering_awaiting_approval' \gset
SELECT pg_temp.assert((SELECT owner_id = :'jon' AND due_at > now() FROM bloom_support.escalations WHERE id = :'esc'), 'approval escalation owned by Jon with a deadline');
UPDATE bloom_support.escalations SET status = 'open', due_at = now() - interval '1 minute' WHERE id = :'esc';
SELECT bloom_support.sweep_deadlines();
SELECT pg_temp.assert((SELECT owner_id = :'jeff' AND fallback_level = 1 AND audience = 'both' FROM bloom_support.escalations WHERE id = :'esc'), 'falls back to Jeff');
UPDATE bloom_support.escalations SET due_at = now() - interval '1 minute' WHERE id = :'esc';
SELECT bloom_support.sweep_deadlines();
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.alerts WHERE condition = 'escalation_unanswered'), 'second miss raises an independent alert');
SELECT pg_temp.rpc('acknowledge_escalation', jsonb_build_object('actor', :'jeff', 'escalation_id', :'esc', 'note', 'on it'));
SELECT pg_temp.assert((SELECT status = 'acknowledged' AND owner_id = :'jeff' FROM bloom_support.escalations WHERE id = :'esc'), 'acknowledged');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('acknowledge_escalation', '{"actor":"%s","escalation_id":"%s"}'::jsonb)$q$, :'sam', :'esc'), 'escalations.resolve');
-- Overdue tickets escalate once.
UPDATE bloom_support.tickets SET due_at = now() - interval '1 hour' WHERE id = :'t3id';
SELECT bloom_support.sweep_deadlines(); SELECT bloom_support.sweep_deadlines();
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.escalations WHERE dedupe_key = 'overdue:' || :'t3id') = 1, 'overdue ticket escalated once');
SELECT pg_temp.assert((SELECT due_at IS NOT NULL FROM bloom_support.tickets WHERE id = :'t1id'), 'tickets carry a response deadline');

-- 15. Watchdog works without any Edge Function: no worker heartbeat → alert recorded.
SELECT bloom_support.watchdog() AS wd \gset
SELECT pg_temp.assert((:'wd'::jsonb)->'findings' @> '[{"condition":"worker_not_running"}]', 'watchdog detects a stopped worker');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.alerts WHERE condition = 'worker_not_running' AND delivered = 'no_channel'), 'alert recorded; no email channel configured here');
SELECT pg_temp.rpc('worker_run_start', '{"worker":"w1"}'::jsonb)#>>'{}' AS run \gset
SELECT pg_temp.rpc('worker_run_finish', jsonb_build_object('run_id', :'run', 'processed', 3, 'failed', 0, 'note', 'ok'));
SELECT pg_temp.assert(NOT ((bloom_support.watchdog())->'findings' @> '[{"condition":"worker_not_running"}]'), 'heartbeat clears the condition');
SELECT pg_temp.assert(NOT pg_temp.rpc('verify_worker_token', '{"token":"anything-at-all-anything-at-all-anything"}'::jsonb)::boolean, 'no vault token here: worker trigger refused');

-- 16. Knowledge: only approved client-audience articles are searchable for answers.
INSERT INTO bloom_support.knowledge(product, title, body, audience, approved) VALUES
  ('crm','Scheduling campaigns','Open the campaign and choose Schedule to pick a send time.','client', true),
  ('crm','Scheduling internals','Campaign scheduling uses claim_scheduled_campaigns internally.','internal', true),
  ('crm','Scheduling draft','Unreviewed scheduling notes.','client', false);
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('search_knowledge', '{"product":"crm","q":"scheduling"}'::jsonb)) = 1, 'internal and unapproved articles never used for answers');

-- 17. OAuth: staff only, single-use codes, rotating refresh.
SELECT pg_temp.rpc('oauth_register_client', '{"client_name":"ChatGPT","redirect_uris":["https://chatgpt.com/connector_platform_oauth_redirect"]}'::jsonb)#>>'{}' AS cid \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('oauth_issue_code', '{"actor":"%s","client_id":"%s","redirect_uri":"https://chatgpt.com/connector_platform_oauth_redirect","code_challenge":"%s","scope":"write","code_hash":"c0"}'::jsonb)$q$, :'gail', :'cid', repeat('a',43)), 'only Brands in Blooms staff');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('oauth_issue_code', '{"actor":"%s","client_id":"%s","redirect_uri":"https://evil.example/cb","code_challenge":"%s","scope":"write","code_hash":"c0"}'::jsonb)$q$, :'jeff', :'cid', repeat('a',43)), 'redirect_uri');
SELECT pg_temp.rpc('oauth_issue_code', jsonb_build_object('actor', :'jeff', 'client_id', :'cid', 'redirect_uri', 'https://chatgpt.com/connector_platform_oauth_redirect', 'code_challenge', repeat('a',43), 'scope', 'write', 'code_hash', 'c1'));
SELECT pg_temp.assert(pg_temp.rpc('oauth_consume_code', jsonb_build_object('code_hash','c1','client_id', :'cid','redirect_uri','https://chatgpt.com/connector_platform_oauth_redirect'))->>'principal_id' = :'jeff', 'code exchanges for Jeff');
SELECT pg_temp.assert(pg_temp.rpc('oauth_consume_code', jsonb_build_object('code_hash','c1','client_id', :'cid','redirect_uri','https://chatgpt.com/connector_platform_oauth_redirect')) IS NULL, 'code is single-use');
SELECT pg_temp.rpc('oauth_issue_tokens', jsonb_build_object('principal_id', :'jeff', 'client_id', :'cid', 'scope', 'write', 'access_hash', 'a1', 'access_prefix', 'bsk_x', 'refresh_hash', 'r1'));
SELECT pg_temp.assert(pg_temp.rpc('authenticate_api_key', '{"hash":"a1"}'::jsonb)->>'principal_id' = :'jeff', 'access token authenticates as Jeff');
SELECT pg_temp.rpc('oauth_issue_tokens', jsonb_build_object('principal_id', :'jeff', 'client_id', :'cid', 'scope', 'write', 'access_hash', 'a2', 'access_prefix', 'bsk_x', 'refresh_hash', 'r2', 'old_refresh_hash', 'r1'));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('oauth_issue_tokens', '{"principal_id":"%s","client_id":"%s","scope":"write","access_hash":"a3","access_prefix":"x","refresh_hash":"r3","old_refresh_hash":"r1"}'::jsonb)$q$, :'jeff', :'cid'), 'invalid refresh token');
SELECT pg_temp.assert((pg_temp.rpc('readiness_facts', jsonb_build_object('actor', :'jon')) ? 'worker'), 'readiness facts');
SELECT id AS oauthkey FROM bloom_support.api_keys WHERE key_hash = 'a2' \gset
SELECT pg_temp.rpc('revoke_api_key', jsonb_build_object('actor', :'jeff', 'key_id', :'oauthkey'));
SELECT pg_temp.assert(pg_temp.rpc('oauth_refresh_lookup', '{"refresh_hash":"r2"}'::jsonb) IS NULL, 'revoking the OAuth key revokes the refresh token');

-- 18. Status rules: valid transitions, waiting reasons, Needs Jon/Jeff as an escalation, history.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'sam', 'ticket', jsonb_build_object('product','crm','channel','staff','subject','How do I export customers?','body','Client asked by phone how to export customers to CSV.','account_id', :'greenleaf','kind_hint','question'))) ->>'ticket_id' AS q1 \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"waiting","waiting_reason":"lunch"}}'::jsonb)$q$, :'sam', :'q1'), 'waiting requires a reason');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"waiting","waiting_reason":"third_party"}'::jsonb));
SELECT pg_temp.assert((SELECT waiting_reason = 'third_party' AND waiting_since IS NOT NULL FROM bloom_support.tickets WHERE id = :'q1'), 'waiting reason and since recorded');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"needs_owner"}}'::jsonb)$q$, :'sam', :'q1'), 'decision_needed');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"needs_owner","decision_needed":"Can we give this client a custom export?","accountable":"jeff","recommendation":"Offer the standard CSV export","decision_due_at":"2099-01-01T00:00:00Z"}'::jsonb));
SELECT pg_temp.assert((SELECT owner_id = :'jeff' AND recommendation IS NOT NULL AND due_at = '2099-01-01T00:00:00Z' FROM bloom_support.escalations WHERE ticket_id = :'q1' AND reason = 'decision_needed'), 'Needs Jon/Jeff records decision, accountable person, recommendation, due');
SELECT pg_temp.assert((SELECT waiting_reason IS NULL FROM bloom_support.tickets WHERE id = :'q1'), 'no contradictory waiting reason outside Waiting');

-- 19. Resolution evidence per type; meaningful responses vs acknowledgements.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"done"}}'::jsonb)$q$, :'sam', :'q1'), 'answer the question');
SELECT pg_temp.assert((SELECT first_response_at IS NULL FROM bloom_support.tickets WHERE id = :'q1'), 'no meaningful response yet');
SELECT (SELECT due_at FROM bloom_support.tickets WHERE id = :'q1') AS due_before \gset
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"working"}'::jsonb));
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'message', '{"body":"Thanks, we got it.","purpose":"acknowledgement"}'::jsonb));
SELECT pg_temp.assert((SELECT first_response_at IS NULL FROM bloom_support.tickets WHERE id = :'q1'), 'acknowledgement is not a meaningful response');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'message', '{"body":"Go to Customers → Export → CSV."}'::jsonb));
SELECT pg_temp.assert((SELECT first_response_at IS NOT NULL AND last_team_message_at IS NOT NULL FROM bloom_support.tickets WHERE id = :'q1'), 'answer sets first response');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"resolved","resolution_summary":"Explained the CSV export"}'::jsonb));
SELECT pg_temp.assert((SELECT resolution_evidence ? 'answer_message_id' AND resolution_evidence->>'type' = 'question' FROM bloom_support.tickets WHERE id = :'q1'), 'question resolution cites the answer');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.ticket_events WHERE ticket_id = :'q1' AND kind = 'status') >= 5, 'status history persisted');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"waiting","waiting_reason":"customer"}}'::jsonb)$q$, :'sam', :'q1'), 'invalid transition');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'sam', 'ticket', jsonb_build_object('product','crm','body','Please add dark mode to the CRM','account_id', :'greenleaf','kind_hint','feature'))) ->>'ticket_id' AS fq \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"ok"}}'::jsonb)$q$, :'sam', :'fq'), 'product decision queue');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'sam', 'ticket', jsonb_build_object('product','cms','body','Change our store hours on the website','account_id', :'greenleaf','kind_hint','change'))) ->>'ticket_id' AS cq \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"ok"}}'::jsonb)$q$, :'sam', :'cq'), 'saved result and its verification');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'cq', 'patch', '{"status":"resolved","resolution_summary":"Hours updated","resolution_evidence":{"verified_note":"Checked the live footer shows 9-5"}}'::jsonb));

-- 20. Timers: our clock pauses for customer waits but not internal waits.
UPDATE bloom_support.settings SET value = value || '{"enabled":false}' WHERE key = 'business_hours';
INSERT INTO bloom_support.tickets(conversation_id, account_id, product, channel, subject, summary, created_at)
SELECT conversation_id, account_id, 'crm', 'staff', 'Timer test', 'x', now() - interval '10 hours' FROM bloom_support.tickets WHERE id = :'q1' RETURNING id AS tt \gset
INSERT INTO bloom_support.ticket_events(ticket_id, kind, to_value, at) VALUES
  (:'tt', 'status', 'waiting:customer', now() - interval '8 hours'), (:'tt', 'status', 'working', now() - interval '5 hours'), (:'tt', 'status', 'waiting:internal', now() - interval '2 hours');
SELECT bloom_support.ticket_timers(:'tt') AS tm \gset
SELECT pg_temp.assert(abs(((:'tm'::jsonb)->>'our_clock_seconds')::int - 7*3600) < 120 AND abs(((:'tm'::jsonb)->>'waiting_customer_seconds')::int - 3*3600) < 120, 'our clock 7h, customer 3h: ' || :'tm');
-- Business hours: Mon 2026-11-02 08:00–18:00 UTC = 8 business hours; Friday 16:00 + 2h = Monday 10:00.
UPDATE bloom_support.settings SET value = '{"enabled":true,"timezone":"UTC","days":[1,2,3,4,5],"start":"09:00","end":"17:00","holidays":["2026-11-03"]}' WHERE key = 'business_hours';
SELECT pg_temp.assert(bloom_support.business_seconds('2026-11-02 08:00Z', '2026-11-02 18:00Z') = 8*3600, 'business seconds in one day');
SELECT pg_temp.assert(bloom_support.business_seconds('2026-11-02 08:00Z', '2026-11-04 18:00Z') = 16*3600, 'holiday excluded');
SELECT pg_temp.assert(bloom_support.add_business_seconds('2026-11-06 16:00Z', 7200) = '2026-11-09 10:00Z', 'Friday 16:00 + 2 business hours = Monday 10:00');
UPDATE bloom_support.settings SET value = value || '{"enabled":false}' WHERE key = 'business_hours';

-- 21. Merge within one client; refuse across clients; email replies follow the merge.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','body','Campaign preview still broken (second report)','account_id', :'greenleaf','email', '{"message_id":"<dup1@x>","thread_root":"<dup1@x>"}'::jsonb)))->>'ticket_id' AS dupt \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('merge_tickets', '{"actor":"%s","source_id":"%s","target_id":"%s"}'::jsonb)$q$, :'sam', :'dupt', :'t3id'), 'different clients');
SELECT pg_temp.rpc('merge_tickets', jsonb_build_object('actor', :'sam', 'source_id', :'dupt', 'target_id', :'t1id', 'reason', 'same report'));
SELECT pg_temp.assert((SELECT merged_into = :'t1id' AND status = 'resolved' FROM bloom_support.tickets WHERE id = :'dupt'), 'source points at target');
SELECT pg_temp.assert(pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'gail', 'ticket_id', :'t1id'))::text LIKE '%second report%', 'target shows merged messages');
SELECT pg_temp.assert(pg_temp.rpc('match_email_thread', '{"refs":["<dup1@x>"]}'::jsonb)#>>'{}' = :'t1id', 'email reply to merged ticket goes to the target');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'sam'))) x WHERE x->>'id' = :'dupt'), 'merged ticket not listed');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"hi"}}'::jsonb)$q$, :'gail', :'dupt'), 'merged into another ticket');

-- 22. Replies after resolution: not reopened blindly.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'gail', 'ticket_id', :'cq', 'message', '{"body":"Thanks! Also, can you add a holiday banner?"}'::jsonb)) ->>'message_id' AS pm \gset
SELECT pg_temp.assert((SELECT status = 'resolved' AND pending_review = 'reply_after_resolution' FROM bloom_support.tickets WHERE id = :'cq'), 'reply on resolved is routed for review, not reopened');
SELECT pg_temp.rpc('resolve_post_reply', jsonb_build_object('actor', :'sam', 'ticket_id', :'cq', 'decision', 'new_ticket', 'message_id', :'pm'));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.ticket_links l JOIN bloom_support.tickets n ON n.id = l.from_ticket WHERE l.to_ticket = :'cq' AND l.kind = 'follow_up' AND n.conversation_id = (SELECT conversation_id FROM bloom_support.tickets WHERE id = :'cq')) = 1, 'distinct request becomes a linked ticket in the same conversation');
SELECT pg_temp.assert((SELECT status = 'resolved' AND pending_review IS NULL FROM bloom_support.tickets WHERE id = :'cq'), 'original stays resolved');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'gail', 'ticket_id', :'q1', 'message', '{"body":"The export button is still greyed out"}'::jsonb)) ->>'message_id' AS pm2 \gset
SELECT pg_temp.rpc('resolve_post_reply', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'decision', 'reopen', 'message_id', :'pm2'));
SELECT pg_temp.assert((SELECT status = 'working' AND reopen_count = 1 FROM bloom_support.tickets WHERE id = :'q1'), 'persisting issue reopens');

-- 23. Client actions; Bloom stays out once a person is requested.
SELECT pg_temp.rpc('client_action', jsonb_build_object('actor', :'gail', 'ticket_id', :'q1', 'action', 'request_person', 'message', 'Can someone call me?'));
SELECT pg_temp.assert((SELECT executor = 'person' AND automation = 'human' FROM bloom_support.tickets WHERE id = :'q1'), 'client can ask for a person');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Bloom here","visibility":"public"}}'::jsonb)$q$, :'bot', :'q1'), 'human control');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('client_action', '{"actor":"%s","ticket_id":"%s","action":"request_person"}'::jsonb)$q$, :'rosa', :'q1'), 'forbidden: ticket');

-- 24. Stale plans are invalidated by new customer input.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','body','How do I change my logo in emails?','account_id', :'greenleaf')))->>'ticket_id' AS sp \gset
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'sp', 'message', '{"body":"Planned answer","purpose":"reply","idempotency_key":"planned-1"}'::jsonb));
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'gail', 'ticket_id', :'sp', 'message', '{"body":"Actually I meant the website logo"}'::jsonb));
SELECT pg_temp.assert((SELECT delivery = 'suppressed' FROM bloom_support.messages WHERE idempotency_key = 'planned-1'), 'stale Bloom reply suppressed');
SELECT pg_temp.assert((SELECT status = 'cancelled' FROM bloom_support.jobs j WHERE j.kind = 'send_email' AND j.payload->>'message_id' = (SELECT id::text FROM bloom_support.messages WHERE idempotency_key = 'planned-1')), 'its send job cancelled');

-- 25. Revocation: a deactivated person loses access immediately, including queued actions they confirmed.
SELECT pg_temp.rpc('record_operation_preview', jsonb_build_object('actor', :'sam', 'operation', jsonb_build_object('account_id', :'greenleaf','kind','campaign.update_draft','permission','ops.campaign.edit','inputs','{}'::jsonb,'idempotency_key','op-revoke'))) ->>'id' AS rop \gset
UPDATE bloom_support.principals SET active = false WHERE id = :'sam';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('claim_operation', '{"actor":"%s","operation_id":"%s"}'::jsonb)$q$, :'sam', :'rop'), 'ops.campaign.edit');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('get_ticket', '{"actor":"%s","ticket_id":"%s"}'::jsonb)$q$, :'sam', :'t3id'), 'forbidden');
UPDATE bloom_support.principals SET active = true WHERE id = :'sam';

-- 26. Bulk changes need confirmation when consequential.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('bulk_update', '{"actor":"%s","ticket_ids":["%s"],"bulk":{"patch":{"status":"resolved","resolution_summary":"x"}}}'::jsonb)$q$, :'jeff', :'sp'), 'type 1 to confirm');
SELECT pg_temp.rpc('bulk_update', jsonb_build_object('actor', :'jeff', 'ticket_ids', jsonb_build_array(:'sp', :'t3id'), 'bulk', '{"add_tags":["vip"]}'::jsonb)) AS bulk \gset
SELECT pg_temp.assert(jsonb_array_length((:'bulk'::jsonb)->'updated') = 2 AND (SELECT 'vip' = ANY(tags) FROM bloom_support.tickets WHERE id = :'sp'), 'bulk tagging');

-- 27. Shared problem: two clients, one investigation, private conversations.
SELECT pg_temp.rpc('create_problem', '{"problem":{"title":"Receipts not printing","product":"pos"}}'::jsonb || jsonb_build_object('actor', :'jeff'))->>'id' AS pbm \gset
SELECT pg_temp.rpc('link_problem', jsonb_build_object('actor', :'jeff', 'ticket_id', :'t3id', 'problem_id', :'pbm'));
SELECT pg_temp.rpc('link_problem', jsonb_build_object('actor', :'jeff', 'ticket_id', :'sp', 'problem_id', :'pbm'));
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'jeff', 'ticket_id', :'t3id', 'issue', '{}'::jsonb))->>'engineering_issue_id' AS pe \gset
SELECT pg_temp.assert(pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'jeff', 'ticket_id', :'sp', 'issue', '{}'::jsonb))->>'engineering_issue_id' = :'pe', 'second client joins the same investigation');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('get_ticket', '{"actor":"%s","ticket_id":"%s"}'::jsonb)$q$, :'rosa', :'sp'), 'forbidden: ticket');
SELECT pg_temp.rpc('update_problem', jsonb_build_object('actor', :'jeff', 'problem_id', :'pbm', 'patch', '{"status":"resolved"}'::jsonb));
SELECT pg_temp.assert((SELECT status <> 'resolved' FROM bloom_support.tickets WHERE id = :'sp'), 'closing the problem does not resolve linked tickets');

-- 28. Spam is excluded; scoped and per-client pauses.
SELECT pg_temp.rpc('set_spam', jsonb_build_object('actor', :'sam', 'ticket_id', :'fq', 'spam', true));
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'sam'))) x WHERE x->>'id' = :'fq'), 'spam hidden from queues');
UPDATE bloom_support.jobs SET status = 'cancelled' WHERE status IN ('queued','running');
SELECT pg_temp.rpc('enqueue_job', jsonb_build_object('actor', :'bot', 'kind', 'send_email', 'ticket_id', :'t3id', 'lane', 'scope-test-email', 'payload', '{}'::jsonb, 'idempotency_key', 'scope-e'));
SELECT pg_temp.rpc('enqueue_job', jsonb_build_object('actor', :'bot', 'kind', 'triage', 'ticket_id', :'t3id', 'lane', 'scope-test-triage', 'payload', '{}'::jsonb, 'idempotency_key', 'scope-t'));
UPDATE bloom_support.settings SET value = '{"triage":true,"answer":true,"email":false,"operations":true,"engineering":true}' WHERE key = 'automation_scopes';
SELECT pg_temp.assert((SELECT array_agg(kind) FROM bloom_support.claim_jobs('scope-worker', 10)) = ARRAY['triage'], 'email scope paused, triage still runs');
UPDATE bloom_support.settings SET value = '{"triage":true,"answer":true,"email":true,"operations":true,"engineering":true}' WHERE key = 'automation_scopes';
UPDATE bloom_support.jobs SET status = 'cancelled' WHERE status IN ('queued','running');
UPDATE bloom_support.accounts SET automation_paused = true WHERE id = :'rose';
SELECT pg_temp.rpc('enqueue_job', jsonb_build_object('actor', :'bot', 'kind', 'triage', 'ticket_id', :'t3id', 'lane', 'acct-pause', 'payload', '{}'::jsonb, 'idempotency_key', 'acct-p'));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.claim_jobs('scope-worker', 10)) = 0, 'paused client gets no automation; intake unaffected');
UPDATE bloom_support.accounts SET automation_paused = false WHERE id = :'rose';

-- 29. Delivery events, pagination, reporting, redaction.
INSERT INTO bloom_support.outbound_emails(ticket_id, purpose, to_email, subject, body, rfc_message_id, idempotency_key, status, provider_id)
VALUES (:'t3id', 'reply', 'till@rosehill.test', 's', 'b', '<o1@x>', 'deliv-1', 'sent', 're_99');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"re_99","type":"email.bounced"}'::jsonb);
SELECT pg_temp.assert((SELECT status = 'bounced' FROM bloom_support.outbound_emails WHERE provider_id = 're_99'), 'bounce recorded');
SELECT pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'jeff', 'filters', jsonb_build_object('envelope', 'true', 'limit', 3, 'sort', 'updated'))) AS pg1 \gset
SELECT pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'jeff', 'filters', jsonb_build_object('envelope', 'true', 'limit', 3, 'sort', 'updated', 'cursor', (:'pg1'::jsonb)->>'next_cursor'))) AS pg2 \gset
SELECT pg_temp.assert(jsonb_array_length((:'pg1'::jsonb)->'items') = 3 AND NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements((:'pg1'::jsonb)->'items') a JOIN jsonb_array_elements((:'pg2'::jsonb)->'items') b ON a->>'id' = b->>'id'), 'keyset pages do not overlap');
SELECT pg_temp.assert(((:'pg1'::jsonb)->>'total')::int = (SELECT count(*) FROM bloom_support.tickets WHERE merged_into IS NULL AND NOT spam AND redacted_at IS NULL), 'total excludes spam and merged');
SELECT pg_temp.rpc('report_metrics', jsonb_build_object('actor', :'jeff')) AS rm \gset
SELECT pg_temp.assert((SELECT (x->>'incoming')::int FROM jsonb_array_elements((:'rm'::jsonb)->'daily') x ORDER BY x->>'day' DESC LIMIT 1)
  = (SELECT count(*) FROM bloom_support.tickets WHERE created_at >= date_trunc('day', now()) AND NOT spam AND merged_into IS NULL), 'incoming matches tickets created today');
SELECT pg_temp.assert(((:'rm'::jsonb)->'handling'->>'verified_autonomous')::int <= ((:'rm'::jsonb)->'handling'->>'by_bloom')::int, 'verified autonomous is a subset of Bloom resolutions');
SELECT pg_temp.assert((:'rm'::jsonb)->'definitions' ? 'verified_autonomous', 'metrics carry definitions');
SELECT pg_temp.assert((pg_temp.rpc('summary_report', '{"period":"daily"}'::jsonb)) ? 'oldest', 'digest summary');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('redact_ticket', '{"actor":"%s","ticket_id":"%s","reason":"x"}'::jsonb)$q$, :'jeff', :'cq'), 'admin.policy');
SELECT pg_temp.rpc('redact_ticket', jsonb_build_object('actor', :'jon', 'ticket_id', :'cq', 'reason', 'client deletion request'));
SELECT pg_temp.assert((SELECT subject = '[redacted]' FROM bloom_support.tickets WHERE id = :'cq') AND EXISTS (SELECT 1 FROM bloom_support.ticket_events WHERE ticket_id = :'cq' AND kind = 'redacted')
  AND EXISTS (SELECT 1 FROM bloom_support.activity WHERE ticket_id = :'cq' AND action = 'ticket.redacted'), 'redaction keeps history and audit');
SELECT bloom_support.sweep_operational() AS so \gset
SELECT pg_temp.assert((:'so'::jsonb) ? 'notifications', 'notification sweep runs');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.notifications WHERE dedupe_key LIKE 'unassigned:%') = (SELECT count(DISTINCT dedupe_key) FROM bloom_support.notifications WHERE dedupe_key LIKE 'unassigned:%'), 'notifications deduplicated');

-- 30. Review fixes: per-caller idempotency keys, tenant moves revoke membership, approval resumes release,
--     retries of unaccepted Bloom sends respect takeover.
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000f1','email','mal@other.test','name','Mal','tenant_id','30000000-0000-4000-8000-0000000000f1','tenant_name','Other Co'))#>>'{}' AS mal \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'mal', 'ticket', jsonb_build_object('product','crm','channel','crm','subject','Mine','body','Reusing someone else''s key','dedupe_key','crm:abc'))) AS malt \gset
SELECT pg_temp.assert((:'malt'::jsonb)->>'ticket_id' <> (:'t1'::jsonb)->>'ticket_id' AND NOT coalesce(((:'malt'::jsonb)->>'duplicate_delivery')::boolean, false), 'another caller''s idempotency key never returns their ticket');
SELECT id AS othercrm FROM bloom_support.accounts WHERE crm_tenant_id = '30000000-0000-4000-8000-0000000000f1' \gset
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000f1','email','mal@other.test','name','Mal','tenant_id','30000000-0000-4000-8000-0000000000f2','tenant_name','New Co'));
SELECT pg_temp.assert(NOT bloom_support.can_access_account(:'mal', :'othercrm'), 'moving tenants revokes the old CRM account membership');
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000f1','email','mal@other.test','name','Mal'));
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.account_members m JOIN bloom_support.accounts a ON a.id = m.account_id WHERE m.principal_id = :'mal' AND m.verified AND a.crm_tenant_id IS NOT NULL), 'removal from a tenant revokes all CRM account membership');
UPDATE bloom_support.engineering_issues SET status = 'awaiting_approval' WHERE id = :'eng';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon', 'issue_id', :'eng', 'update', '{"status":"approved"}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE engineering_issue_id = :'eng' AND kind = 'engineering_step' AND payload->>'step' = 'evaluate' AND status = 'queued'), 'approval queues the release evaluation');
INSERT INTO bloom_support.outbound_emails(ticket_id, purpose, to_email, subject, body, rfc_message_id, idempotency_key, status)
VALUES (:'t2id', 'progress', 'web@greenleaf.test', 's', 'b', '<x2@bloom>', 'prog-retry', 'failed');
SELECT pg_temp.rpc('set_automation', jsonb_build_object('actor', :'jeff', 'ticket_id', :'t2id', 'mode', 'human'));
SELECT pg_temp.assert(pg_temp.rpc('queue_outbound_email', jsonb_build_object('email', jsonb_build_object('ticket_id', :'t2id','purpose','progress','to','web@greenleaf.test','subject','s','body','b','rfc_message_id','<x3@bloom>','idempotency_key','prog-retry','bloom_initiated',true)))->>'status' = 'suppressed', 'a retried Bloom send is suppressed after takeover');


-- 31. Delivery readiness survives the sent -> delivered transition.
-- Isolate these ledger fixtures so all earlier email checks retain their state.
BEGIN;
UPDATE bloom_support.outbound_emails SET sent_at = NULL;
INSERT INTO bloom_support.outbound_emails(purpose,to_email,subject,body,rfc_message_id,idempotency_key,status,sent_at) VALUES
 ('notification','test@example.test','readiness','x','<readiness-sent@test>','readiness-sent','sent','2020-01-01T00:00:00Z'),
 ('notification','test@example.test','readiness','x','<readiness-delivered@test>','readiness-delivered','delivered','2020-01-02T00:00:00Z'),
 ('notification','test@example.test','readiness','x','<readiness-failed@test>','readiness-failed','failed','2020-01-03T00:00:00Z');
SELECT pg_temp.assert((bloom_support.readiness_facts(:'jon')#>>'{last_seen,email_sent}')::timestamptz = '2020-01-02T00:00:00Z', 'delivered mail remains evidence of successful sending; newer failed mail is excluded');
UPDATE bloom_support.outbound_emails SET status='bounced' WHERE idempotency_key='readiness-delivered';
SELECT pg_temp.assert((bloom_support.readiness_facts(:'jon')#>>'{last_seen,email_sent}')::timestamptz = '2020-01-01T00:00:00Z', 'bounced mail does not replace the last accepted send');
UPDATE bloom_support.outbound_emails SET status='suppressed' WHERE idempotency_key='readiness-sent';
SELECT pg_temp.assert((bloom_support.readiness_facts(:'jon')#>>'{last_seen,email_sent}') IS NULL, 'failed, bounced and suppressed mail are not successful readiness evidence');
ROLLBACK;


-- 32. Public help and reviewed answers share only approved client knowledge.
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.bloom_support_public_knowledge(text)','execute')
  AND NOT has_function_privilege('authenticated','public.bloom_support_public_knowledge(text)','execute')
  AND has_function_privilege('service_role','public.bloom_support_public_knowledge(text)','execute'), 'help projection is service-role only');
SELECT pg_temp.assert(jsonb_array_length(public.bloom_support_public_knowledge('crm')) = 1, 'public help excludes internal and draft articles');
SELECT pg_temp.assert(NOT ((public.bloom_support_public_knowledge('crm')->0) ? 'approved_by'), 'public help omits the approver identity');
SELECT pg_temp.assert(jsonb_array_length(bloom_support.search_knowledge('crm','Could you explain scheduling with pineapple?',5)) = 1, 'natural questions retrieve a matching approved answer even with unmatched words');
SELECT pg_temp.assert(jsonb_array_length(bloom_support.search_knowledge('pos','scheduling',5)) = 0, 'knowledge search stays product-scoped');
SELECT pg_temp.assert(jsonb_array_length(bloom_support.search_knowledge('crm','and the or',5)) = 0, 'stopword-only questions return no answer');
SELECT bloom_support.upsert_knowledge(:'sam','{"product":"platform","title":"Support draft","body":"Use the support tracking link.","audience":"client","approved":true}'::jsonb) AS kb_draft \gset
SELECT pg_temp.assert(NOT ((:'kb_draft'::jsonb)->>'approved')::boolean, 'Support can draft but cannot approve');
SELECT bloom_support.upsert_knowledge(:'jeff',jsonb_build_object('id',(:'kb_draft'::jsonb)->>'id','expected_updated_at',(:'kb_draft'::jsonb)->>'updated_at','approved',true)) AS kb_approved \gset
SELECT pg_temp.assert(((:'kb_approved'::jsonb)->>'approved')::boolean, 'Jeff approves an article');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM jsonb_array_elements(public.bloom_support_public_knowledge('pos')) a WHERE a->>'id'=(:'kb_draft'::jsonb)->>'id'), 'platform articles appear for each product');
SELECT bloom_support.upsert_knowledge(:'sam',jsonb_build_object('id',(:'kb_approved'::jsonb)->>'id','expected_updated_at',(:'kb_approved'::jsonb)->>'updated_at','body','Updated draft requiring review')) AS kb_edited \gset
SELECT pg_temp.assert(NOT ((:'kb_edited'::jsonb)->>'approved')::boolean, 'editing withdraws prior approval');
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.upsert_knowledge('%s','{"id":"%s","expected_updated_at":"%s","approved":true}'::jsonb)$q$, :'jeff', (:'kb_approved'::jsonb)->>'id', (:'kb_approved'::jsonb)->>'updated_at'), 'article changed');
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.upsert_knowledge('%s','{"product":"platform","title":"x","body":"x"}'::jsonb)$q$, :'bot'), 'only staff');
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.upsert_knowledge('%s','{"product":"platform","title":"x","body":"x"}'::jsonb)$q$, :'gail'), 'tickets.write');
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.upsert_knowledge('%s','{"product":"platform","title":"  ","body":"x"}'::jsonb)$q$, :'jeff'), 'title');

\echo 'bloom-support-db: all assertions passed'
