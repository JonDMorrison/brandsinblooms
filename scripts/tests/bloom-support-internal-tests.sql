\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261114135139_bloom_support_internal_tests_and_reminders.sql
DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid; t uuid; customer uuid; eng uuid; e uuid; approval uuid; failure uuid;
  r jsonb; before_report jsonb; before_jobs bigint; before_notices bigint; v int; n bigint;
BEGIN
  INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role)
    VALUES(a,'user',gen_random_uuid(),'crm',a::text||'@example.test','Classification fixture','platform_admin');
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Internal test fixture') RETURNING id INTO c;
  INSERT INTO bloom_support.engineering_issues(title,product,status,version,deployment)
    VALUES('Internal fixture repair','cms','escalated',19,'{"state":"rollback_point_unproven"}') RETURNING id INTO eng;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status,stage,engineering_issue_id,tags,context)
    VALUES(c,'cms','staff','Internal end-to-end test','','working','releasing',eng,ARRAY['internal_test'],'{"internal_test":true}') RETURNING id INTO t;
  INSERT INTO bloom_support.tickets(conversation_id,product,channel,subject,summary,status)
    VALUES(c,'cms','staff','Customer test checkout is broken','','working') RETURNING id INTO customer;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,detail,dedupe_key,due_at,fallback_level)
    VALUES(t,eng,'both','engineering_escalated','Rollback point unproven','fixture:internal:'||t,now()-interval '1 minute',24) RETURNING id INTO e;
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,detail,dedupe_key,due_at)
    VALUES(customer,'both','ticket_overdue','Real deadline','fixture:customer:'||customer,now()+interval '1 hour');
  INSERT INTO bloom_support.outbound_emails(ticket_id,purpose,to_email,subject,body,rfc_message_id,idempotency_key,status)
    VALUES(t,'acknowledgement','fixture@example.test','Ack','Received','ack:'||t,'ack:'||t,'delivered');
  INSERT INTO bloom_support.outbound_emails(ticket_id,purpose,to_email,subject,body,rfc_message_id,idempotency_key,status)
    SELECT t,'progress','fixture@example.test','Progress','Working','progress:'||t||':'||i,'progress:'||t||':'||i,
      CASE WHEN i=1 THEN 'delivered' ELSE 'sent' END FROM generate_series(1,5) i;
  INSERT INTO bloom_support.outbound_emails(ticket_id,purpose,to_email,subject,body,rfc_message_id,idempotency_key,status)
    SELECT t,'progress','fixture@example.test','Unsent','Not delivered','unsent:'||t||':'||s,'unsent:'||t||':'||s,s
      FROM unnest(ARRAY['queued','failed','suppressed','uncertain','bounced','complained']) s;
  INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,purpose,delivery)
    SELECT c,customer,'bloom','public','outbound','Fixture '||s,'progress',s FROM unnest(ARRAY['sent','delivered','queued','failed','suppressed']) s;
  before_report:=public.bloom_support_digest_report(now()-interval '1 day');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(before_report->'needs_you') x WHERE x->>'id'=t::text)
    OR (SELECT internal_test FROM bloom_support.tickets WHERE id=t) THEN
    RAISE EXCEPTION 'untrusted subject/tags/context classified test';
  END IF;
  SELECT version INTO v FROM bloom_support.tickets WHERE id=t;
  SELECT count(*) INTO before_jobs FROM bloom_support.jobs;
  r:=bloom_support.set_internal_test(a,t,v,true,'staff:verified-test-request');
  IF NOT (r->>'changed')::boolean THEN RAISE EXCEPTION 'classification not recorded'; END IF;
  IF (SELECT count(*) FROM bloom_support.jobs)<>before_jobs THEN RAISE EXCEPTION 'classification queued communication/work'; END IF;
  IF NOT (SELECT internal_test AND status='working' AND stage='releasing' AND automation='auto'
      AND executor='bloom' AND owner_id IS NULL AND first_response_at IS NULL AND NOT resolution_verified FROM bloom_support.tickets WHERE id=t)
    THEN RAISE EXCEPTION 'classification changed execution/response/resolution'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bloom_support.activity WHERE ticket_id=t AND actor_id=a
      AND action='ticket.internal_test_classified' AND detail->>'source_ref'='staff:verified-test-request') THEN RAISE EXCEPTION 'missing audit'; END IF;
  BEGIN
    PERFORM bloom_support.set_internal_test(a,t,v,false,'staff:stale-version');
    RAISE EXCEPTION 'stale version accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  r:=bloom_support.set_internal_test(a,t,v+1,true,'staff:verified-test-request');
  IF (r->>'changed')::boolean OR (r->>'version')::int<>v+1 THEN RAISE EXCEPTION 'repeated attestation changed ticket'; END IF;
  -- Customer totals omit only the attested test; a real customer mentioning tests remains.
  r:=public.bloom_support_digest_report(now()-interval '1 day');
  IF (r#>>'{counts,open}')::int<>(before_report#>>'{counts,open}')::int-1 THEN RAISE EXCEPTION 'customer total incorrect'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'needs_you') x WHERE x->>'id'=t::text)
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'needs_you') x WHERE x->>'id'=customer::text) THEN RAISE EXCEPTION 'needs_you classification incorrect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'internal_tests') x WHERE x->>'id'=t::text
      AND x->>'status'='working' AND x->>'stage'='releasing' AND x->>'engineering_status'='escalated'
      AND x->>'deployment_state'='rollback_point_unproven' AND x->>'first_response_at' IS NULL
      AND x#>>'{communication,acknowledgement_delivered}'='1' AND x#>>'{communication,progress_sent}'='5'
      AND x#>>'{communication,progress_delivered}'='1') THEN RAISE EXCEPTION 'test blocker/delivery evidence missing'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'repairs') x WHERE x->>'title'='Internal fixture repair') THEN RAISE EXCEPTION 'internal repair in customer count'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(r->'said') x WHERE x->>'body' LIKE 'Fixture %')<>2 THEN RAISE EXCEPTION 'unsent messages represented as sent'; END IF;
  -- Read the actual verification contract without treating a passing check as
  -- release acceptance or suppressing the rollback blocker.
  FOREACH r IN ARRAY ARRAY['{"passed":false}'::jsonb,'{"passed":true,"scope":"other"}'::jsonb] LOOP
    UPDATE bloom_support.engineering_issues SET verification=r WHERE id=eng;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.bloom_support_digest_report(now()-interval '1 day')->'internal_tests') x
      WHERE x->>'id'=t::text AND x->>'deployment_state'='rollback_point_unproven'
      AND x->>'verification_summary'=CASE WHEN r->'passed'='true'::jsonb
        THEN 'A passing check is recorded; affected-flow coverage and release binding still require review'
        ELSE 'A failed check is recorded' END) THEN RAISE EXCEPTION 'recorded check misrepresented'; END IF;
  END LOOP;
  UPDATE bloom_support.engineering_issues SET verification=NULL WHERE id=eng;
  -- Shared engineering must remain visible in customer repairs.
  UPDATE bloom_support.tickets SET engineering_issue_id=eng WHERE id=customer;
  r:=public.bloom_support_digest_report(now()-interval '1 day');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'repairs') x WHERE x->>'title'='Internal fixture repair') THEN RAISE EXCEPTION 'shared customer repair hidden'; END IF;
  -- Generic ticket updates cannot set the protected classification.
  PERFORM bloom_support.update_ticket(a,customer,'{"internal_test":true}');
  IF (SELECT internal_test FROM bloom_support.tickets WHERE id=customer) THEN RAISE EXCEPTION 'generic update classified test'; END IF;
  -- Legacy level 24 normalizes without closing, pausing or restarting the issue.
  PERFORM bloom_support.sweep_deadlines();
  IF NOT (SELECT status='open' AND fallback_level=2 AND due_at>=now()+interval '23 hours' FROM bloom_support.escalations WHERE id=e) THEN RAISE EXCEPTION 'engineering backoff failed'; END IF;
  IF NOT (SELECT status='escalated' AND version=19 AND deployment->>'state'='rollback_point_unproven' FROM bloom_support.engineering_issues WHERE id=eng) THEN RAISE EXCEPTION 'engineering state changed'; END IF;
  SELECT count(*) INTO before_notices FROM bloom_support.notifications;
  SELECT count(*) INTO before_jobs FROM bloom_support.jobs;
  UPDATE bloom_support.escalations SET due_at=now()-interval '1 minute' WHERE id=e;
  PERFORM bloom_support.sweep_deadlines();
  IF (SELECT count(*) FROM bloom_support.notifications)<>before_notices OR (SELECT count(*) FROM bloom_support.jobs)<>before_jobs THEN RAISE EXCEPTION 'duplicate daily reminder'; END IF;
  r:=public.bloom_support_digest_report(now()-interval '1 day');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'alerts') x WHERE x#>>'{detail,escalation_id}'=e::text) THEN RAISE EXCEPTION 'test escalation counted as customer alert'; END IF;
  -- A new escalation episode, failure and approval are independent and immediate.
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,detail,dedupe_key,due_at)
    VALUES(t,eng,'both','engineering_escalated','New blocker','new-episode:'||t,now()-interval '1 minute');
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,dedupe_key,due_at,fallback_level)
    VALUES(t,eng,'both','engineering_failed','new-failure:'||t,now()-interval '1 minute',2) RETURNING id INTO failure;
  INSERT INTO bloom_support.escalations(ticket_id,engineering_issue_id,audience,reason,dedupe_key,due_at,fallback_level)
    VALUES(t,eng,'jon','engineering_awaiting_approval','new-approval:'||t,now()-interval '1 minute',2) RETURNING id INTO approval;
  PERFORM bloom_support.sweep_deadlines();
  IF NOT EXISTS (SELECT 1 FROM bloom_support.jobs WHERE idempotency_key LIKE 'escalate:%:fallback:1' AND payload->>'escalation_id' IN
      (SELECT id::text FROM bloom_support.escalations WHERE dedupe_key='new-episode:'||t)) THEN RAISE EXCEPTION 'new blocker suppressed'; END IF;
  IF (SELECT count(*) FROM bloom_support.escalations WHERE id IN (failure,approval) AND status='open' AND fallback_level=3 AND due_at<now()+interval '5 hours')<>2 THEN RAISE EXCEPTION 'failure/approval path changed'; END IF;
  -- Classification is reversible with new evidence, without closing the test.
  PERFORM bloom_support.set_internal_test(a,t,v+1,false,'staff:customer-work-confirmed');
  r:=public.bloom_support_digest_report(now()-interval '1 day');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'internal_tests') x WHERE x->>'id'=t::text) THEN RAISE EXCEPTION 'reclassification missing'; END IF;
  FOREACH v IN ARRAY ARRAY[1,2,3] LOOP
    UPDATE bloom_support.principals SET role=CASE v WHEN 1 THEN 'support' WHEN 2 THEN 'client' ELSE 'platform_admin' END,active=(v<>3) WHERE id=a;
    BEGIN
      PERFORM bloom_support.set_internal_test(a,t,(SELECT version FROM bloom_support.tickets WHERE id=t),true,'staff:untrusted-request');
      RAISE EXCEPTION 'untrusted classification accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  IF has_function_privilege('anon','bloom_support.set_internal_test(uuid,uuid,integer,boolean,text)','execute')
    OR has_function_privilege('authenticated','bloom_support.set_internal_test(uuid,uuid,integer,boolean,text)','execute')
    OR has_function_privilege('service_role','bloom_support.set_internal_test(uuid,uuid,integer,boolean,text)','execute')
    OR has_function_privilege('authenticated','public.bloom_support_digest_report(timestamptz)','execute') THEN RAISE EXCEPTION 'public classification/report privilege'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-internal-tests: all assertions passed'
