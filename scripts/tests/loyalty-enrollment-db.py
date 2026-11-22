#!/usr/bin/env python3
"""Disposable PostgreSQL enrollment/claim/crash/replay acceptance. No network sends.
Run PGHOST=127.0.0.1 PGPORT=55439 PGDATABASE=bloom_loyalty_delivery_test python3 ...
"""
from pathlib import Path
import concurrent.futures
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
if os.environ.get('PGDATABASE') != 'bloom_loyalty_delivery_test':
    raise SystemExit('Requires disposable bloom_loyalty_delivery_test database')

def sql(query):
    result = subprocess.run(['psql', '-XqAt', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    return result.stdout.strip()

def check(query, expected, label):
    actual = sql(query)
    assert actual == expected, (label, actual, expected)
    print('PASS', label)

setup = '''
DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public; CREATE SCHEMA auth;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE tenants(id uuid PRIMARY KEY);
CREATE TABLE crm_customers(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz,deleted_at timestamptz,merged_into_customer_id uuid,loyalty_member boolean DEFAULT false);
CREATE TABLE customer_loyalty_metrics(customer_id uuid PRIMARY KEY,tenant_id uuid,is_perks_member boolean,perks_enrolled_at timestamptz,customer_created_at timestamptz,time_to_join_perks_days integer,current_loyalty_tier text,updated_at timestamptz);
CREATE TABLE loyalty_provider_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,customer_id uuid,status text);
CREATE TABLE perks_enrollment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,event_type text,new_tier text,enrollment_source text,created_at timestamptz DEFAULT now());
CREATE TABLE crm_automations(id uuid PRIMARY KEY,tenant_id uuid,is_active boolean,trigger_type text,overlap_behavior text,workflow_steps jsonb DEFAULT '[]');
CREATE TABLE automation_trigger_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),automation_id uuid,customer_id uuid,tenant_id uuid,event_type text,metadata jsonb,source_event_key text,processed_at timestamptz,claimed_at timestamptz,claimed_by text,queued_until timestamptz,retry_count integer DEFAULT 0,max_retries integer DEFAULT 3,last_error_at timestamptz,error_message text,created_at timestamptz DEFAULT now(),UNIQUE(tenant_id,automation_id,source_event_key));
CREATE TABLE automation_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),automation_id uuid,customer_id uuid,tenant_id uuid,status text,current_step_index integer,total_steps integer,run_sequence integer,trigger_data jsonb,metadata jsonb,channel_availability jsonb,next_step_scheduled_at timestamptz,started_at timestamptz DEFAULT now(),completed_at timestamptz,updated_at timestamptz,error_message text);
CREATE TABLE crm_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,automation_id uuid,automation_run_id uuid,customer_id uuid NOT NULL,step_index integer,message_type text CHECK(message_type IN ('email','sms')),recipient text NOT NULL,content text NOT NULL,subject text,template_data jsonb,scheduled_at timestamptz,status text,skip_reason text,skipped_at timestamptz,priority integer,automation_node_id text,locked_until timestamptz,locked_by text,updated_at timestamptz,created_at timestamptz DEFAULT now());
'''
sql(setup)
sql((ROOT/'supabase/migrations/20260903120000_automation_atomic_enrollment.sql').read_text())
sql((ROOT/'supabase/migrations/20260903114500_automation_trigger_claiming.sql').read_text().split('REVOKE ALL ON FUNCTION')[0])
# Match the deployed parent cascade and outbox retention contracts.
sql("ALTER TABLE automation_trigger_events ADD FOREIGN KEY(automation_id) REFERENCES crm_automations(id) ON DELETE CASCADE, ADD FOREIGN KEY(customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE; ALTER TABLE automation_runs ADD FOREIGN KEY(automation_id) REFERENCES crm_automations(id) ON DELETE CASCADE, ADD FOREIGN KEY(customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE; ALTER TABLE crm_outbox ADD FOREIGN KEY(automation_run_id) REFERENCES automation_runs(id) ON DELETE SET NULL;")
# A pre-existing enrollment must never be queued by deploying the migration.
sql("INSERT INTO perks_enrollment_events(tenant_id,customer_id,event_type) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','enrolled');")
sql((ROOT/'supabase/migrations/20261122052828_loyalty_enrollment_delivery.sql').read_text())
check('SELECT count(*) FROM automation_trigger_events','0','no migration backfill')
T='00000000-0000-0000-0000-000000000001'
C='00000000-0000-0000-0000-000000000012'
A='00000000-0000-0000-0000-000000000021'
B='00000000-0000-0000-0000-000000000022'
sql(f"INSERT INTO tenants VALUES('{T}'); INSERT INTO crm_customers(id,tenant_id,created_at) VALUES('{C}','{T}',now()-interval '2 years'); INSERT INTO crm_automations(id,tenant_id,is_active,trigger_type,overlap_behavior) VALUES('{A}','{T}',true,'loyalty_join','restart'),('{B}','{T}',true,'loyalty.signup','parallel'),('00000000-0000-0000-0000-000000000023','{T}',false,'loyalty_join','ignore');")
svc="SET request.jwt.claim.role='service_role'; "
track=svc+f"SELECT track_loyalty_enrollment('{C}','{T}');"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    ids=list(pool.map(lambda _:sql(track),range(8)))
assert len(set(ids))==1
print('PASS concurrent enrollment returns one identity')
check(f"SELECT count(*) FROM perks_enrollment_events WHERE customer_id='{C}'",'1','one enrollment for an existing customer')
check('SELECT count(*) FROM automation_trigger_events','2','both active aliases only')
# New contacts without membership do not trigger anything.
sql(f"INSERT INTO crm_customers(id,tenant_id) VALUES('00000000-0000-0000-0000-000000000013','{T}');")
check('SELECT count(*) FROM automation_trigger_events','2','new contact is not enrollment')
# Imported snapshots and historical members stay silent.
sql(f"INSERT INTO loyalty_provider_accounts(tenant_id,customer_id,status) VALUES('{T}','00000000-0000-0000-0000-000000000013','active');")
check(svc+f"SELECT track_loyalty_enrollment('00000000-0000-0000-0000-000000000013','{T}') IS NULL",'t','historical member has no fabricated enrollment')
check('SELECT count(*) FROM automation_trigger_events','2','provider snapshot produces no event')
# Real claim RPC, then two concurrent begin attempts on the same event.
sql("SELECT count(*) FROM claim_due_automation_trigger_events(100,'worker',15);")
event=sql(f"SELECT id FROM automation_trigger_events WHERE automation_id='{A}'")
begin=svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2);"
import json
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    starts=[json.loads(x) for x in pool.map(lambda _:sql(begin),range(2))]
assert {x['decision'] for x in starts}=={'started','resumed'}
run=starts[0]['run_id']; assert all(x['run_id']==run for x in starts)
print('PASS concurrent begin/crash before enqueue reuses one run')
try: sql(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',3);")
except RuntimeError: print('PASS changed normalized step count rejected')
else: raise AssertionError('Changed step count accepted')
sql(f"UPDATE crm_automations SET workflow_steps='[{{\"type\":\"email\"}}]' WHERE id='{A}';")
try: sql(begin)
except RuntimeError: print('PASS edited workflow cannot resume an incomplete enqueue')
else: raise AssertionError('Changed workflow accepted')
sql(f"UPDATE crm_automations SET workflow_steps='[]' WHERE id='{A}';")

message="jsonb_build_object('message_type','email','recipient','synthetic@example.invalid','content','Synthetic','status','queued','scheduled_at',now())"
enqueue=svc+f"SELECT enqueue_loyalty_automation_step('{event}','worker','{run}',0,{message});"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    sent=[json.loads(x) for x in pool.map(lambda _:sql(enqueue),range(8))]
assert len({x['outbox_id'] for x in sent})==1
check('SELECT count(*) FROM crm_outbox','1','concurrent enqueue produces one provider identity')
check(f"SELECT r.next_step_scheduled_at=o.scheduled_at FROM automation_runs r JOIN crm_outbox o ON o.automation_run_id=r.id WHERE r.id='{run}'",'t','schedule persists atomically with original outbox')
check(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2)->>'decision'",'ignored','crash after enqueue does not restart')
for status in ('failed','sent','skipped'):
    sql(f"UPDATE crm_outbox SET status='{status}' WHERE automation_run_id='{run}';")
    again=json.loads(sql(enqueue)); assert again['outbox_id']==sent[0]['outbox_id'] and again['existing']
print('PASS all-status retries preserve original outbox identity')
check(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2)->>'decision'",'resumed','skipped step resumes advancement')
check(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2)->>'step_status'",'skipped','retry exposes durable skipped result despite eligibility changes')
advance=svc+f"SELECT advance_loyalty_automation_step('{event}','worker','{run}',0,now());"
sql(advance)
check(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2)->>'step_index'",'1','crash after advance resumes missing next step')
# Invalid scope/fields cannot enqueue missing second step.
def early_reject(statement,label):
    try: sql(statement)
    except RuntimeError: print('PASS',label)
    else: raise AssertionError(label)
early_reject(advance,'already advanced index rejected')
early_reject(svc+f"SELECT enqueue_loyalty_automation_step('{event}','worker','{run}',1,{message}||jsonb_build_object('tenant_id','forged'));",'arbitrary scope field rejected')
early_reject(svc+f"SELECT advance_loyalty_automation_step('{event}','worker','{run}',1,now());",'advance without skipped message rejected')
second=svc+f"SELECT enqueue_loyalty_automation_step('{event}','worker','{run}',1,{message}||jsonb_build_object('status','skipped','skip_reason','no consent','recipient',''));"
sql(second)
check(svc+f"SELECT advance_loyalty_automation_step('{event}','worker','{run}',1)->>'status'",'completed','last skipped step completes atomically')
sql(f"UPDATE crm_automations SET workflow_steps='[{{\"type\":\"sms\"}}]' WHERE id='{A}';")
check(svc+f"SELECT begin_loyalty_automation_run('{event}','worker',2)->>'decision'",'ignored','completed run cannot restart')

def rejects(statement,label):
    try: sql(statement)
    except RuntimeError: print('PASS',label)
    else: raise AssertionError(label)
rejects(svc+f"SELECT track_loyalty_enrollment('{C}','00000000-0000-0000-0000-000000000002')",'cross-tenant enrollment rejected')
rejects(svc+f"SELECT begin_loyalty_automation_run('{event}','other-worker',2)",'wrong worker rejected')
sql(f"UPDATE automation_trigger_events SET claimed_at=now()-interval '16 minutes' WHERE id='{event}';")
rejects(begin,'expired lease rejected')
rejects(advance,'expired lease cannot advance skipped step')
rejects(f"SET ROLE authenticated; SELECT begin_loyalty_automation_run('{event}','worker',2)",'browser execution denied')
check("SELECT has_function_privilege('anon','public.enqueue_loyalty_automation_step(uuid,text,uuid,integer,jsonb)','EXECUTE')",'f','anonymous enqueue denied')
check("SELECT has_table_privilege('service_role','public.loyalty_automation_event_runs','INSERT')",'f','binding cannot be written directly')
# A forged queue event cannot cross automation/customer tenant scopes.
sql(f"UPDATE automation_trigger_events SET claimed_at=now(),tenant_id='00000000-0000-0000-0000-000000000002' WHERE id='{event}';")
rejects(begin,'forged event tenant rejected')
# Child pruning must not erase replay identity; authorized parent deletion must work.
rejects(f"DELETE FROM automation_trigger_events WHERE id='{event}'",'individual event deletion retains dedupe')
rejects(f"DELETE FROM automation_runs WHERE id='{run}'",'individual run deletion retains dedupe')
sql(f"DELETE FROM crm_automations WHERE id='{A}';")
check(f"SELECT count(*) FROM loyalty_automation_event_runs WHERE automation_id='{A}'",'0','automation deletion cascades binding')
# Bind second alias then remove customer through the actual parent cascade shape.
second_event=sql(f"SELECT id FROM automation_trigger_events WHERE automation_id='{B}'")
sql(svc+f"SELECT begin_loyalty_automation_run('{second_event}','worker',1);")
sql(f"DELETE FROM crm_customers WHERE id='{C}';")
check('SELECT count(*) FROM loyalty_automation_event_runs','0','customer deletion cascades binding')
print('All loyalty enrollment SQL acceptance checks passed; local synthetic rows only.')
