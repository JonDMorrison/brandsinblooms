-- Correct the live approval identity schema and keep Slack drafts private until review.
ALTER TABLE bloom_support.approval_queue ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES bloom_support.principals(id), ADD COLUMN IF NOT EXISTS ticket_version integer, ADD COLUMN IF NOT EXISTS customer_message_at timestamptz, ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'worker', ADD COLUMN IF NOT EXISTS review_reason text;

CREATE OR REPLACE FUNCTION public.bloom_support_list_approval_queue(p_actor text,p_status text DEFAULT 'pending') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid;
BEGIN
 IF p_actor IS NULL OR p_actor !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Access denied: staff identity required' USING ERRCODE='42501'; END IF;
 a:=p_actor::uuid;
 IF NOT EXISTS(SELECT 1 FROM bloom_support.principals WHERE id=a AND active AND kind='user' AND role IN ('platform_admin','platform_operator','support')) THEN RAISE EXCEPTION 'Access denied: active staff only' USING ERRCODE='42501'; END IF;
 PERFORM bloom_support.require_permission(a,'tickets.read_all');
 IF p_status IS NULL OR p_status NOT IN ('pending','approved','rejected','sent','all') THEN RAISE EXCEPTION 'Invalid approval status' USING ERRCODE='22023'; END IF;
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('id',aq.id,'ticket_id',aq.ticket_id,'original_job_id',aq.original_job_id,'message_id',aq.message_id,'to_email',aq.to_email,'subject',aq.subject,'text_body',aq.text_body,'hold_reason',aq.hold_reason,'status',aq.status,'created_at',aq.created_at,'reviewed_at',aq.reviewed_at,'reviewed_by',aq.reviewed_by,'sent_at',aq.sent_at,'source_kind',aq.source_kind,'review_reason',aq.review_reason,'needs_refresh',aq.ticket_version IS NOT NULL AND(aq.ticket_version<>t.version OR aq.customer_message_at IS DISTINCT FROM t.last_customer_message_at),'ticket',jsonb_build_object('number',t.number,'subject',t.subject,'status',t.status)) ORDER BY aq.created_at DESC),'[]'::jsonb) FROM bloom_support.approval_queue aq JOIN bloom_support.tickets t ON t.id=aq.ticket_id WHERE(p_status='all' OR aq.status=p_status) AND NOT t.spam AND t.redacted_at IS NULL AND bloom_support.can_read_ticket(a,t.id));
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_list_approval_queue(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_list_approval_queue(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_insert_approval_queue_entry(p_ticket_id uuid,p_original_job_id text,p_message_id text,p_to_email text,p_subject text,p_text_body text,p_html_body text,p_hold_reason text,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; t bloom_support.tickets;
BEGIN
 SELECT * INTO t FROM bloom_support.tickets WHERE id=p_ticket_id;
 IF NOT FOUND OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Ticket is unavailable' USING ERRCODE='22023'; END IF;
 INSERT INTO bloom_support.approval_queue(ticket_id,original_job_id,message_id,to_email,subject,text_body,html_body,hold_reason,idempotency_key,ticket_version,customer_message_at) VALUES(p_ticket_id,p_original_job_id,p_message_id,p_to_email,p_subject,p_text_body,p_html_body,p_hold_reason,p_idempotency_key,t.version,t.last_customer_message_at) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM bloom_support.approval_queue WHERE idempotency_key=p_idempotency_key AND ticket_id=p_ticket_id; IF v_id IS NULL THEN RAISE EXCEPTION 'Approval idempotency conflict' USING ERRCODE='40001'; END IF; RETURN jsonb_build_object('id',v_id,'created',false); END IF;
 RETURN jsonb_build_object('id',v_id,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_insert_approval_queue_entry(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_insert_approval_queue_entry(uuid,text,text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_prepare_slack_reply(p_job uuid,p_body text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; j bloom_support.jobs; t bloom_support.tickets; a uuid; q text; dest text; v_id uuid; prior bloom_support.approval_queue;
BEGIN
 c:=public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'route'<>'tickets' OR c->>'ticket_id' IS NULL THEN RAISE EXCEPTION 'An authorized ticket conversation is required' USING ERRCODE='42501'; END IF;
 a:=(c->>'principal_id')::uuid; PERFORM bloom_support.require_permission(a,'tickets.internal');
 SELECT * INTO j FROM bloom_support.jobs WHERE id=p_job;
 q:=lower(btrim(j.payload->>'question')); q:=regexp_replace(q,'^bloom[, :]+','','i'); q:=regexp_replace(q,'^((can|could|would) you (please )?|please )','','i');
 IF q !~ '^(draft|prepare|write)\M' OR q !~ '\m(reply|response|answer)\M' OR q ~ '\m(do not|don''t|don’t|never|without|not yet|example|hypothetical)\M' THEN RAISE EXCEPTION 'The current staff message must explicitly request a reply draft' USING ERRCODE='42501'; END IF;
 IF p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 6000 OR p_body ~* '(Bearer[[:space:]]+|xox[baprs]-|sk-[A-Za-z0-9]|gh[pousr]_|bsk_)' THEN RAISE EXCEPTION 'A bounded, credential-free reply is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM bloom_support.tickets WHERE id=(c->>'ticket_id')::uuid FOR UPDATE; PERFORM bloom_support.require_ticket(a,t.id);
 IF t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Ticket is unavailable' USING ERRCODE='22023'; END IF;
 SELECT coalesce(cv.reply_to_email,pr.email) INTO dest FROM bloom_support.conversations cv LEFT JOIN bloom_support.principals pr ON pr.id=t.requester_id WHERE cv.id=t.conversation_id;
 IF dest IS NULL OR dest !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Ticket has no verified reply destination' USING ERRCODE='22023'; END IF;
 SELECT * INTO prior FROM bloom_support.approval_queue WHERE idempotency_key='slack-draft:'||p_job::text;
 IF FOUND THEN RETURN jsonb_build_object('id',prior.id,'status',prior.status,'created',false,'ticket_number',t.number); END IF;
 UPDATE bloom_support.approval_queue SET status='rejected',reviewed_at=now(),reviewed_by=a::text,review_reason='Superseded by a new Slack draft from the same staff member' WHERE ticket_id=t.id AND prepared_by=a AND source_kind='slack_draft' AND status='pending';
 INSERT INTO bloom_support.approval_queue(ticket_id,original_job_id,to_email,subject,text_body,hold_reason,idempotency_key,prepared_by,ticket_version,customer_message_at,source_kind) VALUES(t.id,p_job::text,dest,'[Bloom #'||t.number::text||'] '||left(regexp_replace(regexp_replace(t.subject,'^(re|fwd?):\s*','','i'),'\[Bloom #[0-9]+\]\s*','','i'),150),btrim(p_body)||E'\n\nBrands In Blooms Support','Slack-prepared reply: human review required; sends only to the primary recipient','slack-draft:'||p_job::text,a,t.version,t.last_customer_message_at,'slack_draft') RETURNING id INTO v_id;
 PERFORM bloom_support.log(t.id,t.account_id,a,'reply.prepared_for_review',jsonb_build_object('approval_id',v_id,'source_job_id',p_job));
 PERFORM bloom_support.notify_staff(t.id,'reply.approval_needed','A draft reply needs review on #'||t.number::text,'both');
 RETURN jsonb_build_object('id',v_id,'status','pending','created',true,'ticket_number',t.number);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_prepare_slack_reply(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_prepare_slack_reply(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_review_queued_reply(p_actor text,p_entry_id uuid,p_action text,p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid; v bloom_support.approval_queue; t bloom_support.tickets; v_job uuid; v_message jsonb; dest text;
BEGIN
 IF p_actor IS NULL OR p_actor !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'An authorized reviewer is required' USING ERRCODE='42501'; END IF;
 a:=p_actor::uuid;
 IF NOT EXISTS(SELECT 1 FROM bloom_support.principals WHERE id=a AND active AND kind='user' AND role IN ('platform_admin','platform_operator')) THEN RAISE EXCEPTION 'Active admin or operator required' USING ERRCODE='42501'; END IF;
 PERFORM bloom_support.require_permission(a,'tickets.write');
 IF p_action IS NULL OR p_action NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid review action' USING ERRCODE='22023'; END IF;
 SELECT * INTO v FROM bloom_support.approval_queue WHERE id=p_entry_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approval not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO t FROM bloom_support.tickets WHERE id=v.ticket_id FOR UPDATE; PERFORM bloom_support.require_ticket(a,t.id);
 SELECT * INTO v FROM bloom_support.approval_queue WHERE id=p_entry_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approval is no longer pending' USING ERRCODE='40001'; END IF;
 IF p_action='approved' THEN
  IF t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Ticket is unavailable' USING ERRCODE='22023'; END IF;
  IF v.ticket_version IS NOT NULL AND(v.ticket_version<>t.version OR v.customer_message_at IS DISTINCT FROM t.last_customer_message_at) THEN RAISE EXCEPTION 'The ticket changed after this draft. Prepare and review a fresh reply.' USING ERRCODE='40001'; END IF;
  SELECT coalesce(cv.reply_to_email,pr.email) INTO dest FROM bloom_support.conversations cv LEFT JOIN bloom_support.principals pr ON pr.id=t.requester_id WHERE cv.id=t.conversation_id;
  IF lower(btrim(dest)) IS DISTINCT FROM lower(btrim(v.to_email)) THEN RAISE EXCEPTION 'The reply destination changed. Review a fresh draft.' USING ERRCODE='40001'; END IF;
  IF v.message_id IS NULL THEN v_message:=bloom_support.add_message(a,t.id,jsonb_build_object('body',v.text_body,'visibility','public','purpose','reply','notify_client',false,'idempotency_key','approval-public:'||v.id::text)); v.message_id:=v_message->>'message_id';
  ELSE IF NOT EXISTS(SELECT 1 FROM bloom_support.messages m WHERE m.id::text=v.message_id AND(m.ticket_id=t.id OR(m.ticket_id IS NULL AND m.conversation_id=t.conversation_id)) AND m.visibility='public' AND m.withdrawn_at IS NULL AND m.delivery<>'suppressed') THEN RAISE EXCEPTION 'The reviewed message is no longer eligible' USING ERRCODE='40001'; END IF; END IF;
 END IF;
 UPDATE bloom_support.approval_queue SET status=p_action,reviewed_at=now(),reviewed_by=a::text,review_reason=left(p_reason,500),message_id=v.message_id WHERE id=v.id;
 IF p_action='approved' THEN v_job:=bloom_support.enqueue_job('send_email',t.id,NULL,'email:'||t.id::text,jsonb_build_object('message_id',v.message_id,'approved_queue_id',v.id::text,'purpose','reply'),'approved_reply:'||v.id::text,now(),3,60); END IF;
 PERFORM bloom_support.log(t.id,t.account_id,a,'reply.'||p_action,jsonb_build_object('approval_id',v.id,'job_id',v_job));
 RETURN jsonb_build_object('id',v.id,'ticket_id',t.id,'message_id',v.message_id,'status',p_action,'reviewed_at',now(),'job_id',v_job);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_review_queued_reply(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_review_queued_reply(text,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_fetch_approval_entry(p_entry_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v bloom_support.approval_queue; t bloom_support.tickets;
BEGIN
 SELECT * INTO v FROM bloom_support.approval_queue WHERE id=p_entry_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO t FROM bloom_support.tickets WHERE id=v.ticket_id;
 RETURN jsonb_build_object('id',v.id,'ticket_id',v.ticket_id,'message_id',v.message_id,'to_email',v.to_email,'subject',v.subject,'text_body',v.text_body,'html_body',v.html_body,'status',v.status,'sent_at',v.sent_at,'reviewed_by',v.reviewed_by,'reviewer_active',EXISTS(SELECT 1 FROM bloom_support.principals pr WHERE pr.id::text=v.reviewed_by AND pr.active AND pr.kind='user' AND pr.role IN ('platform_admin','platform_operator')),'ticket_valid',t.id IS NOT NULL AND NOT t.spam AND t.redacted_at IS NULL AND t.merged_into IS NULL,'source_current',v.ticket_version IS NULL OR v.customer_message_at IS NOT DISTINCT FROM t.last_customer_message_at,'source_kind',v.source_kind);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_fetch_approval_entry(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_fetch_approval_entry(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_mark_approval_sent(p_entry_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE bloom_support.approval_queue aq SET status='sent',sent_at=now() WHERE aq.id=p_entry_id AND aq.status='approved' AND EXISTS(SELECT 1 FROM bloom_support.outbound_emails e WHERE e.idempotency_key='approved:'||aq.id::text AND e.ticket_id=aq.ticket_id AND lower(e.to_email)=lower(aq.to_email) AND e.status='sent' AND e.provider_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_mark_approval_sent(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_mark_approval_sent(uuid) TO service_role;
