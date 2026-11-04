-- Behaviour of public.bloom_support_client_suite_read (migration 20261104190000).
-- Synthetic tenants, CRM users and Support principals only; everything is rolled back.
BEGIN;
CREATE TEMP TABLE client_read_checks(label text PRIMARY KEY);
CREATE FUNCTION pg_temp.check_that(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
INSERT INTO client_read_checks VALUES (label); END $$;
CREATE FUNCTION pg_temp.verdict(actor uuid, acct uuid, kind text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.bloom_support_client_suite_read(actor, acct, kind) $$;

INSERT INTO public.tenants(id, name) VALUES
  ('c5010000-0000-4000-8000-000000000001', 'Client read test A'),
  ('c5010000-0000-4000-8000-000000000002', 'Client read test B');
-- Synthetic CRM users. Replica mode skips the after-insert Notion webhook trigger.
SET LOCAL session_replication_role = replica;
INSERT INTO public.users(id, name, email, role, tenant_id) VALUES
  ('c5020000-0000-4000-8000-000000000001', 'Test owner', 'owner@client-read.invalid', 'owner', 'c5010000-0000-4000-8000-000000000001'),
  ('c5020000-0000-4000-8000-000000000002', 'Test admin', 'admin@client-read.invalid', 'admin', 'c5010000-0000-4000-8000-000000000001'),
  ('c5020000-0000-4000-8000-000000000003', 'Test staff', 'staff@client-read.invalid', 'staff', 'c5010000-0000-4000-8000-000000000001'),
  ('c5020000-0000-4000-8000-000000000004', 'Test mkt', 'mkt@client-read.invalid', 'marketing', 'c5010000-0000-4000-8000-000000000001'),
  ('c5020000-0000-4000-8000-000000000005', 'Test other', 'other@client-read.invalid', 'owner', 'c5010000-0000-4000-8000-000000000002');
SET LOCAL session_replication_role = origin;

INSERT INTO bloom_support.accounts(id, name, crm_tenant_id) VALUES
  ('c5030000-0000-4000-8000-000000000001', 'Client read test A', 'c5010000-0000-4000-8000-000000000001'),
  ('c5030000-0000-4000-8000-000000000002', 'Client read test B', 'c5010000-0000-4000-8000-000000000002');
INSERT INTO bloom_support.principals(id, kind, auth_user_id, product, email, role) VALUES
  ('c5040000-0000-4000-8000-000000000001', 'user', 'c5020000-0000-4000-8000-000000000001', 'crm', 'owner@client-read.invalid', 'client'),
  ('c5040000-0000-4000-8000-000000000002', 'user', 'c5020000-0000-4000-8000-000000000002', 'crm', 'admin@client-read.invalid', 'client'),
  ('c5040000-0000-4000-8000-000000000003', 'user', 'c5020000-0000-4000-8000-000000000003', 'crm', 'staff@client-read.invalid', 'client'),
  ('c5040000-0000-4000-8000-000000000004', 'user', 'c5020000-0000-4000-8000-000000000004', 'crm', 'mkt@client-read.invalid', 'client'),
  ('c5040000-0000-4000-8000-000000000005', 'user', 'c5020000-0000-4000-8000-000000000005', 'crm', 'other@client-read.invalid', 'client'),
  ('c5040000-0000-4000-8000-000000000006', 'user', NULL, NULL, 'support@client-read.invalid', 'support');
INSERT INTO bloom_support.account_members(account_id, principal_id, verified) VALUES
  ('c5030000-0000-4000-8000-000000000001', 'c5040000-0000-4000-8000-000000000001', true),
  ('c5030000-0000-4000-8000-000000000001', 'c5040000-0000-4000-8000-000000000002', true),
  ('c5030000-0000-4000-8000-000000000001', 'c5040000-0000-4000-8000-000000000003', true),
  ('c5030000-0000-4000-8000-000000000001', 'c5040000-0000-4000-8000-000000000004', true),
  ('c5030000-0000-4000-8000-000000000002', 'c5040000-0000-4000-8000-000000000005', true);

-- Every signed-in client user of the company: website, products, stock.
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000003', 'c5030000-0000-4000-8000-000000000001', k)->>'allowed' = 'true', 'staff-role client reads ' || k)
FROM unnest(ARRAY['site.read','site.pages','event.list','site.preview_link','pos.products','pos.inventory']) k;
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000004', 'c5030000-0000-4000-8000-000000000001', 'pos.inventory')->>'allowed' = 'true', 'marketing client reads stock');

-- Sales figures: owner/admin only.
SELECT pg_temp.check_that(pg_temp.verdict(p::uuid, 'c5030000-0000-4000-8000-000000000001', k)->>'allowed' = 'true', 'owner/admin reads ' || k || ' ' || p)
FROM unnest(ARRAY['c5040000-0000-4000-8000-000000000001','c5040000-0000-4000-8000-000000000002']) p,
     unnest(ARRAY['pos.sales_summary','pos.price_history']) k;
SELECT pg_temp.check_that(pg_temp.verdict(p::uuid, 'c5030000-0000-4000-8000-000000000001', k)->>'reason' = 'owner_or_admin_only', 'non-admin refused ' || k || ' ' || p)
FROM unnest(ARRAY['c5040000-0000-4000-8000-000000000003','c5040000-0000-4000-8000-000000000004']) p,
     unnest(ARRAY['pos.sales_summary','pos.price_history']) k;

-- Tenant isolation: another company's account, even for an owner.
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000005', 'c5030000-0000-4000-8000-000000000001', 'site.pages')->>'reason' = 'account', 'other company owner refused');
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000001', 'c5030000-0000-4000-8000-000000000002', 'pos.sales_summary')->>'reason' = 'account', 'owner refused other company sales');
-- A verified membership alone is not enough once the CRM user has left the tenant.
INSERT INTO bloom_support.account_members(account_id, principal_id, verified) VALUES ('c5030000-0000-4000-8000-000000000002', 'c5040000-0000-4000-8000-000000000001', true);
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000001', 'c5030000-0000-4000-8000-000000000002', 'site.read')->>'reason' = 'account', 'membership without CRM tenant refused');
-- Unverified membership refused.
UPDATE bloom_support.account_members SET verified = false WHERE principal_id = 'c5040000-0000-4000-8000-000000000003';
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000003', 'c5030000-0000-4000-8000-000000000001', 'site.read')->>'reason' = 'account', 'unverified member refused');

-- No writes and no staff-only reads through this path.
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000001', 'c5030000-0000-4000-8000-000000000001', k)->>'reason' = 'not_client_readable', 'owner refused ' || k)
FROM unnest(ARRAY['site.publish','site.page.update','event.update','client.lookup','campaign.read','campaign.schedule']) k;
SELECT pg_temp.check_that(NOT EXISTS (SELECT 1 FROM bloom_support.role_permissions WHERE role = 'client' AND (permission LIKE 'ops.%' OR permission IN ('tickets.write','accounts.write','tickets.read_all','accounts.read_all'))), 'client role holds no ops or staff permission');
SELECT pg_temp.check_that(NOT bloom_support.has_permission('c5040000-0000-4000-8000-000000000001', p), 'client owner lacks ' || p)
FROM unnest(ARRAY['ops.site.read','ops.site.edit','ops.site.publish','ops.pos.read','ops.event.manage','ops.campaign.edit','ops.campaign.send']) p;
-- Staff principals do not use the client path.
SELECT pg_temp.check_that(pg_temp.verdict('c5040000-0000-4000-8000-000000000006', 'c5030000-0000-4000-8000-000000000001', 'site.read')->>'reason' = 'not_client', 'support principal not a client');
SELECT pg_temp.check_that(bloom_support.has_permission('c5040000-0000-4000-8000-000000000006', 'ops.pos.read'), 'support keeps ops.pos.read');

-- Audit: allowed reads and sales refusals are recorded against the account.
SELECT pg_temp.check_that((SELECT count(*) FROM bloom_support.activity WHERE account_id = 'c5030000-0000-4000-8000-000000000001' AND action = 'operation.read' AND detail->>'access' = 'client') >= 11, 'client reads audited');
SELECT pg_temp.check_that((SELECT count(*) FROM bloom_support.activity WHERE account_id = 'c5030000-0000-4000-8000-000000000001' AND action = 'operation.read_denied') = 4, 'sales refusals audited');
SELECT pg_temp.check_that((SELECT count(*) FROM bloom_support.activity WHERE account_id = 'c5030000-0000-4000-8000-000000000002' AND actor_id <> 'c5040000-0000-4000-8000-000000000005') = 0, 'nothing logged on the other company for refused probes');

-- Grants: only service_role may execute.
SELECT pg_temp.check_that(NOT has_function_privilege(r, 'public.bloom_support_client_suite_read(uuid, uuid, text)', 'EXECUTE'), r || ' cannot execute')
FROM unnest(ARRAY['anon','authenticated']) r;
SELECT pg_temp.check_that(has_function_privilege('service_role', 'public.bloom_support_client_suite_read(uuid, uuid, text)', 'EXECUTE'), 'service_role executes');

SELECT count(*) AS passed FROM client_read_checks;
ROLLBACK;
