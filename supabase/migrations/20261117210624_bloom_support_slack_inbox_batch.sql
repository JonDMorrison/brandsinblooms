-- Atomic, bounded handoff to the existing support pipeline; never a direct send.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_process_inbox(p_job uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; a uuid; q text; t bloom_support.tickets; item jsonb; queued jsonb:='[]'; skipped jsonb:='[]'; seen integer:=0; remain bigint; jid uuid; prior jsonb;
BEGIN
 c:=public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'role' NOT IN ('platform_admin','platform_operator') OR c->>'ticket_id' IS NOT NULL THEN RAISE EXCEPTION 'An owner-authorized support queue conversation is required' USING ERRCODE='42501'; END IF;
 a:=(c->>'principal_id')::uuid; PERFORM bloom_support.require_permission(a,'tickets.write');
 SELECT lower(btrim(payload->>'question')) INTO q FROM bloom_support.jobs WHERE id=p_job;
 q:=regexp_replace(q,'^bloom[, :]+','','i'); q:=regexp_replace(q,'^((can|could|would) you (please )?|please )','','i');
 IF q !~ '^(process|answer|handle|reply to)\M' OR q !~ '\msupport\M' OR q !~ '\m(emails?|inbox|questions?|messages?)\M' OR q ~ '\m(do not|don''t|don’t|never|without|not yet|how|example|hypothetical)\M' THEN RAISE EXCEPTION 'The current staff message must request support inbox processing' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('slack-inbox:'||p_job::text,0));
 SELECT detail->'result' INTO prior FROM bloom_support.activity WHERE action='slack.inbox.queued' AND detail->>'source_job_id'=p_job::text ORDER BY id DESC LIMIT 1;
 IF prior IS NOT NULL THEN RETURN prior||'{"replayed":true}'::jsonb; END IF;
 IF bloom_support.setting('automation_enabled') IS DISTINCT FROM 'true'::jsonb THEN RETURN jsonb_build_object('queued',0,'examined',0,'skipped',0,'reason','Support automation is disabled. No policy was changed.'); END IF;
 FOR t IN SELECT * FROM bloom_support.tickets WHERE status='new' AND NOT internal_test AND NOT spam AND merged_into IS NULL AND redacted_at IS NULL AND bloom_support.can_read_ticket(a,id) ORDER BY created_at LIMIT 25 FOR UPDATE SKIP LOCKED LOOP
  seen:=seen+1;
  IF t.kind IS DISTINCT FROM 'question' OR t.channel IS DISTINCT FROM 'email' OR t.automation IS DISTINCT FROM 'auto' OR t.executor IS DISTINCT FROM 'bloom' OR t.taken_over_by IS NOT NULL OR t.pending_review IS NOT NULL OR t.first_response_at IS NOT NULL OR t.priority='urgent'
   OR EXISTS(SELECT 1 FROM bloom_support.jobs j WHERE j.ticket_id=t.id AND ((j.kind IN ('triage','answer','send_email') AND j.status NOT IN ('succeeded','failed','dead','cancelled')) OR j.idempotency_key='slack-safe-inbox:'||t.id::text||':'||t.version::text))
   OR concat_ws(' ',t.subject,t.summary,t.next_action,(SELECT string_agg(m.body,' ') FROM(SELECT body FROM bloom_support.messages WHERE ticket_id=t.id AND author_kind='client' ORDER BY created_at DESC LIMIT 5) m)) ~* '\m(refund|billing|chargeback|fraud|dispute|legal|privacy|security|password|permission|complaint|angry|frustrated|human|call me)\M'
  THEN skipped:=skipped||jsonb_build_array(jsonb_build_object('number',t.number,'reason','Needs review, is already active, or is outside routine new email questions.')); CONTINUE; END IF;
  jid:=bloom_support.enqueue_job('triage',t.id,NULL,'account:'||coalesce(t.account_id::text,'none:'||t.id::text),jsonb_build_object('requested_via','slack','source_job_id',p_job),'slack-safe-inbox:'||t.id::text||':'||t.version::text,now(),2,60);
  queued:=queued||jsonb_build_array(jsonb_build_object('number',t.number,'job_id',jid));
 END LOOP;
 SELECT count(*) INTO remain FROM bloom_support.tickets WHERE status='new' AND NOT internal_test AND NOT spam AND merged_into IS NULL AND redacted_at IS NULL AND bloom_support.can_read_ticket(a,id);
 item:=jsonb_build_object('queued',jsonb_array_length(queued),'examined',seen,'skipped',jsonb_array_length(skipped),'queued_requests',queued,'skipped_requests',skipped,'page_limit',25,'new_requests_recorded',remain,'more_may_remain',remain>seen,'meaning','Queued means submitted to existing safety checks, not email sent or request resolved. Human-owned and uncertain work remains for review.');
 PERFORM bloom_support.log(NULL,NULL,a,'slack.inbox.queued',jsonb_build_object('source_job_id',p_job,'result',item));
 RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_process_inbox(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_process_inbox(uuid) TO service_role;
