\set ON_ERROR_STOP on
SELECT current_database()='bloom_reporting_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_reporting_test'
  \quit 3
\endif
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE public.users(id uuid,tenant_id uuid);
CREATE TABLE public.admin_session_context(admin_user_id uuid,active_tenant_id uuid);
CREATE FUNCTION public.is_master_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE TABLE public.crm_customers(id uuid,created_at timestamptz,deleted_at timestamptz,last_purchase_date date,order_history jsonb,persona text,persona_id uuid,tags text[],total_spent numeric,user_id uuid,tenant_id uuid);
CREATE TABLE public.crm_campaigns(id uuid,click_rate numeric,created_at timestamptz,open_rate numeric,status text,metrics jsonb,total_sent integer,messages_sent integer,total_opens integer,total_clicks integer,tenant_id uuid,user_id uuid);
CREATE TABLE public.customer_loyalty_metrics(customer_id uuid,is_perks_member boolean);
CREATE TABLE public.customer_segments(customer_id uuid,segment_id uuid);
CREATE TABLE public.crm_segments(id uuid,name text,tenant_id uuid);
CREATE TABLE public.crm_personas(id uuid,persona_name text,tenant_id uuid,user_id uuid);
CREATE TABLE public.customer_personas(customer_id uuid,persona_id uuid,predefined_persona_id text);
CREATE TABLE public.email_tracking_events(id uuid,tenant_id uuid,created_at timestamptz,event_type text,customer_email text);
\ir ../../supabase/migrations/20260508193940_fix_dashboard_snapshot_coalesce_type.sql
\ir ../../supabase/migrations/20260904024700_fix_crm_dashboard_admin_context.sql
INSERT INTO public.users VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
INSERT INTO public.crm_customers SELECT ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()-interval '100 days',NULL,current_date-150,'[]',NULL,NULL,ARRAY['loyalty'],1000,'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001' FROM generate_series(1,100)n;
INSERT INTO public.crm_customers SELECT '40000000-0000-4000-8000-000000000999',now(),NULL,current_date,'[]',NULL,NULL,'{}',999999,'20000000-0000-4000-8000-000000000999','10000000-0000-4000-8000-000000000999';
INSERT INTO public.crm_segments VALUES('30000000-0000-4000-8000-000000000001','High-Value Customers','10000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002','Seasonal Shoppers','10000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000999','High-Value Customers','10000000-0000-4000-8000-000000000999');
INSERT INTO public.customer_segments SELECT id,'30000000-0000-4000-8000-000000000001'::uuid FROM public.crm_customers WHERE tenant_id='10000000-0000-4000-8000-000000000001';
INSERT INTO public.customer_segments VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'),('40000000-0000-4000-8000-000000000999','30000000-0000-4000-8000-000000000999');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
CREATE TEMP TABLE expected AS SELECT public.get_crm_dashboard_snapshot('10000000-0000-4000-8000-000000000001',NULL)::jsonb as tenant_result, public.get_crm_dashboard_snapshot(NULL,'20000000-0000-4000-8000-000000000001')::jsonb as user_result;
CREATE TEMP TABLE original_security AS SELECT prosecdef,proacl,proconfig,split_part(prosrc,'WITH bounds AS',1) as guard FROM pg_proc WHERE oid='public.get_crm_dashboard_snapshot(uuid,uuid)'::regprocedure;
\ir ../../supabase/migrations/20261007214817_crm_reporting_query_scope.sql
\ir ../../supabase/migrations/20261007214817_crm_reporting_query_scope.sql
\ir ../../supabase/migrations/20261007220945_crm_reporting_user_scope_indexes.sql
\ir ../../supabase/migrations/20261007220945_crm_reporting_user_scope_indexes.sql
DO $$DECLARE tenant_result jsonb;user_result jsonb;BEGIN
 tenant_result:=public.get_crm_dashboard_snapshot('10000000-0000-4000-8000-000000000001',NULL)::jsonb;
 user_result:=public.get_crm_dashboard_snapshot(NULL,'20000000-0000-4000-8000-000000000001')::jsonb;
 IF tenant_result IS DISTINCT FROM (SELECT e.tenant_result FROM expected e) OR user_result IS DISTINCT FROM (SELECT e.user_result FROM expected e) THEN RAISE EXCEPTION 'Reporting results changed'; END IF;
 IF tenant_result->>'total_customers'<>'100' OR tenant_result->'segment_counts'->>'high-value'<>'100' OR tenant_result->'segment_counts'->>'seasonal-shoppers'<>'1' THEN RAISE EXCEPTION 'Fixture counts are incorrect';END IF;
 IF (SELECT count(*) FROM pg_index WHERE indisvalid AND indexrelid IN ('public.idx_crm_customers_reporting_user'::regclass,'public.idx_crm_campaigns_reporting_user'::regclass,'public.idx_crm_personas_reporting_user'::regclass))<>3 THEN RAISE EXCEPTION 'User-scope indexes missing or invalid'; END IF;
 IF EXISTS(SELECT 1 FROM original_security o CROSS JOIN pg_proc p WHERE p.oid='public.get_crm_dashboard_snapshot(uuid,uuid)'::regprocedure AND (p.prosecdef IS DISTINCT FROM o.prosecdef OR p.proacl IS DISTINCT FROM o.proacl OR p.proconfig IS DISTINCT FROM o.proconfig OR split_part(p.prosrc,'WITH bounds AS',1) IS DISTINCT FROM o.guard)) THEN RAISE EXCEPTION 'Security configuration changed'; END IF;
 BEGIN PERFORM public.get_crm_dashboard_snapshot('10000000-0000-4000-8000-000000000999',NULL);RAISE EXCEPTION 'Unauthorized tenant read succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.get_crm_dashboard_snapshot('10000000-0000-4000-8000-000000000001',NULL);RAISE EXCEPTION 'Unauthenticated read succeeded';EXCEPTION WHEN invalid_authorization_specification THEN NULL;END;
END $$;
ROLLBACK;
\echo 'PASS: unchanged complete results for tenant/user scope, deduplication, authorization, privileges and migration idempotency'
