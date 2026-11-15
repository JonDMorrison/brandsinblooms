\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='bloom_support' AND table_name='tickets' AND column_name='internal_test') AS has_classification \gset
\if :has_classification
\else
\ir ../../supabase/migrations/20261114135139_bloom_support_internal_tests_and_reminders.sql
\endif
\ir ../../supabase/migrations/20261115183151_bloom_support_completed_escalations.sql
DO $$
DECLARE c uuid; t uuid:=gen_random_uuid(); shared uuid; eng uuid; e uuid; newer uuid; human uuid; queued uuid; running uuid;
  proof jsonb; deployment jsonb:='{"state":"success"}'; before_ticket jsonb; before_issue jsonb; n integer;
BEGIN
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Completed escalation fixture') RETURNING id INTO c;
  proof:=jsonb_build_object('passed',true,'scope','ticket_flow','started_at',now()-interval '1 hour','ticket_ids',jsonb_build_array(t::text));
  INSERT INTO bloom_support.engineering_issues(title,product,status,merge_sha,deployment,verification)
    VALUES('Verified fixture','crm','verified','verified-merge',deployment,proof) RETURNING id INTO eng;
  INSERT INTO bloom_support.tickets(id,conversation_id,product,channel,subject,summary,status,stage,engineering_issue_id,resolution_verified,resolved_at,resolution_evidence)
    VALUES(t,c,'crm','staff','Completed fixture','','resolved','resolved',eng,true,now(),
      jsonb_build_object('engineering_issue_id',eng,'merge_sha','verified-merge','verification',proof,'deployment',deployment));
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,due_at,created_at)
    VALUES(t,eng,'both','engineering_escalated',now()-interval '1 minute',now()-interval '2 hours') RETURNING id INTO e;
  INSERT INTO bloom_support.alerts(condition,detail,dedupe_key) VALUES('escalation_unanswered',jsonb_build_object('escalation_id',e),'fixture:done:'||e);
  -- More than one scan page of genuine blockers must not starve completed work.
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,created_at,due_at)
    SELECT t,'both','engineering_escalated',now()-interval '3 hours',now()+interval '1 day' FROM generate_series(1,201);
  -- Partial or mismatched evidence must never retire the blocker.
  UPDATE bloom_support.engineering_issues SET deployment='{"state":"rollback_point_unproven"}' WHERE id=eng;
  IF bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'rollback blocker suppressed'; END IF;
  UPDATE bloom_support.engineering_issues SET deployment='{"state":"success"}',verification=proof-'ticket_ids' WHERE id=eng;
  IF bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'unbound verification accepted'; END IF;
  UPDATE bloom_support.engineering_issues SET deployment='{"state":"success"}',verification=proof WHERE id=eng;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,engineering_issue_id)
    VALUES(c,'crm','staff','Unresolved shared work','','working',eng) RETURNING id INTO shared;
  IF bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'shared open work suppressed'; END IF;
  UPDATE bloom_support.tickets SET engineering_issue_id=NULL WHERE id=shared;
  UPDATE bloom_support.tickets SET resolution_verified=false WHERE id=t;
  IF bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'unverified closure accepted'; END IF;
  UPDATE bloom_support.tickets SET resolution_verified=true WHERE id=t;
  UPDATE bloom_support.engineering_issues SET verification=jsonb_set(proof,'{started_at}','"infinity"') WHERE id=eng;
  IF bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'infinite proof accepted'; END IF;
  UPDATE bloom_support.engineering_issues SET verification=proof WHERE id=eng;
  IF NOT bloom_support.completed_engineering_escalation(e) THEN RAISE EXCEPTION 'verified completion not recognized'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.bloom_support_digest_report(now()-interval '1 day')->'alerts') a WHERE a#>>'{detail,escalation_id}'=e::text) THEN RAISE EXCEPTION 'obsolete alert visible before sweep'; END IF;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,due_at,created_at)
    SELECT t,eng,'both',r,now()-interval '1 minute',now()-interval '2 hours' FROM unnest(ARRAY['engineering_failed','engineering_awaiting_approval']) r;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,due_at,created_at)
    VALUES(t,eng,'both','engineering_failed',now()-interval '1 minute',now()) RETURNING id INTO newer;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,due_at,created_at)
    VALUES(t,eng,'both','human_decision',now()-interval '1 minute',now()-interval '2 hours') RETURNING id INTO human;
  queued:=bloom_support.enqueue_job('escalate',t,NULL,'email:escalation',jsonb_build_object('escalation_id',e),'fixture:queued:'||e);
  running:=bloom_support.enqueue_job('escalate',t,NULL,'email:escalation',jsonb_build_object('escalation_id',e),'fixture:claimed:'||e);
  UPDATE bloom_support.jobs SET status='running' WHERE id=running;
  SELECT to_jsonb(x) INTO before_ticket FROM bloom_support.tickets x WHERE id=t;
  SELECT to_jsonb(x) INTO before_issue FROM bloom_support.engineering_issues x WHERE id=eng;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT count(*) FROM bloom_support.escalations WHERE engineering_issue_id=eng AND status='resolved')<>3 THEN RAISE EXCEPTION 'obsolete episodes survived'; END IF;
  IF (SELECT count(*) FROM bloom_support.escalations WHERE id IN (newer,human) AND status='open' AND fallback_level=1)<>2 THEN RAISE EXCEPTION 'new failure or human decision hidden'; END IF;
  IF (SELECT status FROM bloom_support.jobs WHERE id=queued)<>'cancelled' OR (SELECT status FROM bloom_support.jobs WHERE id=running)<>'running' THEN RAISE EXCEPTION 'queued cancellation or claimed lease changed'; END IF;
  IF (SELECT to_jsonb(x) FROM bloom_support.tickets x WHERE id=t) IS DISTINCT FROM before_ticket
    OR (SELECT to_jsonb(x) FROM bloom_support.engineering_issues x WHERE id=eng) IS DISTINCT FROM before_issue THEN RAISE EXCEPTION 'customer/engineering state mutated'; END IF;
  SELECT count(*) INTO n FROM bloom_support.activity WHERE ticket_id=t AND action='escalation.engineering_completed';
  PERFORM bloom_support.sweep_deadlines();
  IF n<>3 OR (SELECT count(*) FROM bloom_support.activity WHERE ticket_id=t AND action='escalation.engineering_completed')<>n THEN RAISE EXCEPTION 'audit missing or duplicated'; END IF;
  IF has_function_privilege('authenticated','bloom_support.reconcile_completed_engineering_escalations()','execute') OR has_function_privilege('service_role','bloom_support.completed_engineering_escalation(uuid)','execute') THEN RAISE EXCEPTION 'private helper exposed'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-completed-escalations: all assertions passed'
