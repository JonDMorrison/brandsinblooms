\set ON_ERROR_STOP on
SELECT current_database() = 'bloom_analysis_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run fixture outside bloom_analysis_test'
  \quit 3
\endif
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION public.has_tenant_permission(p_tenant_id uuid,p_permission text,p_location_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE AS $$SELECT p_tenant_id::text=current_setting('test.tenant',true) AND p_permission=ANY(string_to_array(current_setting('test.permissions',true),','))$$;
CREATE TABLE public.bloom_conversations(id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,status text DEFAULT 'active');
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,name text,description text,conditions jsonb,customer_count integer,auto_update boolean,status text,source text,source_id text,deleted_at timestamptz);
CREATE TABLE public.customer_segments(customer_id uuid,segment_id uuid,assigned_by_user_id uuid,UNIQUE(customer_id,segment_id));
CREATE TABLE public.customer_purchase_line_items(tenant_id uuid);
CREATE TABLE public.customer_intelligence_source_events(tenant_id uuid);
CREATE TABLE public.customer_intelligence_sources(tenant_id uuid);
ALTER TABLE public.customer_purchase_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_purchase_line_items_select ON public.customer_purchase_line_items FOR SELECT TO authenticated USING(false);
CREATE POLICY customer_intelligence_source_events_select ON public.customer_intelligence_source_events FOR SELECT TO authenticated USING(false);
CREATE POLICY customer_intelligence_sources_select ON public.customer_intelligence_sources FOR SELECT TO authenticated USING(false);
\ir ../../supabase/migrations/20261007202819_bloom_customer_exploration.sql
INSERT INTO public.tenants VALUES ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
INSERT INTO auth.users VALUES ('20000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002');
INSERT INTO public.bloom_conversations VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','active');
INSERT INTO public.crm_customers VALUES ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',NULL,NULL),('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',NULL,NULL);
INSERT INTO public.bloom_customer_sets(id,tenant_id,user_id,conversation_id,label,payload) VALUES
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Hydrangea buyers','{"included_ids":["40000000-0000-4000-8000-000000000001"],"excluded_ids":[],"unknown_ids":[],"trail":[{"label":"Hydrangea buyers"}]}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('test.tenant','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('test.permissions','reports.read,customers.read,segments.manage',true);
DO $$BEGIN
 IF (SELECT count(*) FROM public.bloom_customer_sets)<>1 THEN RAISE EXCEPTION 'Owner cannot read saved result'; END IF;
 BEGIN INSERT INTO public.bloom_customer_sets(tenant_id,user_id,conversation_id,label,payload) VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','forged','{}');RAISE EXCEPTION 'A client forged a result';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.save_bloom_customer_set_segment('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','No bypass');RAISE EXCEPTION 'A client bypassed approval';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_customer_sets)<>0 THEN RAISE EXCEPTION 'Same-company user sees another user snapshot'; END IF;END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('test.tenant','10000000-0000-4000-8000-000000000002',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_customer_sets)<>0 THEN RAISE EXCEPTION 'Cross-company snapshot leak'; END IF;END $$;
SELECT set_config('test.tenant','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('test.permissions','reports.read',true);
DO $$BEGIN IF (SELECT count(*) FROM public.bloom_customer_sets)<>0 THEN RAISE EXCEPTION 'Missing customer permission ignored'; END IF;END $$;
RESET ROLE;
DO $$DECLARE first_result jsonb; second_result jsonb;BEGIN
 first_result:=public.save_bloom_customer_set_segment('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Hydrangea audience');
 second_result:=public.save_bloom_customer_set_segment('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Hydrangea audience');
 IF first_result->>'id'<>second_result->>'id' OR second_result->>'reused'<>'true' THEN RAISE EXCEPTION 'Saving is not idempotent';END IF;
 IF (SELECT count(*) FROM public.customer_segments)<>1 THEN RAISE EXCEPTION 'Incorrect audience membership';END IF;
 IF (SELECT auto_update FROM public.crm_segments LIMIT 1) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Frozen segment incorrectly dynamic';END IF;
 IF (SELECT analysis_provenance->>'original_count' FROM public.crm_segments LIMIT 1)<>'1' THEN RAISE EXCEPTION 'Provenance missing';END IF;
 BEGIN PERFORM public.save_bloom_customer_set_segment('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Wrong owner');RAISE EXCEPTION 'Wrong owner succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
-- A mixed-company source can never become an audience, even through service code.
UPDATE public.bloom_customer_sets SET payload=jsonb_set(payload,'{included_ids}','["40000000-0000-4000-8000-000000000001","40000000-0000-4000-8000-000000000002"]');
DO $$BEGIN
 BEGIN PERFORM public.save_bloom_customer_set_segment('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Cross-company audience');RAISE EXCEPTION 'Cross-company save succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Audience membership changed%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.crm_segments)<>1 THEN RAISE EXCEPTION 'A failed save left a partial segment';END IF;
END $$;
ROLLBACK;
\echo 'PASS: migration, owned snapshots, client write denial, cross-user/tenant denial, permissions, frozen audience, provenance, atomicity and idempotency'
