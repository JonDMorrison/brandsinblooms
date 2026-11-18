\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261113145619_bloom_support_escalation_reconciliation.sql
\ir ../../supabase/migrations/20261112183000_bloom_support_message_ticket_lock.sql
\ir ../../supabase/migrations/20261118050206_bloom_support_external_response.sql
CREATE TABLE bloom_support.external_response_test_request(actor uuid,ticket uuid,client uuid,request jsonb);
DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); conv uuid; t uuid; m uuid;
BEGIN
 INSERT INTO bloom_support.principals(id,kind,auth_user_id,product,email,display_name,role) VALUES
 (a,'user',gen_random_uuid(),'crm','race-operator@example.test','Fixture','platform_admin'),
 (c,'user',gen_random_uuid(),'crm','race-client@example.test','Fixture','client');
 INSERT INTO bloom_support.conversations(channel,subject,requester_id,reply_to_email)
 VALUES('email','Race fixture',c,'race-client@example.test') RETURNING id INTO conv;
 INSERT INTO bloom_support.tickets(conversation_id,requester_id,product,channel,subject,summary,status,automation,created_at)
 VALUES(conv,c,'crm','email','Race fixture','','working','paused',now()-interval '2 days') RETURNING id INTO t;
 INSERT INTO bloom_support.messages(conversation_id,ticket_id,author_id,author_kind,visibility,direction,body,created_at)
 VALUES(conv,t,c,'client','public','inbound','Synthetic',now()-interval '1 day') RETURNING id INTO m;
 INSERT INTO bloom_support.external_response_test_request VALUES(a,t,c,jsonb_build_object('version',(SELECT version FROM bloom_support.tickets WHERE id=t),
 'account_id',NULL,'inbound_message_id',m,'provider','gmail','mailbox','race-operator@example.test','provider_message_id','syntheticRaceMessage',
 'recipient','race-client@example.test','sent_at',now()-interval '1 hour','source_ref','private:race-evidence','substantive',true));
END $$;
COMMIT;
SELECT format('dbname=%s user=%s host=%s port=%s',current_database(),current_user,
 coalesce(pg_catalog.host(inet_server_addr()),btrim(split_part(current_setting('unix_socket_directories'),',',1))),
 coalesce(inet_server_port(),current_setting('port')::integer)) AS test_connection \gset
SELECT dblink_connect('external_owner', :'test_connection');
SELECT dblink_connect('external_replay', :'test_connection');
SELECT dblink_connect('external_inbound', :'test_connection');
SELECT dblink_exec('external_owner','BEGIN');
SELECT result FROM dblink('external_owner','SELECT public.bloom_support_reconcile_external_response(actor,ticket,request) FROM bloom_support.external_response_test_request') AS r(result jsonb);
SELECT dblink_send_query('external_replay','SELECT public.bloom_support_reconcile_external_response(actor,ticket,request) FROM bloom_support.external_response_test_request');
SELECT dblink_send_query('external_inbound',$sql$SELECT bloom_support.add_message(client,ticket,'{"body":"A newer question","visibility":"public","idempotency_key":"external-race-inbound"}') FROM bloom_support.external_response_test_request$sql$);
SELECT dblink_exec('external_owner','COMMIT');
SELECT result->>'duplicate'='true' AS replay_duplicate FROM dblink_get_result('external_replay') AS r(result jsonb) \gset
\if :replay_duplicate
\else
 \quit 4
\endif
SELECT result FROM dblink_get_result('external_inbound') AS r(result jsonb);
SELECT dblink_disconnect('external_owner');
SELECT dblink_disconnect('external_replay');
SELECT dblink_disconnect('external_inbound');
DO $$
DECLARE x record; before_count bigint;
BEGIN
 SELECT * INTO x FROM bloom_support.external_response_test_request;
 IF (SELECT count(*) FROM bloom_support.external_response_receipts WHERE ticket_id=x.ticket)<>1 THEN RAISE EXCEPTION 'concurrent replay duplicated'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bloom_support.tickets WHERE id=x.ticket AND status<>'resolved' AND last_customer_message_at>last_team_message_at) THEN
 RAISE EXCEPTION 'concurrent inbound lost'; END IF;
 SELECT count(*) INTO before_count FROM bloom_support.external_response_receipts;
 BEGIN
  PERFORM public.bloom_support_reconcile_external_response(x.actor,x.ticket,x.request || jsonb_build_object('version',(SELECT version FROM bloom_support.tickets WHERE id=x.ticket),'provider_message_id','differentStaleEvidence'));
  RAISE EXCEPTION 'newer inbound accepted stale evidence';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM bloom_support.external_response_receipts)<>before_count THEN RAISE EXCEPTION 'failed evidence partially committed'; END IF;
END $$;
\echo 'bloom-support-external-response-race: all assertions passed'
