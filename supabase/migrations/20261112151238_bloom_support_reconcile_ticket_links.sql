-- A person may detach one mistaken duplicate association, not merge/unmerge,
-- approve a feature, dispatch a repair, or replace it with an inferred target.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
CREATE TABLE bloom_support.ticket_link_reconciliation_receipts (
  actor_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, request_key)
);
ALTER TABLE bloom_support.ticket_link_reconciliation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.ticket_link_reconciliation_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bloom_support_reconcile_ticket_links(p_actor uuid, p_ticket uuid, p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets; target bloom_support.tickets;
  receipt bloom_support.ticket_link_reconciliation_receipts;
  deleted_edge jsonb; previous_version integer;
  expected jsonb := p_request->'expected'; actual jsonb; result jsonb;
  clear_fields jsonb := p_request->'clear_inherited'; field text;
  v_request_key text := p_request->>'idempotency_key'; target_id uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF NOT bloom_support.is_staff(p_actor) OR NOT EXISTS (
    SELECT 1 FROM bloom_support.principals WHERE id=p_actor AND active AND kind='user'
  ) THEN RAISE EXCEPTION 'forbidden: a staff person must reconcile ticket links' USING ERRCODE='42501'; END IF;
  PERFORM bloom_support.require_ticket(p_actor,p_ticket);
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR octet_length(p_request::text)>10000
    OR jsonb_typeof(p_request->'idempotency_key') IS DISTINCT FROM 'string'
    OR v_request_key IS NULL OR length(v_request_key) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_request->'version') IS DISTINCT FROM 'number'
    OR coalesce(p_request->>'version','') !~ '^[1-9][0-9]*$'
    OR jsonb_typeof(p_request->'reason') IS DISTINCT FROM 'string'
    OR length(btrim(p_request->>'reason')) NOT BETWEEN 1 AND 2000
    OR jsonb_typeof(p_request->'next_action') IS DISTINCT FROM 'string'
    OR length(btrim(p_request->>'next_action')) NOT BETWEEN 1 AND 1000
    OR jsonb_typeof(expected) IS DISTINCT FROM 'object'
    OR jsonb_typeof(clear_fields) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid: version, full expected links, explicit inherited fields, reason, pending next action and request key required' USING ERRCODE='22023'; END IF;
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(expected) k)
      IS DISTINCT FROM ARRAY['duplicate_of','engineering_issue_id','feature_request_id','merged_into','problem_id']::text[]
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN ('version','expected','clear_inherited','reason','next_action','idempotency_key'))
    OR jsonb_typeof(expected->'duplicate_of') IS DISTINCT FROM 'string'
    OR coalesce(expected->>'duplicate_of','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    OR jsonb_array_length(clear_fields)>3
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(clear_fields) x WHERE jsonb_typeof(x)<>'string' OR x #>> '{}' NOT IN ('problem_id','engineering_issue_id','feature_request_id'))
    OR (SELECT count(*) FROM jsonb_array_elements(clear_fields)) <> (SELECT count(DISTINCT x) FROM jsonb_array_elements(clear_fields) x)
  THEN RAISE EXCEPTION 'invalid: exact link tuple and supported distinct inherited fields required' USING ERRCODE='22023'; END IF;
  target_id := (expected->>'duplicate_of')::uuid;
  PERFORM bloom_support.require_ticket(p_actor,target_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ticket-links:'||p_actor::text||':'||v_request_key,0));
  SELECT * INTO receipt FROM bloom_support.ticket_link_reconciliation_receipts r WHERE r.actor_id=p_actor AND r.request_key=v_request_key;
  IF FOUND THEN
    IF receipt.ticket_id IS DISTINCT FROM p_ticket OR receipt.request IS DISTINCT FROM p_request THEN
      RAISE EXCEPTION 'conflict: reconciliation key reused with changed request' USING ERRCODE='23505';
    END IF;
    RETURN receipt.result;
  END IF;
  -- Stable row order for opposite-direction requests. No relation is changed
  -- until the full reviewed source tuple and exact duplicate edge are checked.
  PERFORM id FROM bloom_support.tickets WHERE id IN (p_ticket,target_id) ORDER BY id FOR UPDATE;
  t := bloom_support.require_ticket(p_actor,p_ticket);
  target := bloom_support.require_ticket(p_actor,target_id);
  actual := jsonb_build_object('duplicate_of',t.duplicate_of,'merged_into',t.merged_into,
    'problem_id',t.problem_id,'engineering_issue_id',t.engineering_issue_id,'feature_request_id',t.feature_request_id);
  IF t.version::text IS DISTINCT FROM p_request->>'version' OR actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'conflict: reviewed ticket links or version changed' USING ERRCODE='40001';
  END IF;
  IF t.merged_into IS NOT NULL OR t.status='resolved' OR t.spam OR t.redacted_at IS NOT NULL OR target.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: only an active unmerged duplicate can be reconciled' USING ERRCODE='40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bloom_support.ticket_links WHERE from_ticket=t.id AND to_ticket=target.id AND kind='duplicate') THEN
    RAISE EXCEPTION 'conflict: expected duplicate relation is missing' USING ERRCODE='40001';
  END IF;
  FOR field IN SELECT jsonb_array_elements_text(clear_fields) LOOP
    IF actual->field = 'null'::jsonb OR actual->field IS DISTINCT FROM to_jsonb(target)->field THEN
      RAISE EXCEPTION 'conflict: selected link is not the duplicate target association: %',field USING ERRCODE='40001';
    END IF;
    -- These explicit independent associations cannot be inferred to be wrong
    -- just because the same UUID also occurs on the duplicate target.
    IF EXISTS (SELECT 1 FROM bloom_support.activity a WHERE a.ticket_id=t.id AND
      ((field='problem_id' AND a.action='problem.linked' AND a.detail->'problem_id'=actual->field)
       OR (field='engineering_issue_id' AND a.action='engineering.linked' AND a.detail->'engineering_issue_id'=actual->field)
       OR (field='feature_request_id' AND a.action='feature.routed' AND a.detail->'feature_request_id'=actual->field)))
      OR (field='feature_request_id' AND (
        EXISTS (SELECT 1 FROM bloom_support.feature_evidence WHERE ticket_id=t.id AND feature_request_id=t.feature_request_id)
        OR EXISTS (SELECT 1 FROM bloom_support.feature_shipment_subscriptions WHERE ticket_id=t.id AND feature_request_id=t.feature_request_id)))
    THEN RAISE EXCEPTION 'conflict: selected link has independent evidence; review separately' USING ERRCODE='40001'; END IF;
  END LOOP;
  -- Do not leave an explicitly retained shared problem pointing back at the
  -- supposedly removed engineering association.
  IF clear_fields ? 'engineering_issue_id' AND NOT clear_fields ? 'problem_id' AND EXISTS (
    SELECT 1 FROM bloom_support.problems WHERE id=t.problem_id AND engineering_issue_id=t.engineering_issue_id
  ) THEN RAISE EXCEPTION 'conflict: retained problem still links this engineering issue' USING ERRCODE='40001'; END IF;
  previous_version := t.version;
  DELETE FROM bloom_support.ticket_links AS link WHERE from_ticket=t.id AND to_ticket=target.id AND kind='duplicate'
    RETURNING to_jsonb(link) INTO deleted_edge;
  IF deleted_edge IS NULL THEN
    RAISE EXCEPTION 'conflict: expected duplicate relation changed' USING ERRCODE='40001';
  END IF;
  UPDATE bloom_support.tickets SET duplicate_of=NULL,
    problem_id=CASE WHEN clear_fields ? 'problem_id' THEN NULL ELSE problem_id END,
    engineering_issue_id=CASE WHEN clear_fields ? 'engineering_issue_id' THEN NULL ELSE engineering_issue_id END,
    feature_request_id=CASE WHEN clear_fields ? 'feature_request_id' THEN NULL ELSE feature_request_id END,
    next_action=p_request->>'next_action', version=version+1, updated_at=now()
  WHERE id=t.id RETURNING version INTO t.version;
  result := jsonb_build_object('ticket_id',t.id,'version',t.version,'detached_duplicate',target.id,'cleared_inherited',clear_fields);
  PERFORM bloom_support.log(t.id,t.account_id,p_actor,'ticket.links_reconciled',jsonb_build_object(
    'before',actual,'deleted_edge',deleted_edge,'previous_next_action',t.next_action,'previous_version',previous_version,'cleared_inherited',clear_fields,'reason',p_request->>'reason','next_action',p_request->>'next_action','version',t.version));
  INSERT INTO bloom_support.ticket_link_reconciliation_receipts(actor_id,request_key,ticket_id,request,result)
    VALUES(p_actor,v_request_key,t.id,p_request,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_reconcile_ticket_links(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_reconcile_ticket_links(uuid,uuid,jsonb) TO service_role;
