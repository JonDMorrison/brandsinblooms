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
CREATE EXTENSION IF NOT EXISTS dblink;

\ir ../../supabase/migrations/20261031120000_bloom_support_core.sql
\ir ../../supabase/migrations/20261031120100_bloom_support_functions.sql
\ir ../../supabase/migrations/20261031120200_bloom_support_gateway.sql
\ir ../../supabase/migrations/20261031120300_bloom_support_campaign_ops.sql
\ir ../../supabase/migrations/20261031140000_bloom_support_operations_hardening.sql
\ir ../../supabase/migrations/20261031150000_bloom_support_desk.sql
\ir ../../supabase/migrations/20261101030000_bloom_support_delivery_readiness.sql
\ir ../../supabase/migrations/20261101035144_bloom_support_knowledge_publication.sql
\ir ../../supabase/migrations/20261101051925_bloom_support_site_creation_recovery.sql
\ir ../../supabase/migrations/20261101140000_bloom_support_audit_hardening.sql
\ir ../../supabase/migrations/20261108221727_bloom_support_verified_email_identity.sql
-- Migration backfill fixture: preserve intentional post-resolution reply
-- review while removing stale waiting state.
INSERT INTO bloom_support.conversations(id, channel, subject)
VALUES ('f0000000-0000-4000-8000-000000000001', 'crm', 'Resolved reply migration fixture');
INSERT INTO bloom_support.tickets(
  id, conversation_id, product, channel, subject, summary, status, stage,
  resolved_at, pending_review, waiting_since
) VALUES (
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000001',
  'crm', 'crm', 'Resolved reply migration fixture',
  'A customer replied after resolution and staff still need to route it.',
  'resolved', 'resolved', now(), 'reply_after_resolution', now()
);
\ir ../../supabase/migrations/20261104200000_bloom_support_resolution_cleanup.sql
\ir ../../supabase/migrations/20261104210000_bloom_support_release_reconciliation.sql
\ir ../../supabase/migrations/20261105200000_bloom_support_email_design.sql
\ir ../../supabase/migrations/20261105220000_bloom_support_client_status.sql
\ir ../../supabase/migrations/20261105230000_bloom_support_admin_wording.sql
\ir ../../supabase/migrations/20261105235000_bloom_support_staff_job_failures.sql
\ir ../../supabase/migrations/20261106010000_bloom_support_mcp_mutation_idempotency.sql
\ir ../../supabase/migrations/20261106020000_bloom_support_email_delivery_lifecycle.sql
\ir ../../supabase/migrations/20261106030000_bloom_support_feature_decision_followup.sql
\ir ../../supabase/migrations/20261106040000_bloom_support_engineering_progress_email.sql
\ir ../../supabase/migrations/20261106050000_bloom_support_feature_decision_messages.sql
\ir ../../supabase/migrations/20261106110933_bloom_support_feature_shipments_and_knowledge.sql
\ir bloom-support-reliability-prerequisites.sql
\ir ../../supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql
\ir ../../supabase/migrations/20261107014000_bloom_support_operational_truth.sql

-- resolve_crm_user now proves that each CRM identity exists in Auth before it
-- records the durable principal link. These are the isolated fixture users.
INSERT INTO auth.users(id, email) VALUES
  ('20000000-0000-4000-8000-0000000000a1', 'owner@greenleaf.test'),
  ('20000000-0000-4000-8000-0000000000a2', 'coworker@greenleaf.test'),
  ('20000000-0000-4000-8000-0000000000f1', 'mal@other.test')
ON CONFLICT (id) DO NOTHING;

BEGIN;
\ir ../../supabase/migrations/20261107162000_bloom_support_engineering_handoff.sql
\ir ../../supabase/migrations/20261107162100_bloom_support_review_safety.sql
-- Match the release runner: migration and history stay in one transaction.
DO $$ BEGIN
  IF current_setting('lock_timeout') <> '2s' THEN
    RAISE EXCEPTION 'migration must not commit the runner transaction';
  END IF;
END $$;
COMMIT;

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

SELECT pg_temp.assert((
  SELECT pending_review = 'reply_after_resolution'
    AND waiting_since IS NULL
  FROM bloom_support.tickets
  WHERE id = 'f0000000-0000-4000-8000-000000000002'
), 'migration preserves post-resolution reply review while clearing stale waiting time');
ALTER TABLE bloom_support.ticket_events DISABLE TRIGGER ticket_events_append_only;
DELETE FROM bloom_support.ticket_events
WHERE ticket_id = 'f0000000-0000-4000-8000-000000000002';
ALTER TABLE bloom_support.ticket_events ENABLE TRIGGER ticket_events_append_only;
ALTER TABLE bloom_support.activity DISABLE TRIGGER activity_append_only;
DELETE FROM bloom_support.activity
WHERE ticket_id = 'f0000000-0000-4000-8000-000000000002';
ALTER TABLE bloom_support.activity ENABLE TRIGGER activity_append_only;
DELETE FROM bloom_support.tickets
WHERE id = 'f0000000-0000-4000-8000-000000000002';
DELETE FROM bloom_support.conversations
WHERE id = 'f0000000-0000-4000-8000-000000000001';

-- Privilege boundary: no client role may reach the schema or the gateway.
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'authenticated cannot call gateway');
SELECT pg_temp.assert(NOT has_function_privilege('anon', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'anon cannot call gateway');
SELECT pg_temp.assert(has_function_privilege('service_role', 'public.bloom_support_rpc(text,jsonb)', 'execute'), 'service_role can call gateway');
SELECT pg_temp.assert(NOT has_schema_privilege('authenticated', 'bloom_support', 'usage'), 'authenticated has no schema usage');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated', 'bloom_support.tickets', 'select'), 'authenticated cannot read tickets');
SELECT pg_temp.assert((
  SELECT count(*) = 5
    AND bool_and(coalesce(proconfig @> ARRAY['search_path=""'], false))
  FROM pg_proc
  WHERE oid = ANY(ARRAY[
    'bloom_support.status_for_stage(text)'::regprocedure,
    'bloom_support.reject_mutation()'::regprocedure,
    'bloom_support.engineering_transition_permission(text,text)'::regprocedure,
    'bloom_support.valid_transition(text,text)'::regprocedure,
    'bloom_support.client_progress(bloom_support.tickets)'::regprocedure
  ])
), 'security-advisor functions have an immutable empty search path');

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

-- A reply key confirms one exact actor/ticket/body/visibility tuple only.
SELECT pg_temp.rpc('add_message', jsonb_build_object(
  'actor', :'sam',
  'ticket_id', :'t3id',
  'message', '{"body":"Exact retry contract","visibility":"internal","idempotency_key":"reply-contract-1"}'::jsonb
)) AS reply_first \gset
SELECT pg_temp.rpc('add_message', jsonb_build_object(
  'actor', :'sam',
  'ticket_id', :'t3id',
  'message', '{"body":"Exact retry contract","visibility":"internal","idempotency_key":"reply-contract-1"}'::jsonb
)) AS reply_retry \gset
SELECT pg_temp.assert(
  (:'reply_retry'::jsonb->>'duplicate')::boolean
    AND :'reply_retry'::jsonb->>'message_id' = :'reply_first'::jsonb->>'message_id',
  'an exact reply retry returns the original receipt'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Edited retry contract","visibility":"internal","idempotency_key":"reply-contract-1"}}'::jsonb)$q$,
  :'sam', :'t3id'
), 'different message');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Exact retry contract","visibility":"public","idempotency_key":"reply-contract-1"}}'::jsonb)$q$,
  :'sam', :'t3id'
), 'different message');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Exact retry contract","visibility":"internal","idempotency_key":"reply-contract-1"}}'::jsonb)$q$,
  :'jeff', :'t3id'
), 'different message');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Exact retry contract","visibility":"internal","idempotency_key":"reply-contract-1"}}'::jsonb)$q$,
  :'sam', :'t2id'
), 'different message');
SELECT pg_temp.assert(
  (SELECT count(*) = 1 FROM bloom_support.messages WHERE idempotency_key = 'reply-contract-1'),
  'changed reply retries never create or claim another message'
);

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

-- Operation retry keys are caller-scoped and retain pre-migration rows.
SELECT pg_temp.rpc('record_operation_preview', jsonb_build_object('actor', :'jeff', 'operation', jsonb_build_object(
  'account_id', :'greenleaf', 'kind', 'site.publish', 'permission', 'ops.site.publish', 'inputs', '{"page":"home"}'::jsonb,
  'preview', '{"summary":"Jeff preview"}'::jsonb, 'idempotency_key', 'shared-preview-key', 'idempotency_fingerprint', repeat('a',64)))) AS jeff_shared_preview \gset
SELECT pg_temp.rpc('record_operation_preview', jsonb_build_object('actor', :'jon', 'operation', jsonb_build_object(
  'account_id', :'greenleaf', 'kind', 'site.publish', 'permission', 'ops.site.publish', 'inputs', '{"page":"home"}'::jsonb,
  'preview', '{"summary":"Jon preview"}'::jsonb, 'idempotency_key', 'shared-preview-key', 'idempotency_fingerprint', repeat('a',64)))) AS jon_shared_preview \gset
SELECT pg_temp.assert((:'jeff_shared_preview'::jsonb)->>'id' <> (:'jon_shared_preview'::jsonb)->>'id'
  AND (:'jeff_shared_preview'::jsonb)->>'actor_id' = :'jeff'
  AND (:'jon_shared_preview'::jsonb)->>'actor_id' = :'jon', 'the same raw preview key cannot cross principals');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('record_operation_preview', jsonb_build_object('actor','%s','operation',jsonb_build_object(
  'account_id','%s','kind','site.publish','permission','ops.site.publish','inputs','{"page":"changed"}'::jsonb,
  'preview','{"summary":"changed"}'::jsonb,'idempotency_key','shared-preview-key','idempotency_fingerprint',repeat('b',64))))$q$,
  :'jeff', :'greenleaf'), 'different operation preview');
INSERT INTO bloom_support.operations(id, account_id, actor_id, kind, permission, inputs, preview, idempotency_key)
VALUES ('f0000000-0000-4000-8000-0000000000f1', :'greenleaf', :'jeff', 'site.publish', 'ops.site.publish',
  '{"page":"legacy"}', '{"summary":"stored before migration"}', 'legacy-preview-key');
SELECT pg_temp.rpc('record_operation_preview', jsonb_build_object('actor', :'jeff', 'operation', jsonb_build_object(
  'account_id', :'greenleaf', 'kind', 'site.publish', 'permission', 'ops.site.publish', 'inputs', '{"page":"legacy"}'::jsonb,
  'preview', '{"summary":"volatile retry output"}'::jsonb, 'idempotency_key', 'legacy-preview-key', 'idempotency_fingerprint', repeat('c',64)))) AS legacy_preview_retry \gset
SELECT pg_temp.assert((:'legacy_preview_retry'::jsonb)->>'id' = 'f0000000-0000-4000-8000-0000000000f1'
  AND (SELECT idempotency_fingerprint = repeat('c',64) FROM bloom_support.operations WHERE id='f0000000-0000-4000-8000-0000000000f1'),
  'a pre-migration raw key replays the stored preview and adopts the request fingerprint');

-- 5. Multi-request conversation + linking.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','channel','crm','body','Also: can I add a second location?','account_id', :'greenleaf','conversation_id', (:'t1'::jsonb)->>'conversation_id'))) AS t4 \gset
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.ticket_links WHERE kind='same_conversation' AND from_ticket = ((:'t4'::jsonb)->>'ticket_id')::uuid), 'second request in same conversation linked');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('create_ticket', '{"actor":"%s","ticket":{"body":"hijack conversation","conversation_id":"%s"}}'::jsonb)$q$, :'rosa', (:'t1'::jsonb)->>'conversation_id'), 'forbidden: conversation');

-- 6. Human takeover blocks Bloom; client reply wakes the ticket.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'message', '{"body":"Thanks — looking into it.","visibility":"public","idempotency_key":"bot-ack-1"}'::jsonb));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE kind='send_email' AND ticket_id = :'t2id') = 1, 'Bloom reply queues email');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t2id', 'message', '{"body":"Thanks — looking into it.","visibility":"public","idempotency_key":"bot-ack-1"}'::jsonb));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.messages WHERE idempotency_key='bot-ack-1') = 1, 'duplicate Bloom reply suppressed');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Thanks — looking into it.","visibility":"public","purpose":"progress","idempotency_key":"bot-ack-1"}}'::jsonb)$q$,
  :'bot', :'t2id'
), 'different message');
SELECT pg_temp.rpc('add_message', jsonb_build_object(
  'actor', :'bot',
  'ticket_id', :'t2id',
  'message', '{"body":"Background progress only","visibility":"public","purpose":"progress","notify_client":false,"idempotency_key":"bot-silent-1"}'::jsonb
));
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('add_message', '{"actor":"%s","ticket_id":"%s","message":{"body":"Background progress only","visibility":"public","purpose":"progress","notify_client":true,"idempotency_key":"bot-silent-1"}}'::jsonb)$q$,
  :'bot', :'t2id'
), 'different message');
SELECT pg_temp.assert((
  SELECT NOT notify_client
    AND purpose = 'progress'
    AND NOT EXISTS (
      SELECT 1 FROM bloom_support.jobs
      WHERE kind = 'send_email' AND payload->>'message_id' = message.id::text
    )
  FROM bloom_support.messages AS message
  WHERE idempotency_key = 'bot-silent-1'
), 'a silent reply durably binds purpose and notification without queuing email');
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
-- 7b. A preview or staff-only job that dies never escalates the client's request (the #1011 incident).
SELECT status AS t2_status, version AS t2_version, coalesce(next_action, '') AS t2_next FROM bloom_support.tickets WHERE id = :'t2id' \gset
SELECT count(*) AS t2_escalations FROM bloom_support.escalations WHERE ticket_id = :'t2id' \gset
INSERT INTO bloom_support.jobs(kind, ticket_id, lane, payload, idempotency_key, status, attempts, max_attempts, locked_by, lease_until)
VALUES ('notify', :'t2id', 'email:notify', '{"preview": true, "to": "jon@bloom.test"}', 'test:preview-dies', 'running', 1, 1, 'worker-p', now() + interval '1 minute'),
       ('notify', :'t2id', 'email:notify', '{"kind": "job.dead", "title": "x"}', 'test:staff-notify-dies', 'running', 1, 1, 'worker-p', now() + interval '1 minute'),
       ('digest', :'t2id', 'email:digest', '{}', 'test:digest-dies', 'running', 1, 1, 'worker-p', now() + interval '1 minute'),
       ('escalate', :'t2id', 'email:escalation', '{}', 'test:escalate-dies', 'running', 1, 1, 'worker-p', now() + interval '1 minute');
SELECT pg_temp.assert(bloom_support.fail_job(id, 'worker-p', 'Cannot read properties of undefined (reading ''replace'')') = 'dead', 'staff job dies after its retries')
  FROM bloom_support.jobs WHERE idempotency_key LIKE 'test:%-dies';
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.escalations e JOIN bloom_support.jobs j ON e.dedupe_key = 'job-dead:' || j.id::text
  WHERE j.idempotency_key LIKE 'test:%-dies'), 'preview and staff-only job failures never escalate');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.escalations WHERE ticket_id = :'t2id') = :t2_escalations, 'no escalation was added to the client request');
SELECT pg_temp.assert((SELECT status = :'t2_status' AND version = :t2_version AND coalesce(next_action, '') = :'t2_next' FROM bloom_support.tickets WHERE id = :'t2id'),
  'the client request is untouched by a staff job failure');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.activity a JOIN bloom_support.jobs j ON a.detail->>'job_id' = j.id::text
  WHERE j.idempotency_key LIKE 'test:%-dies' AND a.action = 'job.dead' AND a.detail->>'escalated' = 'false') = 4, 'staff job failures are still recorded');
SELECT pg_temp.assert((SELECT a.ticket_id IS NULL FROM bloom_support.activity a JOIN bloom_support.jobs j ON a.detail->>'job_id' = j.id::text
  WHERE j.idempotency_key = 'test:preview-dies'), 'a preview failure stays off the borrowed ticket''s history');
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
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"resolved","resolution_summary":"fixed","resolution_verified":true,"resolution_evidence":{"deployment":{"state":"success"},"verification":{"passed":true,"scope":"release_smoke","checks":[{"url":"https://x/health","pass":true}]}}}}'::jsonb)$q$, :'bot', :'t2id'), 'explicitly bound to this ticket');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object(
  'actor', :'bot',
  'ticket_id', :'t2id',
  'patch', jsonb_build_object(
    'status', 'resolved',
    'resolution_summary', 'Checkout fixed and verified on production',
    'resolution_verified', true,
    'resolution_evidence', jsonb_build_object(
      'deployment', jsonb_build_object('state', 'success', 'sha', 'def'),
      'verification', jsonb_build_object(
        'passed', true,
        'scope', 'ticket_flow',
        'ticket_ids', jsonb_build_array(:'t2id'),
        'checks', jsonb_build_array(jsonb_build_object('url', 'https://x/checkout', 'pass', true))
      )
    )
  )
));
SELECT pg_temp.assert((SELECT resolution_evidence->>'resolved_by' = 'bloom' AND resolution_evidence->'deployment'->>'state' = 'success' FROM bloom_support.tickets WHERE id = :'t2id'), 'evidence stored with resolution');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind='send_email' AND idempotency_key = 'email:resolution:' || :'t2id' || ':0'), 'resolution email queued');

-- Sensitive repair → awaiting approval escalates to Jon; deployment failure escalates to both.
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'sam', 'ticket_id', :'t1id', 'issue', '{}'))->>'engineering_issue_id' AS eng2 \gset
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind='investigate' AND engineering_issue_id = :'eng2'), 'Support cannot start an automated repair');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND reason='engineering_start_requested' AND status='open'), 'bug reported to Jon and Jeff for a start decision');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"start_repair":true}}'::jsonb)$q$, :'sam', :'eng2'), 'only an admin can start');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jeff', 'issue_id', :'eng2', 'update', '{"start_repair":true}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.jobs WHERE kind='investigate' AND engineering_issue_id = :'eng2'), 'Jeff started the repair');
SELECT pg_temp.assert((SELECT repair_started_by FROM bloom_support.engineering_issues WHERE id = :'eng2') = :'jeff'::uuid, 'repair start recorded against Jeff');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND reason='engineering_start_requested' AND status='open'), 'start request closed');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng2', 'update', '{"status":"investigating"}'::jsonb));
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1
    FROM bloom_support.jobs
    WHERE kind = 'answer'
      AND ticket_id = :'t1id'
      AND engineering_issue_id = :'eng2'
      AND payload @> '{"mode":"engineering_progress","status":"investigating"}'::jsonb
  ),
  'the approved investigation start durably queues a distinct client update');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng2', 'update', '{"status":"in_review","patch":{"pr_number":43,"head_sha":"h1"}}'::jsonb));
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1
    FROM bloom_support.jobs
    WHERE kind = 'answer'
      AND ticket_id = :'t1id'
      AND engineering_issue_id = :'eng2'
      AND payload @> '{"mode":"engineering_progress","status":"in_review"}'::jsonb
  ),
  'a meaningful repair state durably queues a client progress update');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair', 'issue_id', :'eng2', 'update', '{"status":"awaiting_approval","note":"touches payment amounts"}'::jsonb));
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id = :'eng2' AND audience='jon' AND reason='engineering_awaiting_approval'), 'sensitive fix escalated to Jon');
SELECT pg_temp.assert((SELECT status FROM bloom_support.tickets WHERE id = :'t1id') = 'needs_owner', 'ticket shows Needs admin');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"approved"}}'::jsonb)$q$, :'jeff', :'eng2'), 'engineering.approve');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon', 'issue_id', :'eng2', 'update', '{"status":"approved"}'::jsonb));
SELECT pg_temp.assert((SELECT approved_head_sha FROM bloom_support.engineering_issues WHERE id = :'eng2') = 'h1', 'approval pinned to the reviewed commit');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"merging","patch":{"head_sha":"h2"}}}'::jsonb)$q$, :'release', :'eng2'), 'changed after approval');
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
SELECT pg_temp.assert((SELECT next_action FROM bloom_support.tickets WHERE id = ((:'t4'::jsonb)->>'ticket_id')::uuid) = 'Admin decides on the feature request', 'feature request next action names the role');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm',
    'channel', 'crm',
    'body', 'Our second location needs the same account feature.',
    'account_id', :'greenleaf'
  )
)) AS t4_feature_peer \gset
SELECT pg_temp.rpc('route_feature_request', jsonb_build_object(
  'actor', :'bot',
  'ticket_id', ((:'t4_feature_peer'::jsonb)->>'ticket_id'),
  'feature', jsonb_build_object('feature_request_id', :'fr', 'excerpt', 'A second client request for the same feature.')
));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('decide_feature_request', '{"actor":"%s","feature_request_id":"%s","decision":"accepted"}'::jsonb)$q$, :'jeff', :'fr'), 'features.decide');
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object('actor', :'jon', 'feature_request_id', :'fr', 'decision', 'planned', 'note', 'Q1'));
SELECT pg_temp.assert(
  (SELECT count(*) = 2
          AND count(DISTINCT idempotency_key) = 2
          AND count(*) FILTER (WHERE ticket_id = ((:'t4'::jsonb)->>'ticket_id')::uuid) = 1
          AND count(*) FILTER (WHERE ticket_id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid) = 1
   FROM bloom_support.jobs
   WHERE kind = 'answer'
     AND payload @> '{"mode":"feature_decision","decision":"planned"}'::jsonb),
  'a feature decision durably queues one promised follow-up for every linked ticket');
UPDATE bloom_support.tickets
SET status = 'waiting', waiting_reason = 'customer', stage = 'awaiting_client', next_action = 'Waiting for the client'
WHERE feature_request_id = :'fr';
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object('actor', :'jon', 'feature_request_id', :'fr', 'decision', 'planned', 'note', 'Updated internal note'));
SELECT pg_temp.assert(
  (SELECT count(*) = 2
   FROM bloom_support.jobs
   WHERE kind = 'answer'
     AND payload->>'mode' = 'feature_decision'),
  'repeating the same feature decision does not send clients another update');
SELECT pg_temp.assert(
  (SELECT bool_and(status = 'waiting' AND waiting_reason = 'customer' AND stage = 'awaiting_client' AND next_action = 'Waiting for the client')
   FROM bloom_support.tickets
   WHERE feature_request_id = :'fr'),
  'editing the note on the same feature decision does not reopen client workflows');
SELECT pg_temp.rpc('add_message', jsonb_build_object(
  'actor', :'bot',
  'ticket_id', ((:'t4'::jsonb)->>'ticket_id'),
  'message', jsonb_build_object(
    'body', 'The product team plans to build this feature.',
    'visibility', 'public',
    'purpose', 'feature_decision',
    'notify_client', false,
    'idempotency_key', 'feature-decision-message-contract'
  )
))->>'message_id' AS feature_decision_message \gset
SELECT pg_temp.assert(
  (SELECT purpose = 'feature_decision' AND meaningful
   FROM bloom_support.messages
   WHERE id = :'feature_decision_message')
  AND (SELECT first_response_at IS NOT NULL
       FROM bloom_support.tickets
       WHERE id = ((:'t4'::jsonb)->>'ticket_id')::uuid),
  'a feature decision remains typed and counts as a substantive response');
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_features', jsonb_build_object('actor', :'jeff'))->0->'evidence') = 2, 'feature evidence links every requester');

-- Shipping is a separate, durable promise. It reaches resolved and
-- human-owned requesters exactly once without changing their workflow state.
SELECT id AS rendered_planned_job
FROM bloom_support.jobs
WHERE ticket_id = ((:'t4'::jsonb)->>'ticket_id')::uuid
  AND payload @> '{"mode":"feature_decision","decision":"planned"}'::jsonb \gset
SELECT pg_temp.rpc('add_message', jsonb_build_object(
  'actor', :'bot',
  'ticket_id', ((:'t4'::jsonb)->>'ticket_id'),
  'message', jsonb_build_object(
    'body', 'Our product team plans to build this.',
    'visibility', 'public',
    'purpose', 'feature_decision',
    'idempotency_key', 'feature-decision:' || :'rendered_planned_job'
  )
))->>'message_id' AS rendered_planned_message \gset
UPDATE bloom_support.tickets
SET status = 'resolved', stage = 'resolved', resolved_at = now(),
    waiting_reason = NULL, waiting_since = NULL
WHERE id = ((:'t4'::jsonb)->>'ticket_id')::uuid;
UPDATE bloom_support.tickets
SET automation = 'human', executor = 'person', executor_id = :'sam',
    owner_id = :'sam', taken_over_by = :'sam', taken_over_at = now()
WHERE id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid;
CREATE TEMP TABLE feature_shipment_ticket_state AS
SELECT id, status, stage, automation, executor, executor_id, owner_id,
       next_action, resolved_at, version
FROM bloom_support.tickets
WHERE feature_request_id = :'fr';

SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'shipped',
  'note', 'Available now'
));
SELECT pg_temp.assert(
  (SELECT count(*) = 2 FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr')
  AND (SELECT count(*) = 2 AND count(DISTINCT idempotency_key) = 2
       FROM bloom_support.jobs
       WHERE kind = 'answer' AND payload->>'mode' = 'feature_shipment'
         AND payload->>'feature_request_id' = :'fr'),
  'shipping queues one durable notification for every linked ticket');
SELECT pg_temp.assert(
  (SELECT bool_and(status = 'cancelled')
   FROM bloom_support.jobs
   WHERE kind = 'answer' AND payload->>'mode' = 'feature_decision'
     AND ticket_id IN (
       SELECT id FROM bloom_support.tickets WHERE feature_request_id = :'fr'
     ))
  AND (SELECT delivery = 'suppressed' AND withdrawn_at IS NOT NULL
       FROM bloom_support.messages WHERE id = :'rendered_planned_message')
  AND (SELECT bool_and(status = 'cancelled')
       FROM bloom_support.jobs
       WHERE kind = 'send_email' AND payload->>'message_id' = :'rendered_planned_message'),
  'a shipped decision cancels older queued decision work and email copy');
SELECT pg_temp.assert(
  NOT EXISTS (
    SELECT 1
    FROM bloom_support.tickets current
    JOIN feature_shipment_ticket_state before USING (id)
    WHERE current.status IS DISTINCT FROM before.status
       OR current.stage IS DISTINCT FROM before.stage
       OR current.automation IS DISTINCT FROM before.automation
       OR current.executor IS DISTINCT FROM before.executor
       OR current.executor_id IS DISTINCT FROM before.executor_id
       OR current.owner_id IS DISTINCT FROM before.owner_id
       OR current.next_action IS DISTINCT FROM before.next_action
       OR current.resolved_at IS DISTINCT FROM before.resolved_at
       OR current.version IS DISTINCT FROM before.version
  ),
  'the shipped decision does not reopen or take over resolved and human-owned tickets');
SELECT pg_temp.assert(
  bloom_support.invalidate_planned((( :'t4'::jsonb)->>'ticket_id')::uuid, 'customer reply') >= 0
  AND EXISTS (
    SELECT 1 FROM bloom_support.jobs
    WHERE ticket_id = ((:'t4'::jsonb)->>'ticket_id')::uuid
      AND payload->>'mode' = 'feature_shipment' AND status = 'queued'
  ),
  'a customer reply cannot erase a promised shipment notification');
SELECT pg_temp.assert(
  NOT has_function_privilege('anon', 'public.bloom_support_deliver_feature_shipment(uuid,uuid,integer,text)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.bloom_support_deliver_feature_shipment(uuid,uuid,integer,text)', 'execute')
  AND has_function_privilege('service_role', 'public.bloom_support_deliver_feature_shipment(uuid,uuid,integer,text)', 'execute')
  AND NOT has_function_privilege('anon', 'public.bloom_support_claim_feature_shipment_email(uuid)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.bloom_support_claim_feature_shipment_email(uuid)', 'execute')
  AND has_function_privilege('service_role', 'public.bloom_support_claim_feature_shipment_email(uuid)', 'execute')
  AND NOT has_function_privilege('anon', 'public.bloom_support_mark_feature_shipment_in_product_only(uuid)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.bloom_support_mark_feature_shipment_in_product_only(uuid)', 'execute')
  AND has_function_privilege('service_role', 'public.bloom_support_mark_feature_shipment_in_product_only(uuid)', 'execute'),
  'shipment delivery RPC is service-role only');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_deliver_feature_shipment('%s', s.id, s.current_generation, 'Now available') FROM bloom_support.feature_shipment_subscriptions s WHERE s.feature_request_id = '%s' LIMIT 1$q$,
  :'jeff', :'fr'
), 'automation service required');
SELECT public.bloom_support_deliver_feature_shipment(
  :'bot', id, current_generation, 'Good news — this feature is now available.'
)
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr';
SELECT pg_temp.assert(
  (SELECT count(*) = 2 AND count(DISTINCT idempotency_key) = 2
   FROM bloom_support.messages
   WHERE id IN (
     SELECT notification_message_id FROM bloom_support.feature_shipment_subscriptions
     WHERE feature_request_id = :'fr'
   ) AND author_kind = 'bloom' AND visibility = 'public'
     AND purpose = 'feature_decision' AND meaningful)
  AND (SELECT count(*) = 2
       FROM bloom_support.jobs
       WHERE kind = 'send_email' AND payload ? 'feature_shipment_subscription_id'),
  'delivery creates one substantive Bloom message and one email job per subscription');
SELECT public.bloom_support_deliver_feature_shipment(
  :'bot', id, current_generation, 'Good news — this feature is now available.'
)
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr';
SELECT pg_temp.assert(
  (SELECT count(*) = 2
   FROM bloom_support.messages
   WHERE id IN (
     SELECT notification_message_id FROM bloom_support.feature_shipment_subscriptions
     WHERE feature_request_id = :'fr'
   ))
  AND (SELECT count(*) = 2
       FROM bloom_support.jobs
       WHERE kind = 'send_email' AND payload ? 'feature_shipment_subscription_id'),
  'retries reuse the shipment message and email job');
SELECT id AS human_shipment_message
FROM bloom_support.messages
WHERE ticket_id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid
  AND id IN (
    SELECT notification_message_id FROM bloom_support.feature_shipment_subscriptions
    WHERE feature_request_id = :'fr'
  ) \gset
SELECT bloom_support.queue_outbound_email(jsonb_build_object(
  'ticket_id', ((:'t4_feature_peer'::jsonb)->>'ticket_id'),
  'message_id', :'human_shipment_message',
  'purpose', 'feature_decision',
  'to', 'gail@greenleaf.test',
  'subject', '[Bloom] Feature available',
  'body', 'Good news — this feature is now available.',
  'rfc_message_id', '<feature-shipment-human@bloom.test>',
  'idempotency_key', 'feature-shipment-human-ledger',
  'bloom_initiated', true,
  'covered_message_ids', '[]'::jsonb,
  'cc', '[]'::jsonb
))->>'status' AS human_shipment_email_status \gset
SELECT pg_temp.assert(:'human_shipment_email_status' = 'queued',
  'the relationally-authorized shipment email survives human takeover');
SELECT id AS human_shipment_email
FROM bloom_support.outbound_emails
WHERE idempotency_key = 'feature-shipment-human-ledger' \gset
SELECT public.bloom_support_claim_feature_shipment_email(:'human_shipment_email') AS human_shipment_claimed \gset
SELECT pg_temp.assert(
  :'human_shipment_claimed'::boolean
  AND (SELECT status = 'uncertain' FROM bloom_support.outbound_emails WHERE id = :'human_shipment_email')
  AND (SELECT delivery = 'uncertain' FROM bloom_support.messages WHERE id = :'human_shipment_message')
  AND (SELECT delivery_status = 'uncertain'
       FROM bloom_support.feature_shipment_deliveries
       WHERE notification_message_id = :'human_shipment_message')
  AND (SELECT delivery_status = 'uncertain'
       FROM bloom_support.feature_shipment_subscriptions
       WHERE notification_message_id = :'human_shipment_message'),
  'the final provider gate records a valid shipment as in flight before dispatch');
SELECT pg_temp.assert(
  NOT EXISTS (
    SELECT 1
    FROM bloom_support.tickets current
    JOIN feature_shipment_ticket_state before USING (id)
    WHERE current.status IS DISTINCT FROM before.status
       OR current.stage IS DISTINCT FROM before.stage
       OR current.automation IS DISTINCT FROM before.automation
       OR current.executor IS DISTINCT FROM before.executor
       OR current.executor_id IS DISTINCT FROM before.executor_id
       OR current.owner_id IS DISTINCT FROM before.owner_id
       OR current.next_action IS DISTINCT FROM before.next_action
       OR current.resolved_at IS DISTINCT FROM before.resolved_at
       OR current.version IS DISTINCT FROM before.version
  ),
  'creating shipment messages and email work leaves ticket workflow untouched');

-- A rollback after rendering withdraws queued work without inventing certainty
-- about a provider dispatch that already started. The immutable generation can
-- never be delivered again, while a later real shipment gets a fresh attempt.
SELECT id AS lifecycle_subscription, current_generation AS lifecycle_generation_one,
       notification_message_id AS lifecycle_message_one
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr'
  AND ticket_id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid \gset
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'planned',
  'note', 'Rolled back before provider confirmation'
));
SELECT pg_temp.assert(
  (SELECT retracted_at IS NOT NULL
          AND retraction_reason = 'feature changed from shipped to planned'
   FROM bloom_support.feature_shipment_deliveries
   WHERE subscription_id = :'lifecycle_subscription'
     AND generation = :'lifecycle_generation_one')
  AND (SELECT delivery = 'uncertain' AND withdrawn_at IS NOT NULL
       FROM bloom_support.messages WHERE id = :'lifecycle_message_one')
  AND (SELECT delivery_status = 'uncertain'
       FROM bloom_support.feature_shipment_deliveries
       WHERE subscription_id = :'lifecycle_subscription'
         AND generation = :'lifecycle_generation_one')
  AND (SELECT delivery_status = 'uncertain'
       FROM bloom_support.feature_shipment_subscriptions
       WHERE id = :'lifecycle_subscription')
  AND (SELECT status = 'uncertain'
       FROM bloom_support.outbound_emails WHERE id = :'human_shipment_email')
  AND NOT public.bloom_support_claim_feature_shipment_email(:'human_shipment_email'),
  'a rollback withdraws the rendered generation but preserves an in-flight provider outcome and prevents retry');
SELECT public.bloom_support_deliver_feature_shipment(
  :'bot', :'lifecycle_subscription', :'lifecycle_generation_one',
  'This stale generation must never be recreated.'
)->>'delivered' AS stale_generation_delivered \gset
SELECT pg_temp.assert(NOT :'stale_generation_delivered'::boolean,
  'a retracted shipment generation cannot be delivered again');

SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'shipped',
  'note', 'Available again'
));
SELECT pg_temp.assert(
  (SELECT bool_and(current_generation = 2)
   FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr')
  AND (SELECT count(*) = 2
       FROM bloom_support.feature_shipment_deliveries
       WHERE generation = 2
         AND subscription_id IN (
           SELECT id FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
         ))
  AND (SELECT count(*) = 2 AND count(DISTINCT idempotency_key) = 2
       FROM bloom_support.jobs
       WHERE kind = 'answer' AND payload->>'mode' = 'feature_shipment'
         AND payload->>'feature_request_id' = :'fr'
         AND payload->>'generation' = '2'),
  'a real re-shipment creates exactly one second generation and answer job per subscription');
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'declined',
  'note', 'Withdrawn before the second generation was rendered'
));
SELECT pg_temp.assert(
  (SELECT count(*) = 2 AND bool_and(retracted_at IS NOT NULL AND delivery_status = 'suppressed')
   FROM bloom_support.feature_shipment_deliveries
   WHERE generation = 2
     AND subscription_id IN (
       SELECT id FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
     ))
  AND (SELECT count(*) = 2 AND bool_and(status = 'cancelled')
       FROM bloom_support.jobs
       WHERE kind = 'answer' AND payload->>'mode' = 'feature_shipment'
         AND payload->>'feature_request_id' = :'fr'
         AND payload->>'generation' = '2')
  AND NOT EXISTS (
    SELECT 1 FROM bloom_support.feature_shipment_deliveries
    WHERE generation = 2 AND notification_message_id IS NOT NULL
      AND subscription_id IN (
        SELECT id FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
      )
  ),
  'declining before the answer worker runs cancels generation two without creating a message');

SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'shipped',
  'note', 'Finally available'
));
SELECT public.bloom_support_deliver_feature_shipment(
  :'bot', id, current_generation, 'Good news — this feature is finally available.'
)
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr';
SELECT pg_temp.assert(
  (SELECT bool_and(current_generation = 3)
   FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr')
  AND (SELECT count(*) = 2 AND count(DISTINCT notification_message_id) = 2
       FROM bloom_support.feature_shipment_deliveries
       WHERE generation = 3 AND notification_message_id IS NOT NULL
         AND subscription_id IN (
           SELECT id FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
         ))
  AND (SELECT count(*) = 2 AND count(DISTINCT idempotency_key) = 2
       FROM bloom_support.jobs
       WHERE kind = 'send_email'
         AND payload->>'feature_shipment_generation' = '3'
         AND payload->>'feature_shipment_subscription_id' IN (
           SELECT id::text FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
         )),
  'the later shipment creates exactly one new message and email job per subscription');
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'fr', 'decision', 'shipped',
  'note', 'Copy edit only'
));
SELECT pg_temp.assert(
  (SELECT bool_and(current_generation = 3)
   FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr')
  AND (SELECT count(*) = 6
       FROM bloom_support.feature_shipment_deliveries
       WHERE subscription_id IN (
         SELECT id FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
       ))
  AND (SELECT count(*) = 2
       FROM bloom_support.jobs
       WHERE kind = 'send_email'
         AND payload->>'feature_shipment_generation' = '3'
         AND payload->>'feature_shipment_subscription_id' IN (
           SELECT id::text FROM bloom_support.feature_shipment_subscriptions WHERE feature_request_id = :'fr'
         )),
  'repeating shipped does not increment the generation or duplicate its email work');

SELECT id AS in_product_subscription, notification_message_id AS in_product_message,
       current_generation AS in_product_generation
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr'
  AND ticket_id <> ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid
LIMIT 1 \gset
SELECT public.bloom_support_mark_feature_shipment_in_product_only(
  :'in_product_message'
) AS in_product_terminalized \gset
SELECT pg_temp.assert(
  :'in_product_terminalized'::boolean
  AND (SELECT delivery = 'suppressed' AND withdrawn_at IS NULL
       FROM bloom_support.messages WHERE id = :'in_product_message')
  AND (SELECT delivery_status = 'suppressed' AND retracted_at IS NULL
       FROM bloom_support.feature_shipment_deliveries
       WHERE subscription_id = :'in_product_subscription'
         AND generation = :'in_product_generation')
  AND (SELECT delivery_status = 'suppressed'
       FROM bloom_support.feature_shipment_subscriptions
       WHERE id = :'in_product_subscription'),
  'a shipment without requester email remains visible in-product and reaches a terminal delivery state');

SELECT id AS terminal_subscription, notification_message_id AS terminal_message,
       current_generation AS terminal_generation
FROM bloom_support.feature_shipment_subscriptions
WHERE feature_request_id = :'fr'
  AND ticket_id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid \gset
SELECT pg_temp.rpc('set_spam', jsonb_build_object(
  'actor', :'sam',
  'ticket_id', ((:'t4_feature_peer'::jsonb)->>'ticket_id'),
  'spam', true
));
SELECT pg_temp.assert(
  (SELECT cancelled_at IS NOT NULL AND cancellation_reason = 'ticket marked as spam'
   FROM bloom_support.feature_shipment_subscriptions WHERE id = :'terminal_subscription')
  AND (SELECT retracted_at IS NOT NULL AND retraction_reason = 'ticket marked as spam'
       FROM bloom_support.feature_shipment_deliveries
       WHERE subscription_id = :'terminal_subscription' AND generation = :'terminal_generation')
  AND (SELECT delivery = 'suppressed' AND withdrawn_at IS NOT NULL
       FROM bloom_support.messages WHERE id = :'terminal_message')
  AND (SELECT count(*) = 2 AND bool_and(status = 'cancelled')
       FROM bloom_support.jobs
       WHERE ticket_id = ((:'t4_feature_peer'::jsonb)->>'ticket_id')::uuid
         AND coalesce(payload->>'subscription_id', payload->>'feature_shipment_subscription_id') = :'terminal_subscription'
         AND coalesce(payload->>'generation', payload->>'feature_shipment_generation') = :'terminal_generation'),
  'marking a ticket as spam terminalizes its current shipment attempt and all unsent work');

-- Duplicate product/email identities: execute the real resolver with isolated fixtures.
BEGIN;
DO $$
DECLARE a uuid; b uuid; old_pid uuid; verified_pid uuid; extra_pid uuid; r jsonb;
BEGIN
  INSERT INTO bloom_support.accounts(name, email_domains) VALUES ('Identity A', ARRAY['identity-regression.test']) RETURNING id INTO a;
  INSERT INTO bloom_support.accounts(name) VALUES ('Identity B') RETURNING id INTO b;
  INSERT INTO bloom_support.principals(kind, product, external_id, email, role, created_at)
    VALUES ('external_user', 'email', 'client@identity-regression.test', 'client@identity-regression.test', 'client', now() - interval '2 days') RETURNING id INTO old_pid;
  INSERT INTO bloom_support.principals(kind, product, external_id, email, role)
    VALUES ('external_user', 'cms', 'identity-regression-client', 'CLIENT@identity-regression.test', 'client') RETURNING id INTO verified_pid;
  INSERT INTO bloom_support.account_members(account_id, principal_id, verified) VALUES (a, verified_pid, true);
  r := bloom_support.resolve_email_sender(' CLIENT@identity-regression.test ', 'Client');
  PERFORM pg_temp.assert(r->>'principal_id' = verified_pid::text AND r->>'account_id' = a::text AND r->>'match' = 'membership', 'new verified CMS identity beats older unlinked email identity');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.account_members WHERE principal_id = old_pid), 'resolver does not copy verified membership to old identity');
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', 'Client') = r, 'verified identity resolution is retry stable');

  INSERT INTO bloom_support.principals(kind, product, external_id, email, role)
    VALUES ('external_user', 'pos', 'identity-regression-client', 'client@identity-regression.test', 'client') RETURNING id INTO extra_pid;
  INSERT INTO bloom_support.account_members(account_id, principal_id, verified) VALUES (a, extra_pid, true);
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', NULL)->>'account_id' = a::text, 'same verified account across products is unambiguous');
  UPDATE bloom_support.account_members SET account_id = b WHERE principal_id = extra_pid;
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', NULL)->>'account_id' IS NULL, 'different verified accounts across identities fail closed despite a unique domain');
  UPDATE bloom_support.principals SET active = false WHERE id = extra_pid;
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', NULL)->>'account_id' = a::text, 'inactive identity excluded from account matching');
  UPDATE bloom_support.principals SET active = true, role = 'support' WHERE id = extra_pid;
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', NULL)->>'principal_id' = verified_pid::text, 'staff identity and its memberships excluded');
  INSERT INTO bloom_support.account_members(account_id, principal_id, verified) VALUES (b, verified_pid, true);
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('client@identity-regression.test', NULL)->>'account_id' IS NULL, 'multiple accounts on one identity cannot fall back to domain');
  UPDATE bloom_support.account_members SET verified = false WHERE principal_id = verified_pid;
  r := bloom_support.resolve_email_sender('client@identity-regression.test', NULL);
  PERFORM pg_temp.assert(r->>'account_id' = a::text AND r->>'match' = 'domain', 'unverified memberships do not count as proof');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.account_members WHERE principal_id = old_pid AND verified), 'domain membership stays unverified');

  INSERT INTO bloom_support.principals(kind, product, external_id, email, role, active)
    VALUES ('external_user', 'email', 'blocked@identity-regression.test', 'blocked@identity-regression.test', 'client', false) RETURNING id INTO extra_pid;
  PERFORM pg_temp.expect_error($q$SELECT bloom_support.resolve_email_sender('blocked@identity-regression.test', NULL)$q$, 'sender identity unavailable');
  UPDATE bloom_support.principals SET active = true, role = 'support' WHERE id = extra_pid;
  PERFORM pg_temp.expect_error($q$SELECT bloom_support.resolve_email_sender('blocked@identity-regression.test', NULL)$q$, 'sender identity unavailable');
  UPDATE bloom_support.principals SET role = 'client', email = 'changed@identity-regression.test' WHERE id = extra_pid;
  PERFORM pg_temp.expect_error($q$SELECT bloom_support.resolve_email_sender('blocked@identity-regression.test', NULL)$q$, 'sender identity unavailable');
  UPDATE bloom_support.accounts SET email_domains = ARRAY['gmail.com'] WHERE id = a;
  PERFORM pg_temp.assert(bloom_support.resolve_email_sender('identity-regression@gmail.com', NULL)->>'account_id' IS NULL, 'consumer domain is never account proof');
  PERFORM pg_temp.expect_error($q$SELECT bloom_support.resolve_email_sender('invalid', NULL)$q$, 'invalid sender');
END $$;
ROLLBACK;

-- 11. Email sender resolution never grants staff authority; domain match stays unverified.
UPDATE bloom_support.accounts SET email_domains = '{greenleaf.test}' WHERE id = :'greenleaf';
SELECT pg_temp.rpc('resolve_email_sender', '{"email":"jon@example.test","name":"Spoof"}'::jsonb) AS spoof \gset
SELECT pg_temp.assert((:'spoof'::jsonb)->>'principal_id' <> :'jon', 'email never resolves to a staff principal');
SELECT pg_temp.rpc('resolve_email_sender', '{"email":"manager@greenleaf.test","name":"Manager"}'::jsonb) AS mgr \gset
SELECT pg_temp.assert((:'mgr'::jsonb)->>'match' = 'domain' AND (:'mgr'::jsonb)->>'account_id' = :'greenleaf', 'domain match links account');
SELECT pg_temp.assert(jsonb_array_length(pg_temp.rpc('list_tickets', jsonb_build_object('actor', (:'mgr'::jsonb)->>'principal_id'))) = 0, 'domain-matched sender cannot read account tickets');

-- Message-ID retries authorize the sender first and bind the exact reply.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'email', 'subject', 'Inbound reply binding',
    'body', 'A dedicated ticket for inbound reply idempotency.',
    'account_id', :'greenleaf', 'automation', 'paused'
  )
))#>>'{ticket_id}' AS inbound_reply_ticket \gset
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object(
  'auth_user_id', '20000000-0000-4000-8000-0000000000a2',
  'email', 'coworker@greenleaf.test', 'name', 'Coworker',
  'tenant_id', '30000000-0000-4000-8000-0000000000a1',
  'tenant_name', 'Greenleaf'
))#>>'{}' AS coworker \gset
SELECT pg_temp.rpc('append_inbound_email', jsonb_build_object(
  'actor', :'gail', 'ticket_id', :'inbound_reply_ticket',
  'body', 'The exact inbound reply.',
  'message_id', '<bound-reply@greenleaf.test>',
  'in_reply_to', '<bound-ack@bloom.test>'
)) AS inbound_reply_first \gset
SELECT pg_temp.rpc('append_inbound_email', jsonb_build_object(
  'actor', :'gail', 'ticket_id', :'inbound_reply_ticket',
  'body', 'The exact inbound reply.',
  'message_id', '<bound-reply@greenleaf.test>',
  'in_reply_to', '<bound-ack@bloom.test>'
)) AS inbound_reply_retry \gset
SELECT pg_temp.assert(
  (:'inbound_reply_retry'::jsonb->>'duplicate')::boolean
    AND :'inbound_reply_retry'::jsonb->>'message_id' = :'inbound_reply_first'::jsonb->>'message_id',
  'an exact inbound Message-ID retry returns the original message'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('append_inbound_email', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'gail', 'ticket_id', :'inbound_reply_ticket',
    'body', 'A changed inbound reply.',
    'message_id', '<bound-reply@greenleaf.test>',
    'in_reply_to', '<bound-ack@bloom.test>'
  )::text
), 'email message id reused with different reply');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('append_inbound_email', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'gail', 'ticket_id', :'inbound_reply_ticket',
    'body', 'The exact inbound reply.',
    'message_id', '<bound-reply@greenleaf.test>',
    'in_reply_to', '<different-ack@bloom.test>'
  )::text
), 'email message id reused with different reply');
SELECT pg_temp.rpc('append_inbound_email', jsonb_build_object(
  'actor', :'coworker', 'ticket_id', :'inbound_reply_ticket',
  'body', 'A coworker sent a distinct reply with a colliding Message-ID.',
  'message_id', '<bound-reply@greenleaf.test>',
  'in_reply_to', '<bound-ack@bloom.test>'
)) AS coworker_collision \gset
SELECT pg_temp.assert(
  NOT coalesce((:'coworker_collision'::jsonb->>'duplicate')::boolean, false)
    AND :'coworker_collision'::jsonb->>'message_id' <> :'inbound_reply_first'::jsonb->>'message_id',
  'a different authorized sender may independently use the same Message-ID'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('append_inbound_email', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'gail', 'ticket_id', :'t1id',
    'body', 'The exact inbound reply.',
    'message_id', '<bound-reply@greenleaf.test>',
    'in_reply_to', '<bound-ack@bloom.test>'
  )::text
), 'email message id reused with different reply');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('append_inbound_email', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'rosa', 'ticket_id', :'inbound_reply_ticket',
    'body', 'The exact inbound reply.',
    'message_id', '<bound-reply@greenleaf.test>',
    'in_reply_to', '<bound-ack@bloom.test>'
  )::text
), 'forbidden: ticket');
SELECT pg_temp.assert(
  (SELECT count(*) = 2 AND count(DISTINCT author_id) = 2
   FROM bloom_support.messages WHERE email_message_id = '<bound-reply@greenleaf.test>'),
  'Message-ID uniqueness is requester-scoped while changed and unauthorized retries create nothing'
);
SELECT pg_temp.assert(pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt1","outcome":"received"}'::jsonb)::boolean, 'first email event new');
SELECT pg_temp.assert(NOT pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt1","outcome":"received"}'::jsonb)::boolean, 'duplicate email event detected');
SELECT pg_temp.assert(pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt-rate-1","outcome":"processing"}'::jsonb)::boolean, 'rate fixture email event created');
SELECT pg_temp.assert(public.bloom_support_consume_email_usage('resend', 'evt-rate-1', 'email-retry-test', 'sender', 1), 'first email event spends quota');
UPDATE bloom_support.email_events SET outcome = 'failed' WHERE provider = 'resend' AND provider_event_id = 'evt-rate-1';
SELECT pg_temp.assert(pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt-rate-1","outcome":"processing"}'::jsonb)::boolean, 'failed email event can be retried');
SELECT pg_temp.assert(public.bloom_support_consume_email_usage('resend', 'evt-rate-1', 'email-retry-test', 'sender', 1), 'same provider event retry does not spend quota again');
SELECT pg_temp.assert((SELECT count = 1 FROM bloom_support.usage_counters WHERE bucket = 'email-retry-test' AND subject = 'sender'), 'email retry is charged exactly once');
SELECT pg_temp.assert(pg_temp.rpc('record_email_event', '{"provider":"resend","event_id":"evt-rate-2","outcome":"processing"}'::jsonb)::boolean, 'second email event created');
SELECT pg_temp.assert(NOT public.bloom_support_consume_email_usage('resend', 'evt-rate-2', 'email-retry-test', 'sender', 1), 'new email event remains rate limited');

-- Ambiguous domains bind nothing.
UPDATE bloom_support.accounts SET email_domains = '{greenleaf.test}' WHERE id = :'rose';
SELECT pg_temp.rpc('resolve_email_sender', '{"email":"other@greenleaf.test","name":"Other"}'::jsonb) AS amb \gset
SELECT pg_temp.assert((:'amb'::jsonb)->>'account_id' IS NULL, 'ambiguous domain binds no account');
UPDATE bloom_support.accounts SET email_domains = '{}' WHERE id = :'rose';
-- Bootstrap cannot mint a second administrator.
CREATE OR REPLACE FUNCTION public.is_master_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
SELECT pg_temp.assert(NOT public.bloom_support_bootstrap_admin(:'gail'), 'bootstrap refused once an administrator exists');
SELECT pg_temp.assert((SELECT role FROM bloom_support.principals WHERE id = :'gail') = 'client', 'CRM master admin stays a client');
DROP FUNCTION public.is_master_admin(uuid);
-- Repair report key: outcome only.
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom repair report', 'grants', '["repair_report"]'::jsonb))#>>'{}' AS rr \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'rosa', 'ticket', jsonb_build_object('product','pos','channel','pos','body','Barcode scanner drops the last digit','account_id', :'rose')))->>'ticket_id' AS t5id \gset
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'jon', 'ticket_id', :'t5id', 'issue', '{"title":"Scanner"}'::jsonb))->>'engineering_issue_id' AS eng3 \gset
SELECT pg_temp.assert((SELECT repair_started_by FROM bloom_support.engineering_issues WHERE id = :'eng3') = :'jon'::uuid, 'Jon opening an issue starts the repair');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"in_review","patch":{"pr_number":1,"head_sha":"x"}}}'::jsonb)$q$, :'rr', :'eng3'), 'forbidden');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue', '{"actor":"%s","issue_id":"%s","update":{"status":"reproduced","patch":{"eligibility":{"eligible":true}}}}'::jsonb)$q$, :'rr', :'eng3'), 'reproduction');
UPDATE bloom_support.engineering_issues SET status = 'investigating' WHERE id = :'eng3';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'rr', 'issue_id', :'eng3', 'update', '{"status":"reproduced","patch":{"reproduction":{"reproduced":true,"failing_test":"scanner.test.ts","root_cause":"Off by one","verification":[{"url":"https://169.254.169.254/latest"}],"steps":["print"]}}}'::jsonb));
SELECT pg_temp.assert((
  SELECT status = 'reproduced'
    AND reproduction->>'failing_test' = 'scanner.test.ts'
    AND reproduction->>'root_cause' = 'Off by one'
    AND NOT reproduction ? 'verification'
    AND NOT reproduction ? 'steps'
  FROM bloom_support.engineering_issues
  WHERE id = :'eng3'
), 'repair report records only its normalized outcome schema');
UPDATE bloom_support.engineering_issues SET status = 'in_review' WHERE id = :'eng3';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'rr', 'issue_id', :'eng3', 'update', '{"status":"failed","patch":{"reproduction":{"root_cause":"Late diagnostic note"}}}'::jsonb));
SELECT pg_temp.assert((SELECT status = 'awaiting_approval' AND reproduction->>'root_cause' = 'Late diagnostic note' FROM bloom_support.engineering_issues WHERE id = :'eng3'), 'late failure report adds normalized notes and forces human review without moving the issue back to failed');
-- Withdrawn Bloom replies never reach the client.
INSERT INTO bloom_support.messages(id, conversation_id, ticket_id, author_kind, visibility, direction, body, delivery) SELECT '77777777-0000-4000-8000-000000000001', conversation_id, id, 'bloom', 'public', 'outbound', 'withdrawn draft answer', 'suppressed' FROM bloom_support.tickets WHERE id = :'t3id';
UPDATE bloom_support.messages SET withdrawn_at = now() WHERE id = '77777777-0000-4000-8000-000000000001';
SELECT pg_temp.assert(NOT (pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'rosa', 'ticket_id', :'t3id'))::text LIKE '%withdrawn draft answer%'), 'client view hides withdrawn reply');
SELECT pg_temp.assert(pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'jon', 'ticket_id', :'t3id'))::text LIKE '%withdrawn draft answer%', 'staff still see withdrawn reply');
-- A repair started on an escalated issue reopens it for the investigation step.
UPDATE bloom_support.engineering_issues SET status = 'escalated' WHERE id = :'eng3';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jeff', 'issue_id', :'eng3', 'update', '{"start_repair":true}'::jsonb));
SELECT pg_temp.assert((SELECT status FROM bloom_support.engineering_issues WHERE id = :'eng3') = 'open', 'escalated issue reopened when a repair starts');
-- A queued send retried after the address bounced is suppressed, not resent.
SELECT pg_temp.rpc('queue_outbound_email', '{"email":{"purpose":"reply","to":"bouncer@example.test","subject":"s","body":"b","rfc_message_id":"<r1@x>","idempotency_key":"bounce-retry-1"}}'::jsonb);
INSERT INTO bloom_support.outbound_emails(purpose, to_email, subject, body, rfc_message_id, idempotency_key, status) VALUES ('reply','bouncer@example.test','s','b','<r0@x>','bounce-earlier','bounced');
SELECT pg_temp.assert((pg_temp.rpc('queue_outbound_email', '{"email":{"purpose":"reply","to":"bouncer@example.test","subject":"s","body":"b","rfc_message_id":"<r1@x>","idempotency_key":"bounce-retry-1"}}'::jsonb))->>'status' = 'suppressed', 'retry after a bounce is suppressed');

-- Operations need a person.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('claim_operation', '{"actor":"%s","operation_id":"%s"}'::jsonb)$q$, :'bot', :'opid'), 'forbidden');

-- Activity is append-only.
SELECT pg_temp.expect_error('DELETE FROM bloom_support.activity', 'append-only');

-- Tracking links show public messages only.
SELECT pg_temp.rpc('issue_tracking_token', jsonb_build_object('ticket_id', :'t3id', 'hash', 'h1'));
SELECT pg_temp.assert(NOT (pg_temp.rpc('ticket_by_tracking_token', '{"hash":"h1"}'::jsonb)::text LIKE '%firmware%'), 'tracking page excludes internal notes');
SELECT pg_temp.assert(pg_temp.rpc('ticket_by_tracking_token', '{"hash":"nope"}'::jsonb) IS NULL, 'unknown token yields nothing');
SELECT pg_temp.assert(NOT (pg_temp.rpc('ticket_by_tracking_token', '{"hash":"h1"}'::jsonb)::text LIKE '%withdrawn draft answer%'), 'tracking page hides withdrawn reply');


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
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('search_knowledge', '{"product":"crm","q":"scheduling"}'::jsonb)) article
    WHERE article->>'title' = 'Scheduling campaigns'
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('search_knowledge', '{"product":"crm","q":"scheduling"}'::jsonb)) article
    WHERE article->>'title' IN ('Scheduling internals', 'Scheduling draft')
  ),
  'approved client article is searchable while internal and unapproved articles stay excluded');

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

-- 18. Status rules: valid transitions, waiting reasons, Needs admin as an escalation, history.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'sam', 'ticket', jsonb_build_object('product','crm','channel','staff','subject','How do I export customers?','body','Client asked by phone how to export customers to CSV.','account_id', :'greenleaf','kind_hint','question'))) ->>'ticket_id' AS q1 \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"waiting","waiting_reason":"lunch"}}'::jsonb)$q$, :'sam', :'q1'), 'waiting requires a reason');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"waiting","waiting_reason":"third_party"}'::jsonb));
SELECT pg_temp.assert((SELECT waiting_reason = 'third_party' AND waiting_since IS NOT NULL FROM bloom_support.tickets WHERE id = :'q1'), 'waiting reason and since recorded');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"status":"needs_owner"}}'::jsonb)$q$, :'sam', :'q1'), 'Needs admin requires decision_needed');
SELECT pg_temp.rpc('update_ticket', jsonb_build_object('actor', :'sam', 'ticket_id', :'q1', 'patch', '{"status":"needs_owner","decision_needed":"Can we give this client a custom export?","accountable":"jeff","recommendation":"Offer the standard CSV export","decision_due_at":"2099-01-01T00:00:00Z"}'::jsonb));
SELECT pg_temp.assert((SELECT owner_id = :'jeff' AND recommendation IS NOT NULL AND due_at = '2099-01-01T00:00:00Z' FROM bloom_support.escalations WHERE ticket_id = :'q1' AND reason = 'decision_needed'), 'Needs Jon/Jeff records decision, accountable person, recommendation, due');
SELECT pg_temp.assert((SELECT waiting_reason IS NULL FROM bloom_support.tickets WHERE id = :'q1'), 'no contradictory waiting reason outside Waiting');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.notifications WHERE ticket_id = :'q1' AND kind = 'ticket.needs_owner' AND title LIKE 'Needs admin #%')
  AND NOT EXISTS (SELECT 1 FROM bloom_support.notifications WHERE ticket_id = :'q1' AND title ~ '\m(Jon|Jeff)\M'), 'Needs admin notification names the role, not a person');

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
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.bloom_support_public_knowledge('crm')) article
    WHERE article->>'title' = 'Scheduling campaigns'
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.bloom_support_public_knowledge('crm')) article
    WHERE article->>'title' IN ('Scheduling internals', 'Scheduling draft')
  ),
  'public help includes approved client articles and excludes internal and draft articles');
SELECT pg_temp.assert(NOT ((public.bloom_support_public_knowledge('crm')->0) ? 'approved_by'), 'public help omits the approver identity');
SELECT pg_temp.assert(
  (SELECT count(*) = 9 AND count(*) FILTER (WHERE product = 'crm') = 3
          AND count(*) FILTER (WHERE product = 'cms') = 3
          AND count(*) FILTER (WHERE product = 'pos') = 3
          AND bool_and(jsonb_array_length(source_refs) > 0)
   FROM bloom_support.knowledge
   WHERE id::text LIKE '6f76e09a-38d1-4db2-a231-c01e79ce%'),
  'the reviewed starter knowledge set has three source-grounded articles per product');
SELECT pg_temp.assert(
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.bloom_support_public_knowledge(NULL)) article
    WHERE article ? 'source_refs'
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(bloom_support.search_knowledge('crm','import customers csv',5)) article
    WHERE article ? 'source_refs'
  ),
  'private repository provenance is absent from public help and Bloom answer search');
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(bloom_support.search_knowledge('crm','Could you explain scheduling with pineapple?',5)) article
    WHERE article->>'title' = 'Scheduling campaigns'
  ),
  'natural questions retrieve a matching approved answer even with unmatched words');
SELECT pg_temp.assert(jsonb_array_length(bloom_support.search_knowledge('pos','scheduling',5)) = 0, 'knowledge search stays product-scoped');
SELECT pg_temp.assert(jsonb_array_length(bloom_support.search_knowledge('crm','and the or',5)) = 0, 'stopword-only questions return no answer');
BEGIN;
INSERT INTO bloom_support.knowledge(product,title,body,audience,approved) VALUES ('crm','Review purchases','View purchases in the reports area.','client',true);
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM jsonb_array_elements(bloom_support.search_knowledge('crm','purchases',5)) a WHERE a->>'title'='Review purchases'), 'English lexemes are not stemmed twice');
ROLLBACK;
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


-- 33. Person-confirmed site creation never retries an uncertain product call.
SELECT pg_temp.rpc('record_operation_preview',jsonb_build_object('actor',:'jeff','operation',jsonb_build_object(
  'account_id',:'greenleaf','kind','site.create_draft','permission','ops.site.create','idempotency_key','site-recovery-contract',
  'inputs',jsonb_build_object('expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001',
    'expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),
  'preview',jsonb_build_object('summary','Create unpublished draft')))) AS site_op \gset
SELECT (:'site_op'::jsonb)->>'id' AS site_op_id \gset
SELECT pg_temp.assert(pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'site_op_id'))->>'status'='executing','person claims site creation');
SELECT pg_temp.assert((pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'site_op_id'))->>'already')::boolean,'active creation is not claimed concurrently');
UPDATE bloom_support.operations SET updated_at=now()-interval '6 minutes' WHERE id=:'site_op_id';
SELECT pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'site_op_id')) AS stale_site_claim \gset
SELECT pg_temp.assert(
  :'stale_site_claim'::jsonb->>'status'='reconciliation_needed'
  AND :'stale_site_claim'::jsonb->'reconciliation'->>'action'='execute',
  'stale site creation becomes reconciliation_needed instead of being resent');
SELECT pg_temp.assert((pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'site_op_id'))->>'already')::boolean,
  'uncertain site creation remains blocked until person verification');
SELECT bloom_support.reconcile_operation(:'jeff',:'site_op_id','not_applied','{"passed":true,"checked":"CMS operation log"}'::jsonb,'No site exists for this operation id');
SELECT pg_temp.assert((SELECT status='failed' AND reconciliation IS NULL FROM bloom_support.operations WHERE id=:'site_op_id'),
  'person verification can record that the uncertain site change was not applied');
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.claim_operation('%s','%s')$q$,:'sam',:'site_op_id'),'ops.site.create');

SELECT pg_temp.rpc('record_operation_preview',jsonb_build_object('actor',:'jeff','operation',jsonb_build_object(
  'account_id',:'greenleaf','kind','site.create_draft','permission','ops.site.create','idempotency_key','site-missing-guard-contract',
  'inputs','{}'::jsonb,'preview','{}'::jsonb))) AS unguarded_site_op \gset
SELECT pg_temp.expect_error(format($q$SELECT bloom_support.claim_operation('%s','%s')$q$,:'jeff',(:'unguarded_site_op'::jsonb)->>'id'),'fresh client and owner preview');

-- Non-idempotent campaign changes retain their original no-retry behaviour.
SELECT pg_temp.rpc('record_operation_preview',jsonb_build_object('actor',:'jeff','operation',jsonb_build_object(
  'account_id',:'greenleaf','kind','campaign.update_draft','permission','ops.campaign.edit','idempotency_key','campaign-no-retry-contract',
  'inputs','{}'::jsonb,'preview','{}'::jsonb))) AS no_retry_op \gset
SELECT (:'no_retry_op'::jsonb)->>'id' AS no_retry_id \gset
SELECT pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'no_retry_id'));
SELECT pg_temp.rpc('finish_operation',jsonb_build_object('actor',:'jeff','operation_id',:'no_retry_id','outcome',jsonb_build_object('status','failed','error','test')));
SELECT pg_temp.assert((pg_temp.rpc('claim_operation',jsonb_build_object('actor',:'jeff','operation_id',:'no_retry_id'))->>'already')::boolean,'other failed changes are not automatically replayed');

-- 34. Readiness reports independent live evidence for CMS and POS.
BEGIN;
INSERT INTO bloom_support.activity(account_id, actor_id, action, detail, created_at) VALUES
  (:'greenleaf', :'jeff', 'operation.read', '{"kind":"site.pages"}', '2090-02-01T00:00:00Z'),
  (:'greenleaf', :'jeff', 'operation.read', '{"kind":"pos.products"}', '2090-03-01T00:00:00Z'),
  (:'greenleaf', :'jeff', 'operation.read_denied', '{"kind":"pos.inventory"}', '2090-04-01T00:00:00Z');
INSERT INTO bloom_support.operations(
  account_id, actor_id, kind, permission, inputs, status, idempotency_key, updated_at
) VALUES
  (:'greenleaf', :'jeff', 'site.page.update', 'ops.site.edit', '{}', 'succeeded', 'readiness-cms-success', '2090-02-02T00:00:00Z'),
  (:'greenleaf', :'jeff', 'site.publish', 'ops.site.publish', '{}', 'failed', 'readiness-cms-failed', '2090-05-01T00:00:00Z'),
  (:'greenleaf', :'jeff', 'campaign.schedule', 'ops.campaign.edit', '{}', 'succeeded', 'readiness-crm-success', '2090-06-01T00:00:00Z');
SELECT pg_temp.assert(
  (bloom_support.readiness_facts(:'jon')#>>'{last_seen,operation_cms}')::timestamptz = '2090-02-02T00:00:00Z',
  'CMS readiness uses successful CMS reads and writes, not failed or CRM operations'
);
SELECT pg_temp.assert(
  (bloom_support.readiness_facts(:'jon')#>>'{last_seen,operation_pos}')::timestamptz = '2090-03-01T00:00:00Z',
  'POS readiness uses successful POS reads, not denied attempts'
);
ROLLBACK;

-- 35. Resolved ticket queue state cannot be reintroduced by later jobs.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm',
    'channel', 'crm',
    'subject', 'Resolved-state invariant',
    'body', 'This request is only for the resolved-state regression contract.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS resolved_invariant_ticket \gset
UPDATE bloom_support.tickets
SET status = 'resolved',
    resolved_at = now(),
    next_action = 'must clear',
    next_action_due_at = now() + interval '1 hour',
    waiting_reason = 'internal',
    pending_review = 'must clear'
WHERE id = :'resolved_invariant_ticket';
SELECT pg_temp.assert((
  SELECT stage = 'resolved'
    AND next_action IS NULL
    AND next_action_due_at IS NULL
    AND waiting_reason IS NULL
    AND pending_review IS NULL
    AND due_at IS NULL
  FROM bloom_support.tickets
  WHERE id = :'resolved_invariant_ticket'
), 'entering resolved clears all queue-driving state');
UPDATE bloom_support.tickets
SET next_action = 'later job tried to requeue',
    next_action_due_at = now() + interval '2 hours',
    waiting_reason = 'customer',
    waiting_since = now(),
    pending_review = 'reply_after_resolution'
WHERE id = :'resolved_invariant_ticket';
SELECT pg_temp.assert((
  SELECT next_action IS NULL
    AND next_action_due_at IS NULL
    AND waiting_reason IS NULL
    AND waiting_since IS NULL
    AND pending_review = 'reply_after_resolution'
    AND due_at IS NULL
  FROM bloom_support.tickets
  WHERE id = :'resolved_invariant_ticket'
), 'later updates are re-cleared without breaking post-resolution reply routing');
UPDATE bloom_support.tickets
SET pending_review = 'stale_internal_job'
WHERE id = :'resolved_invariant_ticket';
SELECT pg_temp.assert((
  SELECT pending_review IS NULL
  FROM bloom_support.tickets
  WHERE id = :'resolved_invariant_ticket'
), 'later resolved-ticket updates clear every non-reply pending review value');
INSERT INTO bloom_support.escalations(
  ticket_id, audience, reason, detail, status, dedupe_key
) VALUES (
  :'resolved_invariant_ticket', 'both', 'ticket_overdue',
  'A late watchdog attempted to reopen this escalation', 'open',
  'resolved-invariant-ticket-level'
);
SELECT pg_temp.assert((
  SELECT status = 'resolved'
    AND decision = 'Ticket resolved'
    AND resolved_at IS NOT NULL
  FROM bloom_support.escalations
  WHERE dedupe_key = 'resolved-invariant-ticket-level'
), 'new ticket-level escalations for a resolved ticket close immediately');
UPDATE bloom_support.escalations
SET status = 'open', decision = NULL, resolved_at = NULL
WHERE dedupe_key = 'resolved-invariant-ticket-level';
SELECT pg_temp.assert((
  SELECT status = 'resolved' AND resolved_at IS NOT NULL
  FROM bloom_support.escalations
  WHERE dedupe_key = 'resolved-invariant-ticket-level'
), 'reopening a ticket-level escalation for a resolved ticket is prevented');
INSERT INTO bloom_support.escalations(
  ticket_id, engineering_issue_id, audience, reason, detail, status, dedupe_key
) VALUES (
  :'resolved_invariant_ticket', :'eng', 'jon', 'automation_failed',
  'The linked release still needs an engineering decision', 'open',
  'resolved-invariant-engineering'
);
SELECT pg_temp.assert((
  SELECT status = 'open'
  FROM bloom_support.escalations
  WHERE dedupe_key = 'resolved-invariant-engineering'
), 'intentional engineering escalations remain open after the client ticket resolves');

-- 36. Explicit no-deploy resolutions close only terminal pre-PR work and its shared problem.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'No-deploy issue A',
    'body', 'This fixture will share a conservative no-deploy engineering record.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS no_deploy_a \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'No-deploy issue B',
    'body', 'This second fixture proves every linked ticket must be resolved.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS no_deploy_b \gset
SELECT pg_temp.rpc('create_problem', jsonb_build_object(
  'actor', :'jeff',
  'problem', jsonb_build_object('title', 'Shared no-deploy problem', 'product', 'crm')
))->>'id' AS no_deploy_problem \gset
SELECT pg_temp.rpc('link_problem', jsonb_build_object('actor', :'jeff', 'ticket_id', :'no_deploy_a', 'problem_id', :'no_deploy_problem'));
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'jeff', 'ticket_id', :'no_deploy_a', 'issue', '{}'))#>>'{engineering_issue_id}' AS no_deploy_issue \gset
SELECT pg_temp.rpc('link_problem', jsonb_build_object('actor', :'jeff', 'ticket_id', :'no_deploy_b', 'problem_id', :'no_deploy_problem'));
UPDATE bloom_support.engineering_issues SET status = 'escalated' WHERE id = :'no_deploy_issue';
INSERT INTO bloom_support.escalations(
  ticket_id, engineering_issue_id, audience, reason, detail, status, dedupe_key
) VALUES (
  :'no_deploy_a', :'no_deploy_issue', 'both', 'automation_failed',
  'This escalation should close with the explicit no-deploy resolution.',
  'acknowledged', 'no-deploy-engineering-escalation'
);
UPDATE bloom_support.tickets
SET status = 'resolved',
    resolved_at = now(),
    resolution_evidence = '{"no_deploy_reason":"The setting was corrected without a code release."}'
WHERE id = :'no_deploy_a';
SELECT pg_temp.assert((
  SELECT status = 'escalated'
  FROM bloom_support.engineering_issues
  WHERE id = :'no_deploy_issue'
), 'one unresolved linked ticket keeps terminal engineering work visible');
SELECT pg_temp.assert((
  SELECT status = 'open'
  FROM bloom_support.problems
  WHERE id = :'no_deploy_problem'
), 'one unresolved linked ticket keeps the shared problem open');
UPDATE bloom_support.tickets
SET status = 'resolved',
    resolved_at = now(),
    resolution_evidence = '{"no_deploy_reason":"The same configuration correction fixed this report."}'
WHERE id = :'no_deploy_b';
SELECT pg_temp.assert((
  SELECT status = 'closed'
    AND evidence->>'no_deploy_previous_status' = 'escalated'
    AND evidence->>'no_deploy_closed_at' IS NOT NULL
    AND pr_number IS NULL
    AND merge_sha IS NULL
    AND deployment IS NULL
  FROM bloom_support.engineering_issues
  WHERE id = :'no_deploy_issue'
), 'all explicit no-deploy resolutions close a terminal pre-PR issue and preserve evidence');
SELECT pg_temp.assert((
  SELECT status = 'resolved'
    AND decision = 'Closed without deployment: all linked tickets resolved'
    AND resolved_at IS NOT NULL
  FROM bloom_support.escalations
  WHERE dedupe_key = 'no-deploy-engineering-escalation'
), 'no-deploy cleanup closes the linked engineering escalation');
SELECT pg_temp.assert(EXISTS (
  SELECT 1
  FROM bloom_support.activity
  WHERE ticket_id = :'no_deploy_a'
    AND action = 'engineering.closed_no_deploy'
    AND detail->>'engineering_issue_id' = :'no_deploy_issue'
), 'no-deploy engineering cleanup is append-only audited');
SELECT pg_temp.assert((
  SELECT status = 'resolved'
  FROM bloom_support.problems
  WHERE id = :'no_deploy_problem'
), 'a shared problem resolves after every ticket and linked engineering issue are terminal');

-- AFTER-trigger ordering: the RPC must observe conservative closure before it
-- creates failed/escalated side effects from a stale RETURNING row.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Ordering no-deploy issue',
    'body', 'This fixture is resolved before the repair report finishes.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS ordering_ticket \gset
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object(
  'actor', :'jeff', 'ticket_id', :'ordering_ticket',
  'issue', '{"title":"Ordering no-deploy issue"}'::jsonb
))#>>'{engineering_issue_id}' AS ordering_issue \gset
UPDATE bloom_support.engineering_issues
SET status = 'investigating'
WHERE id = :'ordering_issue';
UPDATE bloom_support.tickets
SET status = 'resolved', resolved_at = now(),
    resolution_evidence = '{"no_deploy_reason":"No code change was required."}'
WHERE id = :'ordering_ticket';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object(
  'actor', :'rr', 'issue_id', :'ordering_issue',
  'update', '{"status":"failed","patch":{"reproduction":{"reproduced":false,"reason":"Configuration only"}}}'::jsonb
)) AS ordering_result \gset
SELECT pg_temp.assert(
  (:'ordering_result'::jsonb)->>'status' = 'closed'
  AND (SELECT status = 'closed' FROM bloom_support.engineering_issues WHERE id = :'ordering_issue'),
  'repair RPC returns the post-trigger closed status'
);
SELECT pg_temp.assert(NOT EXISTS (
  SELECT 1 FROM bloom_support.escalations
  WHERE engineering_issue_id = :'ordering_issue' AND status <> 'resolved'
), 'post-trigger closure cannot recreate an engineering escalation');
SELECT pg_temp.assert(NOT EXISTS (
  SELECT 1 FROM bloom_support.notifications
  WHERE kind = 'engineering.failed' AND title LIKE '%Ordering no-deploy issue%'
), 'post-trigger closure cannot create a misleading failed notification');

SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Active release issue',
    'body', 'This fixture proves a PR prevents conservative no-deploy cleanup.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS active_release_ticket \gset
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'jeff', 'ticket_id', :'active_release_ticket', 'issue', '{}'))#>>'{engineering_issue_id}' AS active_release_issue \gset
UPDATE bloom_support.engineering_issues
SET status = 'escalated',
    pr_number = 42,
    pr_url = 'https://github.com/Brands-In-Blooms/brandsinblooms/pull/42'
WHERE id = :'active_release_issue';
UPDATE bloom_support.tickets
SET status = 'resolved',
    resolved_at = now(),
    resolution_evidence = '{"no_deploy_reason":"Ticket-level workaround documented."}'
WHERE id = :'active_release_ticket';
SELECT pg_temp.assert((
  SELECT status = 'escalated' AND pr_number = 42
  FROM bloom_support.engineering_issues
  WHERE id = :'active_release_issue'
), 'an issue with release evidence is never auto-closed by a ticket resolution');

-- 37. Intake idempotency is atomically bound to the stored payload.
SELECT repeat('a', 64) AS intake_fp_a, repeat('b', 64) AS intake_fp_b \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Fingerprint fixture',
    'body', 'The exact same request may be retried safely.',
    'account_id', :'greenleaf', 'dedupe_key', 'fingerprint-fixture',
    'intake_fingerprint', :'intake_fp_a'
  )
)) AS fingerprint_first \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Fingerprint fixture',
    'body', 'The exact same request may be retried safely.',
    'account_id', :'greenleaf', 'dedupe_key', 'fingerprint-fixture',
    'intake_fingerprint', :'intake_fp_a'
  )
)) AS fingerprint_retry \gset
SELECT pg_temp.assert(
  (:'fingerprint_retry'::jsonb->>'duplicate_delivery')::boolean
  AND :'fingerprint_retry'::jsonb->>'ticket_id' = :'fingerprint_first'::jsonb->>'ticket_id',
  'an exact fingerprint retry returns the one stored ticket'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('create_ticket', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'gail',
    'ticket', jsonb_build_object(
      'product', 'crm', 'channel', 'crm', 'subject', 'Edited retry',
      'body', 'This changed request must not claim the old ticket was saved.',
      'account_id', :'greenleaf', 'dedupe_key', 'fingerprint-fixture',
      'intake_fingerprint', :'intake_fp_b'
    )
  )::text
), 'idempotency key reused with different request');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'rosa',
  'ticket', jsonb_build_object(
    'product', 'pos', 'channel', 'pos', 'subject', 'Actor-isolated key',
    'body', 'Another actor may independently use the same client key.',
    'account_id', :'rose', 'dedupe_key', 'fingerprint-fixture',
    'intake_fingerprint', :'intake_fp_b'
  )
)) AS fingerprint_other_actor \gset
SELECT pg_temp.assert(
  :'fingerprint_other_actor'::jsonb->>'ticket_id' <> :'fingerprint_first'::jsonb->>'ticket_id',
  'idempotency keys remain isolated by actor'
);

-- Public rate claims share the create transaction: exact retries do not spend
-- quota twice, and a rejected new key leaves both counters unchanged.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'intake',
  'ticket', jsonb_build_object(
    'product', 'unknown', 'channel', 'public', 'subject', 'Public quota fixture',
    'body', 'A public retry at the quota boundary must still find this ticket.',
    'dedupe_key', 'public:quota-fixture',
    'intake_fingerprint', :'intake_fp_a',
    'public_rate', jsonb_build_object(
      'email_bucket', 'test-public-email', 'email_subject', 'email-hash', 'email_limit', 1,
      'ip_bucket', 'test-public-ip', 'ip_subject', 'ip-hash', 'ip_limit', 1
    )
  )
)) AS public_rate_first \gset
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'intake',
  'ticket', jsonb_build_object(
    'product', 'unknown', 'channel', 'public', 'subject', 'Public quota fixture',
    'body', 'A public retry at the quota boundary must still find this ticket.',
    'dedupe_key', 'public:quota-fixture',
    'intake_fingerprint', :'intake_fp_a',
    'public_rate', jsonb_build_object(
      'email_bucket', 'test-public-email', 'email_subject', 'email-hash', 'email_limit', 1,
      'ip_bucket', 'test-public-ip', 'ip_subject', 'ip-hash', 'ip_limit', 1
    )
  )
)) AS public_rate_retry \gset
SELECT pg_temp.assert(
  (:'public_rate_retry'::jsonb->>'duplicate_delivery')::boolean
  AND (SELECT count = 1 FROM bloom_support.usage_counters WHERE bucket = 'test-public-email' AND subject = 'email-hash')
  AND (SELECT count = 1 FROM bloom_support.usage_counters WHERE bucket = 'test-public-ip' AND subject = 'ip-hash'),
  'public exact retry succeeds without consuming quota twice'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('create_ticket', %L::jsonb)$q$,
  jsonb_build_object(
    'actor', :'intake',
    'ticket', jsonb_build_object(
      'product', 'unknown', 'channel', 'public', 'subject', 'New over-limit request',
      'body', 'A genuinely new request must still be rejected at the boundary.',
      'dedupe_key', 'public:quota-fixture-2', 'intake_fingerprint', :'intake_fp_b',
      'public_rate', jsonb_build_object(
        'email_bucket', 'test-public-email', 'email_subject', 'email-hash', 'email_limit', 1,
        'ip_bucket', 'test-public-ip', 'ip_subject', 'ip-hash', 'ip_limit', 1
      )
    )
  )::text
), 'rate_limited');
SELECT pg_temp.assert(
  (SELECT count = 1 FROM bloom_support.usage_counters WHERE bucket = 'test-public-email' AND subject = 'email-hash')
  AND NOT EXISTS (SELECT 1 FROM bloom_support.tickets WHERE dedupe_key = :'intake' || ':public:quota-fixture-2'),
  'a rejected public request rolls back quota and ticket state'
);

SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'chatgpt', 'subject', 'Paused handoff',
    'body', 'Chat handoff must never race a triage job.',
    'account_id', :'greenleaf', 'dedupe_key', 'paused-handoff',
    'automation', 'paused'
  )
))#>>'{ticket_id}' AS paused_handoff \gset
SELECT pg_temp.assert((
  SELECT automation = 'paused'
    AND NOT EXISTS (SELECT 1 FROM bloom_support.jobs WHERE ticket_id = :'paused_handoff' AND kind = 'triage')
  FROM bloom_support.tickets WHERE id = :'paused_handoff'
), 'create_ticket preserves paused automation and never enqueues triage');

-- 38. A late repair report merges report-owned facts and re-enters evaluation.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Late report race',
    'body', 'Evaluation reached approval before the repair report arrived.',
    'account_id', :'greenleaf'
  )
))#>>'{ticket_id}' AS late_report_ticket \gset
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object(
  'actor', :'jeff', 'ticket_id', :'late_report_ticket',
  'issue', '{"title":"Late report race"}'::jsonb
))#>>'{engineering_issue_id}' AS late_report_issue \gset
UPDATE bloom_support.engineering_issues
SET status = 'approved',
    pr_number = 88,
    head_sha = 'late-report-head',
    approved_head_sha = 'late-report-head',
    reproduction = '{"trusted_note":"preserve me","reproduced":false}'::jsonb
WHERE id = :'late_report_issue';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object(
  'actor', :'rr', 'issue_id', :'late_report_issue',
  'update', '{"status":"not_reproduced","patch":{"reproduction":{"reproduced":false,"root_cause":"Late evidence changed the release decision","verification":[{"url":"https://attacker.invalid"}]}}}'::jsonb
));
SELECT pg_temp.assert((
  SELECT status = 'awaiting_approval'
    AND approved_head_sha IS NULL
    AND reproduction->>'trusted_note' = 'preserve me'
    AND reproduction->>'root_cause' = 'Late evidence changed the release decision'
    AND NOT (reproduction ? 'verification')
  FROM bloom_support.engineering_issues
  WHERE id = :'late_report_issue'
), 'late repair report merges allowed facts and invalidates approval when material evidence changes');
SELECT pg_temp.assert(EXISTS (
  SELECT 1 FROM bloom_support.jobs
  WHERE engineering_issue_id = :'late_report_issue'
    AND kind = 'engineering_step'
    AND payload->>'step' = 'evaluate'
    AND payload->>'reason' = 'late_repair_report'
), 'late repair report schedules an idempotent reevaluation');

-- 39. Only system-resolved shared problems reopen when work becomes active.
UPDATE bloom_support.tickets
SET status = 'working'
WHERE id = :'no_deploy_a';
SELECT pg_temp.assert((
  SELECT status = 'open' AND auto_resolved_at IS NULL
  FROM bloom_support.problems WHERE id = :'no_deploy_problem'
), 'reopening a linked ticket reopens an auto-resolved problem');
UPDATE bloom_support.tickets
SET status = 'resolved',
    resolved_at = now(),
    resolution_evidence = '{"no_deploy_reason":"The configuration remains corrected."}'
WHERE id = :'no_deploy_a';
SELECT pg_temp.assert((
  SELECT status = 'resolved' AND auto_resolved_at IS NOT NULL
  FROM bloom_support.problems WHERE id = :'no_deploy_problem'
), 'the shared problem auto-resolves again when all work is terminal');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'New linked evidence',
    'body', 'A new active ticket must make the shared problem visible again.',
    'account_id', :'greenleaf'
  )
))#>>'{ticket_id}' AS reopened_problem_ticket \gset
SELECT pg_temp.rpc('link_problem', jsonb_build_object(
  'actor', :'jeff', 'ticket_id', :'reopened_problem_ticket',
  'problem_id', :'no_deploy_problem'
));
SELECT pg_temp.assert((
  SELECT status = 'open' FROM bloom_support.problems WHERE id = :'no_deploy_problem'
), 'linking a new active ticket reopens an auto-resolved problem');
SELECT pg_temp.rpc('update_problem', jsonb_build_object(
  'actor', :'jeff', 'problem_id', :'no_deploy_problem',
  'patch', '{"status":"resolved"}'::jsonb
));
UPDATE bloom_support.tickets SET status = 'working' WHERE id = :'reopened_problem_ticket';
SELECT pg_temp.assert((
  SELECT status = 'resolved' AND auto_resolved_at IS NULL
  FROM bloom_support.problems WHERE id = :'no_deploy_problem'
), 'a person-resolved problem is not reopened automatically');

-- 40. Stale release state is self-healing across migration/function rollout order.
UPDATE bloom_support.engineering_issues
SET updated_at = now()
WHERE status IN ('in_review', 'approved', 'awaiting_approval');
INSERT INTO bloom_support.engineering_issues(
  id, title, product, repository, status, pr_number, pr_url, head_sha,
  approved_head_sha, updated_at
) VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Stranded merged release', 'crm', 'JonDMorrison/brandsinblooms',
  'approved', 1012, 'https://github.com/JonDMorrison/brandsinblooms/pull/1012',
  'reviewed-head', 'reviewed-head', now() - interval '10 minutes'
);
INSERT INTO bloom_support.jobs(
  kind, engineering_issue_id, lane, payload, status, result,
  idempotency_key, created_at, updated_at
) VALUES (
  'engineering_step', 'f1000000-0000-4000-8000-000000000001',
  'engineering:f1000000-0000-4000-8000-000000000001',
  '{"step":"evaluate","reason":"release_state_recovery"}', 'succeeded',
  '{"note":"evaluate: already merged"}',
  'engineering-release-recovery:f1000000-0000-4000-8000-000000000001',
  now() - interval '9 minutes', now() - interval '9 minutes'
);

-- Hold the reconciler's advisory key in this session, then prove a second
-- database session cannot enter the candidate query until the key is released.
-- This exercises cross-worker serialization rather than only the idempotency
-- key used within one cooldown bucket.
SELECT dblink_connect(
  'release_reconcile_concurrency',
  format(
    'dbname=%s user=%s host=%s port=%s',
    current_database(),
    current_user,
    coalesce(
      pg_catalog.host(inet_server_addr()),
      btrim(split_part(current_setting('unix_socket_directories'), ',', 1))
    ),
    coalesce(inet_server_port(), current_setting('port')::integer)
  )
);
SELECT pg_catalog.pg_advisory_lock(
  pg_catalog.hashtextextended('bloom_support:engineering-release-reconcile', 0)
);
SELECT dblink_send_query(
  'release_reconcile_concurrency',
  format(
    'SELECT public.bloom_support_enqueue_engineering_recoveries(%L::uuid)',
    :'release'
  )
);
SELECT pg_sleep(0.1);
SELECT pg_temp.assert(
  dblink_is_busy('release_reconcile_concurrency') = 1,
  'a concurrent release reconciler waits for the transaction-scoped advisory lock'
);
SELECT pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended('bloom_support:engineering-release-reconcile', 0)
);
SELECT recovery_count
FROM dblink_get_result('release_reconcile_concurrency') AS result(recovery_count integer) \gset
SELECT dblink_disconnect('release_reconcile_concurrency');
SELECT pg_temp.assert(:'recovery_count'::integer = 1, 'a succeeded one-shot recovery does not strand a stale release under the old worker');
SELECT pg_temp.assert((
  SELECT count(*) = 1
    AND bool_and(status = 'queued')
    AND bool_and(payload->>'step' = 'evaluate')
    AND bool_and(payload->>'reason' = 'release_state_reconcile')
  FROM bloom_support.jobs
  WHERE engineering_issue_id = 'f1000000-0000-4000-8000-000000000001'
    AND idempotency_key LIKE 'engineering-release-reconcile:%'
), 'release reconciliation queues one fresh evaluation');
SELECT public.bloom_support_enqueue_engineering_recoveries(:'release') AS recovery_count \gset
SELECT pg_temp.assert(:'recovery_count'::integer = 0, 'an active recovery job suppresses duplicate worker ticks');
UPDATE bloom_support.jobs
SET status = 'succeeded', result = '{"note":"evaluate: still open"}'
WHERE engineering_issue_id = 'f1000000-0000-4000-8000-000000000001'
  AND idempotency_key LIKE 'engineering-release-reconcile:%';
SELECT public.bloom_support_enqueue_engineering_recoveries(:'release') AS recovery_count \gset
SELECT pg_temp.assert(:'recovery_count'::integer = 0, 'a recently completed recovery observes the cooldown instead of looping');
SELECT pg_temp.assert(
  NOT has_function_privilege('anon', 'public.bloom_support_enqueue_engineering_recoveries(uuid)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.bloom_support_enqueue_engineering_recoveries(uuid)', 'execute')
  AND has_function_privilege('service_role', 'public.bloom_support_enqueue_engineering_recoveries(uuid)', 'execute'),
  'release reconciliation is service-role only'
);
SELECT pg_temp.expect_error(
  format($q$SELECT public.bloom_support_enqueue_engineering_recoveries('%s')$q$, :'bot'),
  'engineering.release'
);


-- Email design: one conversation per ticket, coalesced Bloom messages, HTML kept for retries.
UPDATE bloom_support.tickets SET automation = 'auto' WHERE id = :'t1id';
INSERT INTO bloom_support.messages(id, conversation_id, ticket_id, author_kind, visibility, direction, body, delivery, purpose)
SELECT x.id, t.conversation_id, t.id, 'bloom', 'public', 'outbound', x.body, 'queued', x.purpose
  FROM bloom_support.tickets t, (VALUES ('e1000000-0000-4000-8000-000000000001'::uuid, 'We have your request.', 'acknowledgement'),
                                        ('e1000000-0000-4000-8000-000000000002'::uuid, 'We passed it on.', 'progress')) x(id, body, purpose)
 WHERE t.id = :'t1id';
SELECT pg_temp.rpc('queue_outbound_email', jsonb_build_object('email', jsonb_build_object('ticket_id', :'t1id', 'message_id', 'e1000000-0000-4000-8000-000000000001',
  'purpose', 'acknowledgement', 'to', 'client@greenleaf.test', 'subject', '[Bloom #1] s', 'body', 'both', 'html', '<p>both</p>',
  'rfc_message_id', '<bloom.random1@bloom.test>', 'thread_root', '<bloom-ticket.' || :'t1id' || '@bloom.test>', 'idempotency_key', 'design-1',
  'covered_message_ids', jsonb_build_array('e1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000099'))))->>'id' AS design_email \gset
SELECT pg_temp.assert((SELECT rfc_message_id = '<bloom-ticket.' || :'t1id' || '@bloom.test>' AND html = '<p>both</p>'
                         AND covered_message_ids = ARRAY['e1000000-0000-4000-8000-000000000002'::uuid]
                         FROM bloom_support.outbound_emails WHERE id = :'design_email'), 'first email takes the ticket thread root and keeps its HTML; only same-ticket messages are covered');
SELECT pg_temp.rpc('mark_outbound_email', jsonb_build_object('id', :'design_email', 'status', 'sent', 'provider_id', 'prov-design-1'));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.messages WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002') AND delivery = 'sent') = 2,
  'a coalesced email marks every message it delivered as sent');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.delivery_delayed"}'::jsonb) AS delayed_delivery \gset
SELECT pg_temp.assert(
  (:'delayed_delivery'::jsonb)->>'status' = 'sent'
  AND ((:'delayed_delivery'::jsonb)->>'delivery_delayed')::boolean
  AND (SELECT status = 'sent' AND provider_events @> '[{"type":"email.delivery_delayed"}]'::jsonb
         FROM bloom_support.outbound_emails WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.messages
       WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
         AND delivery = 'sent') = 2,
  'a delivery delay is recorded without pretending the coalesced messages delivered or failed');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.delivery_delayed"}'::jsonb);
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM bloom_support.activity
          WHERE ticket_id = :'t1id' AND action = 'email.delivery_delayed'
            AND detail->>'provider_id' = 'prov-design-1')
  AND EXISTS (SELECT 1 FROM bloom_support.notifications
              WHERE ticket_id = :'t1id' AND kind = 'email.delivery_delayed'
                AND dedupe_key LIKE 'email-delivery-delayed:' || :'design_email' || ':%')
  AND (SELECT count(*) = count(DISTINCT principal_id) AND count(*) > 0
       FROM bloom_support.notifications
       WHERE ticket_id = :'t1id' AND kind = 'email.delivery_delayed'
         AND dedupe_key LIKE 'email-delivery-delayed:' || :'design_email' || ':%'),
  'a delivery delay gives staff an actionable, deduplicated signal');
SELECT pg_temp.assert((pg_temp.rpc('queue_outbound_email', jsonb_build_object('email', jsonb_build_object('ticket_id', :'t1id', 'purpose', 'progress', 'to', 'client@greenleaf.test',
  'subject', '[Bloom #1] s', 'body', 'later', 'rfc_message_id', '<bloom.random2@bloom.test>', 'thread_root', '<bloom-ticket.' || :'t1id' || '@bloom.test>',
  'idempotency_key', 'design-2'))))->>'rfc_message_id' = '<bloom.random2@bloom.test>', 'later emails keep their own Message-ID');
SELECT pg_temp.assert((pg_temp.rpc('queue_outbound_email', jsonb_build_object('email', jsonb_build_object('ticket_id', :'t1id', 'message_id', 'e1000000-0000-4000-8000-000000000001',
  'purpose', 'acknowledgement', 'to', 'client@greenleaf.test', 'subject', '[Bloom #1] s', 'body', 'both', 'rfc_message_id', '<bloom.random3@bloom.test>',
  'thread_root', '<bloom-ticket.' || :'t1id' || '@bloom.test>', 'idempotency_key', 'design-1'))))->>'duplicate' = 'true', 'a retry is a duplicate of the recorded email');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.delivered"}'::jsonb);
SELECT pg_temp.assert(
  (SELECT status = 'delivered' FROM bloom_support.outbound_emails WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.messages
       WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
         AND delivery = 'delivered') = 2,
  'a delivered event reaches every message represented by the coalesced email');
SELECT count(*) AS delayed_alerts_before_terminal_event
FROM bloom_support.notifications
WHERE ticket_id = :'t1id' AND kind = 'email.delivery_delayed' \gset
SELECT count(*) AS delayed_logs_before_terminal_event
FROM bloom_support.activity
WHERE ticket_id = :'t1id' AND action = 'email.delivery_delayed' \gset
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.delivery_delayed"}'::jsonb);
SELECT pg_temp.assert(
  (SELECT status = 'delivered'
          AND (SELECT count(*) FROM jsonb_array_elements(provider_events) event
               WHERE event->>'type' = 'email.delivery_delayed') = 3
   FROM bloom_support.outbound_emails
   WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.notifications
       WHERE ticket_id = :'t1id' AND kind = 'email.delivery_delayed') = :'delayed_alerts_before_terminal_event'::bigint
  AND (SELECT count(*) FROM bloom_support.activity
       WHERE ticket_id = :'t1id' AND action = 'email.delivery_delayed') = :'delayed_logs_before_terminal_event'::bigint,
  'a late delivery-delay event is retained without raising a false alert after confirmed delivery');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.sent"}'::jsonb);
SELECT pg_temp.assert(
  (SELECT status = 'delivered' FROM bloom_support.outbound_emails WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.messages
       WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
         AND delivery = 'delivered') = 2,
  'an out-of-order sent event cannot roll delivered mail backward');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.bounced"}'::jsonb);
SELECT pg_temp.assert(
  (SELECT status = 'bounced' FROM bloom_support.outbound_emails WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.messages
       WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
         AND delivery = 'bounced') = 2,
  'a bounce reaches every message represented by the coalesced email');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.delivered"}'::jsonb);
SELECT pg_temp.assert((SELECT status = 'bounced' FROM bloom_support.outbound_emails WHERE id = :'design_email'),
  'an out-of-order delivered event cannot hide a bounce');
SELECT pg_temp.rpc('record_delivery_event', '{"provider_id":"prov-design-1","type":"email.complained"}'::jsonb);
SELECT pg_temp.assert(
  (SELECT status = 'complained' FROM bloom_support.outbound_emails WHERE id = :'design_email')
  AND (SELECT count(*) FROM bloom_support.messages
       WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
         AND delivery = 'complained') = 2,
  'a complaint supersedes a bounce and reaches every coalesced message');
SELECT pg_temp.assert(jsonb_typeof(public.bloom_support_digest_report(now() - interval '1 day')->'needs_you') = 'array', 'digest report runs');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'public.bloom_support_digest_report(timestamptz)', 'execute')
  AND has_function_privilege('service_role', 'public.bloom_support_digest_report(timestamptz)', 'execute'), 'digest report is service-role only');
SELECT pg_temp.assert(position('Bloom alert' IN bloom_support.botanical_alert_html('A <b>', ARRAY['x & y'], 'i', 'd', 'b', 'https://bloomsuite.app/x')) > 0
  AND position('<b>' IN bloom_support.botanical_alert_html('A <b>', ARRAY['x & y'], 'i', 'd', 'b', 'https://bloomsuite.app/x')) = 0, 'alert html escapes text');

-- Clients never see an internal routing status: non-staff get the four-state client model.
DO $$
DECLARE t bloom_support.tickets;
BEGIN
  SELECT * INTO t FROM bloom_support.tickets LIMIT 1;
  t.status := 'new'; t.waiting_reason := NULL;
  PERFORM pg_temp.assert(bloom_support.client_status(t) = 'received', 'new -> received');
  t.status := 'working';
  PERFORM pg_temp.assert(bloom_support.client_status(t) = 'in_progress', 'working -> in_progress');
  t.status := 'needs_owner';
  PERFORM pg_temp.assert(bloom_support.client_status(t) = 'in_progress', 'needs_owner -> in_progress');
  t.status := 'waiting'; t.waiting_reason := 'customer';
  PERFORM pg_temp.assert(bloom_support.client_status(t) = 'waiting_on_you', 'waiting on customer -> waiting_on_you');
  FOREACH t.waiting_reason IN ARRAY ARRAY['internal','third_party','deployment','scheduled'] LOOP
    PERFORM pg_temp.assert(bloom_support.client_status(t) = 'in_progress', 'waiting on ' || t.waiting_reason || ' -> in_progress');
  END LOOP;
  t.status := 'resolved'; t.waiting_reason := NULL;
  PERFORM pg_temp.assert(bloom_support.client_status(t) = 'resolved', 'resolved -> resolved');
END $$;
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'bloom_support.client_status(bloom_support.tickets)', 'execute')
  AND NOT has_function_privilege('anon', 'bloom_support.client_status(bloom_support.tickets)', 'execute'), 'client_status is not callable by API roles');
UPDATE bloom_support.tickets SET status = 'needs_owner', waiting_reason = NULL WHERE id = :'t1id';
SELECT pg_temp.assert(pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'gail', 'ticket_id', :'t1id'))->>'status' = 'in_progress', 'client sees needs_owner as in_progress');
SELECT pg_temp.assert(position('needs_owner' IN pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'gail', 'ticket_id', :'t1id'))::text) = 0, 'client ticket payload never names needs_owner');
SELECT pg_temp.assert(position('needs_owner' IN pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'gail'))::text) = 0, 'client ticket list never names needs_owner');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'gail'))) e
  WHERE e->>'status' NOT IN ('received','in_progress','waiting_on_you','resolved')), 'client list uses only the four client statuses');
SELECT pg_temp.assert(pg_temp.rpc('get_ticket', jsonb_build_object('actor', :'jon', 'ticket_id', :'t1id'))->>'status' = 'needs_owner', 'staff still see needs_owner');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('list_tickets', jsonb_build_object('actor', :'jon'))) e
  WHERE e->>'id' = :'t1id' AND e->>'status' = 'needs_owner'), 'staff list keeps the raw status');

-- MCP writes: one durable receipt encloses each database mutation. The dblink
-- helper starts two independent transactions before waiting for either result.
CREATE OR REPLACE FUNCTION public.bloom_support_test_mcp_call(
  p_actor uuid, p_fn text, p_payload jsonb, p_key text, p_tool text, p_hash text
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object('ok', true, 'result', public.bloom_support_mcp_mutation(p_actor, p_fn, p_payload, p_key, p_tool, p_hash));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.concurrent_mcp(
  p_actor uuid, p_fn text, p_payload jsonb, p_key text, p_tool text, p_hash text
) RETURNS jsonb[] LANGUAGE plpgsql AS $$
DECLARE q text; a jsonb; b jsonb;
BEGIN
  q := format($q$SELECT public.bloom_support_test_mcp_call(%L::uuid,%L,%L::jsonb,%L,%L,%L)$q$,
    p_actor, p_fn, p_payload, p_key, p_tool, p_hash);
  PERFORM dblink_connect('mcp_a', 'dbname=' || current_database());
  PERFORM dblink_connect('mcp_b', 'dbname=' || current_database());
  PERFORM dblink_send_query('mcp_a', q);
  PERFORM dblink_send_query('mcp_b', q);
  SELECT result INTO a FROM dblink_get_result('mcp_a') AS x(result jsonb);
  SELECT result INTO b FROM dblink_get_result('mcp_b') AS x(result jsonb);
  PERFORM dblink_disconnect('mcp_a');
  PERFORM dblink_disconnect('mcp_b');
  IF NOT coalesce((a->>'ok')::boolean, false) OR NOT coalesce((b->>'ok')::boolean, false) OR a->'result' IS DISTINCT FROM b->'result' THEN
    RAISE EXCEPTION 'concurrent MCP mismatch: % / %', a, b;
  END IF;
  RETURN ARRAY[a,b];
EXCEPTION WHEN OTHERS THEN
  BEGIN PERFORM dblink_disconnect('mcp_a'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM dblink_disconnect('mcp_b'); EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.concurrent_mcp_conflict(
  p_actor uuid, p_fn text, p_payload_a jsonb, p_hash_a text,
  p_payload_b jsonb, p_hash_b text, p_key text, p_tool text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE qa text; qb text; a jsonb; b jsonb; ok_count integer;
BEGIN
  qa := format($q$SELECT public.bloom_support_test_mcp_call(%L::uuid,%L,%L::jsonb,%L,%L,%L)$q$,
    p_actor, p_fn, p_payload_a, p_key, p_tool, p_hash_a);
  qb := format($q$SELECT public.bloom_support_test_mcp_call(%L::uuid,%L,%L::jsonb,%L,%L,%L)$q$,
    p_actor, p_fn, p_payload_b, p_key, p_tool, p_hash_b);
  PERFORM dblink_connect('mcp_conflict_a', 'dbname=' || current_database());
  PERFORM dblink_connect('mcp_conflict_b', 'dbname=' || current_database());
  PERFORM dblink_send_query('mcp_conflict_a', qa);
  PERFORM dblink_send_query('mcp_conflict_b', qb);
  SELECT result INTO a FROM dblink_get_result('mcp_conflict_a') AS x(result jsonb);
  SELECT result INTO b FROM dblink_get_result('mcp_conflict_b') AS x(result jsonb);
  PERFORM dblink_disconnect('mcp_conflict_a');
  PERFORM dblink_disconnect('mcp_conflict_b');
  ok_count := coalesce((a->>'ok')::boolean, false)::integer + coalesce((b->>'ok')::boolean, false)::integer;
  IF ok_count <> 1
     OR (NOT coalesce((a->>'ok')::boolean, false) AND position('different MCP mutation' IN coalesce(a->>'error','')) = 0)
     OR (NOT coalesce((b->>'ok')::boolean, false) AND position('different MCP mutation' IN coalesce(b->>'error','')) = 0) THEN
    RAISE EXCEPTION 'concurrent MCP conflict was not fail-closed: % / %', a, b;
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN PERFORM dblink_disconnect('mcp_conflict_a'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM dblink_disconnect('mcp_conflict_b'); EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END $$;

INSERT INTO bloom_support.conversations(id, channel, subject) VALUES
 ('f1000000-0000-4000-8000-000000000001','crm','MCP escalation'),
 ('f1000000-0000-4000-8000-000000000002','crm','MCP investigation sequential'),
 ('f1000000-0000-4000-8000-000000000003','crm','MCP investigation concurrent'),
 ('f1000000-0000-4000-8000-000000000004','crm','MCP feature sequential'),
 ('f1000000-0000-4000-8000-000000000005','crm','MCP feature concurrent'),
 ('f1000000-0000-4000-8000-000000000006','crm','MCP escalation concurrent');
INSERT INTO bloom_support.tickets(id, conversation_id, product, channel, subject, summary) VALUES
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','crm','crm','MCP escalation','Needs one escalation'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','crm','crm','MCP investigation sequential','Needs one issue'),
 ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','crm','crm','MCP investigation concurrent','Needs one issue'),
 ('f2000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','crm','crm','MCP feature sequential','Needs one feature'),
 ('f2000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005','crm','crm','MCP feature concurrent','Needs one feature'),
 ('f2000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000006','crm','crm','MCP escalation concurrent','Needs one escalation');

-- create_problem: sequential and concurrent lost responses create one row.
SELECT public.bloom_support_mcp_mutation(:'jon','create_problem',jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','MCP problem sequential')),
  'mcp:'||repeat('1',64),'create_problem',repeat('a',64)) AS mcp_problem_first \gset
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jon','create_problem',jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','MCP problem sequential')),
  'mcp:'||repeat('1',64),'create_problem',repeat('a',64)) = :'mcp_problem_first'::jsonb, 'create_problem sequential retry replays one result');
SELECT pg_temp.concurrent_mcp(:'jon','create_problem',jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','MCP problem concurrent')),
  'mcp:'||repeat('2',64),'create_problem',repeat('b',64));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.problems WHERE title IN ('MCP problem sequential','MCP problem concurrent')) = 2,
  'create_problem has one row per logical request');

-- escalate_ticket: no caller dedupe key is needed; receipt encloses escalation,
-- notification and job creation.
SELECT public.bloom_support_mcp_mutation(:'jon','escalate',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000001','audience','both','reason','MCP escalation sequential'),
  'mcp:'||repeat('3',64),'escalate_ticket',repeat('c',64)) AS mcp_escalate_first \gset
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jon','escalate',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000001','audience','both','reason','MCP escalation sequential'),
  'mcp:'||repeat('3',64),'escalate_ticket',repeat('c',64)) = :'mcp_escalate_first'::jsonb, 'escalate sequential retry replays one result');
SELECT pg_temp.concurrent_mcp(:'jon','escalate',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000006','audience','both','reason','MCP escalation concurrent'),
  'mcp:'||repeat('4',64),'escalate_ticket',repeat('d',64));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.escalations WHERE reason IN ('MCP escalation sequential','MCP escalation concurrent')) = 2,
  'escalate retry creates one escalation per logical request');

-- start_investigation and route_feature_request: their multi-row database work
-- is atomic under the same receipt, including concurrent first calls.
SELECT public.bloom_support_mcp_mutation(:'jon','open_engineering_issue',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000002','issue','{}'::jsonb),
  'mcp:'||repeat('5',64),'start_investigation',repeat('e',64)) AS mcp_investigate_first \gset
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jon','open_engineering_issue',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000002','issue','{}'::jsonb),
  'mcp:'||repeat('5',64),'start_investigation',repeat('e',64)) = :'mcp_investigate_first'::jsonb, 'start_investigation sequential retry replays one result');
SELECT pg_temp.concurrent_mcp(:'jon','open_engineering_issue',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000003','issue','{}'::jsonb),
  'mcp:'||repeat('6',64),'start_investigation',repeat('f',64));
SELECT pg_temp.assert((SELECT count(DISTINCT engineering_issue_id) FROM bloom_support.tickets WHERE id IN ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003')) = 2,
  'each investigation request creates exactly one issue');

SELECT public.bloom_support_mcp_mutation(:'jon','route_feature_request',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000004','feature',jsonb_build_object('title','MCP feature sequential')),
  'mcp:'||repeat('7',64),'route_feature_request',repeat('1',64)) AS mcp_feature_first \gset
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jon','route_feature_request',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000004','feature',jsonb_build_object('title','MCP feature sequential')),
  'mcp:'||repeat('7',64),'route_feature_request',repeat('1',64)) = :'mcp_feature_first'::jsonb, 'route_feature sequential retry replays one result');
SELECT pg_temp.concurrent_mcp(:'jon','route_feature_request',jsonb_build_object('actor',:'jon','ticket_id','f2000000-0000-4000-8000-000000000005','feature',jsonb_build_object('title','MCP feature concurrent')),
  'mcp:'||repeat('8',64),'route_feature_request',repeat('2',64));
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.feature_requests WHERE title IN ('MCP feature sequential','MCP feature concurrent')) = 2,
  'route_feature retry creates one feature per logical request');

-- start_repair: repeated approval cannot increment the issue version or enqueue
-- a second investigate job.
INSERT INTO bloom_support.engineering_issues(id,title,product,status,created_by) VALUES
 ('f3000000-0000-4000-8000-000000000001','MCP repair sequential','crm','open',:'jon'),
 ('f3000000-0000-4000-8000-000000000002','MCP repair concurrent','crm','open',:'jon');
SELECT public.bloom_support_mcp_mutation(:'jon','update_engineering_issue',jsonb_build_object('actor',:'jon','issue_id','f3000000-0000-4000-8000-000000000001','update',jsonb_build_object('start_repair',true)),
  'mcp:'||repeat('9',64),'start_repair',repeat('3',64)) AS mcp_repair_first \gset
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jon','update_engineering_issue',jsonb_build_object('actor',:'jon','issue_id','f3000000-0000-4000-8000-000000000001','update',jsonb_build_object('start_repair',true)),
  'mcp:'||repeat('9',64),'start_repair',repeat('3',64)) = :'mcp_repair_first'::jsonb, 'start_repair sequential retry replays one result');
SELECT pg_temp.concurrent_mcp(:'jon','update_engineering_issue',jsonb_build_object('actor',:'jon','issue_id','f3000000-0000-4000-8000-000000000002','update',jsonb_build_object('start_repair',true)),
  'mcp:'||repeat('a',64),'start_repair',repeat('4',64));
SELECT pg_temp.assert((SELECT bool_and(version = 2) FROM bloom_support.engineering_issues WHERE id IN ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002')),
  'start_repair increments each issue once');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.jobs WHERE engineering_issue_id IN ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002') AND kind='investigate') = 2,
  'start_repair enqueues one investigation per logical request');

-- Same request identity with changed arguments is a conflict, never a fork.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"changed"}}'::jsonb,'%s','create_problem','%s')$q$,
  :'jon', :'jon', 'mcp:'||repeat('1',64), repeat('5',64)), 'different MCP mutation');

-- A receipt is bound to the exact trusted database function as well as the
-- public tool. A future tool remap must never expose an older function result.
INSERT INTO bloom_support.mcp_mutation_receipts(
  request_key,principal_id,tool,function_name,arguments_hash,result,completed_at
) VALUES (
  'mcp:'||md5('function-binding')||md5('function-binding'), :'jon',
  'create_problem','legacy_create_problem',md5('function-binding-args')||md5('function-binding-args'),
  '{"leaked":"old function result"}',now()
);
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"Function binding"}}'::jsonb,'%s','create_problem','%s')$q$,
  :'jon', :'jon', 'mcp:'||md5('function-binding')||md5('function-binding'), md5('function-binding-args')||md5('function-binding-args')),
  'different MCP mutation');

-- Explicit keys and implicit session/request identities share the same
-- fail-closed receipt semantics, sequentially and under a first-call race.
SELECT public.bloom_support_mcp_mutation(:'jon','create_problem',jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Explicit mismatch winner')),
  'mcp:'||repeat('d',64),'create_problem',repeat('8',64));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"Explicit mismatch loser"}}'::jsonb,'%s','create_problem','%s')$q$,
  :'jon', :'jon', 'mcp:'||repeat('d',64), repeat('9',64)), 'different MCP mutation');
SELECT public.bloom_support_mcp_mutation(:'jon','create_problem',jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Implicit mismatch winner')),
  'mcp:'||repeat('e',64),'create_problem',repeat('a',64));
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"Implicit mismatch loser"}}'::jsonb,'%s','create_problem','%s')$q$,
  :'jon', :'jon', 'mcp:'||repeat('e',64), repeat('b',64)), 'different MCP mutation');
SELECT pg_temp.concurrent_mcp_conflict(:'jon','create_problem',
  jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Explicit concurrent A')),repeat('c',64),
  jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Explicit concurrent B')),repeat('d',64),
  'mcp:'||repeat('f',64),'create_problem');
SELECT pg_temp.concurrent_mcp_conflict(:'jon','create_problem',
  jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Implicit concurrent A')),repeat('e',64),
  jsonb_build_object('actor',:'jon','problem',jsonb_build_object('title','Implicit concurrent B')),repeat('f',64),
  'mcp:'||repeat('0',64),'create_problem');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.problems WHERE title IN ('Explicit concurrent A','Explicit concurrent B')) = 1
  AND (SELECT count(*) FROM bloom_support.problems WHERE title IN ('Implicit concurrent A','Implicit concurrent B')) = 1,
  'concurrent changed-payload reuse commits only one mutation');

-- A cached result is never an authorization bypass. Replays re-check the
-- trusted tool/function route and the caller's current role and resources.
SELECT public.bloom_support_mcp_mutation(:'sam','create_problem',jsonb_build_object('actor',:'sam','problem',jsonb_build_object('title','Authorization replay fixture')),
  'mcp:'||md5('auth-role')||md5('auth-role'),'create_problem',md5('auth-role-args')||md5('auth-role-args')) AS auth_role_first \gset
UPDATE bloom_support.principals SET role='client' WHERE id=:'sam';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"Authorization replay fixture"}}'::jsonb,'%s','create_problem','%s')$q$,
  :'sam', :'sam', 'mcp:'||md5('auth-role')||md5('auth-role'), md5('auth-role-args')||md5('auth-role-args')), 'tickets.write');
UPDATE bloom_support.principals SET role='support' WHERE id=:'sam';

SELECT public.bloom_support_mcp_mutation(:'gail','create_ticket',jsonb_build_object('actor',:'gail','ticket',jsonb_build_object(
  'product','crm','channel','crm','body','Authorization account replay fixture','account_id',:'greenleaf')),
  'mcp:'||md5('auth-account')||md5('auth-account'),'create_ticket',md5('auth-account-args')||md5('auth-account-args')) AS auth_account_first \gset
UPDATE bloom_support.account_members SET verified=false WHERE principal_id=:'gail' AND account_id=:'greenleaf';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_ticket','{"actor":"%s","ticket":{"product":"crm","channel":"crm","body":"Authorization account replay fixture","account_id":"%s"}}'::jsonb,'%s','create_ticket','%s')$q$,
  :'gail', :'gail', :'greenleaf', 'mcp:'||md5('auth-account')||md5('auth-account'), md5('auth-account-args')||md5('auth-account-args')), 'forbidden: account');
UPDATE bloom_support.account_members SET verified=true WHERE principal_id=:'gail' AND account_id=:'greenleaf';

INSERT INTO bloom_support.principals(id,kind,product,external_id,email,display_name,role)
VALUES ('f4000000-0000-4000-8000-000000000001','external_user','crm','mcp-conversation-member','member@example.test','Conversation member','client');
INSERT INTO bloom_support.account_members(account_id,principal_id,verified)
VALUES (:'greenleaf','f4000000-0000-4000-8000-000000000001',true);
SELECT conversation_id AS auth_conversation FROM bloom_support.tickets WHERE id=:'t1id' \gset
SELECT public.bloom_support_mcp_mutation('f4000000-0000-4000-8000-000000000001','create_ticket',jsonb_build_object(
  'actor','f4000000-0000-4000-8000-000000000001','ticket',jsonb_build_object('product','crm','channel','crm','body','Conversation replay fixture','conversation_id',:'auth_conversation')),
  'mcp:'||md5('auth-conversation')||md5('auth-conversation'),'create_ticket',md5('auth-conversation-args')||md5('auth-conversation-args'));
UPDATE bloom_support.account_members SET verified=false WHERE principal_id='f4000000-0000-4000-8000-000000000001';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('f4000000-0000-4000-8000-000000000001','create_ticket','{"actor":"f4000000-0000-4000-8000-000000000001","ticket":{"product":"crm","channel":"crm","body":"Conversation replay fixture","conversation_id":"%s"}}'::jsonb,'%s','create_ticket','%s')$q$,
  :'auth_conversation', 'mcp:'||md5('auth-conversation')||md5('auth-conversation'), md5('auth-conversation-args')||md5('auth-conversation-args')), 'forbidden: conversation');

INSERT INTO bloom_support.operations(id,account_id,actor_id,kind,permission,inputs,status,expires_at)
VALUES ('f5000000-0000-4000-8000-000000000001',:'greenleaf',:'sam','site.page.update','ops.site.edit','{}','previewed',now()+interval '30 minutes');
SELECT public.bloom_support_mcp_claim_operation(:'sam','f5000000-0000-4000-8000-000000000001','execute',
  'mcp:'||md5('auth-operation')||md5('auth-operation'),'execute_change',md5('auth-operation-args')||md5('auth-operation-args'));
DELETE FROM bloom_support.role_permissions WHERE role='support' AND permission='accounts.read_all';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_claim_operation('%s','f5000000-0000-4000-8000-000000000001','execute','%s','execute_change','%s')$q$,
  :'sam', 'mcp:'||md5('auth-operation')||md5('auth-operation'), md5('auth-operation-args')||md5('auth-operation-args')), 'forbidden: account');
INSERT INTO bloom_support.role_permissions(role,permission) VALUES ('support','accounts.read_all');
DELETE FROM bloom_support.role_permissions WHERE role='support' AND permission='ops.site.edit';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_claim_operation('%s','f5000000-0000-4000-8000-000000000001','execute','%s','execute_change','%s')$q$,
  :'sam', 'mcp:'||md5('auth-operation')||md5('auth-operation'), md5('auth-operation-args')||md5('auth-operation-args')), 'ops.site.edit');
INSERT INTO bloom_support.role_permissions(role,permission) VALUES ('support','ops.site.edit');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','create_problem','{"actor":"%s","problem":{"title":"Unknown route"}}'::jsonb,'%s','future_write_tool','%s')$q$,
  :'jon', :'jon', 'mcp:'||md5('unknown-route')||md5('unknown-route'), md5('unknown-route-args')||md5('unknown-route-args')), 'unknown MCP mutation route');

-- Stale product-effect claims are never resent. Both the original identity and
-- a new request receive the durable reconciliation error.
INSERT INTO bloom_support.operations(id,account_id,actor_id,kind,permission,inputs,status,confirmed_by,undo,updated_at) VALUES
 ('f6000000-0000-4000-8000-000000000001',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test',
   'expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'executing',:'jeff',NULL,now()-interval '6 minutes'),
 ('f6000000-0000-4000-8000-000000000002',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','executing',:'jeff',NULL,now()-interval '6 minutes'),
 ('f6000000-0000-4000-8000-000000000003',:'greenleaf',:'jeff','campaign.schedule','ops.campaign.send','{}','undoing',:'jeff','{"kind":"campaign.unschedule","campaign_id":"c1"}',now()-interval '6 minutes');
SELECT public.bloom_support_mcp_claim_operation(:'jeff','f6000000-0000-4000-8000-000000000001','execute',
  'mcp:'||md5('stale-site')||md5('stale-site'),'execute_change',md5('stale-site-args')||md5('stale-site-args')) AS stale_site_result \gset
SELECT pg_temp.assert(:'stale_site_result'::jsonb->'mcp_error'->>'code'='operation_reconciliation_needed'
  AND :'stale_site_result'::jsonb->'operation'->'reconciliation'->>'action'='execute',
  'stale site creation returns reconciliation instead of reclaiming the effect');
SELECT pg_temp.assert(public.bloom_support_mcp_claim_operation(:'jeff','f6000000-0000-4000-8000-000000000001','execute',
  'mcp:'||md5('stale-site')||md5('stale-site'),'execute_change',md5('stale-site-args')||md5('stale-site-args'))->'mcp_error'->>'code'='operation_reconciliation_needed',
  'same stale site request replays reconciliation');
SELECT pg_temp.assert(public.bloom_support_mcp_claim_operation(:'jeff','f6000000-0000-4000-8000-000000000001','execute',
  'mcp:'||md5('stale-site-new')||md5('stale-site-new'),'execute_change',md5('stale-site-args')||md5('stale-site-args'))->'mcp_error'->>'code'='operation_reconciliation_needed',
  'new stale site request remains blocked by reconciliation');
SELECT pg_temp.assert(public.bloom_support_mcp_claim_operation(:'jeff','f6000000-0000-4000-8000-000000000002','execute',
  'mcp:'||md5('stale-generic')||md5('stale-generic'),'execute_change',md5('stale-generic-args')||md5('stale-generic-args'))->'mcp_error'->>'code'='operation_reconciliation_needed',
  'stale generic execute becomes reconciliation_needed');
SELECT pg_temp.assert(public.bloom_support_mcp_claim_operation(:'jeff','f6000000-0000-4000-8000-000000000003','undo',
  'mcp:'||md5('stale-undo')||md5('stale-undo'),'undo_change',md5('stale-undo-args')||md5('stale-undo-args'))->'mcp_error'->>'code'='operation_reconciliation_needed',
  'stale undo becomes reconciliation_needed');

-- Person-only reconciliation has its own durable MCP receipt, validates the
-- pending action/evidence, heals prior execute/undo receipts, and preserves the
-- original execution evidence when an undo was verified not to have happened.
INSERT INTO bloom_support.operations(id,account_id,actor_id,kind,permission,inputs,status,result,verification,undo,reconciliation) VALUES
 ('f6100000-0000-4000-8000-000000000001',:'greenleaf',:'jeff','campaign.schedule','ops.campaign.send','{"campaign_id":"c1"}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000002',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000003',:'greenleaf',:'jeff','campaign.schedule','ops.campaign.send','{"campaign_id":"c1"}','reconciliation_needed','{"scheduled":true}','{"passed":true,"execution_marker":"original"}','{"kind":"campaign.unschedule","campaign_id":"c1"}','{"action":"undo","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000004',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000005',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000006',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000007',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}'),
 ('f6100000-0000-4000-8000-000000000008',:'greenleaf',:'jeff','site.page.update','ops.site.edit','{}','reconciliation_needed',NULL,NULL,NULL,'{"action":"execute","reason":"test"}');
INSERT INTO bloom_support.mcp_mutation_receipts(request_key,principal_id,tool,function_name,arguments_hash,result,completed_at)
VALUES ('mcp:'||md5('old-execute-reconciliation')||md5('old-execute-reconciliation'),:'jeff','execute_change','claim_operation',
  md5('old-execute-args')||md5('old-execute-args'),
  '{"mcp_error":{"code":"operation_reconciliation_needed"},"operation":{"id":"f6100000-0000-4000-8000-000000000001","status":"reconciliation_needed"}}',now());
SELECT public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6100000-0000-4000-8000-000000000001','outcome','applied',
  'verification',jsonb_build_object('passed',true,'checked','campaign facts'),'note','Campaign is scheduled in CRM'),
  'mcp:'||md5('reconcile-applied')||md5('reconcile-applied'),'record_reconciliation',md5('reconcile-applied-args')||md5('reconcile-applied-args')) AS reconciled_applied \gset
SELECT pg_temp.assert(:'reconciled_applied'::jsonb->>'status'='succeeded'
  AND :'reconciled_applied'::jsonb->'undo'->>'kind'='campaign.unschedule',
  'verified applied execute becomes succeeded with server-derived undo');
SELECT pg_temp.assert(public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6100000-0000-4000-8000-000000000001','outcome','applied',
  'verification',jsonb_build_object('passed',true,'checked','campaign facts'),'note','Campaign is scheduled in CRM'),
  'mcp:'||md5('reconcile-applied')||md5('reconcile-applied'),'record_reconciliation',md5('reconcile-applied-args')||md5('reconcile-applied-args'))=:'reconciled_applied'::jsonb,
  'record_reconciliation same-key retry replays one terminal result');
SELECT pg_temp.assert((SELECT NOT (result ? 'mcp_error') AND result->>'status'='succeeded'
  FROM bloom_support.mcp_mutation_receipts WHERE request_key='mcp:'||md5('old-execute-reconciliation')||md5('old-execute-reconciliation')),
  'person resolution heals the prior execute reconciliation receipt');

SELECT public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6100000-0000-4000-8000-000000000002','outcome','not_applied',
  'verification',jsonb_build_object('passed',true,'checked','page revision'),'note','The page revision did not change'),
  'mcp:'||md5('reconcile-not-applied')||md5('reconcile-not-applied'),'record_reconciliation',md5('reconcile-not-applied-args')||md5('reconcile-not-applied-args')) AS reconciled_not_applied \gset
SELECT pg_temp.assert(:'reconciled_not_applied'::jsonb->>'status'='failed' AND :'reconciled_not_applied'::jsonb->>'error' LIKE 'Person verified%',
  'verified not_applied execute becomes failed');
SELECT public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6100000-0000-4000-8000-000000000003','outcome','not_undone',
  'verification',jsonb_build_object('passed',true,'checked','campaign still scheduled'),'note','Original schedule remains'),
  'mcp:'||md5('reconcile-not-undone')||md5('reconcile-not-undone'),'record_reconciliation',md5('reconcile-not-undone-args')||md5('reconcile-not-undone-args')) AS reconciled_not_undone \gset
SELECT pg_temp.assert(:'reconciled_not_undone'::jsonb->>'status'='succeeded'
  AND :'reconciled_not_undone'::jsonb->'verification'->>'execution_marker'='original'
  AND :'reconciled_not_undone'::jsonb->'verification'->'undo_reconciliation'->>'checked'='campaign still scheduled',
  'not_undone preserves execution verification and adds undo evidence');

SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','reconcile_operation','{"actor":"%s","operation_id":"f6100000-0000-4000-8000-000000000004","outcome":"undone","verification":{"passed":true},"note":"Wrong action"}'::jsonb,'%s','record_reconciliation','%s')$q$,
  :'jeff',:'jeff','mcp:'||md5('reconcile-wrong-action')||md5('reconcile-wrong-action'),md5('reconcile-wrong-action-args')||md5('reconcile-wrong-action-args')),
  'outcome does not match');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','reconcile_operation','{"actor":"%s","operation_id":"f6100000-0000-4000-8000-000000000004","outcome":"applied","verification":{"passed":false},"note":"Bad evidence"}'::jsonb,'%s','record_reconciliation','%s')$q$,
  :'jeff',:'jeff','mcp:'||md5('reconcile-bad-evidence')||md5('reconcile-bad-evidence'),md5('reconcile-bad-evidence-args')||md5('reconcile-bad-evidence-args')),
  'passed=true');
DELETE FROM bloom_support.role_permissions WHERE role='support' AND permission='accounts.read_all';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','reconcile_operation','{"actor":"%s","operation_id":"f6100000-0000-4000-8000-000000000005","outcome":"not_applied","verification":{"passed":true},"note":"Account revoked"}'::jsonb,'%s','record_reconciliation','%s')$q$,
  :'sam',:'sam','mcp:'||md5('reconcile-account-revoked')||md5('reconcile-account-revoked'),md5('reconcile-account-revoked-args')||md5('reconcile-account-revoked-args')),
  'forbidden: account');
INSERT INTO bloom_support.role_permissions(role,permission) VALUES ('support','accounts.read_all');
SELECT pg_temp.rpc('create_service_principal',jsonb_build_object('actor',:'jon','name','MCP reconciliation service test','grants','["operations"]'::jsonb))#>>'{}' AS reconciliation_service \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_mcp_mutation('%s','reconcile_operation','{"actor":"%s","operation_id":"f6100000-0000-4000-8000-000000000006","outcome":"not_applied","verification":{"passed":true},"note":"Service must not resolve"}'::jsonb,'%s','record_reconciliation','%s')$q$,
  :'reconciliation_service',:'reconciliation_service','mcp:'||md5('reconcile-service')||md5('reconcile-service'),md5('reconcile-service-args')||md5('reconcile-service-args')),
  'signed-in person');

SELECT pg_temp.concurrent_mcp(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6100000-0000-4000-8000-000000000007','outcome','not_applied',
  'verification',jsonb_build_object('passed',true,'checked','concurrent same key'),'note','One verified outcome'),
  'mcp:'||md5('reconcile-concurrent-same')||md5('reconcile-concurrent-same'),'record_reconciliation',
  md5('reconcile-concurrent-same-args')||md5('reconcile-concurrent-same-args'));
SELECT pg_temp.assert((SELECT count(*)=1 FROM bloom_support.activity
  WHERE action='operation.reconciled' AND detail->>'operation_id'='f6100000-0000-4000-8000-000000000007'),
  'concurrent same-key reconciliation records one resolution');

DO $$
DECLARE
  payload jsonb := '{"actor":"00000000-0000-4000-8000-000000000002","operation_id":"f6100000-0000-4000-8000-000000000008","outcome":"not_applied","verification":{"passed":true,"checked":"distinct keys"},"note":"One distinct resolver wins"}'::jsonb;
  qa text; qb text; a jsonb; b jsonb; ok_count integer;
BEGIN
  qa := format($q$SELECT public.bloom_support_test_mcp_call(%L::uuid,'reconcile_operation',%L::jsonb,%L,'record_reconciliation',%L)$q$,
    '00000000-0000-4000-8000-000000000002',payload,
    'mcp:'||md5('reconcile-distinct-a')||md5('reconcile-distinct-a'),md5('reconcile-distinct-args')||md5('reconcile-distinct-args'));
  qb := format($q$SELECT public.bloom_support_test_mcp_call(%L::uuid,'reconcile_operation',%L::jsonb,%L,'record_reconciliation',%L)$q$,
    '00000000-0000-4000-8000-000000000002',payload,
    'mcp:'||md5('reconcile-distinct-b')||md5('reconcile-distinct-b'),md5('reconcile-distinct-args')||md5('reconcile-distinct-args'));
  PERFORM dblink_connect('reconcile_distinct_a','dbname='||current_database());
  PERFORM dblink_connect('reconcile_distinct_b','dbname='||current_database());
  PERFORM dblink_send_query('reconcile_distinct_a',qa);
  PERFORM dblink_send_query('reconcile_distinct_b',qb);
  SELECT result INTO a FROM dblink_get_result('reconcile_distinct_a') AS x(result jsonb);
  SELECT result INTO b FROM dblink_get_result('reconcile_distinct_b') AS x(result jsonb);
  PERFORM dblink_disconnect('reconcile_distinct_a');
  PERFORM dblink_disconnect('reconcile_distinct_b');
  ok_count := coalesce((a->>'ok')::boolean,false)::integer + coalesce((b->>'ok')::boolean,false)::integer;
  IF ok_count <> 1
     OR (NOT coalesce((a->>'ok')::boolean,false) AND position('not awaiting reconciliation' IN coalesce(a->>'error',''))=0)
     OR (NOT coalesce((b->>'ok')::boolean,false) AND position('not awaiting reconciliation' IN coalesce(b->>'error',''))=0) THEN
    RAISE EXCEPTION 'distinct reconciliation race was not serialized: % / %',a,b;
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN PERFORM dblink_disconnect('reconcile_distinct_a'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM dblink_disconnect('reconcile_distinct_b'); EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END $$;

-- Applied site creation reconciliation validates the same product facts as a
-- live response and binds one exact site to one exact client.
INSERT INTO bloom_support.operations(id,account_id,actor_id,kind,permission,inputs,status,reconciliation) VALUES
 ('f6200000-0000-4000-8000-000000000001',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'name','Recovered draft','expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001',
   'expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000002',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000003',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id','92000000-0000-4000-8000-000000000001','expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000004',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000005',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000006',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000007',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000008',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_creator_email','jeff@example.test','expected_tenant_id',NULL,'expected_anchor_site_id',NULL),'reconciliation_needed','{"action":"execute"}'),
 ('f6200000-0000-4000-8000-000000000009',:'greenleaf',:'jeff','site.create_draft','ops.site.create',jsonb_build_object(
   'expected_account_id',:'greenleaf','expected_creator_id','90000000-0000-4000-8000-000000000001','expected_tenant_id',NULL),'reconciliation_needed','{"action":"execute"}');
INSERT INTO bloom_support.account_links(account_id,product,external_id,label)
VALUES (:'rose','cms','91000000-0000-4000-8000-000000000008','Other client site');

SELECT public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6200000-0000-4000-8000-000000000001','outcome','applied','verification',jsonb_build_object(
    'passed',true,'checked','CMS site record','result',jsonb_build_object('account_id',:'greenleaf','site',jsonb_build_object(
      'id','91000000-0000-4000-8000-000000000001','tenant_id','92000000-0000-4000-8000-000000000001',
      'created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false))),
  'note','Verified the unpublished draft in BloomSites'),
  'mcp:'||md5('reconcile-site-applied')||md5('reconcile-site-applied'),'record_reconciliation',md5('reconcile-site-applied-args')||md5('reconcile-site-applied-args')) AS reconciled_site \gset
SELECT pg_temp.assert(:'reconciled_site'::jsonb->>'status'='succeeded'
  AND (SELECT count(*)=1 FROM bloom_support.account_links WHERE account_id=:'greenleaf' AND product='cms' AND external_id='91000000-0000-4000-8000-000000000001'),
  'verified site reconciliation creates exactly one client link');
SELECT public.bloom_support_mcp_mutation(:'jeff','reconcile_operation',jsonb_build_object(
  'actor',:'jeff','operation_id','f6200000-0000-4000-8000-000000000001','outcome','applied','verification',jsonb_build_object(
    'passed',true,'checked','CMS site record','result',jsonb_build_object('account_id',:'greenleaf','site',jsonb_build_object(
      'id','91000000-0000-4000-8000-000000000001','tenant_id','92000000-0000-4000-8000-000000000001',
      'created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false))),
  'note','Verified the unpublished draft in BloomSites'),
  'mcp:'||md5('reconcile-site-applied')||md5('reconcile-site-applied'),'record_reconciliation',md5('reconcile-site-applied-args')||md5('reconcile-site-applied-args'));
SELECT pg_temp.assert((SELECT count(*)=1 FROM bloom_support.account_links WHERE product='cms' AND external_id='91000000-0000-4000-8000-000000000001'),
  'site reconciliation retry never duplicates its link');

CREATE OR REPLACE FUNCTION pg_temp.expect_site_reconciliation_error(p_operation uuid,p_result jsonb,p_fragment text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM bloom_support.reconcile_operation('00000000-0000-4000-8000-000000000002',p_operation,'applied',
    jsonb_build_object('passed',true,'result',p_result),'Invalid site evidence test');
  RAISE EXCEPTION 'expected site reconciliation error containing %',p_fragment;
EXCEPTION WHEN OTHERS THEN
  IF position(p_fragment IN SQLERRM)=0 THEN RAISE EXCEPTION 'expected %, got %',p_fragment,SQLERRM; END IF;
END $$;
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000002',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000002','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000003',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000003','tenant_id','92000000-0000-4000-8000-000000000002','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000004',jsonb_build_object(
  'account_id',:'rose','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000004','tenant_id','92000000-0000-4000-8000-000000000004','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000005',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000005','tenant_id','92000000-0000-4000-8000-000000000005','created_by','90000000-0000-4000-8000-000000000099','is_published',false,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000006',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000006','tenant_id','92000000-0000-4000-8000-000000000006','created_by','90000000-0000-4000-8000-000000000001','is_published',true,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000007',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000007','tenant_id','92000000-0000-4000-8000-000000000007','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',true)),
  'does not match');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000008',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000008','tenant_id','92000000-0000-4000-8000-000000000008','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false)),
  'belongs to another client');
SELECT pg_temp.expect_site_reconciliation_error('f6200000-0000-4000-8000-000000000009',jsonb_build_object(
  'account_id',:'greenleaf','site',jsonb_build_object('id','91000000-0000-4000-8000-000000000009','tenant_id','92000000-0000-4000-8000-000000000009','created_by','90000000-0000-4000-8000-000000000001','is_published',false,'commerce_enabled',false)),
  'does not match');
SELECT pg_temp.assert((SELECT count(*)=8 FROM bloom_support.operations WHERE id::text LIKE 'f6200000-%' AND status='reconciliation_needed'),
  'invalid site evidence leaves every unresolved operation awaiting reconciliation');

-- Retention never removes active sessions or incomplete receipts.
INSERT INTO bloom_support.operations(id,account_id,actor_id,kind,permission,inputs,status,undo,updated_at)
VALUES ('f0000000-0000-4000-8000-0000000000f2',:'greenleaf',:'jon','site.publish','ops.site.publish','{}','executing',NULL,now()),
       ('f0000000-0000-4000-8000-0000000000f3',:'greenleaf',:'jon','site.publish','ops.site.publish','{}','succeeded',NULL,now()),
       ('f0000000-0000-4000-8000-0000000000f4',:'greenleaf',:'jon','site.publish','ops.site.publish','{}','reconciliation_needed',NULL,now()),
       ('f0000000-0000-4000-8000-0000000000f5',:'greenleaf',:'jon','site.publish','ops.site.publish','{}','executing',NULL,now()-interval '6 minutes'),
       ('f0000000-0000-4000-8000-0000000000f6',:'greenleaf',:'jon','campaign.schedule','ops.campaign.send','{}','undoing','{"kind":"campaign.unschedule","campaign_id":"c1"}',now()-interval '6 minutes');
INSERT INTO bloom_support.mcp_sessions(session_id,principal_id,expires_at) VALUES
 ('expired-session-1234567890',:'jon',now()-interval '1 minute'),
 ('active-session-12345678901',:'jon',now()+interval '1 day');
INSERT INTO bloom_support.mcp_mutation_receipts(request_key,principal_id,tool,function_name,arguments_hash,result,created_at,completed_at) VALUES
 ('mcp:'||repeat('b',64),:'jon','old_complete','fixture',repeat('6',64),'{}',now()-interval '40 days',now()-interval '40 days'),
 ('mcp:'||repeat('c',64),:'jon','old_incomplete','fixture',repeat('7',64),NULL,now()-interval '40 days',NULL),
 ('mcp:'||repeat('1',63)||'b',:'jon','old_inflight','fixture',repeat('7',64),'{"id":"f0000000-0000-4000-8000-0000000000f2","status":"executing"}',now()-interval '40 days',now()-interval '40 days'),
 ('mcp:'||repeat('1',63)||'e',:'jon','old_reconciliation','fixture',repeat('7',64),'{"mcp_error":{"code":"operation_reconciliation_needed"},"operation":{"id":"f0000000-0000-4000-8000-0000000000f4","status":"reconciliation_needed"}}',now()-interval '40 days',now()-interval '40 days'),
 ('mcp:'||repeat('1',63)||'d',:'jon','old_stale_snapshot','fixture',repeat('7',64),'{"id":"f0000000-0000-4000-8000-0000000000f3","status":"executing"}',now()-interval '40 days',now()-interval '40 days'),
 ('mcp:'||repeat('1',63)||'c',:'jon','inside_retry_window','fixture',repeat('7',64),'{}',now()-interval '29 days',now()-interval '29 days');
INSERT INTO bloom_support.mcp_sessions(session_id,principal_id,expires_at)
SELECT 'expired-batch-'||lpad(g::text,5,'0'), :'jon', now()-interval '41 days' FROM generate_series(1,260) g;
INSERT INTO bloom_support.mcp_mutation_receipts(request_key,principal_id,tool,function_name,arguments_hash,result,created_at,completed_at)
SELECT 'mcp:'||md5('cleanup-'||g)||md5('cleanup-'||g), :'jon', 'cleanup_batch', 'fixture', md5('hash-'||g)||md5('hash-'||g), '{}',
  now()-interval '41 days', now()-interval '41 days' FROM generate_series(1,260) g;
SELECT bloom_support.cleanup_mcp_idempotency() AS cleanup_first \gset
SELECT pg_temp.assert((:'cleanup_first'::jsonb->>'operations')::int = 2
  AND (:'cleanup_first'::jsonb->>'sessions')::int = 250
  AND (:'cleanup_first'::jsonb->>'receipts')::int = 250
  AND (SELECT count(*) FROM bloom_support.mcp_sessions WHERE session_id LIKE 'expired-batch-%') = 10
  AND (SELECT count(*) FROM bloom_support.mcp_mutation_receipts WHERE tool='cleanup_batch') = 10,
  'MCP cleanup is bounded to a modest batch per initialization');
SELECT pg_temp.assert((SELECT status='executing' FROM bloom_support.operations WHERE id='f0000000-0000-4000-8000-0000000000f2')
  AND (SELECT status='reconciliation_needed' AND reconciliation->>'action'='execute' FROM bloom_support.operations WHERE id='f0000000-0000-4000-8000-0000000000f5')
  AND (SELECT status='reconciliation_needed' AND reconciliation->>'action'='undo' FROM bloom_support.operations WHERE id='f0000000-0000-4000-8000-0000000000f6'),
  'bounded cleanup leaves active claims alone and reconciles stale execute and undo claims');
SELECT bloom_support.cleanup_mcp_idempotency() AS cleanup_second \gset
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.mcp_sessions WHERE session_id LIKE 'expired-batch-%' OR session_id='expired-session-1234567890')
  AND EXISTS (SELECT 1 FROM bloom_support.mcp_sessions WHERE session_id='active-session-12345678901'), 'MCP cleanup removes only expired sessions');
SELECT pg_temp.assert(NOT EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool IN ('old_complete','cleanup_batch'))
  AND EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool='old_incomplete')
  AND EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool='old_inflight')
  AND EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool='old_reconciliation')
  AND NOT EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool='old_stale_snapshot')
  AND EXISTS (SELECT 1 FROM bloom_support.mcp_mutation_receipts WHERE tool='inside_retry_window'),
  'MCP cleanup removes only old completed, non-active receipts outside the retry window');
SELECT pg_temp.assert((SELECT bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='bloom_support' AND c.relname IN ('mcp_sessions','mcp_mutation_receipts'))
  AND NOT has_table_privilege('authenticated','bloom_support.mcp_sessions','select')
  AND NOT has_table_privilege('anon','bloom_support.mcp_mutation_receipts','select'),
  'MCP session and receipt tables retain the schema RLS and privilege boundary');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text)','execute')
  AND NOT has_function_privilege('authenticated','public.bloom_support_mark_operation_reconciliation(uuid,uuid,text)','execute')
  AND NOT has_function_privilege('authenticated','bloom_support.reconcile_operation(uuid,uuid,text,jsonb,text)','execute')
  AND NOT has_function_privilege('anon','bloom_support.authorize_mcp_mutation(uuid,text,text,jsonb)','execute')
  AND has_function_privilege('service_role','public.bloom_support_mcp_mutation(uuid,text,jsonb,text,text,text)','execute')
  AND has_function_privilege('service_role','public.bloom_support_mark_operation_reconciliation(uuid,uuid,text)','execute'),
  'MCP mutation and reconciliation gateways are service-role only');
DROP FUNCTION public.bloom_support_test_mcp_call(uuid,text,jsonb,text,text,text);

-- 41. Review safety: retries are idempotent, terminal tickets stay closed,
-- linked ownership is visible in one engineering summary, and feature routing is guarded.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object(
  'actor', :'gail',
  'ticket', jsonb_build_object(
    'product', 'crm', 'channel', 'crm', 'subject', 'Escalation retry',
    'body', 'A decision may be retried after a later write fails.',
    'account_id', :'greenleaf'
  )
))->>'ticket_id' AS escalation_retry_ticket \gset
SELECT pg_temp.rpc('escalate', jsonb_build_object(
  'actor', :'bot', 'ticket_id', :'escalation_retry_ticket',
  'audience', 'both', 'reason', 'review retry fixture',
  'dedupe_key', 'review-retry-escalation'
))->>'escalation_id' AS escalation_retry_id \gset
SELECT pg_temp.rpc('resolve_escalation', jsonb_build_object(
  'actor', :'jeff', 'escalation_id', :'escalation_retry_id', 'decision', 'same recorded decision'
));
SELECT version AS escalation_retry_version
FROM bloom_support.tickets WHERE id = :'escalation_retry_ticket' \gset
SELECT pg_temp.rpc('resolve_escalation', jsonb_build_object(
  'actor', :'jeff', 'escalation_id', :'escalation_retry_id', 'decision', 'same recorded decision'
));
SELECT pg_temp.assert(
  (SELECT version = :'escalation_retry_version'::integer
   FROM bloom_support.tickets WHERE id = :'escalation_retry_ticket'),
  'same-decision escalation retries do not repeat ticket writes'
);
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('resolve_escalation', '{"actor":"%s","escalation_id":"%s","decision":"different decision"}'::jsonb)$q$,
  :'jeff', :'escalation_retry_id'
), 'different decision');

SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('set_automation', '{"actor":"%s","ticket_id":"%s","mode":"human"}'::jsonb)$q$,
  :'jeff', :'resolved_invariant_ticket'
), 'resolved or merged ticket');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('set_automation', '{"actor":"%s","ticket_id":"%s","mode":"human"}'::jsonb)$q$,
  :'jeff', :'dupt'
), 'resolved or merged ticket');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('route_feature_request', '{"actor":"%s","ticket_id":"%s","feature":{"title":"Must not overwrite engineering"}}'::jsonb)$q$,
  :'bot', :'late_report_ticket'
), 'linked engineering work requires review');
SELECT pg_temp.assert(
  NOT EXISTS (SELECT 1 FROM bloom_support.feature_requests WHERE title = 'Must not overwrite engineering'),
  'a rejected feature route leaves no orphan feature request'
);
SELECT pg_temp.assert(EXISTS (
  SELECT 1
  FROM jsonb_array_elements(pg_temp.rpc('list_engineering', jsonb_build_object('actor', :'jeff'))) issue
  CROSS JOIN LATERAL jsonb_array_elements(issue->'tickets') ticket
  WHERE issue->>'id' = :'eng2'
    AND ticket->>'id' = :'t1id'
    AND ticket ? 'automation'
), 'engineering summaries include ticket ownership without detail lookups');

\ir bloom-support-email-product-routing.sql

\ir ../../supabase/migrations/20261110143000_bloom_support_client_evidence_version.sql
-- Incoming evidence invalidates old snapshots, even on an already-working ticket.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket',
  jsonb_build_object('product','crm','channel','crm','subject','Evidence version contract',
    'body','Initial report','account_id', :'greenleaf'))) AS evidence_ticket \gset
SELECT (:'evidence_ticket'::jsonb->>'ticket_id') AS evidence_ticket_id \gset
UPDATE bloom_support.tickets SET status='working', stage='triage' WHERE id=:'evidence_ticket_id';
SELECT version AS evidence_before FROM bloom_support.tickets WHERE id=:'evidence_ticket_id' \gset
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'gail', 'ticket_id', :'evidence_ticket_id',
  'message', '{"body":"New reproduction detail","visibility":"public","idempotency_key":"evidence-contract-reply"}'::jsonb));
SELECT pg_temp.assert((SELECT version FROM bloom_support.tickets WHERE id=:'evidence_ticket_id') = :evidence_before + 1,
  'client reply increments working ticket evidence version');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('update_ticket', '{"actor":"%s","ticket_id":"%s","patch":{"version":%s,"next_action":"stale decision"}}'::jsonb)$q$,
  :'jeff', :'evidence_ticket_id', :'evidence_before'), 'conflict');
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'gail', 'ticket_id', :'evidence_ticket_id',
  'message', '{"body":"New reproduction detail","visibility":"public","idempotency_key":"evidence-contract-reply"}'::jsonb));
SELECT pg_temp.assert((SELECT version FROM bloom_support.tickets WHERE id=:'evidence_ticket_id') = :evidence_before + 1,
  'idempotent message retry does not invalidate evidence twice');

DO $$
DECLARE c uuid; t uuid; source uuid; v int; e uuid:=gen_random_uuid();
BEGIN
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Closure freshness fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,stage)
 VALUES(c,'crm','crm','Closure freshness fixture','Fixture','working','triage') RETURNING id INTO t;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,stage,merged_into)
 VALUES(c,'crm','crm','Merged source','Fixture','working','triage',t) RETURNING id INTO source;
 UPDATE bloom_support.tickets SET created_at='2026-11-10T11:00:00Z' WHERE id IN(t,source);
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
 VALUES(c,t,'client','public','inbound','Original','2026-11-10T12:00:00Z');
 SELECT version INTO v FROM bloom_support.tickets WHERE id=t;
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
 VALUES(c,source,'client','public','inbound','Merged correction','2026-11-10T12:02:00Z');
 IF (SELECT version FROM bloom_support.tickets WHERE id=t)<>v+1 THEN RAISE EXCEPTION 'merged source did not invalidate target'; END IF;
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
 SELECT c,t,'bloom','internal','internal','Newer note','2026-11-10T12:03:00Z'::timestamptz + n*interval '1 second' FROM generate_series(1,301)n;
 BEGIN
  UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
  resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T12:01:00Z')) WHERE id=t;
  RAISE EXCEPTION 'stale bounded/merged evidence accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE '%current client evidence requires fresh verification%' THEN RAISE; END IF;
 END;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T12:02:01Z')) WHERE id=t;
 UPDATE bloom_support.tickets SET status='working' WHERE id=t;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','person','engineering_issue_id',e) WHERE id=t;
 UPDATE bloom_support.tickets SET status='working' WHERE id=t;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','product_decision','approved') WHERE id=t;
END $$;

DO $$
DECLARE c uuid; t uuid; e uuid;
BEGIN
 INSERT INTO bloom_support.engineering_issues(title,product) VALUES('Freshness omission fixture','crm') RETURNING id INTO e;
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Freshness omission fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,kind,status,stage,engineering_issue_id)
 VALUES(c,'crm','crm','Freshness omission fixture','Fixture','bug','working','triage',e) RETURNING id INTO t;
 UPDATE bloom_support.tickets SET created_at='2026-11-10T11:00:00Z' WHERE id=t;
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
 VALUES(c,t,'client','public','inbound','Latest report','2026-11-10T12:02:00Z');
 BEGIN
  UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
  resolution_evidence=jsonb_build_object('resolved_by','bloom','verification',jsonb_build_object('started_at','2026-11-10T12:01:00Z','scope','ticket_flow','ticket_ids',jsonb_build_array(t))) WHERE id=t;
  RAISE EXCEPTION 'omitted engineering evidence bypassed persisted link';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE '%current client evidence requires fresh verification%' THEN RAISE; END IF;
 END;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','verification',jsonb_build_object('started_at','2026-11-10T12:02:01Z','scope','ticket_flow','ticket_ids',jsonb_build_array(t))) WHERE id=t;
END $$;

DO $$
DECLARE c uuid; a uuid; b uuid; target uuid; e uuid:=gen_random_uuid(); v int; actor uuid:=gen_random_uuid(); snapshot jsonb;
BEGIN
 INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role) VALUES(actor,'user',gen_random_uuid(),'crm',actor::text || '@example.test','Chain fixture','platform_admin');
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Chained merge fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,created_at)
 VALUES(c,'crm','crm','Target','Fixture','working','2026-11-10T11:00:00Z') RETURNING id INTO target;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,created_at,merged_into)
 VALUES(c,'crm','crm','Middle','Fixture','working','2026-11-10T11:00:00Z',target) RETURNING id INTO b;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,created_at,merged_into)
 VALUES(c,'crm','crm','Oldest','Fixture','working','2026-11-10T11:00:00Z',b) RETURNING id INTO a;
 SELECT version INTO v FROM bloom_support.tickets WHERE id=target;
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
 VALUES(c,a,'client','public','inbound','Nested correction','2026-11-10T12:02:00Z');
 IF (SELECT version FROM bloom_support.tickets WHERE id=target)<>v+1 THEN RAISE EXCEPTION 'transitive parent not invalidated'; END IF;
 BEGIN
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T12:01:00Z')) WHERE id=target;
 RAISE EXCEPTION 'nested correction ignored';
 EXCEPTION WHEN check_violation THEN
 IF SQLERRM NOT LIKE '%current client evidence requires fresh verification%' THEN RAISE; END IF;
 END;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T12:03:00Z')) WHERE id=target;
 snapshot:=public.bloom_support_rpc('get_ticket',jsonb_build_object('actor',actor,'ticket_id',target));
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'merged_tickets') source WHERE source->>'id'=a::text)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'messages') message WHERE message->>'body'='Nested correction')
 THEN RAISE EXCEPTION 'staff context lost transitive source correction'; END IF;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,created_at)
 VALUES(c,'crm','crm','Staff report, no client messages','Fixture','working','2026-11-10T12:00:00Z') RETURNING id INTO target;
 BEGIN
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T11:59:00Z')) WHERE id=target;
 RAISE EXCEPTION 'verification predating staff report accepted';
 EXCEPTION WHEN check_violation THEN
 IF SQLERRM NOT LIKE '%current client evidence requires fresh verification%' THEN RAISE; END IF;
 END;
 UPDATE bloom_support.tickets SET status='resolved',resolved_at=now(),resolution_verified=true,
 resolution_evidence=jsonb_build_object('resolved_by','bloom','engineering_issue_id',e,'verification',jsonb_build_object('started_at','2026-11-10T12:03:00Z')) WHERE id=target;
END $$;

-- Signed Slack repair decisions reuse staff permissions and current ticket scope.
BEGIN;
\ir ../../supabase/migrations/20261108133500_bloom_support_slack_diagnostic_staff.sql
\ir ../../supabase/migrations/20261108162000_bloom_support_slack_ticket_threads.sql
\ir ../../supabase/migrations/20261110211500_bloom_support_slack_repair_decisions.sql
\ir ../../supabase/migrations/20261110224000_bloom_support_resume_release.sql
DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid; t uuid; e uuid; j uuid; d uuid; r jsonb; n int;
BEGIN
 INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role) VALUES(a,'user',gen_random_uuid(),'crm','slack-fixture@example.test','Slack fixture','platform_admin');
 INSERT INTO bloom_support.slack_staff_principals(slack_user_id,principal_id) VALUES('U000TEST123',a);
 INSERT INTO bloom_support.settings(key,value) VALUES('slack','{"enabled":true}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
 FOR n IN 1..8 LOOP
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Slack fixture') RETURNING id INTO c;
  INSERT INTO bloom_support.engineering_issues(title,product) VALUES('Slack fixture','crm') RETURNING id INTO e;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,kind,engineering_issue_id,automation,executor) VALUES(c,'crm','crm','Slack fixture','Slack fixture','bug',e,'auto','bloom') RETURNING id INTO t;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason) VALUES(t,e,'both','engineering_start_requested');
  INSERT INTO bloom_support.jobs(kind,ticket_id,lane) VALUES('notify',t,'slack-fixture') RETURNING id INTO j;
  d:=(public.bloom_support_slack_repair_snapshot(t,j)->>'id')::uuid;
  IF d IS NULL THEN RAISE EXCEPTION 'snapshot missing'; END IF;
  INSERT INTO bloom_support.slack_ticket_threads(ticket_id,root_ts) VALUES(t,'1794340000.'||lpad(n::text,6,'0'));
  PERFORM public.bloom_support_bind_slack_repair(d,'1794340000.'||lpad(n::text,6,'0'),'1794340000.'||lpad(n::text,6,'0'));
  r:=public.bloom_support_apply_slack_repair(d,'UUNKNOWN123','C0CFNEQBS2X','1794340000.'||lpad(n::text,6,'0'),'do');
  IF r->>'reason'<>'unauthorized' THEN RAISE EXCEPTION 'unknown actor accepted'; END IF;
  r:=public.bloom_support_apply_slack_repair(d,'U000TEST123','C0CFNEQBS2X','1794340000.999999','do');
  IF r->>'reason'<>'unauthorized' THEN RAISE EXCEPTION 'wrong message accepted'; END IF;
  IF n=3 THEN UPDATE bloom_support.tickets SET version=version+1 WHERE id=t; END IF;
  IF n=4 THEN UPDATE bloom_support.slack_repair_decisions SET expires_at=now()-interval '1 minute' WHERE id=d; END IF;
  IF n=5 THEN UPDATE bloom_support.principals SET active=false WHERE id=a; END IF;
  IF n=6 THEN
   UPDATE bloom_support.principals SET active=true WHERE id=a;
   INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Older resolved issue') RETURNING id INTO c;
   INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,resolution_summary,resolution_verified,resolved_at,engineering_issue_id) VALUES(c,'crm','crm','Older resolved issue','Older resolved issue','resolved','Fixture resolved',true,now(),e);
  END IF;
  IF n IN (7,8) THEN
   INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body) VALUES(c,t,CASE n WHEN 7 THEN 'client' ELSE 'staff' END,CASE n WHEN 7 THEN 'public' ELSE 'internal' END,CASE n WHEN 7 THEN 'inbound' ELSE 'internal' END,'Please use a different approach');
  END IF;
  r:=public.bloom_support_apply_slack_repair(d,'U000TEST123','C0CFNEQBS2X','1794340000.'||lpad(n::text,6,'0'),CASE WHEN n=2 THEN 'reject' ELSE 'do' END);
  IF n=1 THEN
   IF r->>'applied'<>'true' THEN RAISE EXCEPTION 'dispatch failed: %',r; END IF;
   r:=public.bloom_support_apply_slack_repair(d,'U000TEST123','C0CFNEQBS2X','1794340000.'||lpad(n::text,6,'0'),'do');
   IF r->>'reason'<>'already_recorded' OR (SELECT count(*) FROM bloom_support.jobs WHERE engineering_issue_id=e AND kind='investigate')<>1 THEN RAISE EXCEPTION 'duplicate dispatch'; END IF;
  ELSIF n=2 THEN
   IF r->>'applied'<>'true' OR (SELECT status FROM bloom_support.tickets WHERE id=t)<>'needs_owner' OR EXISTS(SELECT 1 FROM bloom_support.jobs WHERE engineering_issue_id=e AND kind='investigate') OR EXISTS(SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id=e AND reason='engineering_start_requested' AND status<>'resolved') THEN RAISE EXCEPTION 'reject semantics failed'; END IF;
  ELSIF r->>'reason'<>(CASE n WHEN 3 THEN 'stale' WHEN 4 THEN 'expired' WHEN 6 THEN 'stale' WHEN 7 THEN 'stale' WHEN 8 THEN 'stale' ELSE 'unauthorized' END) THEN RAISE EXCEPTION 'guard failed: %',r;
  END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.bloom_support_apply_slack_repair(uuid,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'public execution allowed'; END IF;
END $$;

DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid; t uuid; e uuid; v integer; r jsonb; original uuid;
BEGIN
 INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role) VALUES(a,'user',gen_random_uuid(),'crm','resume-fixture@example.test','Resume fixture','platform_admin');
 INSERT INTO bloom_support.engineering_issues(title,product,status,repository,merge_sha) VALUES('Resume fixture','crm','merged','JonDMorrison/brandsinblooms',repeat('a',40)) RETURNING id,version INTO e,v;
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Resume fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,kind,status,stage,engineering_issue_id,automation,executor)
 VALUES(c,'crm','crm','Resume fixture','Fixture','bug','working','releasing',e,'paused','person') RETURNING id INTO t;
 -- Deployment tracking now binds GitHub's recorded PR as well as its merge.
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v); RAISE EXCEPTION 'missing PR reported resumed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM bloom_support.jobs WHERE engineering_issue_id=e) THEN RAISE EXCEPTION 'missing PR queued'; END IF;
 UPDATE bloom_support.engineering_issues SET pr_number=424242 WHERE id=e;
 r:=public.bloom_support_resume_release(a,e,v); original:=(r->>'job_id')::uuid;
 IF r->>'queued'<>'true' OR (SELECT payload->>'step' FROM bloom_support.jobs WHERE id=original)<>'deploy' THEN RAISE EXCEPTION 'not queued: %',r; END IF;
 r:=public.bloom_support_resume_release(a,e,v);
 IF r->>'reason'<>'already_tracking' OR (SELECT count(*) FROM bloom_support.jobs WHERE engineering_issue_id=e)<>1 THEN RAISE EXCEPTION 'duplicate observer'; END IF;
 IF (SELECT executor||':'||automation FROM bloom_support.tickets WHERE id=t)<>'person:paused' OR (SELECT version FROM bloom_support.engineering_issues WHERE id=e)<>v THEN RAISE EXCEPTION 'ownership/state changed'; END IF;
 UPDATE bloom_support.jobs SET status='running' WHERE id=original;
 r:=public.bloom_support_resume_release(a,e,v);
 IF r->>'reason'<>'already_tracking' THEN RAISE EXCEPTION 'running lease ignored'; END IF;
 UPDATE bloom_support.jobs SET status='succeeded' WHERE id=original;
 r:=public.bloom_support_resume_release(a,e,v);
 IF r->>'status'<>'succeeded' OR (SELECT count(*) FROM bloom_support.jobs WHERE engineering_issue_id=e)<>1 THEN RAISE EXCEPTION 'completed replay duplicated'; END IF;
 UPDATE bloom_support.jobs SET status='dead',attempts=3 WHERE id=original;
 r:=public.bloom_support_resume_release(a,e,v);
 IF r->>'status'<>'dead' OR (SELECT attempts FROM bloom_support.jobs WHERE id=original)<>3 THEN RAISE EXCEPTION 'exhausted retry reset'; END IF;
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v+1); RAISE EXCEPTION 'stale version accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE bloom_support.engineering_issues SET status='verifying',version=version+1 WHERE id=e RETURNING version INTO v;
 r:=public.bloom_support_resume_release(a,e,v);
 IF (SELECT payload->>'step' FROM bloom_support.jobs WHERE id=(r->>'job_id')::uuid)<>'verify' THEN RAISE EXCEPTION 'wrong continuation'; END IF;
 UPDATE bloom_support.engineering_issues SET status='in_review',version=version+1 WHERE id=e RETURNING version INTO v;
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v); RAISE EXCEPTION 'unmerged accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 UPDATE bloom_support.principals SET role='client' WHERE id=a;
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v); RAISE EXCEPTION 'client accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE bloom_support.principals SET role='service',kind='service',auth_user_id=NULL,grants=ARRAY['automation.control','engineering.approve'] WHERE id=a;
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v); RAISE EXCEPTION 'service accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE bloom_support.principals SET role='platform_admin',kind='user',auth_user_id=gen_random_uuid(),active=false WHERE id=a;
 BEGIN PERFORM public.bloom_support_resume_release(a,e,v); RAISE EXCEPTION 'disabled principal accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('authenticated','public.bloom_support_resume_release(uuid,uuid,integer)','EXECUTE') OR has_function_privilege('anon','public.bloom_support_resume_release(uuid,uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'public execution allowed'; END IF;
END $$;


ROLLBACK;

-- Release evaluation reads minimal authoritative ticket facts through the
-- already-authorized engineering summary, never through full ticket access.
BEGIN;
CREATE TEMP TABLE release_summary_function_boundary AS
SELECT proowner, proacl, prosecdef, proconfig
FROM pg_proc
WHERE oid = 'bloom_support.list_engineering(uuid,text)'::regprocedure;
\ir ../../supabase/migrations/20261112153000_bloom_support_release_ticket_facts.sql
SELECT pg_temp.assert((
  SELECT current.proowner = previous.proowner
    AND current.proacl IS NOT DISTINCT FROM previous.proacl
    AND current.prosecdef = previous.prosecdef
    AND current.proconfig IS NOT DISTINCT FROM previous.proconfig
  FROM pg_proc current CROSS JOIN release_summary_function_boundary previous
  WHERE current.oid = 'bloom_support.list_engineering(uuid,text)'::regprocedure
), 'release summary migration preserves function ownership, grants and security configuration');
SELECT pg_temp.assert(
  bloom_support.has_permission(:'release', 'engineering.view')
    AND NOT bloom_support.has_permission(:'release', 'tickets.read_all')
    AND NOT bloom_support.has_permission(:'release', 'tickets.read_own'),
  'release retains engineering visibility without full ticket-read permission');

INSERT INTO bloom_support.engineering_issues(title, product, status)
VALUES ('Release summary classification fixture', 'crm', 'open')
RETURNING id AS release_summary_issue \gset
INSERT INTO bloom_support.conversations(channel, subject)
VALUES ('crm', 'Release summary classification fixture')
RETURNING id AS release_summary_conversation \gset
INSERT INTO bloom_support.tickets(
  conversation_id, engineering_issue_id, account_id, product, kind, channel,
  subject, summary, context
) VALUES (
  :'release_summary_conversation', :'release_summary_issue', :'greenleaf',
  'crm', 'bug', 'crm', 'Linked CRM bug', 'Private summary must not be projected',
  '{"private_fixture":"must not be projected"}'::jsonb
) RETURNING id AS release_summary_bug \gset
INSERT INTO bloom_support.tickets(
  conversation_id, engineering_issue_id, account_id, product, kind, channel,
  subject, summary
) VALUES (
  :'release_summary_conversation', :'release_summary_issue', :'rose',
  'cms', 'feature', 'cms', 'Linked CMS feature', 'Another private summary'
) RETURNING id AS release_summary_feature \gset
INSERT INTO bloom_support.tickets(
  conversation_id, account_id, product, kind, channel, subject, summary
) VALUES (
  :'release_summary_conversation', :'greenleaf', 'crm', 'bug', 'crm',
  'Unlinked report in the same conversation', 'Must not enter engineering scope'
) RETURNING id AS release_summary_unlinked \gset
SELECT item AS release_summary
FROM jsonb_array_elements(pg_temp.rpc('list_engineering', jsonb_build_object(
  'actor', :'release', 'status', 'open'
))) item
WHERE item->>'id' = :'release_summary_issue' \gset
SELECT pg_temp.assert(
  jsonb_array_length(:'release_summary'::jsonb->'tickets') = 2
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(:'release_summary'::jsonb->'tickets') ticket
      WHERE ticket->>'id' = :'release_summary_bug'
        AND ticket->>'kind' = 'bug' AND ticket->>'product' = 'crm'
    )
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(:'release_summary'::jsonb->'tickets') ticket
      WHERE ticket->>'id' = :'release_summary_feature'
        AND ticket->>'kind' = 'feature' AND ticket->>'product' = 'cms'
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(:'release_summary'::jsonb->'tickets') ticket
      WHERE ticket->>'id' = :'release_summary_unlinked'
    ),
  'release summary includes exact persisted linked kinds/products and excludes unrelated tickets');
SELECT pg_temp.assert((
  SELECT bool_and(
    (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(ticket) key)
      = ARRAY['account_id','automation','feature_product_approved','feature_request_id','feature_status','id','kind','number','product','status','subject']::text[]
  )
  FROM jsonb_array_elements(:'release_summary'::jsonb->'tickets') ticket
), 'release summary exposes only classification and bound feature decision eligibility, not messages or context');
SELECT pg_temp.assert(NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(pg_temp.rpc('list_engineering', jsonb_build_object(
    'actor', :'release', 'status', 'approved'
  ))) item WHERE item->>'id' = :'release_summary_issue'
), 'release summary retains the existing status filter');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('get_ticket', '{"actor":"%s","ticket_id":"%s"}'::jsonb)$q$,
  :'release', :'release_summary_bug'
), 'forbidden: ticket');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('list_engineering', '{"actor":"%s"}'::jsonb)$q$,
  :'gail'
), 'engineering.view');
SELECT pg_temp.expect_error(format(
  $q$SELECT public.bloom_support_rpc('list_engineering', '{"actor":"%s"}'::jsonb)$q$,
  :'intake'
), 'engineering.view');
-- Product approval binds the exact feature linked to this engineering ticket.
CREATE FUNCTION pg_temp.feature_release_approved(actor uuid, issue uuid, ticket uuid)
RETURNS boolean LANGUAGE sql AS $$
  SELECT (linked->>'feature_product_approved')::boolean
  FROM jsonb_array_elements(bloom_support.list_engineering(actor, 'open')) engineering,
       jsonb_array_elements(engineering->'tickets') linked
  WHERE engineering->>'id' = issue::text AND linked->>'id' = ticket::text
$$;
INSERT INTO bloom_support.feature_requests(title, description, product)
VALUES ('Exact release feature fixture', 'Only this feature may be approved', 'crm')
RETURNING id AS release_product_feature \gset
UPDATE bloom_support.tickets SET product = 'crm', feature_request_id = :'release_product_feature'
WHERE id = :'release_summary_feature';
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'undecided feature cannot borrow engineering approval');
SELECT pg_temp.rpc('decide_feature_request', jsonb_build_object(
  'actor', :'jon', 'feature_request_id', :'release_product_feature', 'decision', 'accepted',
  'note', 'Approve this exact fixture feature after reviewing the recommendation'
));
SELECT pg_temp.assert(pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'authorized human product acceptance is visible without full ticket reads');
UPDATE bloom_support.feature_requests SET status = 'planned' WHERE id = :'release_product_feature';
SELECT pg_temp.assert(pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'human product planning is a positive product decision, not technical release approval');
UPDATE bloom_support.feature_requests SET status = 'declined' WHERE id = :'release_product_feature';
INSERT INTO bloom_support.feature_requests(title, description, product, status, decided_by, decided_at)
VALUES ('Unrelated approved feature', 'Must not authorize the linked feature', 'crm', 'accepted', :'jon', now());
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'declined exact feature cannot borrow approval from another feature');
UPDATE bloom_support.feature_requests SET status = 'accepted', decided_by = :'release' WHERE id = :'release_product_feature';
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'service identity is never human product approval');
UPDATE bloom_support.feature_requests SET decided_by = :'jon', decided_at = NULL WHERE id = :'release_product_feature';
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'missing decision timestamp fails closed');
UPDATE bloom_support.feature_requests SET decided_at = now(), product = 'cms' WHERE id = :'release_product_feature';
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'different product feature cannot authorize this release');
UPDATE bloom_support.tickets SET feature_request_id = NULL WHERE id = :'release_summary_feature';
SELECT pg_temp.assert(NOT pg_temp.feature_release_approved(:'release', :'release_summary_issue', :'release_summary_feature'),
  'missing exact feature link fails closed');
ROLLBACK;

BEGIN;
\ir ../../supabase/migrations/20261112120000_bloom_support_github_engineering_events.sql
DO $$
DECLARE e uuid := gen_random_uuid(); c uuid; t uuid; n integer; j uuid; repo text := 'JonDMorrison/brandsinblooms'; sha text := repeat('a',40); d text := gen_random_uuid()::text;
BEGIN
 INSERT INTO bloom_support.engineering_issues(id,title,product,repository,status,pr_number,head_sha,attempts)
 VALUES(e,'Webhook fixture','crm',repo,'in_review',424242,sha,2);
 INSERT INTO bloom_support.conversations(channel,subject) VALUES('crm','Webhook fixture') RETURNING id INTO c;
 INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,engineering_issue_id)
 VALUES(c,'crm','crm','Webhook fixture','Fixture',e) RETURNING id INTO t;
 IF public.bloom_support_enqueue_github_engineering(d,repo,424243,sha,false)<>0 OR
 public.bloom_support_enqueue_github_engineering(d,repo,424242,repeat('b',40),false)<>0 OR
 public.bloom_support_enqueue_github_engineering(d,'Brands-In-Blooms/bloomtill',424242,sha,false)<>0 THEN RAISE EXCEPTION 'mismatched event accepted'; END IF;
 UPDATE bloom_support.tickets SET automation='human',executor='person' WHERE id=t;
 IF public.bloom_support_enqueue_github_engineering(d,repo,424242,sha,false)<>0 THEN RAISE EXCEPTION 'human hold bypassed'; END IF;
 UPDATE bloom_support.tickets SET automation='auto',executor='bloom' WHERE id=t;
 IF public.bloom_support_enqueue_github_engineering(d,repo,424242,sha,false)<>1 THEN RAISE EXCEPTION 'matching event did not queue'; END IF;
 IF public.bloom_support_enqueue_github_engineering(d,repo,424242,sha,false)<>0 THEN RAISE EXCEPTION 'duplicate accepted'; END IF;
 IF public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,424242,sha,false)<>0 THEN RAISE EXCEPTION 'event burst not coalesced'; END IF;
 SELECT id INTO j FROM bloom_support.jobs WHERE engineering_issue_id=e AND kind='engineering_step';
 UPDATE bloom_support.github_engineering_receipts SET created_at=now()-interval '2 minutes' WHERE engineering_issue_id=e;
 UPDATE bloom_support.jobs SET run_after=now()+interval '10 minutes' WHERE id=j;
 PERFORM public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,424242,sha,false);
 IF (SELECT run_after>now() FROM bloom_support.jobs WHERE id=j) THEN RAISE EXCEPTION 'queued work not accelerated'; END IF;
 UPDATE bloom_support.github_engineering_receipts SET created_at=now()-interval '2 minutes' WHERE engineering_issue_id=e;
 UPDATE bloom_support.jobs SET status='running',attempts=1 WHERE id=j;
 PERFORM public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,424242,sha,false);
 IF (SELECT count(*) FROM bloom_support.jobs WHERE engineering_issue_id=e AND kind='engineering_step')<>1 THEN RAISE EXCEPTION 'running chain duplicated'; END IF;
 UPDATE bloom_support.github_engineering_receipts SET created_at=now()-interval '2 minutes' WHERE engineering_issue_id=e;
 UPDATE bloom_support.jobs SET status='queued',run_after=now()+interval '10 minutes' WHERE id=j;
 PERFORM public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,424242,sha,false);
 IF (SELECT run_after<=now() FROM bloom_support.jobs WHERE id=j) THEN RAISE EXCEPTION 'retry backoff reset'; END IF;
 UPDATE bloom_support.jobs SET status='dead' WHERE id=j;
 UPDATE bloom_support.github_engineering_receipts SET created_at=now()-interval '2 minutes' WHERE engineering_issue_id=e;
 IF public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,424242,sha,false)<>0 THEN RAISE EXCEPTION 'exhausted retry budget reset'; END IF;
 UPDATE bloom_support.jobs SET status='succeeded' WHERE id=j;
 UPDATE bloom_support.engineering_issues SET status='deploying',merge_sha=repeat('c',40),deployment='{"polls":7}' WHERE id=e;
 UPDATE bloom_support.github_engineering_receipts SET created_at=now()-interval '2 minutes' WHERE engineering_issue_id=e;
 IF public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,NULL,sha,true)<>0 THEN RAISE EXCEPTION 'unrelated deployment accepted'; END IF;
 IF public.bloom_support_enqueue_github_engineering(gen_random_uuid()::text,repo,NULL,repeat('c',40),true)<>1 THEN RAISE EXCEPTION 'matching deployment did not queue'; END IF;
 IF (SELECT attempts<>2 OR deployment->>'polls'<>'7' OR status<>'deploying' FROM bloom_support.engineering_issues WHERE id=e) THEN RAISE EXCEPTION 'event changed state or budgets'; END IF;
 IF has_function_privilege('authenticated','public.bloom_support_enqueue_github_engineering(text,text,integer,text,boolean)','EXECUTE') OR has_function_privilege('anon','public.bloom_support_enqueue_github_engineering(text,text,integer,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'public enqueue privilege'; END IF;
END $$;


ROLLBACK;

\ir bloom-support-ticket-link-reconciliation.sql
\ir bloom-support-ticket-flow.sql

\ir bloom-support-slack-conversations.sql

\echo 'bloom-support-db: all assertions passed'
