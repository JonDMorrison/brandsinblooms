-- Queue the reviewed reply and resolve in one transaction. No external email
-- call runs here; existing workers can see the outbox only after commit.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE TABLE bloom_support.reviewed_closure_receipts (
  actor_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id, request_key)
);
ALTER TABLE bloom_support.reviewed_closure_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.reviewed_closure_receipts FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.bloom_support_send_and_solve(p_actor uuid, p_ticket uuid, p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; receipt bloom_support.reviewed_closure_receipts;
  sent jsonb; result jsonb; evidence jsonb; current_version integer; v_key text := p_request->>'idempotency_key';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF NOT bloom_support.is_staff(p_actor) OR bloom_support.principal_role(p_actor) = 'service' THEN
    RAISE EXCEPTION 'forbidden: a person must approve the closing reply' USING ERRCODE = '42501';
  END IF;
  t := bloom_support.require_ticket(p_actor,p_ticket);
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR octet_length(p_request::text)>100000
    OR jsonb_typeof(p_request->'idempotency_key') IS DISTINCT FROM 'string'
    OR v_key IS NULL OR length(v_key) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_request->'version') IS DISTINCT FROM 'number'
    OR coalesce(p_request->>'version','') !~ '^[1-9][0-9]*$'
    OR jsonb_typeof(p_request->'body') IS DISTINCT FROM 'string'
    OR length(btrim(p_request->>'body')) NOT BETWEEN 1 AND 20000
    OR jsonb_typeof(p_request->'resolution_evidence') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid: reviewed closure requires bounded reply, version, evidence and request key' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-close:'||p_actor::text||':'||v_key,0));
  SELECT * INTO receipt FROM bloom_support.reviewed_closure_receipts WHERE actor_id=p_actor AND reviewed_closure_receipts.request_key=v_key;
  IF FOUND THEN
    IF receipt.ticket_id IS DISTINCT FROM p_ticket OR receipt.request IS DISTINCT FROM p_request THEN
      RAISE EXCEPTION 'conflict: closure key reused with changed request' USING ERRCODE='23505';
    END IF;
    RETURN receipt.result;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('message:reviewed-close:'||p_actor::text||':'||v_key,0));
  SELECT * INTO t FROM bloom_support.tickets WHERE id=p_ticket FOR UPDATE;
  PERFORM bloom_support.require_ticket(p_actor,p_ticket);
  IF t.version::text IS DISTINCT FROM p_request->>'version' THEN
    RAISE EXCEPTION 'conflict: reviewed ticket changed' USING ERRCODE='40001';
  END IF;
  IF t.status='resolved' OR t.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: request already resolved or merged' USING ERRCODE='40001';
  END IF;
  sent := bloom_support.add_message(p_actor,p_ticket,jsonb_build_object(
    'body',p_request->>'body','visibility','public','purpose','reply',
    'idempotency_key','reviewed-close:'||p_actor::text||':'||v_key));
  -- add_message can change owner/status/version. Only its own changes occurred
  -- while this transaction held the ticket lock; do not reuse a stale version.
  SELECT version INTO current_version FROM bloom_support.tickets WHERE id=p_ticket;
  evidence := (p_request->'resolution_evidence') || jsonb_build_object('via','send-and-solve','reply_message_id',sent->>'message_id');
  PERFORM bloom_support.update_ticket(p_actor,p_ticket,jsonb_build_object(
    'version',current_version,'status','resolved','resolution_summary',p_request->>'resolution_summary','resolution_evidence',evidence));
  result := jsonb_build_object('message_id',sent->>'message_id','status','resolved');
  INSERT INTO bloom_support.reviewed_closure_receipts(actor_id,request_key,ticket_id,request,result)
    VALUES(p_actor,v_key,p_ticket,p_request,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_send_and_solve(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_send_and_solve(uuid,uuid,jsonb) TO service_role;
