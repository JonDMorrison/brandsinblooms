-- BloomSuite POS -> CRM signed event bridge.
-- A connection is provisioned server-side only after the POS tenant and CRM tenant
-- are explicitly mapped. Incoming events are retained before projection so a
-- missing customer mapping never causes a sale to disappear.

CREATE SCHEMA IF NOT EXISTS bloom_pos_private;
REVOKE ALL ON SCHEMA bloom_pos_private FROM PUBLIC, anon, authenticated;

CREATE TABLE bloom_pos_private.connections (
  key_id text PRIMARY KEY CHECK (key_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  pos_tenant_id uuid NOT NULL,
  crm_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pos_connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  secret text NOT NULL CHECK (length(secret) >= 32),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (pos_tenant_id, crm_tenant_id)
);

CREATE TABLE bloom_pos_private.inbox (
  event_id uuid PRIMARY KEY,
  key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  record_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  envelope jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (key_id, event_type, record_id, revision)
);

CREATE TABLE bloom_pos_private.customer_links (
  key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id) ON DELETE CASCADE,
  pos_customer_id uuid NOT NULL,
  crm_customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  source_event_id uuid NOT NULL REFERENCES bloom_pos_private.inbox(event_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (key_id, pos_customer_id),
  UNIQUE (key_id, crm_customer_id)
);

CREATE TABLE bloom_pos_private.return_events (
  event_id uuid PRIMARY KEY REFERENCES bloom_pos_private.inbox(event_id) ON DELETE CASCADE,
  key_id text NOT NULL REFERENCES bloom_pos_private.connections(key_id) ON DELETE CASCADE,
  original_sale_id text NOT NULL,
  return_sale_id text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  occurred_at timestamptz NOT NULL,
  UNIQUE (key_id, return_sale_id)
);

ALTER TABLE bloom_pos_private.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_pos_private.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_pos_private.customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_pos_private.return_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA bloom_pos_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bloomsuite_pos_connection(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Connection service required';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'keyId', key_id,
      'posTenantId', pos_tenant_id,
      'crmTenantId', crm_tenant_id,
      'posConnectionId', pos_connection_id,
      'secret', secret
    )
    FROM bloom_pos_private.connections
    WHERE key_id = p_key AND enabled
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bloomsuite_pos_connection(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_pos_connection(text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_bloomsuite_pos_event(p_key text, p_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c bloom_pos_private.connections;
  prior bloom_pos_private.inbox;
  eid uuid;
  rev bigint;
  kind text;
  rid text;
  occurred timestamptz;
  data jsonb;
  customer uuid;
  linked_customer uuid;
  sale_id text;
  original_sale text;
  refund_total bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Connection service required';
  END IF;

  SELECT * INTO c
  FROM bloom_pos_private.connections
  WHERE key_id = p_key AND enabled
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connection unavailable'; END IF;

  IF p_envelope->>'tenantId' IS DISTINCT FROM c.pos_tenant_id::text
     OR p_envelope->>'source' IS DISTINCT FROM 'POS'
     OR p_envelope->'version' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(p_envelope->'data') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_envelope->'revision') IS DISTINCT FROM 'number'
  THEN
    RAISE EXCEPTION 'Invalid BloomSuite POS event scope';
  END IF;

  eid := (p_envelope->>'id')::uuid;
  rev := (p_envelope->>'revision')::bigint;
  kind := p_envelope->>'type';
  rid := p_envelope->>'recordId';
  occurred := (p_envelope->>'occurredAt')::timestamptz;
  data := p_envelope->'data';

  IF eid IS NULL OR rev IS NULL OR rev < 1 OR rev > 9007199254740991
     OR p_envelope->'revision' IS DISTINCT FROM to_jsonb(rev)
     OR rid IS NULL OR length(rid) > 200 OR occurred IS NULL
     OR kind NOT IN (
       'SaleCompleted','ReturnCompleted','VoidCompleted','StockMoved',
       'CataloguePriceChanged','CustomerChanged','VariantStockMoved',
       'ReservationChanged','CustomerIdentityLinked','ConsentAuthorityConfigured',
       'CustomerConsentEvidenceReceived','CataloguePhotosChanged'
     )
  THEN
    RAISE EXCEPTION 'Invalid BloomSuite POS event';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_key || ':' || kind || ':' || rid, 0));
  SELECT * INTO prior
  FROM bloom_pos_private.inbox
  WHERE event_id = eid OR (key_id = p_key AND event_type = kind AND record_id = rid AND revision = rev)
  LIMIT 1;
  IF FOUND THEN
    IF prior.key_id <> p_key OR prior.envelope IS DISTINCT FROM p_envelope THEN
      RAISE EXCEPTION 'BloomSuite POS retry changed';
    END IF;
    RETURN jsonb_build_object('accepted', true, 'eventId', eid, 'duplicate', true);
  END IF;

  INSERT INTO bloom_pos_private.inbox(event_id,key_id,event_type,record_id,revision,envelope)
  VALUES(eid,p_key,kind,rid,rev,p_envelope);

  IF kind = 'CustomerChanged' THEN
    customer := NULLIF(data->>'customerId','')::uuid;
    linked_customer := NULLIF(data->>'sharedProfileId','')::uuid;
    IF customer IS NOT NULL AND linked_customer IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.crm_customers cc
         WHERE cc.id = linked_customer
           AND cc.tenant_id = c.crm_tenant_id
           AND cc.deleted_at IS NULL
       )
    THEN
      INSERT INTO bloom_pos_private.customer_links(key_id,pos_customer_id,crm_customer_id,source_event_id)
      VALUES(p_key,customer,linked_customer,eid)
      ON CONFLICT(key_id,pos_customer_id) DO UPDATE
        SET source_event_id = EXCLUDED.source_event_id
      WHERE bloom_pos_private.customer_links.crm_customer_id = EXCLUDED.crm_customer_id;

      UPDATE public.pos_orders o
      SET crm_customer_id = linked_customer,
          customer_resolution_status = 'linked',
          customer_resolution_reason = NULL,
          updated_at = clock_timestamp()
      WHERE o.pos_connection_id = c.pos_connection_id
        AND o.external_customer_id = customer::text;
    END IF;

  ELSIF kind = 'SaleCompleted' THEN
    sale_id := NULLIF(data->>'saleId','');
    IF sale_id IS NULL
       OR jsonb_typeof(data->'lineItems') IS DISTINCT FROM 'array'
       OR jsonb_typeof(data->'tenders') IS DISTINCT FROM 'array'
       OR (data->>'totalCents') !~ '^[0-9]+$'
       OR (data->>'currency') NOT IN ('CAD','USD')
    THEN RAISE EXCEPTION 'Invalid POS sale'; END IF;

    customer := NULLIF(data->>'customerId','')::uuid;

    INSERT INTO public.pos_orders(
      pos_connection_id, external_id, external_customer_id, order_date,
      total_amount, currency, status, items, raw_data, tenant_id, provider
    ) VALUES(
      c.pos_connection_id, sale_id, customer::text, occurred,
      ((data->>'totalCents')::numeric / 100), data->>'currency', 'completed',
      data->'lineItems', p_envelope, c.crm_tenant_id, 'other'
    )
    ON CONFLICT(pos_connection_id,external_id) DO UPDATE
      SET order_date = EXCLUDED.order_date,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          status = CASE WHEN public.pos_orders.status = 'voided' THEN 'voided' ELSE EXCLUDED.status END,
          items = EXCLUDED.items,
          raw_data = EXCLUDED.raw_data,
          updated_at = clock_timestamp();

    SELECT l.crm_customer_id INTO linked_customer
    FROM bloom_pos_private.customer_links l
    WHERE l.key_id = p_key AND l.pos_customer_id = customer;
    IF linked_customer IS NOT NULL THEN
      UPDATE public.pos_orders
      SET crm_customer_id = linked_customer,
          customer_resolution_status = 'linked',
          customer_resolution_reason = NULL,
          updated_at = clock_timestamp()
      WHERE pos_connection_id = c.pos_connection_id AND external_id = sale_id;
    END IF;

  ELSIF kind = 'ReturnCompleted' THEN
    original_sale := NULLIF(data->>'originalSaleId','');
    sale_id := NULLIF(data->>'returnSaleId','');
    IF original_sale IS NULL OR sale_id IS NULL OR (data->>'returnAmountCents') !~ '^[0-9]+$'
    THEN RAISE EXCEPTION 'Invalid POS return'; END IF;

    INSERT INTO bloom_pos_private.return_events(event_id,key_id,original_sale_id,return_sale_id,amount_cents,occurred_at)
    VALUES(eid,p_key,original_sale,sale_id,(data->>'returnAmountCents')::bigint,occurred)
    ON CONFLICT DO NOTHING;

    SELECT coalesce(sum(amount_cents),0) INTO refund_total
    FROM bloom_pos_private.return_events
    WHERE key_id = p_key AND original_sale_id = original_sale;

    UPDATE public.pos_orders
    SET refund_amount = refund_total::numeric / 100,
        refunded_at = occurred,
        status = CASE
          WHEN total_amount IS NOT NULL AND refund_total::numeric / 100 >= total_amount THEN 'refunded'
          ELSE status
        END,
        updated_at = clock_timestamp()
    WHERE pos_connection_id = c.pos_connection_id AND external_id = original_sale;

  ELSIF kind = 'VoidCompleted' THEN
    sale_id := NULLIF(data->>'saleId','');
    IF sale_id IS NULL THEN RAISE EXCEPTION 'Invalid POS void'; END IF;
    UPDATE public.pos_orders
    SET status = 'voided', updated_at = clock_timestamp()
    WHERE pos_connection_id = c.pos_connection_id AND external_id = sale_id;
  END IF;

  RETURN jsonb_build_object('accepted', true, 'eventId', eid, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_bloomsuite_pos_event(text,jsonb) TO service_role;
