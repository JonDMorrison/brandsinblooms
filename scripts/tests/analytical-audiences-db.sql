\set ON_ERROR_STOP on
SELECT current_database()='bloom_audience_test' AS isolated \gset
\if :isolated
\else
\quit 3
\endif
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.bloom_customer_sets(id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,payload jsonb);
CREATE TABLE public.customer_intelligence_imports(id uuid PRIMARY KEY,tenant_id uuid,status text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION public.has_tenant_permission(uuid,text,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT $1::text=current_setting('test.tenant',true)$$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth,public TO service_role;
\ir ../../supabase/migrations/20261021214832_analytical_audience_refresh.sql
INSERT INTO public.tenants VALUES('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
INSERT INTO auth.users VALUES('20000000-0000-4000-8000-000000000001',NULL),('20000000-0000-4000-8000-000000000002',NULL);
INSERT INTO public.users VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','admin');
INSERT INTO public.crm_customers VALUES('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',NULL,NULL),('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',NULL,NULL);
INSERT INTO public.bloom_customer_sets VALUES('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"tenant_id":"10000000-0000-4000-8000-000000000001","user_id":"20000000-0000-4000-8000-000000000001","included_ids":["40000000-0000-4000-8000-000000000001"],"unknown_ids":[],"excluded_ids":[],"trail":[{"rule":{"mode":"purchased","product":"pottery"}}]}');
SET LOCAL ROLE service_role;
DO $$DECLARE a jsonb;b jsonb;BEGIN
 a:=public.save_bloom_analytical_audience('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Dynamic','dynamic','{}');
 b:=public.save_bloom_analytical_audience('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Dynamic','dynamic','{}');
 IF a->>'id'<>b->>'id' OR b->>'reused'<>'true' THEN RAISE EXCEPTION 'Save replay failed';END IF;
 PERFORM public.save_bloom_analytical_audience('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fixed','fixed','{}');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true),set_config('test.tenant','10000000-0000-4000-8000-000000000001',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_analytical_audiences)<>2 THEN RAISE EXCEPTION 'Owner read failed'; END IF;
 BEGIN PERFORM public.claim_bloom_audience_refresh(gen_random_uuid());RAISE EXCEPTION 'Client acquired service lease';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_analytical_audiences)<>0 THEN RAISE EXCEPTION 'Other user leaked audience';END IF;END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true),set_config('test.tenant','10000000-0000-4000-8000-000000000002',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_analytical_audiences)<>0 THEN RAISE EXCEPTION 'Other tenant leaked audience';END IF;END $$;
RESET ROLE;
UPDATE public.bloom_analytical_audiences SET next_refresh_at=now()-interval '1 day';
SET LOCAL ROLE service_role;
DO $$DECLARE a public.bloom_analytical_audiences;t uuid:=gen_random_uuid();snapshot jsonb;BEGIN
 SELECT * INTO a FROM public.claim_bloom_audience_refresh(t);
 IF a.mode<>'dynamic' THEN RAISE EXCEPTION 'Fixed audience was refreshed';END IF;
 IF EXISTS(SELECT 1 FROM public.claim_bloom_audience_refresh(gen_random_uuid())) THEN RAISE EXCEPTION 'Lease overlap';END IF;
 IF public.finish_bloom_audience_refresh(a.id,gen_random_uuid(),a.version,a.snapshot,NULL) THEN RAISE EXCEPTION 'Stale token accepted';END IF;
 snapshot:=jsonb_set(a.snapshot,'{member_ids}','["40000000-0000-4000-8000-000000000002"]');
 BEGIN PERFORM public.finish_bloom_audience_refresh(a.id,t,a.version,snapshot,NULL);RAISE EXCEPTION 'Cross-tenant member committed';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Cross-tenant member committed' THEN RAISE;END IF;END;
 INSERT INTO public.customer_intelligence_imports VALUES(gen_random_uuid(),a.tenant_id,'completed');
 IF NOT public.finish_bloom_audience_refresh(a.id,t,a.version,a.snapshot,NULL) THEN RAISE EXCEPTION 'Valid commit failed';END IF;
 IF public.finish_bloom_audience_refresh(a.id,t,a.version,a.snapshot,NULL) THEN RAISE EXCEPTION 'Committed replay accepted';END IF;
 IF (SELECT next_refresh_at FROM public.bloom_analytical_audiences WHERE id=a.id)>now() THEN RAISE EXCEPTION 'Concurrent import refresh lost';END IF;
 IF (SELECT version FROM public.bloom_analytical_audiences WHERE id=a.id)<>2 THEN RAISE EXCEPTION 'Version not atomic';END IF;
END $$;
INSERT INTO public.customer_intelligence_imports VALUES(gen_random_uuid(),'10000000-0000-4000-8000-000000000001','completed');
DO $$DECLARE a public.bloom_analytical_audiences;t uuid:=gen_random_uuid();BEGIN
 SELECT * INTO a FROM public.claim_bloom_audience_refresh(t);IF a.id IS NULL THEN RAISE EXCEPTION 'Import did not queue refresh';END IF;
 IF NOT public.finish_bloom_audience_refresh(a.id,t,a.version,NULL,'Synthetic failure') THEN RAISE EXCEPTION 'Failure acknowledgment failed';END IF;
 IF (SELECT snapshot FROM public.bloom_analytical_audiences WHERE id=a.id) IS DISTINCT FROM a.snapshot THEN RAISE EXCEPTION 'Failed refresh replaced membership';END IF;
END $$;
RESET ROLE;
UPDATE public.users SET role='staff';UPDATE public.bloom_analytical_audiences SET next_refresh_at=now()-interval '1 day';
SET LOCAL ROLE service_role;
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.claim_bloom_audience_refresh(gen_random_uuid())) THEN RAISE EXCEPTION 'Revoked owner still refreshed';END IF;END $$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: save replay, tenant/user RLS, service-only writes, fixed preservation, exclusive lease, stale token, cross-tenant rejection, atomic replacement, import queue, failure preservation, revoked owner'
