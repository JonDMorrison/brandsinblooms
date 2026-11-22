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
CREATE TABLE pos_connections(id uuid PRIMARY KEY,tenant_id uuid,is_active boolean DEFAULT true,platform text DEFAULT 'bloomsuite',settings jsonb DEFAULT '{"provider":"bloomsuite_pos"}',last_sync_at timestamptz,sync_status text,sync_error text);
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
CREATE TABLE bloom_pos_private.connections(key_id text PRIMARY KEY,pos_tenant_id uuid,crm_tenant_id uuid,pos_connection_id uuid,enabled boolean,currency text DEFAULT 'CAD');
CREATE TABLE bloom_pos_private.inbox(event_id uuid PRIMARY KEY,key_id text,event_type text,record_id text,revision bigint,envelope jsonb,subject_id text);
CREATE TABLE bloom_pos_private.customer_links(key_id text,pos_customer_id uuid,crm_customer_id uuid,source_event_id uuid,PRIMARY KEY(key_id,pos_customer_id));
CREATE TABLE pos_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,pos_connection_id uuid,external_id text,crm_customer_id uuid,currency text,customer_resolution_status text,customer_resolution_reason text,updated_at timestamptz,external_customer_id text,order_date timestamptz,total_amount numeric,status text,items jsonb,raw_data jsonb,provider text,refund_amount numeric,refunded_at timestamptz,UNIQUE(pos_connection_id,external_id));
CREATE TABLE bloom_pos_private.return_events(event_id uuid PRIMARY KEY,key_id text,original_sale_id text,return_sale_id text,amount_cents bigint,occurred_at timestamptz,UNIQUE(key_id,return_sale_id));
CREATE FUNCTION bloom_pos_private.event_time(e jsonb) RETURNS timestamptz LANGUAGE sql AS $$SELECT coalesce(e#>>'{data,occurredAt}',e->>'occurredAt')::timestamptz$$;
CREATE TABLE purchase_metric_calls(customer_id uuid);
CREATE FUNCTION recalculate_purchase_metrics(uuid) RETURNS void LANGUAGE sql AS $$INSERT INTO public.purchase_metric_calls VALUES($1)$$;
CREATE FUNCTION bloom_pos_private.event_data(e jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT CASE WHEN jsonb_typeof(e#>'{data,payload}')='object' THEN e#>'{data,payload}' ELSE e->'data' END$$;
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
# Exercise the actual signed purchase projector, with a metric-call recorder only.
legacy=(ROOT/'supabase/migrations/20261009160000_bloomsuite_pos_replay_integrity.sql').read_text()
sql('CREATE OR REPLACE FUNCTION public.accept_bloomsuite_pos_event'+legacy.split('CREATE OR REPLACE FUNCTION public.accept_bloomsuite_pos_event',1)[1].split('REVOKE ALL ON FUNCTION public.bloomsuite_pos_connection',1)[0])
sql((ROOT/'supabase/migrations/20261122054222_checkout_membership_authority.sql').read_text())
T='00000000-0000-0000-0000-000000000001';PT='00000000-0000-0000-0000-000000000002';PC='00000000-0000-0000-0000-000000000003';ST='00000000-0000-0000-0000-000000000004';P='00000000-0000-0000-0000-000000000005';V='00000000-0000-0000-0000-000000000006';U='00000000-0000-0000-0000-000000000007'
sql(f"INSERT INTO tenants VALUES('{T}');INSERT INTO users VALUES('{U}','{T}','owner');INSERT INTO pos_connections(id,tenant_id) VALUES('{PC}','{T}');INSERT INTO bloom_pos_private.connections(key_id,pos_tenant_id,crm_tenant_id,pos_connection_id,enabled) VALUES('test','{PT}','{T}','{PC}',true);INSERT INTO loyalty_programmes VALUES('{P}','{T}','{V}','draft','Synthetic');INSERT INTO loyalty_programme_versions VALUES('{V}','{T}','{P}');")
owner=f"SET request.jwt.claim.sub='{U}';SET request.jwt.claim.role='authenticated';"
svc="SET request.jwt.claim.role='service_role';"
policy=sql(owner+f"SELECT save_pos_membership_policy('test','{ST}','{V}',NULL,'NATIVE','v1','I agree to the saved membership terms.','Please send me store email updates.','Please send me store SMS updates.',true)")
def event(n,email='member@example.invalid',phone=None,emailConsent=False,smsConsent=False):
 return {'id':f'00000000-0000-0000-0001-{n:012d}','tenantId':PT,'source':'POS','type':'MembershipEnrollmentRequested','version':1,'recordId':f'00000000-0000-0000-0002-{n:012d}','revision':n,'data':{'sourceEventId':f'00000000-0000-0000-0003-{n:012d}','storeId':ST,'policyId':policy,'termsVersion':'v1','authority':'CRM','observedAt':'2026-11-20T00:00:00Z','membershipAgreed':True,'email':email,'phone':phone,'firstName':'Synthetic','emailConsent':emailConsent,'smsConsent':smsConsent}}
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
stale=event(12,email='stale@example.invalid',emailConsent=True)
check(accept(stale)+"->>'accepted'",'true','known stale policy acknowledged to avoid blocking later delivery')
check("SELECT state FROM bloom_pos_private.membership_requests WHERE id='00000000-0000-0000-0002-000000000012'",'REJECTED','stale terms recorded as rejected')
check("SELECT count(*) FROM crm_customers WHERE email='stale@example.invalid'",'0','stale terms do not create contact or consent')
check(accept(stale)+"->>'duplicate'",'true','rejected stale retry is exact and durable')
stale['data']['email']='changed@example.invalid';rejects(accept(stale),'changed stale retry rejected')
# Signed source sale linkage and subsequent real return/void projection.
policy=sql(owner+f"SELECT save_pos_membership_policy('test','{ST}','{V}',3,'NATIVE','v1','I agree to the saved membership terms.','Please send me store email updates.','Please send me store SMS updates.',true)")
def sale(n,customer=None):
 payload={'saleId':f'sale-{n}','totalCents':1200,'currency':'CAD','lineItems':[{'name':'Synthetic'}],'tenders':[{'type':'cash'}]}
 if customer: payload['customerId']=customer
 return {'id':f'00000000-0000-0000-0004-{n:012d}','tenantId':PT,'source':'POS','type':'SaleCompleted','version':1,'recordId':f'00000000-0000-0000-0003-{n:012d}','revision':n+100,'occurredAt':'2026-11-20T00:00:00Z','data':{'id':f'00000000-0000-0000-0003-{n:012d}','tenantId':PT,'type':'SaleCompleted','version':1,'occurredAt':'2026-11-20T00:00:00Z','payload':payload}}
guest=event(20,email='guest-purchase@example.invalid')
check(accept(guest)+"->>'accepted'",'true','membership before sale retained')
check("SELECT purchase_result FROM bloom_pos_private.membership_requests WHERE id='"+guest['recordId']+"'",'pending','missing accepted source sale stays pending')
check(accept(sale(20))+"->>'accepted'",'true','late signed source sale accepted')
check("SELECT c.email FROM pos_orders o JOIN crm_customers c ON c.id=o.crm_customer_id WHERE o.external_id='sale-20'",'guest-purchase@example.invalid','guest binds only real accepted source sale')
check("SELECT count(*) FROM bloom_pos_private.customer_links",'0','guest never invents POS customer identity')
ret=sale(21);ret['type']='ReturnCompleted';ret['data']['type']='ReturnCompleted';ret['data']['payload']={'originalSaleId':'sale-20','returnSaleId':'return-20','returnAmountCents':400}
check(accept(ret)+"->>'accepted'",'true','real return projector accepted')
check("SELECT c.email||':'||o.refund_amount::text FROM pos_orders o JOIN crm_customers c ON c.id=o.crm_customer_id WHERE o.external_id='sale-20'",'guest-purchase@example.invalid:4.0000000000000000','guest binding survives return projection')
void=sale(22);void['type']='VoidCompleted';void['data']['type']='VoidCompleted';void['data']['payload']={'saleId':'sale-20'}
check(accept(void)+"->>'accepted'",'true','real void projector accepted')
check("SELECT status||':'||(crm_customer_id IS NOT NULL)::text FROM pos_orders WHERE external_id='sale-20'",'voided:true','void state preserved with source identity')
pos_customer='00000000-0000-0000-0005-000000000001'
check(accept(sale(30,pos_customer))+"->>'accepted'",'true','known POS customer sale accepted unmatched')
check(accept(sale(31,pos_customer))+"->>'accepted'",'true','older unmatched sale retained')
known=event(30,email='known-purchase@example.invalid');known['data']['customerId']=pos_customer
check(accept(known)+"->>'accepted'",'true','known POS customer signup accepted')
check("SELECT count(*) FROM bloom_pos_private.customer_links WHERE pos_customer_id='"+pos_customer+"'",'1','canonical identity installs nonconflicting bridge link')
check("SELECT crm_customer_id IS NULL FROM pos_orders WHERE external_id='sale-31'",'t','no blind historical backfill')
check(accept(sale(32,pos_customer))+"->>'accepted'",'true','future sale accepted via canonical bridge link')
check("SELECT c.email FROM pos_orders o JOIN crm_customers c ON c.id=o.crm_customer_id WHERE o.external_id='sale-32'",'known-purchase@example.invalid','future purchases use established identity')
# Conflicting saved link must never be overwritten by a different resolved signup.
other=sql("SELECT id FROM crm_customers WHERE email='member@example.invalid'")
conflict_pos='00000000-0000-0000-0005-000000000002'
sql(f"INSERT INTO bloom_pos_private.customer_links VALUES('test','{conflict_pos}','{other}','{e['id']}')")
check(accept(sale(40,conflict_pos))+"->>'accepted'",'true','existing linked sale accepted')
conflict=event(40,email='link-conflict@example.invalid');conflict['data']['customerId']=conflict_pos
check(accept(conflict)+"->>'accepted'",'true','conflicting purchase identity retained for review')
check("SELECT purchase_result FROM bloom_pos_private.membership_requests WHERE id='"+conflict['recordId']+"'",'review_required','conflicting bridge link requires review')
check("SELECT crm_customer_id::text FROM bloom_pos_private.customer_links WHERE pos_customer_id='"+conflict_pos+"'",other,'existing bridge identity not overwritten')
check("SELECT state FROM bloom_pos_private.membership_requests WHERE id='"+conflict['recordId']+"'",'REVIEW_REQUIRED','conflicting existing POS identity never auto-enrolls')
check("SELECT count(*) FROM perks_enrollment_events e JOIN crm_customers c ON c.id=e.customer_id WHERE c.email='link-conflict@example.invalid'",'0','identity conflict has no loyalty event')
# The domain event identity and connection, not transport envelope ID, bind a sale.
wrong_source=event(50,email='wrong-source@example.invalid');wrong_source['data']['sourceEventId']=sale(20)['id']
check(accept(wrong_source)+"->>'accepted'",'true','transport ID request retained without guessing source')
check("SELECT purchase_result FROM bloom_pos_private.membership_requests WHERE id='"+wrong_source['recordId']+"'",'pending','transport ID cannot match original domain event')
conflicting_guest=event(51,email='other-guest@example.invalid');conflicting_guest['data']['sourceEventId']=guest['data']['sourceEventId']
check(accept(conflicting_guest)+"->>'accepted'",'true','second identity for same guest sale retained')
check("SELECT state FROM bloom_pos_private.membership_requests WHERE id='"+conflicting_guest['recordId']+"'",'REVIEW_REQUIRED','guest source cannot be rebound to different identity')
check("SELECT c.email FROM pos_orders o JOIN crm_customers c ON c.id=o.crm_customer_id WHERE o.external_id='sale-20'",'guest-purchase@example.invalid','original guest binding preserved')
race=event(60,email='sale-race@example.invalid');race_sale=sale(60)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(lambda e:sql(accept(e)),[race,race_sale,race,race_sale,race,race_sale]))
check("SELECT count(*) FROM bloom_pos_private.membership_sale_links WHERE source_event_id='"+race['data']['sourceEventId']+"'",'1','concurrent sale/signup retry retains one source binding')
check("SELECT count(*) FROM perks_enrollment_events e JOIN crm_customers c ON c.id=e.customer_id WHERE c.email='sale-race@example.invalid'",'1','concurrent sale/signup emits one enrollment')
rejects("SET ROLE authenticated;SELECT bloom_pos_private.project_membership_purchase('"+race['recordId']+"')",'browser cannot invoke purchase linker')
check("SELECT count(*)>0 FROM purchase_metric_calls",'t','real projection invokes metric refresh without sends')
print('Membership SQL checks passed; local fixtures only')
