\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261114135139_bloom_support_internal_tests_and_reminders.sql
INSERT INTO bloom_support.conversations(id,channel,subject)
VALUES('fb000000-0000-4000-8000-000000000001','staff','Reminder race');
INSERT INTO bloom_support.tickets(id,conversation_id,product,channel,subject,summary,status)
VALUES('fb000000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','crm','staff','Reminder race','','working');
INSERT INTO bloom_support.escalations(id,ticket_id,audience,reason,detail,dedupe_key,due_at,fallback_level)
VALUES('fb000000-0000-4000-8000-000000000003','fb000000-0000-4000-8000-000000000002','both','engineering_escalated','Still blocked','fixture:reminder-race',now()-interval '1 minute',24);
COMMIT;
SELECT format('dbname=%s user=%s host=%s port=%s',current_database(),current_user,
  coalesce(pg_catalog.host(inet_server_addr()),btrim(split_part(current_setting('unix_socket_directories'),',',1))),
  coalesce(inet_server_port(),current_setting('port')::integer)) AS test_connection \gset
SELECT dblink_connect('sweep_one', :'test_connection');
SELECT dblink_connect('sweep_two', :'test_connection');
SELECT dblink_exec('sweep_one','BEGIN');
SELECT result FROM dblink('sweep_one','SELECT bloom_support.sweep_deadlines()') AS x(result jsonb);
-- The first sweep retains the escalation row lock while the second scans.
SELECT result FROM dblink('sweep_two','SELECT bloom_support.sweep_deadlines()') AS x(result jsonb);
SELECT dblink_exec('sweep_one','COMMIT');
SELECT result FROM dblink('sweep_two','SELECT bloom_support.sweep_deadlines()') AS x(result jsonb);
SELECT dblink_disconnect('sweep_one');
SELECT dblink_disconnect('sweep_two');
DO $$
BEGIN
  IF (SELECT count(*) FROM bloom_support.jobs WHERE payload->>'escalation_id'='fb000000-0000-4000-8000-000000000003')<>1 THEN RAISE EXCEPTION 'concurrent sweeps duplicated reminder'; END IF;
  IF (SELECT count(*) FROM bloom_support.alerts WHERE detail->>'escalation_id'='fb000000-0000-4000-8000-000000000003')<>1 THEN RAISE EXCEPTION 'concurrent sweeps duplicated alert'; END IF;
  IF (SELECT count(*) FROM bloom_support.activity WHERE ticket_id='fb000000-0000-4000-8000-000000000002' AND action='escalation.fallback')<>1 THEN RAISE EXCEPTION 'concurrent sweeps repeated fallback'; END IF;
  IF EXISTS (SELECT 1 FROM bloom_support.notifications WHERE ticket_id='fb000000-0000-4000-8000-000000000002' AND kind='escalation.overdue' GROUP BY principal_id HAVING count(*)>1) THEN RAISE EXCEPTION 'concurrent sweeps duplicated staff notice'; END IF;
  IF NOT (SELECT fallback_level=2 AND status='open' AND due_at>now()+interval '23 hours' FROM bloom_support.escalations WHERE id='fb000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'concurrency lost open blocker/backoff'; END IF;
END $$;
\echo 'bloom-support-reminder-concurrency: all assertions passed'
