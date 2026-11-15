\set ON_ERROR_STOP on
SELECT current_database()='bloom_support_test' AS isolated_database \gset
\if :isolated_database
\else
  \quit 3
\endif
BEGIN;
\ir ../../supabase/migrations/20261115191247_bloom_support_release_ticket_links.sql
INSERT INTO bloom_support.settings(key,value) VALUES('slack','{"enabled":true}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
INSERT INTO bloom_support.conversations(id,channel,subject) VALUES('fd000000-0000-4000-8000-000000000001','staff','Release link race');
INSERT INTO bloom_support.engineering_issues(id,title,product,repository,pr_number) VALUES('fd000000-0000-4000-8000-000000000003','Release link race','crm','JonDMorrison/brandsinblooms',77);
INSERT INTO bloom_support.tickets(id,conversation_id,product,channel,subject,summary,engineering_issue_id)
VALUES('fd000000-0000-4000-8000-000000000002','fd000000-0000-4000-8000-000000000001','crm','staff','Release link race','','fd000000-0000-4000-8000-000000000003');
COMMIT;
SELECT format('dbname=%s user=%s host=%s port=%s',current_database(),current_user,
 coalesce(pg_catalog.host(inet_server_addr()),btrim(split_part(current_setting('unix_socket_directories'),',',1))),
 coalesce(inet_server_port(),current_setting('port')::integer)) AS test_connection \gset
SELECT dblink_connect('release_one', :'test_connection');
SELECT dblink_connect('release_two', :'test_connection');
SELECT dblink_exec('release_one','BEGIN');
SELECT result FROM dblink('release_one',$q$SELECT public.bloom_support_enqueue_slack_github('fixture-release-race','github.pr_merged','https://github.com/JonDMorrison/brandsinblooms/pull/77','support')$q$) AS x(result jsonb);
SELECT dblink_send_query('release_two',$q$SELECT public.bloom_support_enqueue_slack_github('fixture-release-race','github.pr_merged','https://github.com/JonDMorrison/brandsinblooms/pull/77','support')$q$);
SELECT dblink_exec('release_one','COMMIT');
SELECT result FROM dblink_get_result('release_two') AS x(result jsonb);
SELECT dblink_disconnect('release_one');
SELECT dblink_disconnect('release_two');
DO $$ BEGIN
 IF (SELECT count(*) FROM bloom_support.jobs WHERE idempotency_key LIKE 'slack:external:github:fixture-release-race%')<>1 THEN RAISE EXCEPTION 'concurrent release notices duplicated'; END IF;
 IF (SELECT count(*) FROM bloom_support.github_release_receipts WHERE event_id='fixture-release-race')<>1 THEN RAISE EXCEPTION 'concurrent receipt lost'; END IF;
END $$;
\echo 'bloom-support-release-links-race: all assertions passed'
