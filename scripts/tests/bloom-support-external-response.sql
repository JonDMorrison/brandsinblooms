\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261113145619_bloom_support_escalation_reconciliation.sql
\ir ../../supabase/migrations/20261118050206_bloom_support_external_response.sql
DO $$
DECLARE a uuid:=gen_random_uuid(); client uuid:=gen_random_uuid(); conv uuid; t uuid; inbound uuid; e uuid; eng uuid;
  req jsonb; changed jsonb; result jsonb; sent timestamptz:=now()-interval '1 hour'; n bigint; field text;
BEGIN
  INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role) VALUES
    (a,'user',gen_random_uuid(),'crm','operator-external@example.test','Fixture','platform_admin'),
    (client,'user',gen_random_uuid(),'crm','requester-external@example.test','Fixture','client');
  INSERT INTO bloom_support.conversations(channel,subject,requester_id,reply_to_email)
    VALUES('email','Synthetic request',client,'requester-external@example.test') RETURNING id INTO conv;
  INSERT INTO bloom_support.tickets(conversation_id,requester_id,product,channel,subject,summary,status,automation,owner_id,created_at)
    VALUES(conv,client,'crm','email','Synthetic request','','needs_owner','paused',a,now()-interval '3 days') RETURNING id INTO t;
  INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_id,author_kind,visibility,direction,body,created_at)
    VALUES(conv,t,client,'client','public','inbound','Synthetic inquiry',now()-interval '2 days') RETURNING id INTO inbound;
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,detail,dedupe_key)
    VALUES(t,'both','ticket_overdue','Synthetic deadline','external-test:'||t) RETURNING id INTO e;
  INSERT INTO bloom_support.escalations(ticket_id,audience,reason,detail,dedupe_key)
    VALUES(t,'both','engineering_escalated','Synthetic blocker','external-engineering:'||t) RETURNING id INTO eng;
  PERFORM bloom_support.enqueue_job('escalate',t,NULL,'email:escalation',jsonb_build_object('escalation_id',e),'external-job:'||t);
  req := jsonb_build_object('version',(SELECT version FROM bloom_support.tickets WHERE id=t),'account_id',NULL,
    'inbound_message_id',inbound,'provider','gmail','mailbox','operator-external@example.test','provider_message_id','syntheticMessage001',
    'recipient','requester-external@example.test','sent_at',sent,'source_ref','private:verified-synthetic-evidence','substantive',true);
  SELECT count(*) INTO n FROM bloom_support.jobs;
  -- Wrong identities and stale review all reject atomically.
  FOREACH field IN ARRAY ARRAY['recipient','inbound_message_id','version','account_id'] LOOP
    changed := req || CASE field WHEN 'recipient' THEN '{"recipient":"wrong@example.test"}'::jsonb
      WHEN 'inbound_message_id' THEN jsonb_build_object(field,gen_random_uuid())
      WHEN 'account_id' THEN jsonb_build_object(field,gen_random_uuid())
      ELSE '{"version":999999}'::jsonb END;
    BEGIN
      PERFORM public.bloom_support_reconcile_external_response(a,t,changed);
      RAISE EXCEPTION 'accepted invalid %',field;
    EXCEPTION WHEN serialization_failure THEN NULL; END;
  END LOOP;
  BEGIN
    PERFORM public.bloom_support_reconcile_external_response(client,t,req);
    RAISE EXCEPTION 'client accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.bloom_support_reconcile_external_response(a,t,req||jsonb_build_object('sent_at',now()+interval '1 hour'));
    RAISE EXCEPTION 'future accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.bloom_support_reconcile_external_response(a,t,req||'{"substantive":false}');
    RAISE EXCEPTION 'acknowledgement accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  UPDATE bloom_support.tickets SET last_customer_message_at=now() WHERE id=t;
  req:=req||jsonb_build_object('version',(SELECT version FROM bloom_support.tickets WHERE id=t));
  BEGIN
    PERFORM public.bloom_support_reconcile_external_response(a,t,req);
    RAISE EXCEPTION 'newer inbound lost';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  UPDATE bloom_support.tickets SET last_customer_message_at=now()-interval '2 days' WHERE id=t;
  req:=req||jsonb_build_object('version',(SELECT version FROM bloom_support.tickets WHERE id=t));
  result:=public.bloom_support_reconcile_external_response(a,t,req);
  IF result->>'delivery'<>'not_verified' OR result->>'duplicate'<>'false' THEN RAISE EXCEPTION 'receipt inaccurate'; END IF;
  IF NOT EXISTS(SELECT 1 FROM bloom_support.tickets WHERE id=t AND status='needs_owner' AND owner_id=a AND automation='paused'
    AND first_response_at=sent AND last_team_message_at=sent) THEN RAISE EXCEPTION 'timing/owner/status changed incorrectly'; END IF;
  IF NOT EXISTS(SELECT 1 FROM bloom_support.external_response_receipts WHERE ticket_id=t AND sent_at=sent AND imported_at=now()) THEN RAISE EXCEPTION 'provenance times wrong'; END IF;
  IF (SELECT status FROM bloom_support.escalations WHERE id=e)<>'resolved' OR (SELECT status FROM bloom_support.escalations WHERE id=eng)<>'open' THEN RAISE EXCEPTION 'wrong episode retired'; END IF;
  IF (SELECT count(*) FROM bloom_support.jobs)<>n OR EXISTS(SELECT 1 FROM bloom_support.jobs WHERE idempotency_key='external-job:'||t AND status<>'cancelled') THEN RAISE EXCEPTION 'jobs changed incorrectly'; END IF;
  result:=public.bloom_support_reconcile_external_response(a,t,req);
  IF result->>'duplicate'<>'true' OR (SELECT count(*) FROM bloom_support.external_response_receipts WHERE ticket_id=t)<>1 THEN RAISE EXCEPTION 'replay duplicated'; END IF;
  BEGIN
    PERFORM public.bloom_support_reconcile_external_response(a,t,req||jsonb_build_object('sent_at',sent-interval '1 minute'));
    RAISE EXCEPTION 'changed evidence accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF bloom_support.external_response_alert_detail('approaching_deadline',jsonb_build_object('tickets',jsonb_build_array(jsonb_build_object('id',t)),'summary','old')) IS NOT NULL THEN RAISE EXCEPTION 'stale prebreach still visible'; END IF;
  IF bloom_support.external_response_alert_detail('escalation_unanswered',jsonb_build_object('escalation_id',e)) IS NOT NULL THEN RAISE EXCEPTION 'stale fallback still visible'; END IF;
  IF bloom_support.external_response_alert_detail('approaching_deadline','{"tickets":12}') IS DISTINCT FROM '{"tickets":12}'::jsonb THEN RAISE EXCEPTION 'unknown alert hidden'; END IF;
  result:=bloom_support.external_response_alert_detail('approaching_deadline',jsonb_build_object('tickets',jsonb_build_array(jsonb_build_object('id',t),jsonb_build_object('id','unknown')),'summary','old'));
  IF jsonb_array_length(result->'tickets')<>1 OR result->>'summary'='old' THEN RAISE EXCEPTION 'mixed alert incorrect'; END IF;
  -- Independent next-action reminders still work after historical import.
  UPDATE bloom_support.tickets SET next_action_due_at=now()-interval '1 minute' WHERE id=t;
  PERFORM bloom_support.sweep_deadlines();
  IF NOT EXISTS(SELECT 1 FROM bloom_support.escalations WHERE ticket_id=t AND reason='ticket_overdue' AND status='open') THEN RAISE EXCEPTION 'future legitimate reminder lost'; END IF;
  IF has_function_privilege('authenticated','public.bloom_support_reconcile_external_response(uuid,uuid,jsonb)','execute')
    OR has_function_privilege('anon','public.bloom_support_reconcile_external_response(uuid,uuid,jsonb)','execute')
    OR has_table_privilege('service_role','bloom_support.external_response_receipts','SELECT') THEN RAISE EXCEPTION 'evidence exposed'; END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-external-response: all assertions passed'
