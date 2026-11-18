-- Manual evidence only. No mailbox access, outbound message, closure or repair.
CREATE TABLE bloom_support.external_response_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  mailbox text NOT NULL,
  provider_message_id text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  actor_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  sent_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL,
  result jsonb NOT NULL,
  UNIQUE(provider,mailbox,provider_message_id)
);
ALTER TABLE bloom_support.external_response_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.external_response_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_reconcile_external_response(p_actor uuid,p_ticket uuid,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t bloom_support.tickets; conv bloom_support.conversations; msg bloom_support.messages;
  receipt bloom_support.external_response_receipts; evidence jsonb; result jsonb;
  sent timestamptz; recipient text; sender text; source text; esc record;
  retired jsonb := '[]'; imported timestamptz := now(); evidence_id uuid := gen_random_uuid();
BEGIN
  PERFORM bloom_support.require_permission(p_actor,'tickets.write');
  IF NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE id=p_actor AND active AND kind='user'
    AND role IN ('platform_admin','platform_operator')) THEN
    RAISE EXCEPTION 'forbidden: active operator attestation required' USING ERRCODE='42501';
  END IF;
  PERFORM bloom_support.require_ticket(p_actor,p_ticket);
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_request) k) IS DISTINCT FROM
      ARRAY['account_id','inbound_message_id','mailbox','provider','provider_message_id','recipient','sent_at','source_ref','substantive','version']::text[]
    OR jsonb_typeof(p_request->'version') IS DISTINCT FROM 'number'
    OR coalesce(p_request->>'version','') !~ '^[1-9][0-9]*$'
    OR p_request->'substantive' IS DISTINCT FROM 'true'::jsonb
    OR p_request->>'provider' IS DISTINCT FROM 'gmail'
    OR EXISTS (SELECT 1 FROM unnest(ARRAY['inbound_message_id','mailbox','provider_message_id','recipient','sent_at','source_ref']) k
      WHERE jsonb_typeof(p_request->k) IS DISTINCT FROM 'string')
    OR length(btrim(p_request->>'source_ref')) NOT BETWEEN 8 AND 2000
    OR coalesce(p_request->>'provider_message_id','') !~ '^[a-zA-Z0-9_-]{8,200}$'
    OR coalesce(p_request->>'sent_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
  THEN RAISE EXCEPTION 'invalid: exact reviewed substantive sent-message evidence required' USING ERRCODE='22023'; END IF;
  sent := (p_request->>'sent_at')::timestamptz;
  sender := lower(btrim(p_request->>'mailbox'));
  recipient := lower(btrim(p_request->>'recipient'));
  IF NOT isfinite(sent) OR sent>now() OR sender !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid: real sent time and exact addresses required' USING ERRCODE='22023'; END IF;
  -- A manually verified sender must already be a trusted staff identity. Aliases
  -- absent from the existing identity model require separate identity review.
  IF NOT EXISTS (SELECT 1 FROM bloom_support.principals WHERE active AND kind='user'
    AND role IN ('platform_admin','platform_operator','support') AND lower(email)=sender) THEN
    RAISE EXCEPTION 'forbidden: sender is not an existing active staff identity' USING ERRCODE='42501'; END IF;
  evidence := (p_request-'version') || jsonb_build_object('mailbox',sender,'recipient',recipient,'sent_at',sent);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('external-response:gmail:'||sender||':'||(p_request->>'provider_message_id'),0));
  SELECT * INTO receipt FROM bloom_support.external_response_receipts
    WHERE provider='gmail' AND mailbox=sender AND provider_message_id=p_request->>'provider_message_id';
  IF FOUND THEN
    IF receipt.ticket_id IS DISTINCT FROM p_ticket OR receipt.evidence IS DISTINCT FROM evidence THEN
      RAISE EXCEPTION 'conflict: provider message already bound to different evidence' USING ERRCODE='23505'; END IF;
    RETURN receipt.result || jsonb_build_object('duplicate',true);
  END IF;
  SELECT * INTO t FROM bloom_support.tickets WHERE id=p_ticket FOR UPDATE;
  PERFORM bloom_support.require_ticket(p_actor,p_ticket);
  IF t.version::text IS DISTINCT FROM p_request->>'version' OR t.account_id IS DISTINCT FROM (p_request->>'account_id')::uuid
    OR t.status='resolved' OR t.spam OR t.merged_into IS NOT NULL OR t.redacted_at IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: ticket version, account or active state changed' USING ERRCODE='40001'; END IF;
  SELECT * INTO conv FROM bloom_support.conversations WHERE id=t.conversation_id FOR SHARE;
  SELECT * INTO msg FROM bloom_support.messages WHERE id=(p_request->>'inbound_message_id')::uuid FOR SHARE;
  IF msg.id IS NULL OR msg.ticket_id IS DISTINCT FROM t.id OR msg.conversation_id IS DISTINCT FROM t.conversation_id
    OR msg.direction<>'inbound' OR msg.visibility<>'public' OR msg.author_kind<>'client'
    OR msg.created_at>sent OR conv.account_id IS DISTINCT FROM t.account_id
    OR recipient IS DISTINCT FROM lower(btrim(coalesce(conv.reply_to_email,
      (SELECT email FROM bloom_support.principals WHERE id=t.requester_id))))
    OR EXISTS (SELECT 1 FROM bloom_support.principals WHERE id=t.requester_id AND email IS NOT NULL
      AND lower(btrim(email))<>recipient) THEN
    RAISE EXCEPTION 'conflict: exact inbound request and recipient match required' USING ERRCODE='40001'; END IF;
  -- Import time must never satisfy a later question. The message trigger and
  -- ticket lock serialize concurrent inbound replies with this transaction.
  IF t.last_customer_message_at>sent OR EXISTS (SELECT 1 FROM bloom_support.messages WHERE ticket_id=t.id
    AND direction='inbound' AND author_kind='client' AND visibility='public' AND created_at>sent) THEN
    RAISE EXCEPTION 'conflict: newer customer reply requires fresh review' USING ERRCODE='40001'; END IF;
  source := 'external-evidence:'||evidence_id::text;
  -- Reuse #501's timing/audit logic and its documented pre-ticket SLA clamp.
  PERFORM bloom_support.record_external_response(p_actor,t.id,sent,source);
  -- Only first-response deadline episodes can be retired here. Independent
  -- next-action deadlines, engineering decisions and ownership stay intact.
  IF t.next_action_due_at IS NULL THEN
    FOR esc IN SELECT * FROM bloom_support.escalations WHERE ticket_id=t.id
      AND reason='ticket_overdue' AND status IN ('open','acknowledged') FOR UPDATE LOOP
      UPDATE bloom_support.escalations SET status='resolved',resolved_at=now(),
        decision='Verified external substantive response; inquiry remains open.' WHERE id=esc.id;
      UPDATE bloom_support.jobs SET status='cancelled',updated_at=now() WHERE status='queued'
        AND kind='escalate' AND payload->>'escalation_id'=esc.id::text;
      retired := retired || to_jsonb(esc.id);
      PERFORM bloom_support.log(t.id,t.account_id,p_actor,'escalation.deadline_reconciled',
        jsonb_build_object('escalation_id',esc.id,'external_response_id',evidence_id));
    END LOOP;
  END IF;
  result := jsonb_build_object('recorded',true,'duplicate',false,'evidence_id',evidence_id,'ticket_id',t.id,
    'sent_at',sent,'imported_at',imported,'delivery','not_verified','retired_escalations',retired,
    'version',(SELECT version FROM bloom_support.tickets WHERE id=t.id));
  INSERT INTO bloom_support.external_response_receipts(id,provider,mailbox,provider_message_id,ticket_id,actor_id,sent_at,imported_at,evidence,result)
    VALUES(evidence_id,'gmail',sender,p_request->>'provider_message_id',t.id,p_actor,sent,imported,evidence,result);
  PERFORM bloom_support.log(t.id,t.account_id,p_actor,'response.external_reconciled',
    jsonb_build_object('evidence_id',evidence_id,'sent_at',sent,'imported_at',imported,
      'retired_escalations',retired,'reviewed_version',t.version));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_reconcile_external_response(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_reconcile_external_response(uuid,uuid,jsonb) TO service_role;

-- Keep historical alerts immutable while removing only response obligations
-- satisfied by an attested external response from the current digest view.
CREATE OR REPLACE FUNCTION bloom_support.external_response_alert_detail(p_condition text,p_detail jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE remaining jsonb; item jsonb;
BEGIN
  IF p_condition='escalation_unanswered' AND EXISTS (
    SELECT 1 FROM bloom_support.external_response_receipts r
    JOIN bloom_support.escalations e ON e.ticket_id=r.ticket_id
    WHERE e.id::text=p_detail->>'escalation_id' AND e.status='resolved'
      AND r.result->'retired_escalations' ? e.id::text
  ) THEN RETURN NULL; END IF;
  IF p_condition IS DISTINCT FROM 'approaching_deadline'
    OR jsonb_typeof(p_detail->'tickets') IS DISTINCT FROM 'array' THEN RETURN p_detail; END IF;
  remaining := '[]';
  FOR item IN SELECT value FROM jsonb_array_elements(p_detail->'tickets') LOOP
    IF NOT EXISTS (SELECT 1 FROM bloom_support.external_response_receipts r
      JOIN bloom_support.tickets t ON t.id=r.ticket_id
      WHERE t.id::text=item->>'id' AND t.first_response_at IS NOT NULL
        AND coalesce(t.last_customer_message_at,t.created_at)<=t.last_team_message_at)
    THEN remaining := remaining || jsonb_build_array(item); END IF;
  END LOOP;
  IF remaining=p_detail->'tickets' THEN RETURN p_detail; END IF;
  IF jsonb_array_length(remaining)=0 THEN RETURN NULL; END IF;
  RETURN p_detail || jsonb_build_object('tickets',remaining,'count',jsonb_array_length(remaining),
    'summary',jsonb_array_length(remaining)::text||' requests remain in this historical response-deadline alert; review their current state.');
END $$;
REVOKE ALL ON FUNCTION bloom_support.external_response_alert_detail(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_digest_report(p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN jsonb_build_object(
    'needs_you', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]') FROM (
        SELECT DISTINCT ON (t.id) jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'client', a.name,
               'reason', e.reason, 'since', e.created_at,
               'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)) x
          FROM bloom_support.escalations e
          JOIN bloom_support.tickets t ON t.id = e.ticket_id
          LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
         WHERE e.status IN ('open','acknowledged') AND t.status <> 'resolved' AND t.merged_into IS NULL AND NOT t.spam AND NOT t.internal_test
         ORDER BY t.id, (e.reason = 'ticket_overdue'), e.created_at DESC
         LIMIT 20) n),
    'resolved', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
                   'by_bloom', coalesce(pr.kind = 'service' OR pr.role = 'service', false), 'summary', t.resolution_summary) ORDER BY ev.at), '[]')
        FROM (SELECT DISTINCT ON (ticket_id) ticket_id, actor_id, at FROM bloom_support.ticket_events
               WHERE kind = 'status' AND to_value = 'resolved' AND at >= p_since ORDER BY ticket_id, at DESC) ev
        JOIN bloom_support.tickets t ON t.id = ev.ticket_id AND t.status = 'resolved' AND NOT t.spam AND NOT t.internal_test AND t.merged_into IS NULL
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        LEFT JOIN bloom_support.principals pr ON pr.id = ev.actor_id),
    'said', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
               'body', left(m.body, 600), 'at', m.created_at,'purpose',m.purpose,'delivery',m.delivery,'meaningful',m.meaningful) ORDER BY m.created_at), '[]')
        FROM bloom_support.messages m
        JOIN bloom_support.tickets t ON t.id = m.ticket_id AND NOT t.spam AND NOT t.internal_test
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        WHERE m.author_kind = 'bloom' AND m.visibility = 'public' AND m.withdrawn_at IS NULL AND m.delivery IN ('sent','delivered') AND m.created_at >= p_since),
    'repairs', (SELECT coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'status', e.status,
                  'client', (SELECT a.name FROM bloom_support.tickets t JOIN bloom_support.accounts a ON a.id = t.account_id
                              WHERE t.engineering_issue_id = e.id AND NOT t.internal_test ORDER BY t.created_at LIMIT 1)) ORDER BY e.updated_at DESC), '[]')
        FROM bloom_support.engineering_issues e
        WHERE e.status NOT IN ('open', 'verified', 'closed')
          -- Shared issues remain customer work if any linked ticket is a customer.
          AND (NOT EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id)
            OR EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id AND NOT t.internal_test))),
    'alerts', (SELECT coalesce(jsonb_agg(jsonb_build_object('condition', al.condition, 'detail', filtered.detail, 'at', al.created_at) ORDER BY al.created_at), '[]')
        FROM bloom_support.alerts al
        CROSS JOIN LATERAL (SELECT bloom_support.external_response_alert_detail(al.condition,al.detail) AS detail) filtered
        WHERE al.created_at >= p_since AND filtered.detail IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e JOIN bloom_support.tickets t ON t.id=e.ticket_id
            WHERE e.id::text=al.detail->>'escalation_id' AND t.internal_test)),
    'internal_tests', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id',t.id,'number',t.number,'subject',t.subject,'status',t.status,'stage',t.stage,
        'next_action',t.next_action,'engineering_status',e.status,
        'deployment_state',e.deployment->>'state',
        'verification_summary',CASE
          WHEN e.verification IS NULL OR e.verification IN ('null'::jsonb,'{}'::jsonb) THEN 'No check recorded'
          WHEN e.verification->'passed'='false'::jsonb THEN 'A failed check is recorded'
          WHEN e.verification->'passed'='true'::jsonb THEN 'A passing check is recorded; affected-flow coverage and release binding still require review'
          ELSE 'Check evidence recorded; outcome requires review' END,
        'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)
      ) ORDER BY t.created_at), '[]')
      FROM bloom_support.tickets t LEFT JOIN bloom_support.engineering_issues e ON e.id=t.engineering_issue_id
      WHERE t.internal_test AND NOT t.spam AND t.merged_into IS NULL
        AND (t.status <> 'resolved' OR t.resolved_at >= p_since)),
    'counts', jsonb_build_object(
      'open',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND status <> 'resolved'),
      'new',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND created_at >= p_since)),
    'staff', (SELECT coalesce(jsonb_agg(lower(pr.email)), '[]') FROM bloom_support.principals pr
        WHERE pr.kind = 'user' AND pr.active AND pr.email IS NOT NULL AND pr.role IN ('platform_admin', 'platform_operator')),
    'approvals_pending', (SELECT count(*)::int FROM bloom_support.approval_queue WHERE status = 'pending'));
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_digest_report(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_digest_report(timestamptz) TO service_role;
