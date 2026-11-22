#!/usr/bin/env python3
"""Executable acceptance in a disposable local database. Never sends messages."""
import os, subprocess, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
if os.environ.get('PGDATABASE')!='bloom_membership_test': raise SystemExit('Requires disposable bloom_membership_test')
def sql(q):
 r=subprocess.run(['psql','-XqAt','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr+r.stdout)
 return r.stdout.strip()
def check(q,want,label):
 actual=sql(q)
 assert actual==want,(label,actual,want)
 print('PASS',label)
def rejects(q,label):
 try: sql(q)
 except RuntimeError: print('PASS',label)
 else: raise AssertionError(label)
setup='''
DROP SCHEMA IF EXISTS bloom_pos_private CASCADE; DROP SCHEMA IF EXISTS loyalty_private CASCADE; DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END$$;
CREATE SCHEMA public;CREATE SCHEMA auth;CREATE SCHEMA bloom_pos_private;CREATE SCHEMA loyalty_private;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE tenants(id uuid PRIMARY KEY);
CREATE TABLE users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE pos_connections(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE pos_customers(id uuid PRIMARY KEY,pos_connection_id uuid);
CREATE TABLE crm_customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,user_id uuid,email text,phone text,first_name text,last_name text,pos_source text,external_id text,custom_fields jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz,deleted_at timestamptz,merged_into_customer_id uuid,loyalty_member boolean DEFAULT false,suppressed boolean DEFAULT false,opt_out boolean DEFAULT false,email_opt_in boolean DEFAULT false,sms_opt_in boolean DEFAULT false,email_opt_in_at timestamptz,sms_opt_in_at timestamptz,email_opt_out_at timestamptz,sms_opt_out_at timestamptz,email_consent boolean,sms_consent boolean,email_consent_source text,sms_consent_source text,email_consent_method text,sms_consent_method text,email_consent_details jsonb,sms_consent_details jsonb);
CREATE TABLE customer_consents(customer_id uuid,channel text,status text,consent_timestamp timestamptz,created_at timestamptz,updated_at timestamptz,PRIMARY KEY(customer_id,channel));
CREATE TABLE crm_email_consent_events(tenant_id uuid,customer_id uuid,email text,event_type text,source text,user_agent text,consent_basis text,evidence jsonb,created_at timestamptz);
CREATE TABLE crm_sms_consent_events(tenant_id uuid,customer_id uuid,phone text,event_type text,source text,user_agent text,consent_basis text,evidence jsonb,created_at timestamptz);
CREATE TABLE global_email_suppression_list(email text,lifted_at timestamptz,expires_at timestamptz);
CREATE TABLE suppression_list(tenant_id uuid,customer_id uuid,channel text,lifted_at timestamptz,email text,phone text);
CREATE TABLE customer_loyalty_metrics(customer_id uuid PRIMARY KEY,tenant_id uuid,is_perks_member boolean,perks_enrolled_at timestamptz,customer_created_at timestamptz,time_to_join_perks_days integer,current_loyalty_tier text,updated_at timestamptz);
CREATE TABLE loyalty_provider_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,customer_id uuid,status text);
CREATE TABLE perks_enrollment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,event_type text,new_tier text,enrollment_source text,created_at timestamptz DEFAULT now());
CREATE TABLE bloom_pos_private.connections(key_id text PRIMARY KEY,pos_tenant_id uuid,crm_tenant_id uuid,pos_connection_id uuid,enabled boolean);
CREATE TABLE bloom_pos_private.inbox(event_id uuid PRIMARY KEY,key_id text,event_type text,record_id text,revision bigint,envelope jsonb,subject_id text);
CREATE TABLE loyalty_programmes(id uuid PRIMARY KEY,tenant_id uuid,current_version_id uuid,status text,name text);
CREATE TABLE loyalty_programme_versions(id uuid PRIMARY KEY,tenant_id uuid,programme_id uuid,UNIQUE(tenant_id,programme_id,id));
CREATE FUNCTION loyalty_private.immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Immutable'; END$$;
CREATE FUNCTION loyalty_private.assert_actor(t uuid,u uuid) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF auth.role()<>'service_role' OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=u AND tenant_id=t AND role='owner') THEN RAISE EXCEPTION 'Access denied'; END IF;END$$;
CREATE FUNCTION bloom_pos_private.preference_reviewer() RETURNS uuid LANGUAGE sql AS $$SELECT tenant_id FROM public.users WHERE id=auth.uid() AND role='owner'$$;
CREATE FUNCTION get_current_crm_access() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('role',CASE WHEN role='owner' THEN 'owner_admin' ELSE role END,'tenantId',tenant_id) FROM public.users WHERE id=auth.uid()$$;
CREATE FUNCTION bloomsuite_pos_connection(k text) RETURNS jsonb LANGUAGE sql AS $$SELECT to_jsonb(c) FROM bloom_pos_private.connections c WHERE key_id=k AND enabled$$;
CREATE FUNCTION bloom_pos_private.event_integer(j jsonb,n bigint,label text) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN IF j::text !~ '^[0-9]+$' OR j::text::bigint<n THEN RAISE EXCEPTION 'Invalid revision'; END IF;RETURN j::text::bigint;END$$;
CREATE FUNCTION accept_bloomsuite_pos_event(text,jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"legacy":true}'::jsonb$$;
'''
sql(setup)
sql((ROOT/'supabase/migrations/20260903080000_customer_identity_resolution.sql').read_text())
sql((ROOT/'supabase/migrations/20261121210000_form_consent_history_events.sql').read_text())
# The tracker prerequisite is released independently before this schema.
tracker=ROOT/'supabase/migrations/20261122052828_loyalty_enrollment_delivery.sql'
sql(tracker.read_text().split('CREATE OR REPLACE FUNCTION public.track_loyalty_enrollment',1)[1].split('-- Advancing a skipped step',1)[0].join(['CREATE OR REPLACE FUNCTION public.track_loyalty_enrollment','']))
sql((ROOT/'supabase/migrations/20261122054222_checkout_membership_authority.sql').read_text())
T='00000000-0000-0000-0000-000000000001';PT='00000000-0000-0000-0000-000000000002';PC='00000000-0000-0000-0000-000000000003';ST='00000000-0000-0000-0000-000000000004';P='00000000-0000-0000-0000-000000000005';V='00000000-0000-0000-0000-000000000006';U='00000000-0000-0000-0000-000000000007'
sql(f"INSERT INTO tenants VALUES('{T}');INSERT INTO users VALUES('{U}','{T}','owner');INSERT INTO pos_connections VALUES('{PC}','{T}');INSERT INTO bloom_pos_private.connections VALUES('test','{PT}','{T}','{PC}',true);INSERT INTO loyalty_programmes VALUES('{P}','{T}','{V}','draft','Synthetic');INSERT INTO loyalty_programme_versions VALUES('{V}','{T}','{P}');")
owner=f"SET request.jwt.claim.sub='{U}';SET request.jwt.claim.role='authenticated';"
svc="SET request.jwt.claim.role='service_role';"
policy=sql(owner+f"SELECT save_pos_membership_policy('test','{ST}','{V}',NULL,'NATIVE','v1','I agree to the saved membership terms.','Please send me store email updates.','Please send me store SMS updates.',true)")
def event(n,email='member@example.invalid',phone=None,emailConsent=False,smsConsent=False):
 return {'id':f'00000000-0000-0000-0001-{n:012d}','tenantId':PT,'source':'POS','type':'MembershipEnrollmentRequested','version':1,'recordId':f'00000000-0000-0000-0002-{n:012d}','revision':n,'data':{'storeId':ST,'policyId':policy,'termsVersion':'v1','authority':'CRM','observedAt':'2026-11-20T00:00:00Z','membershipAgreed':True,'email':email,'phone':phone,'firstName':'Synthetic','emailConsent':emailConsent,'smsConsent':smsConsent}}
def accept(e): return svc+"SELECT accept_bloomsuite_pos_event('test','"+json.dumps(e).replace("'","''")+"'::jsonb)"
e=event(1)
check(accept(e)+"->>'accepted'",'true','new guest confirmed')
check("SELECT state FROM bloom_pos_private.membership_requests",'CONFIRMED','native authority confirms automatically')
check("SELECT count(*) FROM perks_enrollment_events",'1','one genuine enrollment')
check("SELECT email_opt_in OR sms_opt_in FROM crm_customers",'f','membership does not imply marketing')
check(accept(e)+"->>'duplicate'",'true','retry accepted')
check("SELECT count(*) FROM perks_enrollment_events",'1','retry has no extra enrollment')
changed=event(1,emailConsent=True);rejects(accept(changed),'changed retry rejected')
check(accept(event(2,emailConsent=True))+"->>'accepted'",'true','existing member independent opt-in')
check("SELECT count(*) FROM crm_email_consent_events",'1','consent audit recorded once')
check("SELECT count(*) FROM perks_enrollment_events",'1','new request existing member no fabricated enrollment')
sql("UPDATE crm_customers SET email_opt_out_at=now(),email_opt_in=false")
check(accept(event(3,emailConsent=True))+"->>'accepted'",'true','withdrawn member request retained')
check("SELECT email_result FROM bloom_pos_private.membership_requests WHERE id='00000000-0000-0000-0002-000000000003'",'suppression_preserved','withdrawal remains respected')
wrong=event(4);wrong['tenantId']=ST;rejects(accept(wrong),'cross-tenant rejected')
wrong=event(4);wrong['data']['storeId']=T;rejects(accept(wrong),'wrong store policy rejected')
wrong=event(4);wrong['data']['membershipAgreed']=False;rejects(accept(wrong),'explicit membership choice required')
wrong=event(4);wrong['data']['policyId']=ST;rejects(accept(wrong),'unknown terms policy rejected')
sql(f"INSERT INTO crm_customers(tenant_id,email) VALUES('{T}','duplicate@example.invalid'),('{T}','duplicate@example.invalid')")
check(accept(event(5,email='duplicate@example.invalid'))+"->>'accepted'",'true','ambiguous request retained')
check("SELECT state FROM bloom_pos_private.membership_requests WHERE id='00000000-0000-0000-0002-000000000005'",'REVIEW_REQUIRED','ambiguous identity waits for review')
check("SELECT count(*) FROM perks_enrollment_events",'1','ambiguous identity never enrolls')
status=event(1);status['type']='MembershipStatusRequested';status['data']={'storeId':T}
check(accept(status)+"->>'state'",'PENDING','status is store scoped')
rejects("SET ROLE authenticated;"+accept(event(6)),'browser cannot bypass signed bridge')
# Independent SMS, active suppression, provider authority and concurrent exact replay.
check(accept(event(7,email='sms@example.invalid',phone='+16045550123',smsConsent=True))+"->>'accepted'",'true','SMS-only agreement accepted')
check("SELECT count(*) FROM crm_sms_consent_events",'1','independent SMS history')
check("SELECT email_opt_in FROM crm_customers WHERE email='sms@example.invalid'",'f','SMS does not imply email')
sql("INSERT INTO global_email_suppression_list(email) VALUES('global@example.invalid')")
check(accept(event(8,email='global@example.invalid',emailConsent=True))+"->>'accepted'",'true','global suppression retains membership request')
check("SELECT email_result FROM bloom_pos_private.membership_requests WHERE id='00000000-0000-0000-0002-000000000008'",'suppression_preserved','global suppression not reset')
import concurrent.futures
concurrent_event=event(9,email='concurrent@example.invalid')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(lambda _:sql(accept(concurrent_event)),range(6)))
check("SELECT count(*) FROM perks_enrollment_events e JOIN crm_customers c ON c.id=e.customer_id WHERE c.email='concurrent@example.invalid'",'1','concurrent retry once per enrollment')
policy=sql(owner+f"SELECT save_pos_membership_policy('test','{ST}','{V}',1,'PROVIDER','v1','I agree to the saved membership terms.','Please send me store email updates.','Please send me store SMS updates.',true)")
check(accept(event(10,email='provider@example.invalid'))+"->>'accepted'",'true','provider request accepted')
check("SELECT state FROM bloom_pos_private.membership_requests WHERE id='00000000-0000-0000-0002-000000000010'",'PROVIDER_PENDING','provider never fabricated native confirmation')
check("SELECT count(*) FROM perks_enrollment_events e JOIN crm_customers c ON c.id=e.customer_id WHERE c.email='provider@example.invalid'",'0','provider pending has no enrollment event')
lookup=event(11);lookup['type']='MembershipPolicyRequested'
check(accept(lookup)+"->'policy'->>'id'",policy,'current programme policy available')
sql(f"UPDATE loyalty_programmes SET status='paused' WHERE id='{P}'")
check(accept(lookup)+"->>'policy' IS NULL",'t','paused programme terms unavailable')
sql(f"UPDATE loyalty_programmes SET status='archived' WHERE id='{P}'")
check(accept(lookup)+"->>'policy' IS NULL",'t','archived programme terms unavailable')
sql(f"UPDATE loyalty_programmes SET status='draft',current_version_id='{ST}' WHERE id='{P}'")
check(accept(lookup)+"->>'policy' IS NULL",'t','changed programme version terms unavailable')
sql(f"UPDATE loyalty_programmes SET current_version_id='{V}' WHERE id='{P}'")
sql(owner+f"SELECT save_pos_membership_policy('test','{ST}','{V}',2,'PROVIDER','v1','I agree to the saved membership terms.','Please send me store email updates.','Please send me store SMS updates.',false)")
check(accept(lookup)+"->>'policy' IS NULL",'t','disabled terms unavailable')
print('Membership SQL checks passed; local fixtures only')
