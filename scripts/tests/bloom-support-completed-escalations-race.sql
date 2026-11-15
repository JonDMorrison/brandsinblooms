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
INSERT INTO bloom_support.conversations(id,channel,subject) VALUES('fc000000-0000-4000-8000-000000000001','staff','Completed race');
INSERT INTO bloom_support.engineering_issues(id,title,product,status,merge_sha,deployment,verification)
VALUES('fc000000-0000-4000-8000-000000000003','Verified race','crm','verified','race-merge','{"state":"success"}',
 jsonb_build_object('passed',true,'scope','ticket_flow','started_at',now()-interval '1 hour','ticket_ids',jsonb_build_array('fc000000-0000-4000-8000-000000000002')));
INSERT INTO bloom_support.tickets(id,conversation_id,product,channel,subject,summary,status,stage,engineering_issue_id,resolution_verified,resolved_at,resolution_evidence)
SELECT 'fc000000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','crm','staff','Completed race','','resolved','resolved',id,true,now(),
 jsonb_build_object('engineering_issue_id',id,'merge_sha',merge_sha,'deployment',deployment,'verification',verification)
 FROM bloom_support.engineering_issues WHERE id='fc000000-0000-4000-8000-000000000003';
INSERT INTO bloom_support.escalations(id,ticket_id,engineering_issue_id,audience,reason,created_at,due_at)
VALUES('fc000000-0000-4000-8000-000000000004','fc000000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000003','both','engineering_escalated',now()-interval '2 hours',now()-interval '1 minute');
COMMIT;
SELECT format('dbname=%s user=%s host=%s port=%s',current_database(),current_user,
 coalesce(pg_catalog.host(inet_server_addr()),btrim(split_part(current_setting('unix_socket_directories'),',',1))),
 coalesce(inet_server_port(),current_setting('port')::integer)) AS test_connection \gset
SELECT dblink_connect('change', :'test_connection');
SELECT dblink_connect('cleanup', :'test_connection');
SELECT dblink_exec('change','BEGIN');
SELECT dblink_exec('change',$q$UPDATE bloom_support.tickets SET status='working',resolution_verified=false WHERE id='fc000000-0000-4000-8000-000000000002'$q$);
SELECT result FROM dblink('cleanup','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
DO $$ BEGIN IF (SELECT status FROM bloom_support.escalations WHERE id='fc000000-0000-4000-8000-000000000004')<>'open' THEN RAISE EXCEPTION 'closed during reopening'; END IF; END $$;
SELECT dblink_exec('change','COMMIT');
SELECT result FROM dblink('cleanup','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
DO $$ BEGIN IF (SELECT status FROM bloom_support.escalations WHERE id='fc000000-0000-4000-8000-000000000004')<>'open' THEN RAISE EXCEPTION 'closed reopened work'; END IF; END $$;
UPDATE bloom_support.tickets SET status='resolved',resolution_verified=true,resolved_at=now() WHERE id='fc000000-0000-4000-8000-000000000002';
SELECT dblink_exec('change','BEGIN');
SELECT dblink_exec('change',$q$UPDATE bloom_support.engineering_issues SET deployment='{"state":"rollback_point_unproven"}' WHERE id='fc000000-0000-4000-8000-000000000003'$q$);
SELECT result FROM dblink('cleanup','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
DO $$ BEGIN IF (SELECT status FROM bloom_support.escalations WHERE id='fc000000-0000-4000-8000-000000000004')<>'open' THEN RAISE EXCEPTION 'closed while evidence changing'; END IF; END $$;
SELECT dblink_exec('change','ROLLBACK');
SELECT dblink_exec('change','BEGIN');
SELECT result FROM dblink('change','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
SELECT result FROM dblink('cleanup','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
SELECT dblink_exec('change','COMMIT');
SELECT result FROM dblink('cleanup','SELECT bloom_support.reconcile_completed_engineering_escalations()') AS x(result integer);
SELECT dblink_disconnect('change');
SELECT dblink_disconnect('cleanup');
DO $$ BEGIN
 IF (SELECT status FROM bloom_support.escalations WHERE id='fc000000-0000-4000-8000-000000000004')<>'resolved' THEN RAISE EXCEPTION 'safe completion not reconciled'; END IF;
 IF (SELECT count(*) FROM bloom_support.activity WHERE ticket_id='fc000000-0000-4000-8000-000000000002' AND action='escalation.engineering_completed')<>1 THEN RAISE EXCEPTION 'concurrent duplicate reconciliation'; END IF;
END $$;
\echo 'bloom-support-completed-escalations-race: all assertions passed'
