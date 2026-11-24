BEGIN;
DO $qa$
DECLARE t uuid:=gen_random_uuid(); actor uuid; conn uuid:=gen_random_uuid(); variant uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); site uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); email text; sale text:='qa-'||gen_random_uuid()::text; k text:='qa_'||replace(gen_random_uuid()::text,'-',''); n integer;
BEGIN
 SELECT id INTO actor FROM auth.users LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Missing test actor'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 email:='care-qa-'||replace(buyer::text,'-','')||'@northfieldgardens.ca';
 INSERT INTO public.tenants(id,name) VALUES(t,'ROLLBACK ONLY care QA');
 INSERT INTO public.crm_customers(id,tenant_id,email,email_opt_in,email_opt_in_at,opt_out,suppressed) VALUES(buyer,t,email,true,now()-interval '3 days',false,false);
 INSERT INTO public.pos_connections(id,user_id,tenant_id,platform,name,is_active) VALUES(conn,actor,t,'bloomsuite','ROLLBACK ONLY',true);
 INSERT INTO bloom_pos_private.connections(key_id,pos_tenant_id,crm_tenant_id,pos_connection_id,secret,enabled,currency) VALUES(k,gen_random_uuid(),t,conn,repeat('x',64),true,'CAD');
 INSERT INTO public.pos_orders(pos_connection_id,external_id,order_date,tenant_id,status,items,provider) VALUES(conn,sale,now()-interval '2 days',t,'completed',jsonb_build_array(jsonb_build_object('catalogueItemId',variant,'quantity',1,'name','QA plant')),'other');
 -- Mirror the native bridge's reviewed identity resolution after INSERT.
 UPDATE public.pos_orders SET crm_customer_id=buyer,customer_resolution_status='linked',customer_resolution_reason=NULL WHERE pos_connection_id=conn AND external_id=sale;
 INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope,subject_id) VALUES(gen_random_uuid(),k,'SaleCompleted',sale,1,'{}',sale);
 SELECT count(*) INTO n FROM bloom_pos_private.care_followup_buyers(t,conn,variant,now()-interval '7 days',now()-interval '1 day'); IF n<>0 THEN RAISE EXCEPTION 'No evidence consent was admitted'; END IF;
 INSERT INTO public.crm_email_consent_events(tenant_id,customer_id,email,event_type,source,consent_basis,created_at) VALUES(t,buyer,email,'opt_in','qa_rollback','express',now()-interval '3 days');
 SELECT count(*) INTO n FROM bloom_pos_private.care_followup_buyers(t,conn,variant,now()-interval '7 days',now()-interval '1 day'); IF n<>1 THEN RAISE EXCEPTION 'Eligible POS buyer not admitted: %',n; END IF;
 SELECT count(*) INTO n FROM bloom_pos_private.care_followup_buyers(t,conn,gen_random_uuid(),now()-interval '7 days',now()-interval '1 day'); IF n<>0 THEN RAISE EXCEPTION 'Wrong product admitted'; END IF;
 INSERT INTO public.crm_storefront_tenant_links(storefront_site_id,crm_tenant_id,enabled,reviewed_by,reviewed_at) VALUES(site,t,true,actor,now());
 INSERT INTO public.crm_connected_websites(tenant_id,cms_site_id,site_name,site_origin,status,linked_by) VALUES(t,site,'QA only','https://northfieldgardens.ca','active',actor);
 INSERT INTO public.crm_storefront_customer_links(tenant_id,storefront_site_id,storefront_user_id,source_email,crm_customer_id,status,evidence_ref,reviewed_by,reviewed_at) VALUES(t,site,u,email,buyer,'verified','QA rollback fixture',actor,now());
 SELECT count(*) INTO n FROM bloom_pos_private.website_care_candidates(t,site); IF n<>1 THEN RAISE EXCEPTION 'Verified online candidate not admitted: %',n; END IF;
 UPDATE public.crm_storefront_customer_links SET status='revoked' WHERE tenant_id=t;
 SELECT count(*) INTO n FROM bloom_pos_private.website_care_candidates(t,site); IF n<>0 THEN RAISE EXCEPTION 'Revoked website identity admitted'; END IF;
 UPDATE public.pos_orders SET refund_amount=1 WHERE tenant_id=t;
 SELECT count(*) INTO n FROM bloom_pos_private.care_followup_buyers(t,conn,variant,now()-interval '7 days',now()-interval '1 day'); IF n<>0 THEN RAISE EXCEPTION 'Refunded purchase admitted'; END IF;
 UPDATE public.pos_orders SET refund_amount=0 WHERE tenant_id=t;
 INSERT INTO public.crm_email_consent_events(tenant_id,customer_id,email,event_type,source,consent_basis,created_at) VALUES(t,buyer,email,'opt_out','qa_rollback','revoked',now());
 SELECT count(*) INTO n FROM bloom_pos_private.care_followup_buyers(t,conn,variant,now()-interval '7 days',now()-interval '1 day'); IF n<>0 THEN RAISE EXCEPTION 'Withdrawn consent admitted'; END IF;
END $qa$;
SELECT 'PASS: native order location, explicit opt-in, exact variant, verified web identity, revoked linkage, refund, withdrawal' AS result;
ROLLBACK;
