\set ON_ERROR_STOP on
SELECT current_database()='bloom_internal_webhooks_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_internal_webhooks_test'
  \quit 3
\endif
BEGIN;

-- Stand-ins for the Supabase platform pieces the trigger depends on.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY, decrypted_secret text);
CREATE SCHEMA net;
CREATE TABLE net.captured_requests(url text, headers jsonb, body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint
LANGUAGE sql AS $$
  INSERT INTO net.captured_requests VALUES (url, headers, body);
  SELECT 1::bigint;
$$;
CREATE FUNCTION public.get_service_role_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
$$;
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY, tenant_id uuid, email text);
CREATE TABLE public.users(id uuid PRIMARY KEY, email text);
-- The older migration also re-creates a check constraint on this table.
CREATE TABLE public.customer_intelligence_source_events(
  event_type text CONSTRAINT customer_intelligence_source_events_event_type_check CHECK (true)
);

-- The production-era definition: hard-coded production destination.
\ir ../../supabase/migrations/20261016185841_source_report_summaries.sql
CREATE TRIGGER "notion-clients-imported" AFTER INSERT ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.invoke_internal_notion_sync('update-notion-profile');
CREATE TRIGGER "notify-notion-trial" AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.invoke_internal_notion_sync('notify-notion-trial');

-- Reproduce the leak: a non-production project with its own service key in
-- Vault posts its customer rows to the production project.
INSERT INTO vault.decrypted_secrets VALUES ('service_role_key', 'sb_secret_staging_project_key_000000');
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'leak@example.com');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM net.captured_requests WHERE url LIKE 'https://udldmkqwnxhdeztyqcau.supabase.co/%') = 1,
    'precondition: the old definition posts a staging customer row to production';
END $$;
TRUNCATE net.captured_requests;

\ir ../../supabase/migrations/20261118190000_internal_notion_sync_own_project.sql

-- 1. Unconfigured project: nothing is sent anywhere.
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'a@example.com');
INSERT INTO public.users VALUES ('30000000-0000-4000-8000-000000000001', 'new-user@example.com');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM net.captured_requests) = 0,
    'a project without internal_functions_base_url must not post anywhere';
END $$;

-- 2. Malformed or foreign-looking values fail closed.
INSERT INTO vault.decrypted_secrets VALUES ('internal_functions_base_url', 'https://evil.example.com');
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'b@example.com');
UPDATE vault.decrypted_secrets SET decrypted_secret = 'http://abcdefghijklmnopqrst.supabase.co' WHERE name = 'internal_functions_base_url';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'c@example.com');
UPDATE vault.decrypted_secrets SET decrypted_secret = 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/x' WHERE name = 'internal_functions_base_url';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'd@example.com');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM net.captured_requests) = 0,
    'non-https, non-Supabase or path-bearing base URLs must be rejected';
END $$;

-- 3. A configured project posts only to its own functions, with the same payload.
UPDATE vault.decrypted_secrets SET decrypted_secret = 'https://stagingprojectref00a.supabase.co' WHERE name = 'internal_functions_base_url';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'e@example.com');
INSERT INTO public.users VALUES ('30000000-0000-4000-8000-000000000002', 'second-user@example.com');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM net.captured_requests) = 2, 'one post per configured insert';
  ASSERT NOT EXISTS (SELECT 1 FROM net.captured_requests WHERE url LIKE '%udldmkqwnxhdeztyqcau%'),
    'a non-production project must never reach production';
  ASSERT EXISTS (
    SELECT 1 FROM net.captured_requests
    WHERE url = 'https://stagingprojectref00a.supabase.co/functions/v1/update-notion-profile'
      AND body->>'table' = 'crm_customers' AND body->>'type' = 'INSERT'
      AND body->'record'->>'email' = 'e@example.com'
      AND headers->>'apikey' = 'sb_secret_staging_project_key_000000'
  ), 'customer insert posts to this project''s update-notion-profile with the Vault key';
  ASSERT EXISTS (
    SELECT 1 FROM net.captured_requests
    WHERE url = 'https://stagingprojectref00a.supabase.co/functions/v1/notify-notion-trial'
      AND body->>'table' = 'users'
  ), 'user insert posts to this project''s notify-notion-trial';
END $$;
TRUNCATE net.captured_requests;

-- 4. Production keeps working once its own base URL is in its Vault.
UPDATE vault.decrypted_secrets SET decrypted_secret = 'https://udldmkqwnxhdeztyqcau.supabase.co' WHERE name = 'internal_functions_base_url';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'f@example.com');
DO $$ BEGIN
  ASSERT (SELECT url FROM net.captured_requests) = 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/update-notion-profile',
    'production posts to its own update-notion-profile exactly as before';
END $$;
TRUNCATE net.captured_requests;

-- 5. Unchanged behaviour: bulk-import deferral and the missing-key skip.
SET LOCAL app.customer_import.defer_notion = 'true';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'g@example.com');
RESET app.customer_import.defer_notion;
DELETE FROM vault.decrypted_secrets WHERE name = 'service_role_key';
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', 'h@example.com');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM net.captured_requests) = 0,
    'deferred bulk imports and a missing service key still skip the post';
END $$;

-- 6. Only service_role can call the helpers directly.
DO $$ BEGIN
  ASSERT NOT has_function_privilege('authenticated', 'public.internal_functions_base_url()', 'EXECUTE'), 'authenticated cannot read the base URL';
  ASSERT NOT has_function_privilege('anon', 'public.internal_functions_base_url()', 'EXECUTE'), 'anon cannot read the base URL';
  ASSERT has_function_privilege('service_role', 'public.internal_functions_base_url()', 'EXECUTE'), 'service_role can read the base URL';
  ASSERT NOT has_function_privilege('authenticated', 'public.invoke_internal_notion_sync()', 'EXECUTE'), 'authenticated cannot call the webhook function';
END $$;

\echo 'internal Notion sync posts only to this project: ok'
ROLLBACK;
