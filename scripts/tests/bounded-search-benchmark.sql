\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'bloom_search_benchmark' THEN RAISE EXCEPTION 'Disposable bloom_search_benchmark required'; END IF; END $$;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claims',true)::jsonb->>'role'$$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.app_admin_emails(email text PRIMARY KEY);
CREATE TABLE public.user_roles(user_id uuid,role text);
CREATE TABLE public.admin_session_context(admin_user_id uuid PRIMARY KEY,active_tenant_id uuid);
CREATE TABLE public.user_location_access(user_id uuid,tenant_id uuid,location_id uuid,PRIMARY KEY(user_id,tenant_id,location_id));
CREATE TABLE public.tenant_locations(id uuid PRIMARY KEY,tenant_id uuid,is_active boolean);
CREATE TABLE public.customer_location_activity(customer_id uuid,tenant_id uuid,location_id uuid,PRIMARY KEY(customer_id,tenant_id,location_id));
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,external_id text,created_at timestamptz,primary_location_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.customer_intelligence_imports(id uuid PRIMARY KEY,tenant_id uuid,status text,source text,report_type text,source_sha256 text,source_filename text,source_period_start date,source_period_end date,created_at timestamptz,completed_at timestamptz,reconciliation jsonb);
CREATE TABLE public.customer_intelligence_source_events(id uuid PRIMARY KEY,tenant_id uuid,customer_id uuid,external_customer_code text,import_id uuid,source text,event_type text,created_at timestamptz,raw_data jsonb);
CREATE INDEX ON public.customer_intelligence_source_events(tenant_id,import_id,id);
CREATE TABLE public.customer_purchase_line_items(id uuid,tenant_id uuid,customer_id uuid,product_code text,product_name text,sales_category text,department text,quantity numeric,net_amount numeric,currency text,purchased_at timestamptz,created_at timestamptz,source text,import_id uuid,external_transaction_id text);
\ir bounded-search-production-permissions.sql
ALTER TABLE public.customer_intelligence_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY bench_imports ON public.customer_intelligence_imports FOR SELECT TO authenticated USING(has_tenant_permission(tenant_id,'customer.read',NULL));
ALTER TABLE public.customer_purchase_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY bench_dated ON public.customer_purchase_line_items FOR SELECT TO authenticated USING(has_tenant_permission(tenant_id,'customer.read',NULL));
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.tenants VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO auth.users VALUES ('20000000-0000-0000-0000-000000000001','admin@example.invalid'),('20000000-0000-0000-0000-000000000002','staff@example.invalid');
INSERT INTO public.app_admin_emails VALUES ('admin@example.invalid');
INSERT INTO public.admin_session_context VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.users VALUES ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','staff');
INSERT INTO public.tenant_locations SELECT ('30000000-0000-0000-0000-00000000000'||i)::uuid,'10000000-0000-0000-0000-000000000001',true FROM generate_series(1,2)i;
INSERT INTO public.user_location_access VALUES ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
INSERT INTO public.crm_customers SELECT md5('customer'||i)::uuid,'10000000-0000-0000-0000-000000000001',i::text,'2026-01-01',('30000000-0000-0000-0000-00000000000'||(1+i%2))::uuid,NULL,NULL FROM generate_series(1,47934)i;
INSERT INTO public.customer_intelligence_imports SELECT md5('import'||y)::uuid,'10000000-0000-0000-0000-000000000001','completed','ideal','customer_sales_summary',repeat(md5(y::text),2),'Synthetic '||y,(y||'-01-01')::date,(y||'-12-31')::date,'2026-10-01','2026-10-01',NULL FROM generate_series(2019,2026)y;
INSERT INTO public.customer_intelligence_source_events
SELECT md5('event'||i)::uuid,'10000000-0000-0000-0000-000000000001',md5('customer'||(1+i%47934))::uuid,(1+i%47934)::text,md5('import'||(2019+i%8))::uuid,'ideal','purchase_summary','2026-10-01',
jsonb_build_object('kind','purchase_summary','currency','CAD','period_start',(2019+i%8)||'-01-01','period_end',(2019+i%8)||'-12-31','source_sha256',repeat(md5((2019+i%8)::text),2),'items',
(SELECT jsonb_agg(jsonb_build_array('P'||j,CASE WHEN i%113=0 AND j=1 THEN 'Eucalyptus bunch' ELSE 'Product '||md5((i*200+j)::text) END,CASE WHEN i%7=0 THEN 'Tropical' ELSE 'Floral' END,1,12,j)) FROM generate_series(1,CASE WHEN i%1000=0 THEN 200 ELSE 1+i%16 END)j)) FROM generate_series(1,88044)i;
CREATE TABLE public.customer_intelligence_verified_summaries(import_id uuid PRIMARY KEY,tenant_id uuid,fingerprint text,verified_at timestamptz);
ALTER TABLE public.customer_intelligence_verified_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_intelligence_verified_summaries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.customer_intelligence_verified_summaries TO service_role;
\ir ../../supabase/migrations/20261103230000_summary_verification_generations.sql
BEGIN;
\ir ../../supabase/migrations/20261105003000_bloom_bounded_summary_search.sql
COMMIT;
-- Approximate the inspected whole-table row count/heap width, not just one tenant.
ALTER TABLE public.crm_customers ADD COLUMN synthetic_padding text;
INSERT INTO public.crm_customers SELECT md5('other'||i)::uuid,'10000000-0000-0000-0000-000000000002',i::text,'2026-01-01',NULL,NULL,NULL,NULL FROM generate_series(1,165292)i;
UPDATE public.crm_customers SET synthetic_padding=repeat(md5(id::text),19);
VACUUM ANALYZE;
