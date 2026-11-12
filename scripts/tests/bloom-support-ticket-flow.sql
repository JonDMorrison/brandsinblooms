-- Included by bloom-support-db.sql after its permission fixtures are established.
BEGIN;
\ir ../../supabase/migrations/20261112151241_bloom_support_ticket_flow_context.sql
\ir ../../supabase/migrations/20261112163800_bloom_support_atomic_trusted_verification.sql
SELECT pg_temp.assert(
  NOT has_function_privilege('anon', 'public.bloom_support_ticket_flow_context(uuid,uuid,text,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.bloom_support_ticket_flow_context(uuid,uuid,text,integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.bloom_support_ticket_flow_context(uuid,uuid,text,integer)', 'EXECUTE'),
  'ticket flow context is service-role-only');
UPDATE bloom_support.settings SET value='true'::jsonb WHERE key IN ('automation_enabled','auto_release_enabled');
INSERT INTO bloom_support.settings(key,value) VALUES ('automation_scopes','{"engineering":true}')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
INSERT INTO bloom_support.engineering_issues(title, product, status, head_sha)
VALUES ('Flow projection fixture', 'crm', 'verifying', repeat('a',40)) RETURNING id AS flow_issue, version AS flow_version \gset
INSERT INTO bloom_support.conversations(channel, subject)
VALUES ('crm', 'Flow projection fixture') RETURNING id AS flow_conversation \gset
INSERT INTO bloom_support.tickets(conversation_id,engineering_issue_id,account_id,product,kind,channel,subject,summary,context)
VALUES (:'flow_conversation',:'flow_issue',:'greenleaf','crm','bug','crm','Private subject','Private summary',
 '{"page_url":"https://bloomsuite.app/campaigns/123?secret=private#private","private":"hidden"}')
RETURNING id AS flow_ticket \gset
INSERT INTO bloom_support.tickets(conversation_id,account_id,product,kind,channel,subject,summary)
VALUES (:'flow_conversation',:'greenleaf','crm','bug','crm','Unlinked private report','Private summary');
SELECT public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version') AS flow_result \gset
SELECT pg_temp.assert(
  :'flow_result'::jsonb->>'issue_id' = :'flow_issue'
  AND :'flow_result'::jsonb->>'head_sha' = repeat('a',40)
  AND (:'flow_result'::jsonb->>'version')::integer = :'flow_version'
  AND jsonb_array_length(:'flow_result'::jsonb->'tickets') = 1
  AND :'flow_result'::jsonb->'tickets'->0 = jsonb_build_object('id',:'flow_ticket','kind','bug','product','crm',
    'page_url','https://bloomsuite.app/campaigns/123'),
  'projection binds exact issue/head/version and exposes only linked classification and stripped page selector');
SELECT pg_temp.assert(NOT bloom_support.has_permission(:'release','tickets.read_all')
  AND NOT bloom_support.has_permission(:'release','tickets.read_own'), 'projection does not widen ticket-read permission');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ticket_flow_context('%s','%s',repeat('a',40),%s)$q$,
 :'gail',:'flow_issue',:'flow_version'), 'engineering.release');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ticket_flow_context('%s','%s',repeat('b',40),%s)$q$,
 :'release',:'flow_issue',:'flow_version'), 'stale verification context');
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ticket_flow_context('%s','%s',repeat('a',40),%s)$q$,
 :'release',:'flow_issue',(:'flow_version')::integer+1), 'stale verification context');
SELECT pg_temp.assert((:'flow_result'::jsonb->>'tickets_automatic')::boolean, 'unheld linked tickets permit verification');
UPDATE bloom_support.settings SET value='false'::jsonb WHERE key='automation_enabled';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean, 'global automation hold blocks final context');
UPDATE bloom_support.settings SET value='true'::jsonb WHERE key='automation_enabled';
UPDATE bloom_support.settings SET value='false'::jsonb WHERE key='auto_release_enabled';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean, 'automatic release hold blocks final context');
UPDATE bloom_support.settings SET value='true'::jsonb WHERE key='auto_release_enabled';
UPDATE bloom_support.settings SET value='{"engineering":false}'::jsonb WHERE key='automation_scopes';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean, 'engineering scope hold blocks final context');
UPDATE bloom_support.settings SET value='{"engineering":true}'::jsonb WHERE key='automation_scopes';
UPDATE bloom_support.accounts SET automation_paused=true WHERE id=:'greenleaf';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean,
 'account pause blocks verification and rollback without private account reads');
UPDATE bloom_support.accounts SET automation_paused=false WHERE id=:'greenleaf';
UPDATE bloom_support.tickets SET executor='person' WHERE id=:'flow_ticket';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean,
 'human-owned ticket blocks verification and rollback');
UPDATE bloom_support.tickets SET executor='bloom',automation='paused' WHERE id=:'flow_ticket';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean,
 'paused ticket blocks verification and rollback');
UPDATE bloom_support.tickets SET automation='auto' WHERE id=:'flow_ticket';
UPDATE bloom_support.tickets SET spam=true WHERE id=:'flow_ticket';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean,
 'spam ticket blocks verification and rollback');
SELECT pg_temp.assert(public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->'tickets'->0->'page_url' = 'null'::jsonb, 'spam page selector is withheld');
UPDATE bloom_support.tickets SET spam=false,redacted_at=now() WHERE id=:'flow_ticket';
SELECT pg_temp.assert(NOT (public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->>'tickets_automatic')::boolean,
 'redacted ticket blocks verification and rollback');
SELECT pg_temp.assert(public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->'tickets'->0->'page_url' = 'null'::jsonb, 'redacted page selector is withheld');
UPDATE bloom_support.tickets SET redacted_at=NULL WHERE id=:'flow_ticket';
UPDATE bloom_support.tickets SET context = '{"page_url":"https://user:password@bloomsuite.app/campaigns"}' WHERE id=:'flow_ticket';
SELECT pg_temp.assert(public.bloom_support_ticket_flow_context(:'release',:'flow_issue',repeat('a',40),:'flow_version')->'tickets'->0->'page_url' = 'null'::jsonb,
 'credential-bearing page selectors are not exposed');
UPDATE bloom_support.engineering_issues SET status='escalated' WHERE id=:'flow_issue';
SELECT pg_temp.expect_error(format($q$SELECT public.bloom_support_ticket_flow_context('%s','%s',repeat('a',40),%s)$q$,
 :'release',:'flow_issue',:'flow_version'), 'stale verification context');

-- Atomic trusted-browser transition: provider/network work has already finished.
-- A newly placed hold must still reject the final write in this transaction.
UPDATE bloom_support.tickets SET automation='auto',executor='bloom',spam=false,redacted_at=NULL,
 context='{"page_url":"https://bloomsuite.app/support/contact"}' WHERE id=:'flow_ticket';
UPDATE bloom_support.engineering_issues SET status='verifying',repository='JonDMorrison/brandsinblooms',
 merge_sha=repeat('b',40),pr_number=123,evidence='{"github_issue":{"number":321}}',deployment='{"state":"success"}' WHERE id=:'flow_issue';
SELECT encode(sha256(convert_to('[' || to_jsonb(:'flow_ticket'::text)::text || ']','UTF8')),'hex') AS flow_binding \gset
SELECT (now()-interval '1 minute')::text AS flow_started \gset
UPDATE bloom_support.engineering_issues SET verification=jsonb_build_object('trusted_browser_request',jsonb_build_object(
 'engineering_issue_id',id,'issue_version',version,'head_sha',head_sha,'pr_number',pr_number,
 'created_at',(now()-interval '2 minutes')::text,'nonce','12345678-1234-1234-1234-123456789abc','deployed_sha',merge_sha,'deployment_id','dpl_test','ticket_binding',:'flow_binding'))
 WHERE id=:'flow_issue';
UPDATE bloom_support.settings SET value=value || jsonb_build_object('trustedReproductionIssues',jsonb_build_object(:'flow_issue',
 jsonb_build_object('recipe','public-support-attachment-name-v1','github_issue',321,'ticket_ids',jsonb_build_array(:'flow_ticket')))) WHERE key='release_policy';
SELECT jsonb_build_object('passed',true,'scope','ticket_flow','started_at',:'flow_started','ticket_ids',jsonb_build_array(:'flow_ticket'),
 'checks',jsonb_build_array(jsonb_build_object('ticket_id',:'flow_ticket','check_scope','ticket_flow','flow_path','/support/contact',
 'url','https://bloomsuite.app/support/contact','pass',true,'trusted_browser',jsonb_build_object(
 'nonce','12345678-1234-1234-1234-123456789abc','head_sha',repeat('a',40),'deployed_sha',repeat('b',40),'deployment_id','dpl_test',
 'ticket_binding',:'flow_binding','started_at',:'flow_started')))) AS flow_verified \gset
CREATE OR REPLACE FUNCTION pg_temp.flow_verify(e uuid,v jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN UPDATE bloom_support.engineering_issues SET status='verified',verification=v,version=version+1 WHERE id=e; END $$;
UPDATE bloom_support.accounts SET automation_paused=true WHERE id=:'greenleaf';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'account hold');
UPDATE bloom_support.accounts SET automation_paused=false WHERE id=:'greenleaf';
UPDATE bloom_support.tickets SET automation='paused' WHERE id=:'flow_ticket';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'ticket hold');
UPDATE bloom_support.tickets SET automation='auto',spam=true WHERE id=:'flow_ticket';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'ticket hold');
UPDATE bloom_support.tickets SET spam=false WHERE id=:'flow_ticket';
UPDATE bloom_support.settings SET value='false' WHERE key='auto_release_enabled';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'global hold');
UPDATE bloom_support.settings SET value='true' WHERE key='auto_release_enabled';
UPDATE bloom_support.settings SET value='{"engineering":false}' WHERE key='automation_scopes';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'global hold');
UPDATE bloom_support.settings SET value='{"engineering":true}' WHERE key='automation_scopes';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',
 jsonb_set(:'flow_verified'::jsonb,'{started_at}',to_jsonb(now()::text))),'per-ticket evidence mismatch');
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',
 jsonb_set(:'flow_verified'::jsonb,'{checks,0,trusted_browser,nonce}','"different"')),'per-ticket evidence mismatch');
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',
 jsonb_set(:'flow_verified'::jsonb,'{ticket_ids}','[]')),'ticket binding changed');
SELECT pg_temp.expect_error(format($q$UPDATE bloom_support.engineering_issues SET status='verified',verification=%L,version=version+1,evidence='{"github_issue":{"number":999}}' WHERE id=%L$q$,
 :'flow_verified',:'flow_issue'),'stale trusted browser verification binding');
UPDATE bloom_support.engineering_issues SET verification=jsonb_set(verification,'{trusted_browser_request,created_at}',to_jsonb((now()-interval '31 minutes')::text)) WHERE id=:'flow_issue';
SELECT pg_temp.expect_error(format('SELECT pg_temp.flow_verify(%L,%L)',:'flow_issue',:'flow_verified'),'observation timestamp');
UPDATE bloom_support.engineering_issues SET verification=jsonb_set(verification,'{trusted_browser_request,created_at}',to_jsonb((now()-interval '2 minutes')::text)) WHERE id=:'flow_issue';
SELECT pg_temp.flow_verify(:'flow_issue',:'flow_verified');
SELECT pg_temp.assert((SELECT status='verified' AND verification->>'started_at'=:'flow_started' FROM bloom_support.engineering_issues WHERE id=:'flow_issue'),
 'only unheld exact bound browser evidence becomes verified, retaining actual observation start');
SELECT pg_temp.assert(NOT has_function_privilege('anon','bloom_support.guard_trusted_browser_verification()','EXECUTE')
 AND NOT has_function_privilege('authenticated','bloom_support.guard_trusted_browser_verification()','EXECUTE'),'atomic guard adds no public authority');

ROLLBACK;
