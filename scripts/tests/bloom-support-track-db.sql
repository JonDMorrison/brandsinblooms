\set ON_ERROR_STOP on
-- Disposable-database contract test for the public tracking page (/support/track/:token).
-- Run: createdb bloom_support_track_test && psql -d bloom_support_track_test -f scripts/tests/bloom-support-track-db.sql
SELECT current_database()='bloom_support_track_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_support_track_test'
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
\ir ../../supabase/migrations/20261104200000_bloom_support_resolution_cleanup.sql
\ir ../../supabase/migrations/20261104210000_bloom_support_release_reconciliation.sql

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

\ir ../../supabase/migrations/20261105210000_bloom_support_tracking_page.sql

CREATE OR REPLACE FUNCTION pg_temp.track(p_op text, p_token text, p jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.bloom_support_track(p_op, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), p) $$;
CREATE OR REPLACE FUNCTION pg_temp.issue(p_ticket uuid, p_token text) RETURNS void LANGUAGE sql AS $$
  SELECT public.bloom_support_rpc('issue_tracking_token', jsonb_build_object('ticket_id', p_ticket, 'hash', encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))) $$;

-- Privilege boundary: only the Edge Function (service role) reaches the page's entry point.
SELECT pg_temp.assert(NOT has_function_privilege('anon', 'public.bloom_support_track(text,text,jsonb)', 'execute'), 'anon cannot call track entry point');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated', 'public.bloom_support_track(text,text,jsonb)', 'execute'), 'authenticated cannot call track entry point');
SELECT pg_temp.assert(has_function_privilege('service_role', 'public.bloom_support_track(text,text,jsonb)', 'execute'), 'service role can call track entry point');
SELECT pg_temp.assert(NOT has_function_privilege('anon', 'bloom_support.track_payload(uuid,timestamptz)', 'execute'), 'anon cannot call track payload');

-- People: staff, Bloom automation, and two clients on different accounts.
INSERT INTO bloom_support.principals(id, kind, auth_user_id, product, email, display_name, role) VALUES
 ('00000000-0000-4000-8000-000000000001','user','10000000-0000-4000-8000-000000000001','crm','jon@example.test','Jon','platform_admin'),
 ('00000000-0000-4000-8000-000000000003','user','10000000-0000-4000-8000-000000000003','crm','sam@example.test','Sam Support','support');
\set jon '00000000-0000-4000-8000-000000000001'
\set sam '00000000-0000-4000-8000-000000000003'
SELECT pg_temp.rpc('create_service_principal', jsonb_build_object('actor', :'jon', 'name', 'Bloom automation', 'grants', '["automation"]'::jsonb))#>>'{}' AS bot \gset
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000a1','email','owner@greenleaf.test','name','Gail Green','tenant_id','30000000-0000-4000-8000-0000000000a1','tenant_name','Greenleaf'))#>>'{}' AS gail \gset
SELECT account_id AS greenleaf FROM bloom_support.account_members WHERE principal_id = :'gail' \gset
SELECT pg_temp.rpc('resolve_crm_user', jsonb_build_object('auth_user_id','20000000-0000-4000-8000-0000000000b2','email','rosa@rosehill.test','name','Rosa','tenant_id','30000000-0000-4000-8000-0000000000b2','tenant_name','Rose Hill'))#>>'{}' AS rosa \gset
SELECT account_id AS rose FROM bloom_support.account_members WHERE principal_id = :'rosa' \gset

SELECT (pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'gail', 'ticket', jsonb_build_object('product','crm','channel','crm','subject','Campaign stuck','body','My campaign is stuck in sending','account_id', :'greenleaf'))))->>'ticket_id' AS t1 \gset
SELECT (pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'rosa', 'ticket', jsonb_build_object('product','pos','channel','pos','subject','Rose Hill till','body','Rose Hill private till problem','account_id', :'rose'))))->>'ticket_id' AS t9 \gset

-- Bloom acknowledges twice, a person replies, staff leave an internal note, and a Bloom draft is withdrawn.
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t1', 'message', '{"body":"Thanks, we have your request.","purpose":"acknowledgement"}'::jsonb));
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t1', 'message', '{"body":"Bloom is looking at it now.","purpose":"progress"}'::jsonb));
SELECT (pg_temp.rpc('add_message', jsonb_build_object('actor', :'bot', 'ticket_id', :'t1', 'message', '{"body":"withdrawn draft answer"}'::jsonb)))->>'message_id' AS draft \gset
UPDATE bloom_support.messages SET withdrawn_at = now() WHERE id = :'draft';
-- The two automatic notes were emailed (a later human reply only withdraws unsent Bloom drafts).
UPDATE bloom_support.messages SET delivery = 'sent' WHERE ticket_id = :'t1' AND author_kind = 'bloom' AND withdrawn_at IS NULL;
SELECT pg_temp.rpc('add_message', jsonb_build_object('actor', :'sam', 'ticket_id', :'t1', 'message', '{"body":"Internal: SMTP relay creds rotated, Jeff to check","visibility":"internal"}'::jsonb));
SELECT (pg_temp.rpc('add_message', jsonb_build_object('actor', :'sam', 'ticket_id', :'t1', 'message', '{"body":"Hi Gail, we have restarted the send."}'::jsonb)))->>'message_id' AS staffmsg \gset
-- Files: one public on the staff reply, one internal, one public on the other customer's ticket.
INSERT INTO bloom_support.attachments(id, ticket_id, message_id, storage_path, file_name, content_type, size_bytes, visibility) VALUES
 ('a0000000-0000-4000-8000-000000000001', :'t1', :'staffmsg', 't1/pub.png', 'send-log.png', 'image/png', 10, 'public'),
 ('a0000000-0000-4000-8000-000000000002', :'t1', NULL, 't1/int.png', 'internal-trace.png', 'image/png', 10, 'internal'),
 ('a0000000-0000-4000-8000-000000000009', :'t9', NULL, 't9/rose.png', 'rose-receipt.png', 'image/png', 10, 'public');
-- The routing state is internal ("Needs Jon/Jeff").
UPDATE bloom_support.tickets SET status = 'needs_owner', stage = 'awaiting_decision' WHERE id = :'t1';

SELECT pg_temp.issue(:'t1', 'token-for-ticket-one-aaaaaaaa');
SELECT pg_temp.track('view', 'token-for-ticket-one-aaaaaaaa') AS v \gset

-- Only the client projection leaves the database.
SELECT pg_temp.assert(:'v'::jsonb->>'state' = 'ok', 'valid link shows the request');
SELECT pg_temp.assert(:'v'::jsonb->>'status' = 'in_progress', 'needs_owner is shown as in progress');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%needs_owner%'), 'internal status never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%awaiting_decision%'), 'internal stage never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%SMTP relay%'), 'internal note never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%withdrawn draft answer%'), 'withdrawn message never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%Sam%'), 'staff names never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%internal-trace.png%'), 'internal file never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb::text LIKE '%Rose Hill%') AND NOT (:'v'::jsonb::text LIKE '%rose-receipt%'), 'other customers never returned');
SELECT pg_temp.assert(NOT (:'v'::jsonb ? 'id') AND NOT (:'v'::jsonb::text LIKE '%' || :'gail' || '%'), 'no ticket or person ids returned');
SELECT pg_temp.assert(jsonb_array_length(:'v'::jsonb->'messages') = 4, 'request, two automatic notes and the staff reply');
SELECT pg_temp.assert((:'v'::jsonb#>>'{messages,0,author}') = 'customer' AND (:'v'::jsonb#>>'{messages,0,name}') = 'Gail', 'request attributed to the customer by first name');
SELECT pg_temp.assert((:'v'::jsonb#>>'{messages,1,automatic}')::boolean AND (:'v'::jsonb#>>'{messages,1,purpose}') = 'acknowledgement', 'acknowledgement marked automatic');
SELECT pg_temp.assert((:'v'::jsonb#>>'{messages,3,author}') = 'team' AND (:'v'::jsonb#>>'{messages,3,name}') = 'Bloom Support' AND NOT (:'v'::jsonb#>>'{messages,3,automatic}')::boolean, 'person reply shown as Bloom Support');
SELECT pg_temp.assert((:'v'::jsonb#>>'{messages,3,attachments,0,file_name}') = 'send-log.png', 'public file listed on its message');
SELECT pg_temp.assert((:'v'::jsonb->'company') = '{"name":"Greenleaf"}'::jsonb AND (:'v'::jsonb->>'requester_name') = 'Gail', 'client company name from its own account and first name');
SELECT pg_temp.assert((:'v'::jsonb#>>'{_account,id}') = :'greenleaf', 'the Edge Function is told the ticket''s own account for branding');
SELECT pg_temp.assert((:'v'::jsonb->>'can_reply')::boolean, 'client requester can reply');
-- The gateway route returns the same projection.
SELECT pg_temp.assert(NOT (pg_temp.rpc('ticket_by_tracking_token', jsonb_build_object('hash', encode(sha256(convert_to('token-for-ticket-one-aaaaaaaa','UTF8')),'hex')))::text LIKE '%SMTP relay%'), 'gateway route excludes internal note');
SELECT pg_temp.assert(pg_temp.rpc('ticket_by_tracking_token', jsonb_build_object('hash', encode(sha256(convert_to('token-for-ticket-one-aaaaaaaa','UTF8')),'hex')))->>'status' = 'in_progress', 'gateway route maps status');

-- Unknown, malformed, revoked and expired links.
SELECT pg_temp.assert(pg_temp.track('view', 'no-such-token-zzzzzzzzzzzzz') IS NULL, 'unknown link shows nothing');
SELECT pg_temp.expect_error($q$SELECT public.bloom_support_track('view', 'nope', '{}')$q$, 'not_found');
SELECT pg_temp.issue(:'t1', 'revoked-token-bbbbbbbbbbbbbbbb');
UPDATE bloom_support.tracking_tokens SET revoked_at = now() WHERE token_hash = encode(sha256(convert_to('revoked-token-bbbbbbbbbbbbbbbb','UTF8')),'hex');
SELECT pg_temp.assert(pg_temp.track('view', 'revoked-token-bbbbbbbbbbbbbbbb') IS NULL, 'revoked link shows nothing');
SELECT pg_temp.assert(pg_temp.track('renew', 'revoked-token-bbbbbbbbbbbbbbbb') IS NULL, 'revoked link cannot be renewed');
SELECT pg_temp.issue(:'t1', 'expired-token-cccccccccccccccc');
UPDATE bloom_support.tracking_tokens SET expires_at = now() - interval '1 day' WHERE token_hash = encode(sha256(convert_to('expired-token-cccccccccccccccc','UTF8')),'hex');
SELECT pg_temp.assert(pg_temp.track('view', 'expired-token-cccccccccccccccc') = '{"state":"expired"}'::jsonb, 'expired link says only that it expired');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'expired-token-cccccccccccccccc', '{"body":"hello there","idempotency_key":"key-expired-1"}')$q$, 'not_found');
SELECT pg_temp.assert(pg_temp.track('renew', 'token-for-ticket-one-aaaaaaaa') IS NULL, 'a live link is not renewed');
SELECT pg_temp.assert(pg_temp.track('renew', 'expired-token-cccccccccccccccc', '{"ip":"ip-1"}')->>'email' = 'owner@greenleaf.test', 'renewal goes to the requester address');
SELECT pg_temp.assert(pg_temp.track('renew', 'expired-token-cccccccccccccccc', '{"ip":"ip-1"}') ? 'ticket_id', 'second renewal allowed');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('renew', 'expired-token-cccccccccccccccc', '{"ip":"ip-1"}')$q$, 'rate_limited');

-- Files: public ones on this ticket only.
SELECT pg_temp.assert(pg_temp.track('attachment', 'token-for-ticket-one-aaaaaaaa', '{"attachment_id":"a0000000-0000-4000-8000-000000000001"}')->>'path' = 't1/pub.png', 'public file can be fetched');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('attachment', 'token-for-ticket-one-aaaaaaaa', '{"attachment_id":"a0000000-0000-4000-8000-000000000002"}')$q$, 'not_found');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('attachment', 'token-for-ticket-one-aaaaaaaa', '{"attachment_id":"a0000000-0000-4000-8000-000000000009"}')$q$, 'not_found');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('attachment', 'token-for-ticket-one-aaaaaaaa', '{"attachment_id":"not-a-uuid"}')$q$, 'not_found');

-- Replies run as the requester through add_message.
SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', '{"body":"  It is still stuck at 40%.  ","idempotency_key":"key-reply-0001","ip":"ip-2"}') AS r1 \gset
SELECT pg_temp.assert((SELECT author_kind = 'client' AND author_id = :'gail' AND visibility = 'public' AND body = 'It is still stuck at 40%.' FROM bloom_support.messages WHERE id = (:'r1'::jsonb->>'message_id')::uuid), 'reply stored as the customer');
SELECT pg_temp.assert((pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', '{"body":"It is still stuck at 40%.","idempotency_key":"key-reply-0001","ip":"ip-2"}')->>'duplicate')::boolean, 'retry with the same key is a duplicate');
SELECT pg_temp.assert((SELECT count(*) FROM bloom_support.messages WHERE ticket_id = :'t1' AND body = 'It is still stuck at 40%.') = 1, 'retry adds no second message');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', jsonb_build_object('body', repeat('x', 5001), 'idempotency_key', 'key-reply-long'))$q$, 'invalid');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', '{"body":" ","idempotency_key":"key-reply-empty"}')$q$, 'invalid');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', '{"body":"hello","idempotency_key":"bad key!"}')$q$, 'invalid');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('delete', 'token-for-ticket-one-aaaaaaaa', '{}')$q$, 'invalid');
-- Rate limit: ten writes per link per hour (six used above).
SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', jsonb_build_object('body', 'Burst ' || g, 'idempotency_key', 'key-burst-' || g, 'ip', 'ip-' || g)) FROM generate_series(1, 4) g;
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'token-for-ticket-one-aaaaaaaa', '{"body":"one too many","idempotency_key":"key-burst-x","ip":"ip-x"}')$q$, 'rate_limited');

-- A staff-raised request shows the staff member's words as the request, but is read-only here.
SELECT (pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'jon', 'ticket', jsonb_build_object('product','crm','channel','staff','subject','Import history','body','Client asked for order history','account_id', :'greenleaf'))))->>'ticket_id' AS t2 \gset
SELECT pg_temp.issue(:'t2', 'staff-raised-token-dddddddddddd');
SELECT pg_temp.track('view', 'staff-raised-token-dddddddddddd') AS v2 \gset
SELECT pg_temp.assert((:'v2'::jsonb#>>'{messages,0,author}') = 'customer', 'staff-raised request is not labelled Bloom Support');
SELECT pg_temp.assert(NOT (:'v2'::jsonb->>'can_reply')::boolean, 'staff-raised request has no page composer');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'staff-raised-token-dddddddddddd', '{"body":"hello there","idempotency_key":"key-staff-1"}')$q$, 'forbidden');

-- Resolved: reply is refused, confirm and reopen go through client_action.
SELECT pg_temp.issue(:'t1', 'second-link-eeeeeeeeeeeeeeeeeeee');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('action', 'second-link-eeeeeeeeeeeeeeeeeeee', '{"action":"confirm_resolved"}')$q$, 'not resolved');
UPDATE bloom_support.tickets SET status = 'resolved', stage = 'resolved', resolved_at = now(), resolution_summary = 'The send was restarted and finished.' WHERE id = :'t1';
SELECT pg_temp.track('view', 'second-link-eeeeeeeeeeeeeeeeeeee') AS v3 \gset
SELECT pg_temp.assert(:'v3'::jsonb->>'status' = 'resolved' AND (:'v3'::jsonb->>'step')::int = 4 AND (:'v3'::jsonb->>'can_confirm')::boolean AND NOT (:'v3'::jsonb->>'can_reply')::boolean, 'resolved state and actions');
SELECT pg_temp.expect_error($q$SELECT pg_temp.track('reply', 'second-link-eeeeeeeeeeeeeeeeeeee', '{"body":"thanks!","idempotency_key":"key-resolved-1"}')$q$, 'resolved');
SELECT pg_temp.track('action', 'second-link-eeeeeeeeeeeeeeeeeeee', '{"action":"confirm_resolved"}');
SELECT pg_temp.assert((pg_temp.track('view', 'second-link-eeeeeeeeeeeeeeeeeeee')->>'confirmed')::boolean, 'confirmation recorded');
SELECT pg_temp.track('action', 'second-link-eeeeeeeeeeeeeeeeeeee', '{"action":"still_broken","message":"It failed again this morning."}');
SELECT pg_temp.assert((SELECT status = 'working' AND reopen_count = 1 FROM bloom_support.tickets WHERE id = :'t1'), 'still broken reopens the request');
SELECT pg_temp.assert(pg_temp.track('view', 'second-link-eeeeeeeeeeeeeeeeeeee')::text LIKE '%It failed again this morning.%', 'reopen message shown');

\echo 'tracking page: all assertions passed'
