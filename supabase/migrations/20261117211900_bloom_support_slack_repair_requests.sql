-- Explicit requests enter the existing repair/release pipeline under the real actor.
-- No arbitrary execution, approval bypass, attempt reset, or duplicate coding task.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_request_repair(p_job uuid,p_resume boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; a uuid; q text; t bloom_support.tickets; e bloom_support.engineering_issues; prior jsonb; result jsonb; opened jsonb; j uuid; mode text:=CASE WHEN p_resume THEN 'resume' ELSE 'repair' END; created boolean:=false;
BEGIN
 c:=public.bloom_support_slack_conversation_context(p_job);
 IF coalesce(c->>'allowed','false')<>'true' OR c->>'ticket_id' IS NULL OR c->>'route'<>'tickets' THEN RAISE EXCEPTION 'An authorized bound ticket conversation is required' USING ERRCODE='42501'; END IF;
 a:=(c->>'principal_id')::uuid; t:=bloom_support.require_ticket(a,(c->>'ticket_id')::uuid);
 IF t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL OR t.status='resolved' THEN RAISE EXCEPTION 'An active support request is required' USING ERRCODE='22023'; END IF;
 SELECT lower(btrim(payload->>'question')) INTO q FROM bloom_support.jobs WHERE id=p_job;
 q:=regexp_replace(q,'^bloom[, :]+','','i'); q:=regexp_replace(q,'^((can|could|would) you (please )?|please )','','i');
 IF q ~ '\m(do not|don''t|don’t|never|without|not yet|how|example|hypothetical)\M' OR (NOT p_resume AND q !~ '^(fix|repair)\M') OR (p_resume AND q !~ '^(deploy|release|ship|resume)\M') THEN RAISE EXCEPTION 'The current staff message must explicitly request this repair or release action' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('slack-repair:'||p_job::text||':'||mode,0));
 SELECT detail->'result' INTO prior FROM bloom_support.activity WHERE action='slack.repair.requested' AND detail->>'source_job_id'=p_job::text AND detail->>'mode'=mode ORDER BY id DESC LIMIT 1;
 IF prior IS NOT NULL THEN RETURN prior||'{"replayed":true}'::jsonb; END IF;
 IF p_resume THEN
  IF t.engineering_issue_id IS NULL THEN RAISE EXCEPTION 'No tracked release exists for this request' USING ERRCODE='22023'; END IF;
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id=t.engineering_issue_id;
  result:=public.bloom_support_resume_release(a,e.id,e.version)||jsonb_build_object('work_state','release_tracking_requested','ticket_number',t.number,'engineering_issue_id',e.id,'meaning','Only a recorded merged release can resume. This requests deployment or verification tracking; it does not claim the release succeeded.');
 ELSE
  PERFORM bloom_support.require_permission(a,'engineering.start');
  IF t.engineering_issue_id IS NULL THEN
   opened:=bloom_support.open_engineering_issue(a,t.id,jsonb_build_object('title',t.subject,'evidence',jsonb_build_object('requested_via','authenticated Slack ticket conversation','source_job_id',p_job)));
   t.engineering_issue_id:=(opened->>'engineering_issue_id')::uuid; created:=true;
  END IF;
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id=t.engineering_issue_id;
  IF coalesce((e.reproduction->>'needs_human')::boolean,false) THEN
   result:=jsonb_build_object('work_state','human_review_required','meaning','A human stop is recorded. No additional automated repair was started.');
  ELSE
   SELECT id INTO j FROM bloom_support.jobs WHERE engineering_issue_id=e.id AND kind IN ('investigate','engineering_step') AND status IN ('queued','running') ORDER BY created_at LIMIT 1;
   IF j IS NOT NULL THEN result:=jsonb_build_object('work_state',CASE WHEN created THEN 'queued' ELSE 'already_active' END,'job_id',j,'meaning','The existing repair pipeline owns this work. No duplicate coding session was started.');
   ELSIF NOT bloom_support.has_permission(a,'engineering.dispatch') THEN result:=jsonb_build_object('work_state','recorded_for_owner','meaning','An authorized owner must start coding. No coding session was started by this request.');
   ELSIF e.status IN ('open','failed','not_reproduced','escalated') THEN
    PERFORM bloom_support.update_engineering_issue(a,e.id,jsonb_build_object('start_repair',true,'version',e.version,'note','Explicit repair request from the authenticated Slack ticket thread. Existing attempt, human-stop and release safeguards remain in force.'));
    result:=jsonb_build_object('work_state','queued','meaning','A coding repair was queued through the existing authorized pipeline. Merge, deployment and affected-flow verification are not yet complete.');
   ELSE result:=jsonb_build_object('work_state','existing_work','meaning','Existing engineering work is already beyond the repair-start stage. Review its recorded release status; no duplicate repair was started.'); END IF;
  END IF;
  result:=result||jsonb_build_object('ticket_number',t.number,'engineering_issue_id',e.id,'created_issue',created,'recorded_status',e.status);
 END IF;
 PERFORM bloom_support.log(t.id,t.account_id,a,'slack.repair.requested',jsonb_build_object('source_job_id',p_job,'mode',mode,'result',result));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_request_repair(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_request_repair(uuid,boolean) TO service_role;
