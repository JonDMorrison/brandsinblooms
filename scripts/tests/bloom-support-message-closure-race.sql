\set ON_ERROR_STOP on
-- Run only after bloom-support-db.sql, using its disposable database.
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261112183000_bloom_support_message_ticket_lock.sql
INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role)
VALUES('fa000000-0000-4000-8000-000000000001','user',gen_random_uuid(),'crm','closure-race@example.test','Closure race','client');
INSERT INTO bloom_support.conversations(id,channel,subject)
VALUES('fa000000-0000-4000-8000-000000000002','crm','Closure race');
INSERT INTO bloom_support.tickets(id,conversation_id,requester_id,product,kind,channel,subject,summary,status,automation,executor)
VALUES('fa000000-0000-4000-8000-000000000003','fa000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001',
  'crm','bug','crm','Closure race','','working','auto','bloom');
COMMIT;
SELECT format('dbname=%s user=%s host=%s port=%s', current_database(), current_user,
  coalesce(pg_catalog.host(inet_server_addr()), btrim(split_part(current_setting('unix_socket_directories'), ',', 1))),
  coalesce(inet_server_port(), current_setting('port')::integer)) AS test_connection \gset
SELECT dblink_connect('closure_owner', :'test_connection');
SELECT dblink_connect('client_reply', :'test_connection');
SELECT pid AS reply_pid FROM dblink('client_reply','SELECT pg_backend_pid()') AS p(pid integer) \gset
SELECT dblink_exec('closure_owner','BEGIN');
SELECT dblink_exec('closure_owner',$sql$
  UPDATE bloom_support.tickets SET status='resolved',resolution_evidence='{"resolved_by":"person"}',resolution_summary='Manual close'
  WHERE id='fa000000-0000-4000-8000-000000000003'
$sql$);
SELECT dblink_send_query('client_reply',$sql$
  SELECT bloom_support.add_message('fa000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000003',
    '{"body":"The issue is still present.","visibility":"public","idempotency_key":"closure-race-client"}')
$sql$);
-- Wait for an actual database lock wait rather than assuming thread timing.
SELECT set_config('bloom.test_reply_pid', :'reply_pid', false);
DO $$
DECLARE deadline timestamptz := clock_timestamp()+interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_stat_clear_snapshot();
    EXIT WHEN EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=current_setting('bloom.test_reply_pid')::integer AND wait_event_type='Lock');
    IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'client reply never waited behind closure'; END IF;
    PERFORM pg_sleep(0.01);
  END LOOP;
END $$;
SELECT dblink_exec('closure_owner','COMMIT');
SELECT result FROM dblink_get_result('client_reply') AS r(result jsonb);
SELECT dblink_disconnect('closure_owner');
SELECT dblink_disconnect('client_reply');
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM bloom_support.tickets WHERE id='fa000000-0000-4000-8000-000000000003'
    AND status='resolved' AND pending_review='reply_after_resolution') THEN
    RAISE EXCEPTION 'reply lost its post-resolution review state';
  END IF;
  IF (SELECT count(*) FROM bloom_support.jobs WHERE ticket_id='fa000000-0000-4000-8000-000000000003' AND kind='post_resolution_reply')<>1 THEN
    RAISE EXCEPTION 'reply was not queued for post-resolution routing exactly once';
  END IF;
  IF EXISTS(SELECT 1 FROM bloom_support.jobs WHERE ticket_id='fa000000-0000-4000-8000-000000000003' AND kind='triage') THEN
    RAISE EXCEPTION 'reply used stale pre-resolution routing';
  END IF;
END $$;
\echo 'bloom-support-message-closure-race: all assertions passed'
