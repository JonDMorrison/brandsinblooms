BEGIN;
CREATE TEMP TABLE bridge_checks(label text PRIMARY KEY);
CREATE FUNCTION pg_temp.check_that(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
INSERT INTO bridge_checks VALUES(label); END $$;
CREATE FUNCTION pg_temp.expect_error(statement text,fragment text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught text; BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN caught:=SQLERRM; END;
 PERFORM pg_temp.check_that(caught IS NOT NULL AND position(fragment in caught)>0,label);
END $$;
CREATE FUNCTION pg_temp.envelope(seq integer,kind text,body jsonb,nested boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('id',('f9010000-0000-4000-8000-'||lpad(seq::text,12,'0'))::uuid,
 'tenantId','f9020000-0000-4000-8000-000000000001','source','POS','type',kind,'version',1,
 'recordId','record-'||seq,'revision',seq,'occurredAt','2026-10-09T10:00:00Z',
 'data',CASE WHEN nested THEN jsonb_build_object('id',gen_random_uuid(),'type',kind,'version',1,
 'tenantId','f9020000-0000-4000-8000-000000000001','occurredAt','2026-10-08T12:00:00Z','idempotencyKey','source-'||seq,'payload',body) ELSE body END)
$$;
CREATE FUNCTION pg_temp.sale(id text,customer text DEFAULT NULL,currency text DEFAULT 'CAD') RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('saleId',id,'customerId',customer,'sessionId','session-qa','currency',currency,
 'totalCents',1000,'lineItems',jsonb_build_array(jsonb_build_object('id','line-1','catalogueItemId','plant-1','name','Test Hosta','quantity',1,'unitPriceCents',1000,'taxLines','[]'::jsonb)),
 'tenders',jsonb_build_array(jsonb_build_object('id','tender-1','type','CASH','amountCents',1000)),'taxLines','[]'::jsonb)
$$;
INSERT INTO public.tenants(id,name) VALUES('f9030000-0000-4000-8000-000000000001','Synthetic bridge test'),('f9030000-0000-4000-8000-000000000002','Foreign test tenant');
INSERT INTO public.pos_connections(id,tenant_id,user_id,platform,name,settings)
VALUES('f9040000-0000-4000-8000-000000000001','f9030000-0000-4000-8000-000000000001','f9050000-0000-4000-8000-000000000001','bloomsuite','Synthetic POS','{"provider":"bloomsuite_pos"}');
INSERT INTO public.crm_customers(id,tenant_id,email) VALUES
 ('f9060000-0000-4000-8000-000000000001','f9030000-0000-4000-8000-000000000001','one@example.invalid'),
 ('f9060000-0000-4000-8000-000000000002','f9030000-0000-4000-8000-000000000001','two@example.invalid'),
 ('f9060000-0000-4000-8000-000000000003','f9030000-0000-4000-8000-000000000002','foreign@example.invalid');
INSERT INTO bloom_pos_private.connections(key_id,pos_tenant_id,crm_tenant_id,pos_connection_id,secret,enabled,currency)
VALUES('qa-bridge','f9020000-0000-4000-8000-000000000001','f9030000-0000-4000-8000-000000000001','f9040000-0000-4000-8000-000000000001',repeat('test-only-',8),true,'CAD');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
CREATE FUNCTION pg_temp.preference(seq integer,crm uuid DEFAULT 'f9060000-0000-4000-8000-000000000001',email text DEFAULT 'one@example.invalid',observed timestamptz DEFAULT clock_timestamp()-interval '1 minute') RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.envelope(seq,'MarketingConsentRequested',jsonb_build_object('authority','CRM','channel','EMAIL','status','PENDING_AUTHORITY_REVIEW','externalCustomerId',crm,'customerId','f9070000-0000-4000-8000-000000000001','recipient',email,'statement','I agree to store emails and can unsubscribe at any time.','policyVersion',1,'evidenceRef','pos-consent:request-'||seq,'observedAt',observed));
$$;
SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(70,'CustomerChanged','{"customerId":"f9070000-0000-4000-8000-000000000001","sharedProfileId":"f9060000-0000-4000-8000-000000000001"}'));
CREATE TEMP TABLE captures(seq integer PRIMARY KEY,envelope jsonb);GRANT SELECT ON captures TO authenticated;
INSERT INTO captures VALUES(71,pg_temp.preference(71)),(72,pg_temp.preference(72)),(73,pg_temp.preference(73)),(74,pg_temp.preference(74));
SELECT pg_temp.check_that(public.accept_bloomsuite_pos_event('qa-bridge',(SELECT envelope FROM captures WHERE seq=71))->>'accepted'='true','separate confirmed preference is retained');
SELECT pg_temp.check_that(public.accept_bloomsuite_pos_event('qa-bridge',(SELECT envelope FROM captures WHERE seq=71))->>'duplicate'='true','lost response reuses one exact preference envelope');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',jsonb_set((SELECT envelope FROM captures WHERE seq=71),'{data,recipient}','"other@example.invalid"'))$q$,'retry changed','changed retry cannot substitute address');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.preference(75,'f9060000-0000-4000-8000-000000000003','foreign@example.invalid'))$q$,'identity required','foreign customer cannot enter the review queue');
SELECT pg_temp.check_that((SELECT email_opt_in=false FROM public.crm_customers WHERE id='f9060000-0000-4000-8000-000000000001'),'inbound preference never grants campaign permission');
SELECT pg_temp.check_that((SELECT count(*)=1 FROM bloom_pos_private.marketing_requests),'one private request after duplicate and changed retry');
SELECT pg_temp.check_that(NOT has_function_privilege('authenticated','public.accept_bloomsuite_pos_before_marketing(text,jsonb)','EXECUTE'),'browser cannot bypass signed receiver');
INSERT INTO public.users(id,tenant_id,role) VALUES('f9050000-0000-4000-8000-000000000001','f9030000-0000-4000-8000-000000000001','owner'),('f9050000-0000-4000-8000-000000000002','f9030000-0000-4000-8000-000000000002','owner'),('f9050000-0000-4000-8000-000000000003','f9030000-0000-4000-8000-000000000001','staff');
INSERT INTO auth.sessions(id,user_id) VALUES('f9080000-0000-4000-8000-000000000001','f9050000-0000-4000-8000-000000000001'),('f9080000-0000-4000-8000-000000000002','f9050000-0000-4000-8000-000000000002'),('f9080000-0000-4000-8000-000000000003','f9050000-0000-4000-8000-000000000003');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000001","session_id":"f9080000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.check_that(jsonb_array_length(public.bloomsuite_pos_marketing_workspace())=1,'owner reads only the actual business review queue');
SELECT pg_temp.expect_error($q$SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000071',true,'Verified statement and current withdrawals',false)$q$,'withdrawals','approval requires an explicit review of withdrawals');
SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000071',true,'Verified statement and current withdrawals',true);
SELECT pg_temp.check_that((SELECT email_opt_in=true FROM public.crm_customers WHERE id='f9060000-0000-4000-8000-000000000001'),'review uses real atomic channel writer after authorization');
SELECT pg_temp.check_that((SELECT status='opted_in' FROM public.customer_consents WHERE customer_id='f9060000-0000-4000-8000-000000000001' AND channel='email'),'canonical consent and customer flag are updated together');
SELECT pg_temp.check_that((SELECT evidence->>'note' LIKE '%pos-consent:request-71%' FROM public.crm_email_consent_events WHERE event_type='opt_in'),'original POS proof is retained in the existing consent audit');
SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000071',true,'Verified statement and current withdrawals',true);
SELECT pg_temp.check_that((SELECT count(*)=1 FROM public.crm_email_consent_events),'lost review response is idempotent');
SELECT public.set_customer_marketing_consent_authorized('f9060000-0000-4000-8000-000000000001','email',false,'customer_service',NULL,'Customer withdrew permission today',NULL,NULL);
SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000071',true,'Verified statement and current withdrawals',true);
SELECT pg_temp.check_that((SELECT email_opt_in=false FROM public.crm_customers WHERE id='f9060000-0000-4000-8000-000000000001'),'replayed approval never lifts a later withdrawal');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.accept_bloomsuite_pos_event('qa-bridge',(SELECT envelope FROM captures WHERE seq=72));
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000001","session_id":"f9080000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.expect_error($q$SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000072',true,'Verified statement and current withdrawals',true)$q$,'withdrawal','newer withdrawal blocks an older captured preference');
SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000072',false,'Customer withdrawal is newer than this request',false);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.accept_bloomsuite_pos_event('qa-bridge',(SELECT envelope FROM captures WHERE seq=73));
UPDATE public.crm_customers SET email='changed@example.invalid' WHERE id='f9060000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000001","session_id":"f9080000-0000-4000-8000-000000000001"}',true);
SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000073',false,'Email changed so this evidence must be rejected',false);
SELECT pg_temp.check_that((SELECT state='REJECTED' FROM bloom_pos_private.marketing_requests WHERE event_id='f9010000-0000-4000-8000-000000000073'),'stale identity can be rejected without granting consent');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000002","session_id":"f9080000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.check_that(jsonb_array_length(public.bloomsuite_pos_marketing_workspace())=0,'foreign owner cannot see recorded statements or addresses');
SELECT pg_temp.expect_error($q$SELECT public.review_bloomsuite_pos_marketing('f9010000-0000-4000-8000-000000000071',true,'Verified statement and current withdrawals',true)$q$,'Tenant preference','foreign owner cannot approve a request');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000003","session_id":"f9080000-0000-4000-8000-000000000003"}',true);
SELECT pg_temp.expect_error('SELECT public.bloomsuite_pos_marketing_workspace()','Marketing review access','ordinary staff cannot read this global marketing queue');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f9050000-0000-4000-8000-000000000001","session_id":"f9080000-0000-4000-8000-000000000099"}',true);
SELECT pg_temp.expect_error('SELECT public.bloomsuite_pos_marketing_workspace()','Current staff session','expired or fabricated session cannot review preferences');
SELECT pg_temp.check_that(NOT has_function_privilege('authenticated','public.set_customer_marketing_consent(uuid,text,boolean,text,text,text,text,text)','EXECUTE'),'direct atomic writer remains private');
SELECT jsonb_build_object('passed',count(*),'checks',jsonb_agg(label ORDER BY label)) AS result FROM bridge_checks;
ROLLBACK;
