\set ON_ERROR_STOP on
-- Disposable database only. Never run this fixture on a hosted project.
DO $$ BEGIN IF current_database()<>'bloom_analysis_test' THEN RAISE EXCEPTION 'Disposable bloom_analysis_test required'; END IF; END $$;
BEGIN;
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE ROLE service_role;
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,created_at timestamptz,
 primary_location_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.customer_intelligence_source_events (
 id uuid PRIMARY KEY, tenant_id uuid, customer_id uuid, external_customer_code text,
 import_id uuid, source text, event_type text, created_at timestamptz, raw_data jsonb
);
CREATE INDEX ON public.customer_intelligence_source_events(tenant_id,import_id,id);
ALTER TABLE public.customer_intelligence_source_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_tenant ON public.customer_intelligence_source_events FOR SELECT TO authenticated
 USING (tenant_id=current_setting('test.tenant')::uuid);
GRANT SELECT ON public.customer_intelligence_source_events TO authenticated;
INSERT INTO public.customer_intelligence_source_events
SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',i::text,
 '30000000-0000-4000-8000-000000000001','ideal','purchase_summary','2026-01-01',
 jsonb_build_object('items',jsonb_build_array(jsonb_build_array('X','Unrelated','Other',1,1,1),
 jsonb_build_array('E','Eucalyptus bunch','Floral',1,12,2))) FROM generate_series(1,501)i;
INSERT INTO public.customer_intelligence_source_events VALUES
 ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',NULL,NULL,
 '90000000-0000-4000-8000-000000000001','ideal','purchase_summary','2026-01-01','{"items":[["E","Eucalyptus bunch","Floral",1,999,1]]}');
\ir ../../supabase/migrations/20261105003000_bloom_bounded_summary_search.sql
SET LOCAL ROLE authenticated;
SET LOCAL test.tenant='10000000-0000-4000-8000-000000000001';
DO $$ DECLARE p jsonb; a uuid:=NULL; n integer:=0; pages integer:=0; BEGIN
 LOOP
  p:=public.bloom_summary_search_page('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-02-01',a,'eucalyptus');
  IF (p->>'scanned')::integer>250 THEN RAISE EXCEPTION 'Unbounded page'; END IF;
  IF jsonb_array_length(p->'candidates')<>(p->>'scanned')::integer THEN RAISE EXCEPTION 'Lost matching rows'; END IF;
  IF p->'candidates'->0->'item_indexes'<>'[1]'::jsonb THEN RAISE EXCEPTION 'Original item position lost'; END IF;
  n:=n+(p->>'scanned')::integer;pages:=pages+1;a:=(p->>'last_id')::uuid;
  EXIT WHEN (p->>'scanned')::integer<250;
 END LOOP;
 IF n<>501 OR pages<>3 THEN RAISE EXCEPTION 'Incomplete traversal'; END IF;
 p:=public.bloom_summary_search_page('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-02-01',NULL,'wreath');
 IF p->>'scanned'<>'250' OR jsonb_array_length(p->'candidates')<>0 OR jsonb_array_length(p->'customer_ids')<>1 THEN RAISE EXCEPTION 'Nonmatching page lost cursor or evidence'; END IF;
 p:=public.bloom_summary_search_page('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','2026-02-01',NULL,'eucalyptus');
 IF p->>'scanned'<>'0' THEN RAISE EXCEPTION 'Cross tenant disclosure'; END IF;
 p:=public.bloom_summary_search_page('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2025-12-31',NULL,'eucalyptus');
 IF p->>'scanned'<>'0' THEN RAISE EXCEPTION 'Cutoff ignored'; END IF;
END $$;
ROLLBACK;
