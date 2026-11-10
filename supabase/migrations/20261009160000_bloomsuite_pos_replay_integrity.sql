-- The POS transports its original DomainEvent inside data, including payload.
-- Forward repair: never rewrite the already-deployed bridge migration.
BEGIN;
ALTER TABLE public.pos_connections DROP CONSTRAINT pos_connections_platform_check;
ALTER TABLE public.pos_connections ADD CONSTRAINT pos_connections_platform_check
 CHECK (platform IN ('shopify','square','vmx','bloomsuite'));
ALTER TABLE bloom_pos_private.customer_links DROP CONSTRAINT customer_links_key_id_crm_customer_id_key;
CREATE INDEX bloomsuite_pos_crm_customer_links ON bloom_pos_private.customer_links(key_id,crm_customer_id);
ALTER TABLE bloom_pos_private.connections ADD COLUMN currency text CHECK (currency IN ('CAD','USD'));
CREATE UNIQUE INDEX bloomsuite_pos_connection_owner ON bloom_pos_private.connections(pos_connection_id);
ALTER TABLE bloom_pos_private.inbox ADD COLUMN subject_id text;
CREATE INDEX bloomsuite_pos_subject_history ON bloom_pos_private.inbox(key_id,event_type,subject_id,revision DESC);
CREATE INDEX bloomsuite_pos_original_returns ON bloom_pos_private.return_events(key_id,original_sale_id);

CREATE FUNCTION bloom_pos_private.event_data(e jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(e#>'{data,payload}')='object' THEN e#>'{data,payload}' ELSE e->'data' END
$$;
REVOKE ALL ON FUNCTION bloom_pos_private.event_data(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION bloom_pos_private.event_time(e jsonb) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (CASE WHEN jsonb_typeof(e#>'{data,payload}')='object' THEN e#>>'{data,occurredAt}' ELSE e->>'occurredAt' END)::timestamptz
$$;
REVOKE ALL ON FUNCTION bloom_pos_private.event_time(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION bloom_pos_private.event_integer(v jsonb,minimum bigint,label text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE n numeric;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION '%',label; END IF;
 n:=(v#>>'{}')::numeric;
 IF n<minimum OR n>9007199254740991 OR n<>trunc(n) THEN RAISE EXCEPTION '%',label; END IF;
 RETURN n::bigint;
END $$;
REVOKE ALL ON FUNCTION bloom_pos_private.event_integer(jsonb,bigint,text) FROM PUBLIC,anon,authenticated;

UPDATE bloom_pos_private.inbox SET subject_id=CASE
 WHEN event_type='ReturnCompleted' THEN bloom_pos_private.event_data(envelope)->>'originalSaleId'
 WHEN event_type IN ('SaleCompleted','VoidCompleted') THEN bloom_pos_private.event_data(envelope)->>'saleId'
 WHEN event_type IN ('CustomerChanged','CustomerIdentityLinked') THEN bloom_pos_private.event_data(envelope)->>'customerId'
 ELSE record_id END;

CREATE OR REPLACE FUNCTION public.bloomsuite_pos_connection(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT jsonb_build_object('keyId',c.key_id,'posTenantId',c.pos_tenant_id,
  'crmTenantId',c.crm_tenant_id,'posConnectionId',c.pos_connection_id,'secret',c.secret)
  FROM bloom_pos_private.connections c JOIN public.pos_connections p ON p.id=c.pos_connection_id
  WHERE c.key_id=p_key AND c.enabled AND c.currency IS NOT NULL
   AND p.tenant_id=c.crm_tenant_id AND p.is_active
   AND p.platform='bloomsuite' AND p.settings->>'provider'='bloomsuite_pos');
END $$;

CREATE OR REPLACE FUNCTION public.accept_bloomsuite_pos_event(p_key text,p_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 c bloom_pos_private.connections; prior bloom_pos_private.inbox;
 sale_row bloom_pos_private.inbox; existing_return bloom_pos_private.return_events;
 eid uuid; rev bigint; kind text; rid text; subject text; data jsonb;
 occurred timestamptz; customer uuid; linked uuid; target uuid; old_link uuid;
 sale_id text; return_id text; cents bigint; refund_cents bigint; refunded_at_value timestamptz;
 payload_currency text; order_id uuid; sale_customer uuid; sale_data jsonb; order_status text;
 stale boolean:=false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Connection service required' USING ERRCODE='42501';
 END IF;
 SELECT b.* INTO c FROM bloom_pos_private.connections b
 JOIN public.pos_connections pc ON pc.id=b.pos_connection_id
 WHERE b.key_id=p_key AND b.enabled AND b.currency IS NOT NULL
  AND pc.tenant_id=b.crm_tenant_id AND pc.is_active
  AND pc.platform='bloomsuite' AND pc.settings->>'provider'='bloomsuite_pos' FOR SHARE OF b,pc;
 IF NOT FOUND THEN RAISE EXCEPTION 'Connection unavailable or tenant mapping is invalid'; END IF;
 IF jsonb_typeof(p_envelope) IS DISTINCT FROM 'object'
  OR p_envelope->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text
  OR p_envelope->>'source' IS DISTINCT FROM 'POS'
  OR p_envelope->'version' IS DISTINCT FROM '1'::jsonb
  OR jsonb_typeof(p_envelope->'data') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_envelope->'revision') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'Invalid BloomSuite POS event scope'; END IF;
 eid:=(p_envelope->>'id')::uuid;
 rev:=bloom_pos_private.event_integer(p_envelope->'revision',1,'Invalid BloomSuite POS event revision');
 kind:=p_envelope->>'type';rid:=p_envelope->>'recordId';
 occurred:=(p_envelope->>'occurredAt')::timestamptz;
 IF eid IS NULL OR coalesce(length(rid),0) NOT BETWEEN 1 AND 200 OR occurred IS NULL OR NOT isfinite(occurred)
  OR kind IS NULL OR kind NOT IN ('SaleCompleted','ReturnCompleted','VoidCompleted','StockMoved',
   'CataloguePriceChanged','CustomerChanged','VariantStockMoved','ReservationChanged',
   'CustomerIdentityLinked','ConsentAuthorityConfigured','CustomerConsentEvidenceReceived',
   'CataloguePhotosChanged','WebOrderFulfillmentChanged')
 THEN RAISE EXCEPTION 'Invalid BloomSuite POS event'; END IF;
 data:=p_envelope->'data';
 IF data ? 'payload' THEN
  IF kind NOT IN ('SaleCompleted','ReturnCompleted','VoidCompleted','StockMoved')
   OR jsonb_typeof(data->'payload') IS DISTINCT FROM 'object'
   OR data->>'type' IS DISTINCT FROM kind OR data->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text
   OR data->'version' IS DISTINCT FROM '1'::jsonb OR (data->>'id')::uuid IS NULL
  THEN RAISE EXCEPTION 'Invalid original POS event scope'; END IF;
  occurred:=(data->>'occurredAt')::timestamptz;
  IF occurred IS NULL OR NOT isfinite(occurred) THEN RAISE EXCEPTION 'Invalid original POS event time'; END IF;
  data:=data->'payload';
 END IF;
 subject:=CASE WHEN kind='ReturnCompleted' THEN data->>'originalSaleId'
  WHEN kind IN ('SaleCompleted','VoidCompleted') THEN data->>'saleId'
  WHEN kind IN ('CustomerChanged','CustomerIdentityLinked') THEN data->>'customerId' ELSE rid END;
 IF coalesce(length(subject),0) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Event subject required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bloomsuite-crm:'||p_key,0));
 SELECT * INTO prior FROM bloom_pos_private.inbox
 WHERE event_id=eid OR (key_id=p_key AND event_type=kind AND record_id=rid AND revision=rev) LIMIT 1;
 IF FOUND THEN
  IF prior.key_id<>p_key OR prior.envelope IS DISTINCT FROM p_envelope THEN RAISE EXCEPTION 'BloomSuite POS retry changed'; END IF;
  RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',true);
 END IF;

 IF kind IN ('SaleCompleted','ReturnCompleted','VoidCompleted') THEN
  sale_id:=subject;
  IF kind='SaleCompleted' THEN
   IF jsonb_typeof(data->'lineItems') IS DISTINCT FROM 'array'
    OR jsonb_typeof(data->'tenders') IS DISTINCT FROM 'array'
    OR jsonb_typeof(data->'totalCents') IS DISTINCT FROM 'number'
    OR jsonb_array_length(data->'lineItems') NOT BETWEEN 1 AND 100
    OR jsonb_array_length(data->'tenders') NOT BETWEEN 1 AND 100
   THEN RAISE EXCEPTION 'Invalid POS sale'; END IF;
   cents:=bloom_pos_private.event_integer(data->'totalCents',0,'Invalid POS sale money');
   payload_currency:=coalesce(data->>'currency',c.currency);
   IF payload_currency IS DISTINCT FROM c.currency THEN RAISE EXCEPTION 'POS currency differs from mapped business'; END IF;
   customer:=NULLIF(data->>'customerId','')::uuid;
   SELECT * INTO prior FROM bloom_pos_private.inbox
    WHERE key_id=p_key AND event_type=kind AND subject_id=subject ORDER BY revision DESC LIMIT 1;
   IF FOUND AND bloom_pos_private.event_data(prior.envelope) IS DISTINCT FROM data THEN
    RAISE EXCEPTION 'A completed sale cannot be replaced by a different sale payload';
   END IF;
  ELSIF kind='ReturnCompleted' THEN
   return_id:=data->>'returnSaleId';
   IF coalesce(length(return_id),0) NOT BETWEEN 1 AND 200 OR return_id=subject
    OR jsonb_typeof(data->'returnAmountCents') IS DISTINCT FROM 'number'
   THEN RAISE EXCEPTION 'Invalid POS return'; END IF;
   cents:=bloom_pos_private.event_integer(data->'returnAmountCents',0,'Invalid POS return money');
   SELECT * INTO existing_return FROM bloom_pos_private.return_events WHERE key_id=p_key AND return_sale_id=return_id;
   IF FOUND AND (existing_return.original_sale_id<>subject OR existing_return.amount_cents<>cents
    OR (SELECT bloom_pos_private.event_data(envelope) FROM bloom_pos_private.inbox WHERE event_id=existing_return.event_id) IS DISTINCT FROM data)
   THEN RAISE EXCEPTION 'A completed return cannot be replaced by a different return payload'; END IF;
  END IF;
 END IF;
 INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope,subject_id)
 VALUES(eid,p_key,kind,rid,rev,p_envelope,subject);

 IF kind IN ('CustomerChanged','CustomerIdentityLinked') THEN
  customer:=subject::uuid;
  SELECT EXISTS(SELECT 1 FROM bloom_pos_private.inbox WHERE key_id=p_key
   AND event_type=kind AND subject_id=subject AND revision>rev) INTO stale;
  IF NOT stale THEN
   linked:=CASE WHEN kind='CustomerChanged' THEN NULLIF(data->>'sharedProfileId','')::uuid
    WHEN data->>'externalSource'='CRM' THEN NULLIF(data->>'externalCustomerId','')::uuid ELSE NULL END;
   IF kind='CustomerChanged' AND NULLIF(data->>'mergedIntoCustomerId','') IS NOT NULL THEN
    target:=(data->>'mergedIntoCustomerId')::uuid;
    SELECT crm_customer_id INTO old_link FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=customer;
    SELECT crm_customer_id INTO linked FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=target;
    IF linked IS NULL OR old_link IS DISTINCT FROM linked THEN RAISE EXCEPTION 'Customer merge requires a reviewed matching CRM identity'; END IF;
   END IF;
   IF linked IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.pos_orders WHERE tenant_id=c.crm_tenant_id AND crm_customer_id=linked AND currency IS DISTINCT FROM c.currency) THEN
     RAISE EXCEPTION 'Customer purchase currencies require review before linking';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.crm_customers cc WHERE cc.id=linked AND cc.tenant_id=c.crm_tenant_id
     AND cc.deleted_at IS NULL AND cc.merged_into_customer_id IS NULL)
    THEN RAISE EXCEPTION 'Shared CRM customer is not active in the mapped business'; END IF;
    SELECT crm_customer_id INTO old_link FROM bloom_pos_private.customer_links WHERE key_id=p_key AND pos_customer_id=customer;
    IF old_link IS NOT NULL AND old_link<>linked THEN RAISE EXCEPTION 'Existing customer link conflicts; review required'; END IF;
    INSERT INTO bloom_pos_private.customer_links(key_id,pos_customer_id,crm_customer_id,source_event_id) VALUES(p_key,customer,linked,eid)
    ON CONFLICT(key_id,pos_customer_id) DO UPDATE SET source_event_id=excluded.source_event_id;
    UPDATE public.pos_orders SET crm_customer_id=linked,customer_resolution_status='linked',customer_resolution_reason=NULL,
     updated_at=clock_timestamp() WHERE pos_connection_id=c.pos_connection_id AND external_customer_id=customer::text;
    PERFORM public.recalculate_purchase_metrics(linked);
   END IF;
  END IF;
 ELSIF kind IN ('SaleCompleted','ReturnCompleted','VoidCompleted') THEN
  IF kind='ReturnCompleted' THEN
   INSERT INTO bloom_pos_private.return_events(event_id,key_id,original_sale_id,return_sale_id,amount_cents,occurred_at)
    VALUES(eid,p_key,subject,return_id,cents,occurred) ON CONFLICT(key_id,return_sale_id) DO NOTHING;
  END IF;
  SELECT * INTO sale_row FROM bloom_pos_private.inbox WHERE key_id=p_key AND event_type='SaleCompleted' AND subject_id=sale_id ORDER BY revision LIMIT 1;
  IF FOUND THEN
   sale_data:=bloom_pos_private.event_data(sale_row.envelope);
   sale_customer:=NULLIF(sale_data->>'customerId','')::uuid;
   SELECT coalesce(sum(amount_cents),0),max(occurred_at) INTO refund_cents,refunded_at_value FROM bloom_pos_private.return_events WHERE key_id=p_key AND original_sale_id=sale_id;
   order_status:=CASE WHEN EXISTS(SELECT 1 FROM bloom_pos_private.inbox WHERE key_id=p_key AND event_type='VoidCompleted' AND subject_id=sale_id) THEN 'voided'
    WHEN refund_cents>0 AND refund_cents>=bloom_pos_private.event_integer(sale_data->'totalCents',0,'Invalid POS sale money') THEN 'refunded' ELSE 'completed' END;
   INSERT INTO public.pos_orders(pos_connection_id,external_id,external_customer_id,order_date,total_amount,currency,status,items,raw_data,tenant_id,provider,refund_amount,refunded_at)
   VALUES(c.pos_connection_id,sale_id,sale_customer::text,bloom_pos_private.event_time(sale_row.envelope),(sale_data->>'totalCents')::numeric/100,
     coalesce(sale_data->>'currency',c.currency),order_status,sale_data->'lineItems',sale_row.envelope,c.crm_tenant_id,'other',refund_cents::numeric/100,refunded_at_value)
   ON CONFLICT(pos_connection_id,external_id) DO UPDATE SET status=excluded.status,refund_amount=excluded.refund_amount,refunded_at=excluded.refunded_at,updated_at=clock_timestamp()
   RETURNING id INTO order_id;
   SELECT l.crm_customer_id INTO linked FROM bloom_pos_private.customer_links l JOIN public.crm_customers cc ON cc.id=l.crm_customer_id AND cc.tenant_id=c.crm_tenant_id
    WHERE l.key_id=p_key AND l.pos_customer_id=sale_customer AND cc.deleted_at IS NULL AND cc.merged_into_customer_id IS NULL;
   UPDATE public.pos_orders SET crm_customer_id=linked,
    customer_resolution_status=CASE WHEN linked IS NOT NULL THEN 'linked' WHEN sale_customer IS NULL THEN 'missing_identity' ELSE 'unmatched' END,
    customer_resolution_reason=CASE WHEN linked IS NULL THEN 'Awaiting a verified BloomSuite POS customer link' ELSE NULL END WHERE id=order_id;
   IF linked IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.pos_orders WHERE tenant_id=c.crm_tenant_id AND crm_customer_id=linked AND currency IS DISTINCT FROM c.currency) THEN
     RAISE EXCEPTION 'Customer purchase currencies require review before linking';
    END IF;
    PERFORM public.recalculate_purchase_metrics(linked);
   END IF;
  END IF;
 END IF;
 UPDATE public.pos_connections SET last_sync_at=clock_timestamp(),sync_status='success',sync_error=NULL WHERE id=c.pos_connection_id;
 RETURN jsonb_build_object('accepted',true,'eventId',eid,'duplicate',false,'stale',stale);
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_pos_connection(text),public.accept_bloomsuite_pos_event(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_pos_connection(text),public.accept_bloomsuite_pos_event(text,jsonb) TO service_role;
COMMIT;
