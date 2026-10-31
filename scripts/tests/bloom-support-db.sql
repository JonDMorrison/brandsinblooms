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
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed","resolution_verified":true,"resolution_evidence":{"deployment":{"state":"success"},"verification":{"passed":false}}}}'::jsonb)$q$, :'bot', :'t2id'), 'user-flow check');
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
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'will', 'ticket_id', :'t2id', 'message', '{"body":"Still broken on my iPhone"}'::jsonb));
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

\echo 'bloom-support-db: all assertions passed'
