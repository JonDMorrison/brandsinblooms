#!/usr/bin/env python3
"""Disposable PostgreSQL contract; reads repo files, never production data/files."""
from pathlib import Path
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
if os.environ.get('PGDATABASE') != 'bloom_analysis_test':
    sys.exit('Refusing to run outside the disposable bloom_analysis_test database.')

def function_from(path: str, name: str) -> str:
    source = (ROOT / path).read_text()
    match = re.search(r'CREATE OR REPLACE FUNCTION public\.' + re.escape(name) + r'\([\s\S]*?\n\$\$;', source, re.I)
    if not match:
        raise RuntimeError(f'Authoritative function {name} was not found in {path}')
    return match.group(0)

legacy = function_from('supabase/migrations/20260903160000_location_access_management.sql', 'has_tenant_permission')
crm_path = 'supabase/migrations/20260903154054_tenant_crm_role_foundation.sql'
crm = function_from(crm_path, 'get_current_crm_access') + '\n' + function_from(crm_path, 'crm_has_permission')
migration = (ROOT / 'supabase/migrations/20261014193543_customer_intelligence_permission_contract.sql').read_text()
setup = r'''
\set ON_ERROR_STOP on
BEGIN;
DO $$BEGIN IF current_database()<>'bloom_analysis_test' THEN RAISE EXCEPTION 'Wrong database'; END IF; END$$;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.admin_session_context(admin_user_id uuid PRIMARY KEY,active_tenant_id uuid);
CREATE TABLE public.tenant_locations(id uuid,tenant_id uuid,is_active boolean);
CREATE TABLE public.user_location_access(user_id uuid,tenant_id uuid,location_id uuid);
CREATE FUNCTION public.is_master_admin(id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT id='20000000-0000-4000-8000-000000000001'::uuid$$;
INSERT INTO public.users SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  CASE WHEN n=7 THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END,
  CASE n WHEN 1 THEN 'admin' WHEN 2 THEN 'owner' WHEN 3 THEN 'admin' WHEN 4 THEN 'marketing' WHEN 5 THEN 'staff' WHEN 6 THEN 'store_manager' WHEN 7 THEN 'marketing' ELSE 'unknown' END
FROM generate_series(1,8)n;
INSERT INTO public.admin_session_context VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
INSERT INTO public.tenant_locations VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true);
INSERT INTO public.user_location_access SELECT id,tenant_id,'30000000-0000-4000-8000-000000000001'::uuid FROM public.users WHERE role IN('staff','store_manager');
CREATE TABLE public.bloom_customer_sets(id integer PRIMARY KEY,tenant_id uuid,user_id uuid);
CREATE TABLE public.customer_purchase_line_items(id integer PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.customer_intelligence_source_events(id integer PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.customer_intelligence_imports(id integer PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.customer_intelligence_sources(id integer PRIMARY KEY,tenant_id uuid,status text);
'''
policies = r'''
ALTER TABLE public.bloom_customer_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchase_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.bloom_customer_sets,public.customer_purchase_line_items,public.customer_intelligence_source_events,public.customer_intelligence_imports,public.customer_intelligence_sources TO authenticated;
GRANT INSERT,UPDATE ON public.customer_intelligence_sources TO authenticated;
CREATE POLICY bloom_customer_sets_read ON public.bloom_customer_sets FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND public.has_tenant_permission(tenant_id,'customers.read',NULL) AND public.has_tenant_permission(tenant_id,'reports.read',NULL));
CREATE POLICY customer_purchase_line_items_select ON public.customer_purchase_line_items FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'customers.read',NULL));
CREATE POLICY customer_intelligence_source_events_select ON public.customer_intelligence_source_events FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'customers.read',NULL));
CREATE POLICY customer_intelligence_imports_select ON public.customer_intelligence_imports FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'reports.read',NULL));
CREATE POLICY customer_intelligence_sources_select ON public.customer_intelligence_sources FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'reports.read',NULL));
CREATE POLICY customer_intelligence_sources_insert ON public.customer_intelligence_sources FOR INSERT TO authenticated WITH CHECK(public.has_tenant_permission(tenant_id,'integrations.manage',NULL));
CREATE POLICY customer_intelligence_sources_update ON public.customer_intelligence_sources FOR UPDATE TO authenticated USING(public.has_tenant_permission(tenant_id,'integrations.manage',NULL)) WITH CHECK(public.has_tenant_permission(tenant_id,'integrations.manage',NULL));
DO $$DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['customer_purchase_line_items','customer_intelligence_source_events','customer_intelligence_imports'] LOOP
  EXECUTE format('INSERT INTO public.%I VALUES(1,%L),(2,%L)',tbl,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
 END LOOP;
END$$;
INSERT INTO public.customer_intelligence_sources VALUES(1,'10000000-0000-4000-8000-000000000001','active'),(2,'10000000-0000-4000-8000-000000000002','active');
INSERT INTO public.bloom_customer_sets VALUES
 (1,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004'),
 (2,'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001'),
 (3,'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000007');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$BEGIN
 IF NOT public.has_tenant_permission('10000000-0000-4000-8000-000000000001','customer.read',NULL) THEN RAISE EXCEPTION 'Fixture marketing authority invalid'; END IF;
 IF (SELECT count(*) FROM public.customer_purchase_line_items)<>0 THEN RAISE EXCEPTION 'Expected to reproduce the old plural-key denial'; END IF;
END$$;
RESET ROLE;
'''
checks = r'''
DO $$DECLARE n integer; tbl text; ids integer[]; expected integer[]; count_rows integer; allowed boolean; actor uuid; BEGIN
 FOR n IN 1..9 LOOP
  actor:=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  expected:=CASE WHEN n IN(1,7) THEN ARRAY[2] WHEN n IN(2,3,4) THEN ARRAY[1] ELSE ARRAY[]::integer[] END;
  FOREACH tbl IN ARRAY ARRAY['customer_purchase_line_items','customer_intelligence_source_events','customer_intelligence_imports','customer_intelligence_sources'] LOOP
   EXECUTE format('SELECT coalesce(array_agg(id ORDER BY id),ARRAY[]::integer[]) FROM public.%I',tbl) INTO ids;
   IF ids<>expected THEN RAISE EXCEPTION 'Wrong role/tenant visibility for actor %, table %: % expected %',n,tbl,ids,expected; END IF;
  END LOOP;
  SELECT coalesce(array_agg(id ORDER BY id),ARRAY[]::integer[]) INTO ids FROM public.bloom_customer_sets;
  expected:=CASE n WHEN 1 THEN ARRAY[2] WHEN 4 THEN ARRAY[1] WHEN 7 THEN ARRAY[3] ELSE ARRAY[]::integer[] END;
  IF ids<>expected THEN RAISE EXCEPTION 'Snapshot ownership failed for actor %: %',n,ids; END IF;
  UPDATE public.customer_intelligence_sources SET status='reviewed'; GET DIAGNOSTICS count_rows=ROW_COUNT;
  IF count_rows<>CASE WHEN n IN(1,2,3) THEN 1 ELSE 0 END THEN RAISE EXCEPTION 'Wrong integration write scope for actor %',n; END IF;
  allowed:=true;
  BEGIN
   INSERT INTO public.customer_intelligence_sources VALUES(100+n,'10000000-0000-4000-8000-000000000001','draft');
  EXCEPTION WHEN insufficient_privilege THEN allowed:=false;
  END;
  IF allowed IS DISTINCT FROM (n IN(2,3)) THEN RAISE EXCEPTION 'Wrong integration insert privilege for actor %',n; END IF;
  EXECUTE 'RESET ROLE';
  DELETE FROM public.customer_intelligence_sources WHERE id>=100;
 END LOOP;
END$$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$BEGIN
 BEGIN
  UPDATE public.customer_intelligence_sources SET tenant_id='10000000-0000-4000-8000-000000000002' WHERE id=1;
  RAISE EXCEPTION 'Tenant reassignment unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.bloom_customer_sets VALUES(9,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Client snapshot forging unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.customer_purchase_line_items;
 IF n<>0 THEN RAISE EXCEPTION 'Unauthenticated claims exposed records'; END IF;
END$$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: actual permission functions, owner/admin/marketing/staff/store manager/unknown/master contexts, source write controls, snapshot ownership, cross-tenant checks and idempotency'
'''
subprocess.run(['psql', '-X', '-v', 'ON_ERROR_STOP=1'], input=setup + legacy + '\n' + crm + '\n' + policies + migration + '\n' + migration + '\n' + checks, text=True, check=True, cwd=ROOT)
