\set ON_ERROR_STOP on
-- Disposable-database contract test for the Bloom chat spending cap.
-- Run by scripts/tests/run-bloom-support-tests.sh (database bloom_support_spend_test).
SELECT current_database()='bloom_support_spend_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_support_spend_test'
  \quit 3
\endif

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Minimal CRM tenants table (the real one has many more columns).
CREATE TABLE public.tenants (id uuid PRIMARY KEY, name text);

\ir ../../supabase/migrations/20261031120000_bloom_support_core.sql
\ir ../../supabase/migrations/20261031120100_bloom_support_functions.sql
\ir ../../supabase/migrations/20261104150000_bloom_support_chat_spend_cap.sql

CREATE OR REPLACE FUNCTION pg_temp.assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(p_ok,false) THEN RAISE EXCEPTION 'assertion failed: %', p_msg; END IF; END $$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_fragment text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected error containing "%" but statement succeeded: %', p_fragment, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF position(p_fragment IN SQLERRM) = 0 THEN RAISE EXCEPTION 'expected "%", got "%" for %', p_fragment, SQLERRM, p_sql; END IF;
END $$;

\set acme '30000000-0000-4000-8000-000000000001'
\set busy '30000000-0000-4000-8000-000000000002'
\set jon '00000000-0000-4000-8000-000000000001'
\set jeff '00000000-0000-4000-8000-000000000002'
\set client '00000000-0000-4000-8000-000000000004'
INSERT INTO public.tenants VALUES (:'acme','Acme Garden'), (:'busy','Busy Nursery');
INSERT INTO bloom_support.principals(id, kind, email, display_name, role) VALUES
 (:'jon','user','jon@example.test','Jon','platform_admin'),
 (:'jeff','user','jeff@example.test','Jeff','platform_operator'),
 (:'client','user','owner@acme.test','Acme owner','client');

-- Privilege boundary: no client role can read the ledger or caps or call the functions.
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','bloom_support.chat_spend_caps','insert'), 'authenticated cannot write caps');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','bloom_support.chat_spend_caps','update'), 'authenticated cannot raise caps');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated','bloom_support.chat_usage','select'), 'authenticated cannot read usage');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.bloom_chat_spend_set_cap(uuid,uuid,numeric,text)','execute'), 'authenticated cannot set a cap');
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.bloom_chat_spend_reserve(uuid,uuid,text,text,bigint)','execute'), 'anon cannot reserve');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.bloom_chat_spend_overview(uuid)','execute'), 'authenticated cannot read overview');
SELECT pg_temp.assert(has_function_privilege('service_role','public.bloom_chat_spend_reserve(uuid,uuid,text,text,bigint)','execute'), 'service_role reserves');

-- Default cap is 25 USD.
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'cap_micros')::bigint = 25000000, 'default cap 25 USD');

-- Under cap: reserve, settle with actual cost.
SELECT public.bloom_chat_spend_reserve(:'acme', NULL, 'chat', 'gpt-4o', 2000000) AS r1 \gset
SELECT pg_temp.assert((:'r1'::jsonb->>'allowed')::boolean, 'reservation under cap allowed');
SELECT pg_temp.assert((public.bloom_chat_spend_settle((:'r1'::jsonb->>'reservation_id')::uuid, 1200, 80, 3800)->>'status') = 'settled', 'settles');
SELECT pg_temp.assert((public.bloom_chat_spend_settle((:'r1'::jsonb->>'reservation_id')::uuid, 1200, 80, 3800)->>'settled')::boolean = false, 'settle is idempotent');
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'committed_micros')::bigint = 3800, 'committed = actual cost');
SELECT pg_temp.assert((SELECT input_tokens = 1200 AND output_tokens = 80 AND cost_micros = 3800 FROM bloom_support.chat_usage WHERE id = (:'r1'::jsonb->>'reservation_id')::uuid), 'ledger records tokens and cost');

-- Released reservation costs nothing.
SELECT public.bloom_chat_spend_reserve(:'acme', NULL, 'chat', 'gpt-4o', 500000) AS r2 \gset
SELECT public.bloom_chat_spend_settle((:'r2'::jsonb->>'reservation_id')::uuid, NULL, NULL, NULL);
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'committed_micros')::bigint = 3800, 'release refunds reservation');

-- Over cap: refused, nothing reserved.
SELECT pg_temp.assert(NOT (public.bloom_chat_spend_reserve(:'acme', NULL, 'chat', 'gpt-4o', 25000000)->>'allowed')::boolean, 'over cap refused');
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'committed_micros')::bigint = 3800, 'refusal reserves nothing');

-- Overrides: only a platform admin.
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_chat_spend_set_cap('%s','%s',1000,NULL)$q$, :'client', :'acme'), 'admin.policy');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_chat_spend_set_cap('%s','%s',1000,NULL)$q$, :'jeff', :'acme'), 'admin.policy');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_chat_spend_overview('%s')$q$, :'client'), 'admin.policy');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_chat_spend_set_cap('%s','%s',1000,NULL)$q$, :'jon', gen_random_uuid()), 'not_found');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_chat_spend_set_cap('%s','%s',-1,NULL)$q$, :'jon', :'acme'), 'invalid');
SELECT public.bloom_chat_spend_set_cap(:'jon', :'acme', 100, 'pilot');
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'cap_micros')::bigint = 100000000, 'override honoured');
SELECT pg_temp.assert((public.bloom_chat_spend_reserve(:'acme', NULL, 'chat', 'gpt-4o', 25000000)->>'allowed')::boolean, 'override lets the call through');
SELECT pg_temp.assert(EXISTS (SELECT 1 FROM bloom_support.activity WHERE action = 'chat_spend_cap.changed'), 'cap change audited');
SELECT pg_temp.assert(jsonb_array_length(public.bloom_chat_spend_overview(:'jon')->'tenants') = 1, 'overview lists the tenant');
SELECT public.bloom_chat_spend_set_cap(:'jon', :'acme', NULL, NULL);
SELECT pg_temp.assert((public.bloom_chat_spend_status(:'acme')->>'cap_micros')::bigint = 25000000, 'clearing override returns to default');

\echo 'bloom-support-chat-spend: all assertions passed'
