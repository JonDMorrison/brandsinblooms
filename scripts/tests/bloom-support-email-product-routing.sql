-- Runs after the existing disposable SQL contract fixtures.
BEGIN;
\ir ../../supabase/migrations/20261109014500_bloom_support_email_product_routing.sql
SELECT pg_temp.rpc('resolve_product_user', '{"product":"cms","external_user_id":"route-client","email":"route@northfield.test","name":"Route Client","external_account_id":"route-site","account_name":"Route Site"}'::jsonb) AS route_identity \gset
SELECT :'route_identity'::jsonb->>'principal_id' AS route_client, :'route_identity'::jsonb->>'account_id' AS route_account \gset
SELECT pg_temp.assert(bloom_support.verified_email_product(:'route_account', :'route_client') = 'cms', 'verified singleton routes to CMS');
SELECT pg_temp.assert(bloom_support.verified_email_product(:'route_account', :'jon') IS NULL, 'staff and wrong requester cannot infer product');
UPDATE bloom_support.account_members SET verified=false WHERE principal_id=:'route_client';
SELECT pg_temp.assert(bloom_support.verified_email_product(:'route_account', :'route_client') IS NULL, 'unverified membership stays unknown');
UPDATE bloom_support.account_members SET verified=true WHERE principal_id=:'route_client';
UPDATE bloom_support.principals SET active=false WHERE id=:'route_client';
SELECT pg_temp.assert(bloom_support.verified_email_product(:'route_account', :'route_client') IS NULL, 'inactive identity stays unknown');
UPDATE bloom_support.principals SET active=true WHERE id=:'route_client';
INSERT INTO bloom_support.account_links(account_id,product,external_id) VALUES (:'route_account','pos','route-ambiguous-pos');
SELECT pg_temp.assert(bloom_support.verified_email_product(:'route_account', :'route_client') IS NULL, 'multi-product account stays unknown');
DELETE FROM bloom_support.account_links WHERE external_id='route-ambiguous-pos';
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'intake', 'ticket', jsonb_build_object('product','unknown','channel','email','subject','Calendar emoji bug','body','Calendar export corrupts Unicode','account_id', :'route_account','requester_id', :'route_client','context', '{"email_match":"membership"}'::jsonb))) AS routed_ticket \gset
SELECT :'routed_ticket'::jsonb->>'ticket_id' AS routed_id \gset
SELECT pg_temp.assert((SELECT product='cms' AND context->'product_routing'->>'source'='verified_single_product_account' FROM bloom_support.tickets WHERE id=:'routed_id'), 'new intake routes with provenance');
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'intake', 'ticket', jsonb_build_object('product','pos','channel','email','body','Explicit product retained','account_id', :'route_account','requester_id', :'route_client','context', '{"email_match":"membership"}'::jsonb))) AS explicit_ticket \gset
SELECT pg_temp.assert((SELECT product='pos' FROM bloom_support.tickets WHERE id=(:'explicit_ticket'::jsonb->>'ticket_id')::uuid), 'never overwrite explicit product');
-- Simulate a pre-migration ticket, without disabling any production guard.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'intake', 'ticket', jsonb_build_object('product','unknown','channel','email','body','Existing calendar export report','account_id', :'route_account','requester_id', :'route_client','context', '{"email_match":"domain"}'::jsonb))) AS legacy_ticket \gset
SELECT :'legacy_ticket'::jsonb->>'ticket_id' AS legacy_id \gset
SELECT pg_temp.assert((SELECT product='unknown' FROM bloom_support.tickets WHERE id=:'legacy_id'), 'domain-only match never routes');
UPDATE bloom_support.tickets SET context='{"email_match":"membership"}' WHERE id=:'legacy_id';
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'bot', 'ticket_id', :'legacy_id', 'issue','{}'::jsonb)) AS legacy_engineering \gset
SELECT :'legacy_engineering'::jsonb->>'engineering_issue_id' AS legacy_issue \gset
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'repair','issue_id', :'legacy_issue','update',jsonb_build_object('status','escalated','note','Product unknown'))) AS initial_stop \gset
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_rpc('update_engineering_issue','{"actor":"%s","issue_id":"%s","update":{"start_repair":true}}')$q$, :'bot', :'legacy_issue'), 'only an admin');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'legacy_issue','update',jsonb_build_object('start_repair',true))) AS restart \gset
SELECT pg_temp.assert(:'restart'::jsonb->>'product'='cms' AND :'restart'::jsonb->>'status'='open', 'normal owner restart routes existing issue');
SELECT pg_temp.assert((SELECT product='cms' AND engineering_issue_id=:'legacy_issue'::uuid FROM bloom_support.tickets WHERE id=:'legacy_id'), 'same ticket and issue retained');
SELECT pg_temp.assert((SELECT evidence->'product_routing'->>'owner_assisted_restart'='true' AND repository IS NULL AND branch IS NULL AND attempts=0 AND approved_at IS NULL FROM bloom_support.engineering_issues WHERE id=:'legacy_issue'), 'routing provenance recorded without dispatch or release approval');
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM bloom_support.jobs WHERE engineering_issue_id=:'legacy_issue' AND kind='investigate' AND status='queued'), 'existing start operation queues investigation');
SELECT pg_temp.assert(NOT has_function_privilege('anon','bloom_support.verified_email_product(uuid,uuid)','execute'), 'no public RPC privilege added');
-- No recovery for an account that became ambiguous before owner approval.
SELECT pg_temp.rpc('create_ticket', jsonb_build_object('actor', :'intake', 'ticket', jsonb_build_object('product','unknown','channel','email','body','Ambiguous old report','account_id', :'route_account','requester_id', :'route_client','context', '{"email_match":"domain"}'::jsonb))) AS blocked_ticket \gset
SELECT :'blocked_ticket'::jsonb->>'ticket_id' AS blocked_id \gset
UPDATE bloom_support.tickets SET context='{"email_match":"membership"}' WHERE id=:'blocked_id';
SELECT pg_temp.rpc('open_engineering_issue', jsonb_build_object('actor', :'bot','ticket_id', :'blocked_id','issue','{}'::jsonb)) AS blocked_eng \gset
SELECT :'blocked_eng'::jsonb->>'engineering_issue_id' AS blocked_issue \gset
INSERT INTO bloom_support.account_links(account_id,product,external_id) VALUES (:'route_account','crm','route-ambiguous-crm');
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS blocked_restart \gset
SELECT pg_temp.assert(:'blocked_restart'::jsonb->>'product'='unknown', 'owner start does not resolve ambiguous account');
DELETE FROM bloom_support.account_links WHERE external_id='route-ambiguous-crm';
UPDATE bloom_support.engineering_issues SET branch='bloom/already-dispatched' WHERE id=:'blocked_issue';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS dispatched_restart \gset
SELECT pg_temp.assert(:'dispatched_restart'::jsonb->>'product'='unknown', 'never reroute a repair with an existing branch');
SELECT pg_temp.assert((SELECT product='unknown' FROM bloom_support.tickets WHERE id=:'blocked_id'), 'failed routing leaves ticket unchanged');
UPDATE bloom_support.engineering_issues SET branch=NULL, evidence='{"dispatches":1}' WHERE id=:'blocked_issue';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS guard_restart \gset
SELECT pg_temp.assert(:'guard_restart'::jsonb->>'product'='unknown', 'dispatch evidence prevents rerouting');
UPDATE bloom_support.engineering_issues SET evidence='{}' WHERE id=:'blocked_issue';
UPDATE bloom_support.tickets SET automation='paused' WHERE id=:'blocked_id';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS guard_restart \gset
SELECT pg_temp.assert(:'guard_restart'::jsonb->>'product'='unknown', 'paused report stays untouched');
UPDATE bloom_support.tickets SET automation='auto', executor='person' WHERE id=:'blocked_id';
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS guard_restart \gset
SELECT pg_temp.assert(:'guard_restart'::jsonb->>'product'='unknown', 'person-owned report stays untouched');
UPDATE bloom_support.tickets SET executor='bloom' WHERE id=:'blocked_id';
UPDATE bloom_support.tickets SET engineering_issue_id=:'blocked_issue' WHERE id=(:'explicit_ticket'::jsonb->>'ticket_id')::uuid;
SELECT pg_temp.rpc('update_engineering_issue', jsonb_build_object('actor', :'jon','issue_id', :'blocked_issue','update',jsonb_build_object('start_repair',true))) AS guard_restart \gset
SELECT pg_temp.assert(:'guard_restart'::jsonb->>'product'='unknown', 'conflicting linked report prevents partial rerouting');
SELECT pg_temp.assert((SELECT product='unknown' FROM bloom_support.tickets WHERE id=:'blocked_id'), 'all-or-nothing routing leaves unresolved ticket untouched');
ROLLBACK;
\echo 'email product routing: all assertions passed'
