\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261113145619_bloom_support_escalation_reconciliation.sql
DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid; t uuid; e uuid; real_t uuid; real_e uuid;
  responded timestamptz:=now()-interval '1 hour'; r jsonb; n bigint; before_jobs bigint;
BEGIN
  INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role)
    VALUES(a,'user',gen_random_uuid(),'crm',a::text||'@example.test','Response fixture','platform_admin');
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Response fixture') RETURNING id INTO c;
  INSERT INTO bloom_support.tickets(conversation_id,product,kind,channel,subject,summary,status,automation,executor,owner_id,created_at)
    VALUES(c,'crm','bug','staff','Paused handoff','','working','paused','person',a,now()-interval '15 days') RETURNING id INTO t;
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,detail,dedupe_key,due_at,fallback_level)
    VALUES(t,'both','ticket_overdue','Old deadline','fixture:'||t,now()-interval '1 hour',17) RETURNING id INTO e;
  SELECT count(*) INTO before_jobs FROM bloom_support.jobs WHERE ticket_id=t;
  r:=bloom_support.record_external_response(a,t,responded,'gmail:sent:fixture-reply');
  IF r->>'duplicate'<>'false' THEN RAISE EXCEPTION 'first evidence not recorded'; END IF;
  r:=bloom_support.record_external_response(a,t,responded,'gmail:sent:fixture-reply');
  IF r->>'duplicate'<>'true' THEN RAISE EXCEPTION 'evidence replay not idempotent'; END IF;
  IF (SELECT count(*) FROM bloom_support.jobs WHERE ticket_id=t)<>before_jobs THEN RAISE EXCEPTION 'recording evidence sends jobs'; END IF;
  IF NOT (SELECT status='working' AND automation='paused' AND executor='person' AND first_response_at=responded AND last_team_message_at=responded FROM bloom_support.tickets WHERE id=t) THEN RAISE EXCEPTION 'response changed client work'; END IF;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT status FROM bloom_support.escalations WHERE id=e)<>'resolved' THEN RAISE EXCEPTION 'stale response escalation survives'; END IF;
  IF (SELECT status FROM bloom_support.tickets WHERE id=t)<>'working' THEN RAISE EXCEPTION 'work incorrectly closed'; END IF;
  -- A forwarded handoff may be created after the customer already received
  -- the reply. Preserve actual evidence time without negative response metrics.
  PERFORM bloom_support.record_external_response(a,t,now()-interval '16 days','gmail:sent:pre-handoff');
  IF NOT (SELECT first_response_at=created_at AND last_team_message_at=responded FROM bloom_support.tickets WHERE id=t) THEN RAISE EXCEPTION 'pre-handoff response timing incorrect'; END IF;
  -- A new, genuinely overdue next step must escalate again, despite the old
  -- escalation having been resolved. The paused human owner is not exempt.
  UPDATE bloom_support.tickets SET next_action='Investigate remaining issue',next_action_due_at=now()-interval '1 minute' WHERE id=t;
  PERFORM bloom_support.sweep_deadlines();
  SELECT count(*) INTO n FROM bloom_support.escalations WHERE ticket_id=t AND reason='ticket_overdue' AND status='open';
  IF n<>1 THEN RAISE EXCEPTION 'new work deadline missing or duplicated: %',n; END IF;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT count(*) FROM bloom_support.escalations WHERE ticket_id=t AND reason='ticket_overdue' AND status='open')<>1 THEN RAISE EXCEPTION 'sweep duplicate'; END IF;
  -- Resume the same overdue deadline after a customer wait: the previous
  -- resolved episode must not permanently block a new escalation.
  UPDATE bloom_support.tickets SET status='waiting',waiting_reason='customer' WHERE id=t;
  PERFORM bloom_support.sweep_deadlines();
  UPDATE bloom_support.tickets SET status='working' WHERE id=t;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT count(*) FROM bloom_support.escalations WHERE ticket_id=t AND reason='ticket_overdue' AND status='open')<>1 THEN RAISE EXCEPTION 'same-deadline resumed work suppressed'; END IF;
  -- No keyword-based suppression: a real customer may mention tests.
  INSERT INTO bloom_support.tickets(conversation_id,product,kind,channel,subject,summary,status,automation,created_at)
    VALUES(c,'crm','bug','staff','Test checkout is broken','','working','paused',now()-interval '15 days') RETURNING id INTO real_t;
  PERFORM bloom_support.sweep_deadlines();
  SELECT id INTO real_e FROM bloom_support.escalations WHERE ticket_id=real_t AND reason='ticket_overdue' AND status='open';
  IF real_e IS NULL THEN RAISE EXCEPTION 'genuine unanswered paused case suppressed'; END IF;
  UPDATE bloom_support.escalations SET due_at=now()-interval '1 minute',fallback_level=1 WHERE id=real_e;
  PERFORM bloom_support.sweep_deadlines();
  IF NOT (SELECT status='open' AND fallback_level=2 AND due_at>=now()+interval '23 hours' FROM bloom_support.escalations WHERE id=real_e) THEN RAISE EXCEPTION 'fallback/backoff incorrect'; END IF;
  UPDATE bloom_support.escalations SET due_at=now()-interval '1 minute',fallback_level=17 WHERE id=real_e;
  PERFORM bloom_support.sweep_deadlines();
  IF NOT (SELECT status='open' AND fallback_level=2 FROM bloom_support.escalations WHERE id=real_e) THEN RAISE EXCEPTION 'unbounded ladder remains'; END IF;
  -- Non-response blockers never disappear just because a reply was sent.
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,detail,dedupe_key,due_at)
    VALUES(t,'both','engineering_start','Needs approval','engineering:'||t,now()+interval '1 hour') RETURNING id INTO e;
  UPDATE bloom_support.tickets SET next_action_due_at=NULL WHERE id=t;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT status FROM bloom_support.escalations WHERE id=e)<>'open' THEN RAISE EXCEPTION 'engineering decision wrongly closed'; END IF;
  IF has_function_privilege('authenticated','bloom_support.record_external_response(uuid,uuid,timestamptz,text)','execute') OR has_function_privilege('anon','bloom_support.record_external_response(uuid,uuid,timestamptz,text)','execute') THEN RAISE EXCEPTION 'public response evidence privilege'; END IF;
  UPDATE bloom_support.principals SET role='support' WHERE id=a;
  BEGIN
    PERFORM bloom_support.record_external_response(a,t,responded,'gmail:sent:untrusted');
    RAISE EXCEPTION 'untrusted evidence accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
\echo 'bloom-support-escalation-reconciliation: all assertions passed'
