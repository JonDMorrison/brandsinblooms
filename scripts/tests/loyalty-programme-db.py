#!/usr/bin/env python3
"""Disposable PostgreSQL acceptance, including real concurrent replay.
No production data is read. The explicitly named test database is rebuilt.
"""
from pathlib import Path
import concurrent.futures
import json
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
if os.environ.get('PGDATABASE') != 'bloom_loyalty_test':
    sys.exit('Refusing to run outside the disposable bloom_loyalty_test database.')

def sql(query: str) -> str:
    run = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if run.returncode:
        raise RuntimeError(run.stderr[-12000:] + '\n' + run.stdout[-4000:])
    return run.stdout.strip()

def function_from(path: str, name: str) -> str:
    source = (ROOT / path).read_text()
    m = re.search(r'CREATE OR REPLACE FUNCTION public\.' + re.escape(name) + r'\([\s\S]*?\n\$\$;', source, re.I)
    if not m:
        raise RuntimeError('Missing authoritative permission function: ' + name)
    return m.group(0)

legacy = function_from('supabase/migrations/20260903160000_location_access_management.sql', 'has_tenant_permission')
crm_path = 'supabase/migrations/20260903154054_tenant_crm_role_foundation.sql'
crm = function_from(crm_path, 'get_current_crm_access') + '\n' + function_from(crm_path, 'crm_has_permission')
migration = (ROOT / 'supabase/migrations/20261015170116_loyalty_programme_operations.sql').read_text()
setup = r'''
DO $$BEGIN IF current_database()<>'bloom_loyalty_test' THEN RAISE EXCEPTION 'Wrong database'; END IF; END$$;
DROP SCHEMA IF EXISTS loyalty_private CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END$$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(auth.jwt()->>'sub','')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'role'$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
CREATE TABLE public.tenants(id uuid PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.admin_session_context(admin_user_id uuid PRIMARY KEY,active_tenant_id uuid);
CREATE TABLE public.tenant_locations(id uuid,tenant_id uuid,is_active boolean);
CREATE TABLE public.user_location_access(user_id uuid,tenant_id uuid,location_id uuid);
CREATE TABLE public.test_master_admins(id uuid PRIMARY KEY);
CREATE FUNCTION public.is_master_admin(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.test_master_admins WHERE id=$1)$$;
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,deleted_at timestamptz,merged_into_customer_id uuid);
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,name text,description text,conditions jsonb,customer_count integer,auto_update boolean,status text,source text,source_id text,analysis_provenance jsonb);
CREATE TABLE public.customer_segments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid,segment_id uuid,assigned_by_user_id uuid,UNIQUE(customer_id,segment_id));
CREATE TABLE public.crm_campaigns(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,created_by_user_id uuid,title text NOT NULL,start_date date,description text,source text);
CREATE TABLE public.content_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,created_by_user_id uuid,campaign_id uuid REFERENCES public.campaigns(id),status text NOT NULL,scheduled_date date NOT NULL,post_type text,ai_output text,notes text,plan_theme text);
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.tenants VALUES('10000000-0000-0000-0000-000000000001',true),('20000000-0000-0000-0000-000000000001',true);
INSERT INTO public.users(id,tenant_id,role) VALUES
 ('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','owner'),
 ('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','marketing'),
 ('10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','store_manager'),
 ('10000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','staff'),
 ('20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001','admin');
INSERT INTO public.crm_customers VALUES
 ('10000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000001',NULL,NULL),
 ('10000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000001',NULL,NULL),
 ('20000000-0000-0000-0000-000000000101','20000000-0000-0000-0000-000000000001',NULL,NULL);
CREATE FUNCTION public.test_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %',message; END IF; END$$;
CREATE FUNCTION public.test_denied(query text, message text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE denied boolean:=false;
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'EXPECTED DENIAL: %',message; END IF;
END$$;
'''
sql(setup + '\n' + legacy + '\n' + crm + '\n' + migration)
T = '10000000-0000-0000-0000-000000000001'
U = '10000000-0000-0000-0000-000000000011'
C = '10000000-0000-0000-0000-000000000101'
service = "SET ROLE service_role; SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false);\n"
def literal(value) -> str:
    return "'" + json.dumps(value, separators=(',', ':')).replace("'", "''") + "'::jsonb"
def definition(name='Welcome'):
    return {'version': 1, 'name': name, 'currency': 'CAD'}
def save(key, name='Welcome', actor=U, tenant=T):
    return f"SELECT public.save_loyalty_programme_v1('{tenant}','{actor}',{literal(definition(name))},'{key}',NULL,NULL);"

def last_json(output: str):
    return json.loads(output.splitlines()[-1])

# Real simultaneous transactions must converge on one draft/version.
key = '30000000-0000-0000-0000-000000000001'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    values = list(pool.map(lambda _: last_json(sql(service + save(key))), range(2)))
assert values[0]['programmeId'] == values[1]['programmeId'], values
p, v = values[0]['programmeId'], values[0]['versionId']
assert sql(f"SELECT count(*) FROM public.loyalty_programmes WHERE id='{p}';") == '1'
print('PASS: simultaneous replay creates one programme and one immutable version')

# Browser direct mutations, wrong actors, wrong tenants, request-key tampering.
sql(service + f"""
SELECT public.test_denied($q${save(key,'Tampered')}$q$,'different request payload');
SELECT public.test_denied($q${save('30000000-0000-0000-0000-000000000002', actor='10000000-0000-0000-0000-000000000013')}$q$,'store manager cannot access company-wide programmes');
SELECT public.test_denied($q${save('30000000-0000-0000-0000-000000000003', tenant='20000000-0000-0000-0000-000000000001')}$q$,'wrong tenant actor');
SELECT public.test_denied($q$UPDATE public.loyalty_programme_versions SET definition='{{}}' WHERE id='{v}'$q$,'immutable definition');
""")
for actor, expected in [(U, 1), ('10000000-0000-0000-0000-000000000012', 1), ('10000000-0000-0000-0000-000000000013', 0), ('10000000-0000-0000-0000-000000000014', 0), ('20000000-0000-0000-0000-000000000011', 0), ('00000000-0000-0000-0000-000000000001', 0)]:
    claims = json.dumps({'sub': actor, 'role': 'authenticated'})
    sql(f"SET ROLE authenticated; SELECT set_config('request.jwt.claims','{claims}',false); SELECT public.test_assert((SELECT count(*)={expected} FROM public.loyalty_programmes),'RLS programme scope'); SELECT public.test_denied($q${save('30000000-0000-0000-0000-000000000004')}$q$,'browser cannot execute financial/measurement mutations');")
sql("SET ROLE anon; SELECT public.test_denied('SELECT * FROM public.loyalty_programmes','anonymous reads');")
print('PASS: owner/marketing access, location and cross-tenant denial, no client writes')

preview = '40000000-0000-0000-0000-000000000001'
digest = 'a' * 64
snapshot = {'version': 1, 'period': {'tenantId': T, 'sourceCutoff': '2026-10-15T17:00:00Z', 'customers': [{'customerId': C, 'recordedSpendMinor': 10000}]}}
payload = {'baseline': snapshot, 'audience': {'kind': 'all_customers', 'customerIds': [C]}}
sql(service + f"INSERT INTO public.loyalty_operation_previews(id,tenant_id,user_id,kind,programme_version_id,digest,payload) VALUES('{preview}','{T}','{U}','baseline','{v}','{digest}',{literal(payload)});")
confirm = f"SELECT public.confirm_loyalty_baseline_v1('{T}','{U}','{preview}','{digest}');"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    values = list(pool.map(lambda _: last_json(sql(service + confirm)), range(2)))
b = values[0]['baselineId']
assert b == values[1]['baselineId']
sql(service + f"SELECT public.test_denied($q$UPDATE public.loyalty_programme_baselines SET snapshot='{{}}' WHERE id='{b}'$q$,'baseline immutable'); SELECT public.test_denied($q$SELECT public.confirm_loyalty_baseline_v1('{T}','{U}','{preview}','{'b'*64}')$q$,'approval bound to digest');")
print('PASS: baseline confirmation replay, fixed cohort and immutable recorded values')

# A source identity change between preview and confirmation must fail entirely.
preview2 = '40000000-0000-0000-0000-000000000002'
sql(service + f"INSERT INTO public.loyalty_operation_previews(id,tenant_id,user_id,kind,programme_version_id,digest,payload) VALUES('{preview2}','{T}','{U}','baseline','{v}','{digest}',{literal(payload)});")
sql(f"UPDATE public.crm_customers SET merged_into_customer_id='10000000-0000-0000-0000-000000000102' WHERE id='{C}';")
sql(service + f"SELECT public.test_denied($q$SELECT public.confirm_loyalty_baseline_v1('{T}','{U}','{preview2}','{digest}')$q$,'changed identity');")
sql(f"UPDATE public.crm_customers SET merged_into_customer_id=NULL WHERE id='{C}';")
print('PASS: identity changes require review, never silent audience reduction')

# Result, exact IDs, segment creation and repeat-safe membership.
result = {'version': 1, 'kind': 'loyalty_programme_result', 'tenantId': T, 'currentWindow': {'start': '2026-09-01', 'end': '2026-09-30'}, 'sourceCutoff': '2026-10-15T17:00:00Z', 'rows': [{'customerId': C, 'state': 'declining'}]}
period = {'tenantId': T}
run = last_json(sql(service + f"SELECT public.save_loyalty_run_v1('{T}','{U}','{b}','50000000-0000-0000-0000-000000000001',{literal(result)},{literal(period)},NULL);"))['runId']
bad = {**result, 'rows': [{'customerId': '20000000-0000-0000-0000-000000000101', 'state': 'declining'}]}
sql(service + f"SELECT public.test_denied($q$SELECT public.save_loyalty_run_v1('{T}','{U}','{b}','50000000-0000-0000-0000-000000000002',{literal(bad)},{literal(period)},NULL)$q$,'equal-sized substituted audience');")
save_segment = f"SELECT public.save_loyalty_result_segment_v1('{T}','{U}','{run}',ARRAY['declining'],'Declining customers',1);"
s1 = last_json(sql(service + save_segment)); s2 = last_json(sql(service + save_segment)); assert s1['segmentId'] == s2['segmentId']
sql(f"SELECT public.test_assert((SELECT count(*)=1 FROM public.customer_segments WHERE segment_id='{s1['segmentId']}'),'exact saved membership'); SELECT public.test_assert((SELECT auto_update=false FROM public.crm_segments WHERE id='{s1['segmentId']}'),'static not dynamic');")
print('PASS: immutable result, exact customer identity and atomic static audience saving')

# Preview already hashes/validates source rows; commit cannot schedule sending.
cal_id = '60000000-0000-0000-0000-000000000001'
cal = {'kind': 'calendar_import', 'name': 'Garden marketing calendar', 'timezone': 'America/Vancouver', 'counts': {'rejected': 0}, 'rows': [
    {'rowNumber': 2, 'state': 'accepted', 'fingerprint': '1'*64, 'original': {'Title': 'Spring'}, 'item': {'title': 'Spring', 'date': '2027-03-01', 'channel': 'email', 'notes': 'No automatic send', 'theme': 'Spring'}}
]}
def add_calendar(id, value):
    sql(service + f"INSERT INTO public.loyalty_operation_previews(id,tenant_id,user_id,kind,digest,payload) VALUES('{id}','{T}','{U}','calendar','{digest}',{literal(value)});")
add_calendar(cal_id, cal)
commit = f"SELECT public.commit_calendar_import_v1('{T}','{U}','{cal_id}','{digest}',false);"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    values = list(pool.map(lambda _: last_json(sql(service + commit)), range(2)))
assert values[0] == values[1], values
assert values[0]['created'] == 1 and values[0]['scheduledMessages'] == 0
sql("SELECT public.test_assert((SELECT count(*)=1 FROM public.content_tasks WHERE status='planned'),'planned only');")
# Duplicate import under a distinct preview also remains one task.
cal2 = '60000000-0000-0000-0000-000000000002'; add_calendar(cal2, cal)
assert last_json(sql(service + f"SELECT public.commit_calendar_import_v1('{T}','{U}','{cal2}','{digest}',false);"))['duplicates'] == 1
# Failure after first row must roll back parent, tasks, original rows and batch.
cal3 = '60000000-0000-0000-0000-000000000003'
broken = {**cal, 'rows': [{**cal['rows'][0], 'fingerprint': '2'*64}, {**cal['rows'][0], 'rowNumber': 3, 'fingerprint': '3'*64, 'item': {**cal['rows'][0]['item'], 'date': 'not-a-date'}}]}
add_calendar(cal3, broken)
sql(service + f"SELECT public.test_denied($q$SELECT public.commit_calendar_import_v1('{T}','{U}','{cal3}','{digest}',false)$q$,'calendar failure atomicity');")
sql("SELECT public.test_assert((SELECT count(*)=1 FROM public.content_tasks),'no partial tasks'); SELECT public.test_assert((SELECT count(*)=1 FROM public.campaigns),'no partial parent'); SELECT public.test_assert((SELECT count(*)=1 FROM public.calendar_import_rows),'no partial original rows');")
print('PASS: concurrent calendar commit, cross-upload dedupe, original rows, failure atomicity, no sends')

# Require explicit acknowledgement for rejected rows.
cal4 = '60000000-0000-0000-0000-000000000004'
rejected = {**cal, 'counts': {'rejected': 1}, 'rows': [{**cal['rows'][0], 'fingerprint': '4'*64}, {'rowNumber': 3, 'state': 'rejected', 'original': {'Date': 'bad'}}]}
add_calendar(cal4, rejected)
sql(service + f"SELECT public.test_denied($q$SELECT public.commit_calendar_import_v1('{T}','{U}','{cal4}','{digest}',false)$q$,'must acknowledge rejected rows');")
assert last_json(sql(service + f"SELECT public.commit_calendar_import_v1('{T}','{U}','{cal4}','{digest}',true);"))['rejected'] == 1
print('PASS: rejected-row acknowledgement and complete reconciliation counts')

# Revoking the actor after preview cannot be bypassed by a stale edge session.
sql(f"UPDATE public.users SET role='staff' WHERE id='{U}';")
sql(service + f"SELECT public.test_denied($q${confirm}$q$,'revoked actor cannot confirm even a replay');")
sql(f"UPDATE public.users SET role='owner' WHERE id='{U}';")
print('PASS: permission revocation checked inside the committing transaction')
print('PASS: all programme database acceptance contracts')
