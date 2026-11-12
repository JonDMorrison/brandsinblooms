\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261112180000_bloom_support_reviewed_closure.sql
\ir ../../supabase/migrations/20261112184000_bloom_support_atomic_closure.sql
DO $$
DECLARE actor uuid:=gen_random_uuid(); c uuid; e uuid; t uuid; request jsonb; proof jsonb; first_result jsonb;
  before_messages bigint; before_jobs bigint; v integer;
BEGIN
  INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role)
    VALUES(actor,'user',gen_random_uuid(),'crm',actor::text||'@example.test','Atomic closure fixture','platform_admin');
  INSERT INTO bloom_support.conversations(channel,subject) VALUES('staff','Atomic closure fixture') RETURNING id INTO c;
  INSERT INTO bloom_support.engineering_issues(title,product,status,version,reproduction)
    VALUES('Atomic closure fixture','crm','not_reproduced',1,jsonb_build_object('checked_at',now()-interval '1 hour')) RETURNING id INTO e;
  INSERT INTO bloom_support.tickets(conversation_id,engineering_issue_id,product,kind,channel,subject,summary,status,created_at)
    VALUES(c,e,'crm','bug','staff','Atomic closure fixture','','working',now()-interval '2 hours') RETURNING id INTO t;
  SELECT version INTO v FROM bloom_support.tickets WHERE id=t;
  proof:=jsonb_build_object('engineering_issue_id',e,'engineering_version',1,'verification',jsonb_build_object('passed',true),'no_deploy_reason','Investigation could not reproduce');
  request:=jsonb_build_object('body','We investigated but could not reproduce this.','version',v,'idempotency_key','atomic-closure-fixture','resolution_summary','Investigated','resolution_evidence',proof);
  INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
    VALUES(c,t,'client','public','inbound','New evidence after the investigation',now()-interval '1 minute');
  SELECT count(*) INTO before_messages FROM bloom_support.messages WHERE ticket_id=t;
  SELECT count(*) INTO before_jobs FROM bloom_support.jobs WHERE ticket_id=t;
  -- Simulate an operator refreshing the ticket version, but not rerunning the investigation.
  SELECT version INTO v FROM bloom_support.tickets WHERE id=t;
  request:=request||jsonb_build_object('version',v);
  BEGIN
    PERFORM public.bloom_support_send_and_solve(actor,t,request);
    RAISE EXCEPTION 'stale evidence unexpectedly closed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT count(*) FROM bloom_support.messages WHERE ticket_id=t)<>before_messages
    OR (SELECT count(*) FROM bloom_support.jobs WHERE ticket_id=t)<>before_jobs
    OR EXISTS(SELECT 1 FROM bloom_support.reviewed_closure_receipts WHERE actor_id=actor)
    OR (SELECT status FROM bloom_support.tickets WHERE id=t)='resolved' THEN
    RAISE EXCEPTION 'failed closure left message, outbox, receipt or solved status';
  END IF;
  UPDATE bloom_support.engineering_issues SET reproduction=jsonb_build_object('checked_at',now()) WHERE id=e;
  first_result:=public.bloom_support_send_and_solve(actor,t,request);
  IF public.bloom_support_send_and_solve(actor,t,request) IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'retry receipt changed'; END IF;
  IF (SELECT count(*) FROM bloom_support.messages WHERE ticket_id=t AND author_id=actor)<>1
    OR (SELECT status FROM bloom_support.tickets WHERE id=t)<>'resolved' THEN RAISE EXCEPTION 'atomic success/replay incorrect'; END IF;
  BEGIN
    PERFORM public.bloom_support_send_and_solve(actor,t,request||'{"body":"Changed reply"}');
    RAISE EXCEPTION 'changed retry accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF has_function_privilege('anon','public.bloom_support_send_and_solve(uuid,uuid,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.bloom_support_send_and_solve(uuid,uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC exposed without authenticated service gateway';
  END IF;
END $$;
ROLLBACK;
\echo 'bloom-support-atomic-closure: all assertions passed'
