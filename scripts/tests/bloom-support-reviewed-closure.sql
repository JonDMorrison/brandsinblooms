\set ON_ERROR_STOP on
-- Run after bloom-support-db.sql against its disposable database only.
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261112180000_bloom_support_reviewed_closure.sql
CREATE FUNCTION pg_temp.reviewed_close(t uuid, evidence jsonb, expected_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    UPDATE bloom_support.tickets SET status='resolved', resolution_evidence=evidence WHERE id=t;
  EXCEPTION WHEN OTHERS THEN
    IF expected_error IS NOT NULL AND position(expected_error IN SQLERRM)>0 THEN RETURN; END IF;
    RAISE;
  END;
  IF expected_error IS NOT NULL THEN RAISE EXCEPTION 'expected rejection: %', expected_error; END IF;
  UPDATE bloom_support.tickets SET status='working' WHERE id=t;
END $$;
DO $$
DECLARE c uuid; e uuid; t uuid; child uuid; proof jsonb; verification jsonb;
BEGIN
  INSERT INTO bloom_support.conversations(channel,subject) VALUES ('staff','Closure contract') RETURNING id INTO c;
  INSERT INTO bloom_support.engineering_issues(title,product,status,version)
    VALUES ('Closure contract','crm','verified',7) RETURNING id INTO e;
  INSERT INTO bloom_support.tickets(conversation_id,engineering_issue_id,product,kind,channel,subject,summary,status,created_at)
    VALUES(c,e,'crm','bug','staff','Closure contract','','working',now()-interval '2 hours') RETURNING id INTO t;
  verification := jsonb_build_object('passed',true,'scope','ticket_flow','ticket_ids',jsonb_build_array(t::text),'started_at',now()-interval '1 hour');
  UPDATE bloom_support.engineering_issues SET verification=jsonb_build_object('passed',true,'scope','ticket_flow','ticket_ids',jsonb_build_array(t::text),'started_at',now()-interval '1 hour') WHERE id=e;
  UPDATE bloom_support.engineering_issues SET deployment='{"state":"success"}' WHERE id=e;
  proof := jsonb_build_object('via','send-and-solve','resolved_by','person','engineering_issue_id',e,'engineering_version',7,
    'verification',verification,'deployment',jsonb_build_object('state','success'));
  PERFORM pg_temp.reviewed_close(t,proof);
  UPDATE bloom_support.engineering_issues SET verification=jsonb_set(verification,'{passed}','"true"') WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof || jsonb_build_object('verification',(SELECT verification FROM bloom_support.engineering_issues WHERE id=e)), 'ticket-bound production evidence');
  UPDATE bloom_support.engineering_issues SET verification=jsonb_set(verification,'{passed}','true') WHERE id=e;
  UPDATE bloom_support.engineering_issues SET verification=jsonb_set(verification,'{started_at}',to_jsonb(now()+interval '1 day')) WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof || jsonb_build_object('verification',(SELECT verification FROM bloom_support.engineering_issues WHERE id=e)), 'requires a fresh investigation');
  UPDATE bloom_support.engineering_issues SET verification=proof->'verification' WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof || '{"engineering_version":6}', 'reviewed engineering evidence changed');
  PERFORM pg_temp.reviewed_close(t,proof || '{"verification":{"passed":true}}','ticket-bound production evidence');
  UPDATE bloom_support.engineering_issues SET status='rolled_back' WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof,'outcome no longer supports');
  UPDATE bloom_support.engineering_issues SET status='verified' WHERE id=e;
  INSERT INTO bloom_support.tickets(conversation_id,product,kind,channel,subject,summary,status,created_at,merged_into)
    VALUES(c,'crm','bug','staff','Merged source','','working',now()-interval '2 hours',t) RETURNING id INTO child;
  INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_kind,visibility,direction,body,created_at)
    VALUES(c,child,'client','public','inbound','Still broken',now());
  PERFORM pg_temp.reviewed_close(t,proof,'requires a fresh investigation');
  -- Manual resolution is a different contract and remains available.
  PERFORM pg_temp.reviewed_close(t,proof - 'via');
  UPDATE bloom_support.engineering_issues SET status='not_reproduced', reproduction=jsonb_build_object('checked_at',now()) WHERE id=e;
  proof := jsonb_build_object('via','send-and-solve','resolved_by','person','engineering_issue_id',e,'engineering_version',7,
    'verification',jsonb_build_object('passed',true),'no_deploy_reason','Investigated; no defect reproduced');
  PERFORM pg_temp.reviewed_close(t,proof);
  UPDATE bloom_support.engineering_issues SET reproduction=jsonb_build_object('checked_at',now()+interval '1 day') WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof,'requires a fresh investigation');
  UPDATE bloom_support.engineering_issues SET reproduction='{}',updated_at=now()+interval '1 day' WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof,'investigation closure needs');
  UPDATE bloom_support.engineering_issues SET status='open',reproduction=jsonb_build_object('result','not_reproduced','checked_at',now()) WHERE id=e;
  PERFORM pg_temp.reviewed_close(t,proof);
END $$;
ROLLBACK;
\echo 'bloom-support-reviewed-closure: all assertions passed'
