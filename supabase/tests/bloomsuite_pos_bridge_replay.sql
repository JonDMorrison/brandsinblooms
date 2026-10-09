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
SELECT pg_temp.check_that(NOT has_function_privilege('anon','public.accept_bloomsuite_pos_event(text,jsonb)','EXECUTE'),'anonymous cannot apply events');
SELECT pg_temp.check_that(NOT has_function_privilege('authenticated','public.bloomsuite_pos_connection(text)','EXECUTE'),'browser cannot read signing key');
SELECT pg_temp.check_that(public.bloomsuite_pos_connection('qa-bridge')->>'keyId'='qa-bridge','explicit mapping resolves');

DO $$ DECLARE e jsonb; ret jsonb; BEGIN
 ret:=pg_temp.envelope(10,'ReturnCompleted','{"originalSaleId":"sale-1","returnSaleId":"return-1","returnAmountCents":300}',true);
 PERFORM pg_temp.check_that(public.accept_bloomsuite_pos_event('qa-bridge',ret)->>'accepted'='true','return before sale retained');
 PERFORM pg_temp.check_that((SELECT count(*)=0 FROM public.pos_orders),'return cannot invent a sale');
 e:=pg_temp.envelope(20,'SaleCompleted',pg_temp.sale('sale-1','f9070000-0000-4000-8000-000000000001'),true);
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',e);
 PERFORM pg_temp.check_that((SELECT total_amount=10 AND refund_amount=3 AND status='completed' FROM public.pos_orders WHERE external_id='sale-1'),'nested sale and earlier partial return reconcile');
 PERFORM pg_temp.check_that((SELECT order_date='2026-10-08T12:00:00Z'::timestamptz FROM public.pos_orders WHERE external_id='sale-1'),'offline original sale time preserved');
 PERFORM pg_temp.check_that((SELECT raw_data=e FROM public.pos_orders WHERE external_id='sale-1'),'original signed envelope retained');
 PERFORM pg_temp.check_that(public.accept_bloomsuite_pos_event('qa-bridge',e)->>'duplicate'='true','lost sale receipt can be retried');
 PERFORM pg_temp.check_that(public.accept_bloomsuite_pos_event('qa-bridge',ret)->>'duplicate'='true','lost return receipt can be retried');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(21,'ReturnCompleted',ret#>'{data,payload}',true));
 PERFORM pg_temp.check_that((SELECT refund_amount=3 FROM public.pos_orders WHERE external_id='sale-1'),'semantic return replay does not double refund');
 PERFORM pg_temp.check_that((SELECT count(*)=1 FROM bloom_pos_private.return_events),'one return ledger fact');
 PERFORM pg_temp.check_that((SELECT crm_customer_id IS NULL AND customer_resolution_status='unmatched' FROM public.pos_orders WHERE external_id='sale-1'),'unknown customer stays unmatched');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(30,'CustomerChanged','{"customerId":"f9070000-0000-4000-8000-000000000001","sharedProfileId":"f9060000-0000-4000-8000-000000000001"}'));
 PERFORM pg_temp.check_that((SELECT crm_customer_id='f9060000-0000-4000-8000-000000000001' FROM public.pos_orders WHERE external_id='sale-1'),'late verified identity links existing purchase');
 PERFORM pg_temp.check_that((SELECT total_purchases=1 AND lifetime_value=7 FROM public.customer_purchase_metrics WHERE customer_id='f9060000-0000-4000-8000-000000000001'),'existing metric engine uses net purchase facts');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(29,'CustomerChanged','{"customerId":"f9070000-0000-4000-8000-000000000001","sharedProfileId":"f9060000-0000-4000-8000-000000000002"}'));
 PERFORM pg_temp.check_that((SELECT crm_customer_id='f9060000-0000-4000-8000-000000000001' FROM public.pos_orders WHERE external_id='sale-1'),'older identity cannot change latest link');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(40,'VoidCompleted','{"saleId":"sale-2","hadTenders":true}',true));
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(41,'SaleCompleted',pg_temp.sale('sale-2'),true));
 PERFORM pg_temp.check_that((SELECT status='voided' FROM public.pos_orders WHERE external_id='sale-2'),'void before sale remains voided');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(42,'ReturnCompleted','{"originalSaleId":"sale-1","returnSaleId":"return-2","returnAmountCents":700}',true));
 PERFORM pg_temp.check_that((SELECT status='refunded' AND refund_amount=10 FROM public.pos_orders WHERE external_id='sale-1'),'full return reconciles to refunded');
 PERFORM pg_temp.check_that((SELECT lifetime_value=0 FROM public.customer_purchase_metrics WHERE customer_id='f9060000-0000-4000-8000-000000000001'),'refund recomputes metrics without incrementing counters');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(43,'SaleCompleted',e#>'{data,payload}',true));
 PERFORM pg_temp.check_that((SELECT status='refunded' AND refund_amount=10 FROM public.pos_orders WHERE external_id='sale-1'),'late sale replay cannot erase refunds');
 PERFORM pg_temp.check_that((SELECT bool_and(NOT email_opt_in AND NOT sms_opt_in) FROM public.crm_customers),'no marketing consent inferred');
 PERFORM public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(44,'WebOrderFulfillmentChanged','{"orderId":"test-web-order"}'));
 PERFORM pg_temp.check_that((SELECT count(*)=2 FROM public.pos_orders),'unrelated acknowledged event cannot manufacture a sale');
 PERFORM pg_temp.check_that((SELECT sync_status='success' AND last_sync_at IS NOT NULL FROM public.pos_connections WHERE id='f9040000-0000-4000-8000-000000000001'),'visible connection sync status uses valid schema value');
END $$;
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(51,'CustomerChanged','{"customerId":"f9070000-0000-4000-8000-000000000001","sharedProfileId":"f9060000-0000-4000-8000-000000000002"}'))$q$,'Existing customer link conflicts','conflicting new link rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(52,'CustomerChanged','{"customerId":"f9070000-0000-4000-8000-000000000002","sharedProfileId":"f9060000-0000-4000-8000-000000000003"}'))$q$,'mapped business','foreign tenant identity rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(53,'SaleCompleted',pg_temp.sale('sale-1')||'{"totalCents":2000}',true))$q$,'cannot be replaced','changed completed sale rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(54,'ReturnCompleted','{"originalSaleId":"sale-1","returnSaleId":"return-1","returnAmountCents":301}',true))$q$,'cannot be replaced','changed semantic return rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(55,'SaleCompleted',pg_temp.sale('currency-error',NULL,'USD'),true))$q$,'currency differs','foreign currency rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(56,'SaleCompleted',pg_temp.sale('null-money')||'{"totalCents":null}',true))$q$,'Invalid POS sale','null money rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(57,'SaleCompleted',pg_temp.sale('fraction-money')||'{"totalCents":1.5}',true))$q$,'Invalid POS sale money','fractional cents rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',jsonb_set(pg_temp.envelope(58,'SaleCompleted',pg_temp.sale('nested-tenant'),true),'{data,tenantId}','"f9020000-0000-4000-8000-000000000002"'))$q$,'original POS event scope','nested tenant substitution rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(59,'SaleCompleted',pg_temp.sale('outer-tenant'),true)||'{"tenantId":"f9020000-0000-4000-8000-000000000002"}')$q$,'event scope','outer tenant substitution rejected');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(60,'SaleCompleted',pg_temp.sale('fraction-revision'),true)||'{"revision":1.5}')$q$,'Invalid BloomSuite POS event','fractional revision rejected');
SELECT pg_temp.check_that((SELECT count(*)=0 FROM bloom_pos_private.inbox WHERE revision BETWEEN 51 AND 60),'rejections roll back inbox and projections');
UPDATE public.pos_connections SET tenant_id='f9030000-0000-4000-8000-000000000002' WHERE id='f9040000-0000-4000-8000-000000000001';
SELECT pg_temp.check_that(public.bloomsuite_pos_connection('qa-bridge') IS NULL,'mismatched connection ownership fails closed');
SELECT pg_temp.expect_error($q$SELECT public.accept_bloomsuite_pos_event('qa-bridge',pg_temp.envelope(61,'SaleCompleted',pg_temp.sale('bad-binding'),true))$q$,'mapping is invalid','receiver enforces connection ownership');
SELECT jsonb_build_object('passed',count(*),'checks',jsonb_agg(label ORDER BY label)) AS result FROM bridge_checks;
ROLLBACK;
