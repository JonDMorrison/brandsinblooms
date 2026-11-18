\set ON_ERROR_STOP on
SELECT current_database()='bloom_internal_webhooks_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_internal_webhooks_test'
  \quit 3
\endif
BEGIN;

-- Stand-ins for the Supabase platform pieces.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY, decrypted_secret text);
CREATE SCHEMA net;
CREATE TABLE net.captured_requests(url text NOT NULL, headers jsonb, body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}'::jsonb, body jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.captured_requests VALUES (url, headers, body);
  SELECT 1::bigint;
$$;
CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text UNIQUE, schedule text, command text, username text DEFAULT current_user);
CREATE FUNCTION cron.unschedule(job_id bigint) RETURNS boolean LANGUAGE sql AS $$
  DELETE FROM cron.job WHERE jobid = job_id RETURNING true;
$$;
CREATE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL, database text DEFAULT NULL, username text DEFAULT NULL, active boolean DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  UPDATE cron.job SET schedule = coalesce(alter_job.schedule, job.schedule), command = coalesce(alter_job.command, job.command)
  WHERE jobid = job_id;
$$;
CREATE FUNCTION public.get_service_role_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE TABLE public.subscriptions(user_id uuid, plan text, end_date date);
CREATE TABLE public.trial_expiration_emails(id bigserial PRIMARY KEY, user_id uuid, days_remaining numeric, email_type text);
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY, tenant_id uuid, email text);
CREATE TABLE public.crm_email_preference_tokens(tenant_id uuid, customer_id uuid, email text, token text, purpose text, expires_at timestamptz);
CREATE TABLE public.email_messages(id bigserial PRIMARY KEY, tenant_id uuid, customer_id uuid, email text, payload jsonb, resend_id text, status text DEFAULT 'queued', updated_at timestamptz);
-- The older migration also re-creates a check constraint on this table.
CREATE TABLE public.customer_intelligence_source_events(
  event_type text CONSTRAINT customer_intelligence_source_events_event_type_check CHECK (true)
);

-- Scheduled jobs shaped like production's (tokens are fakes).
INSERT INTO cron.job(jobname, schedule, command, username) VALUES
  ('process-automation-outbox', '* * * * *',
   $c$ SELECT net.http_post( url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-automation-outbox', headers:='{"Content-Type": "application/json", "Authorization": "Bearer fakeLegacyPlaintextTokenForTestsOnlyAAAAAAAAAAAAAAAAAAAA"}'::jsonb, body:='{}'::jsonb ) as request_id; $c$,
   'supabase_read_only_user'),
  ('process-automation-triggers', '* * * * *',
   $c$ SELECT net.http_post( url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/automation-executor', headers := jsonb_build_object( 'Content-Type', 'application/json', 'Authorization', 'Bearer fakeLegacyPlaintextTokenForTestsOnlyBBBBBBBBBBBBBBBBBBBB' ), body := '{}'::jsonb ) AS request_id; $c$,
   'postgres'),
  ('process-automation-outbox-v2', '* * * * *',
   $c$ SELECT net.http_post( url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-automation-outbox', headers := jsonb_build_object( 'Content-Type', 'application/json', 'apikey', public.get_service_role_key() ), body := '{}'::jsonb ) $c$,
   'postgres'),
  ('monthly-performance-queue', '0 17 1 * *',
   $c$SELECT net.http_post(url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-monthly-performance', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()), body:='{}'::jsonb)$c$,
   'postgres'),
  ('bloom-support-worker', '* * * * *',
   $c$ SELECT net.http_post( url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-worker', headers := jsonb_build_object('Content-Type','application/json','x-bloom-worker-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bloom_support_worker_token')), body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 55000) $c$,
   'postgres'),
  ('send-support-emails', '0 15 * * *',
   $c$SELECT net.http_post( url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-support-emails', headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb )$c$,
   'postgres'),
  ('unrelated-maintenance', '0 0 * * *', $c$SELECT 1$c$, 'postgres');

INSERT INTO vault.decrypted_secrets VALUES ('service_role_key', 'sb_secret_project_key_0000000000000000');

\ir ../../supabase/migrations/20261029171207_fix_bulk_unsubscribe_header_tokens.sql
CREATE TRIGGER trg_apply_bulk_email_unsubscribe_headers BEFORE INSERT ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.apply_bulk_email_unsubscribe_headers();
\ir ../../supabase/migrations/20261016185841_source_report_summaries.sql
\ir ../../supabase/migrations/20261118190000_internal_notion_sync_own_project.sql
\ir ../../supabase/migrations/20261118200000_internal_functions_own_project.sql

-- 1. Jobs: own legacy plaintext-credential job gone, the rest rewritten,
-- another role's job and unrelated jobs untouched.
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-automation-triggers'),
    'a plaintext-credential job owned by the migration role is unscheduled';
  ASSERT (SELECT username = 'supabase_read_only_user' AND command LIKE '%udldmkqwnxhdeztyqcau%'
          FROM cron.job WHERE jobname = 'process-automation-outbox'),
    'another role''s job is left exactly as it was (the migration role cannot change it)';
  ASSERT (SELECT count(*) FROM cron.job) = 6, 'every other job is kept';
  ASSERT NOT EXISTS (SELECT 1 FROM cron.job WHERE username = current_user AND command LIKE '%udldmkqwnxhdeztyqcau%'),
    'no job the migration role owns names the production project any more';
  ASSERT (SELECT command FROM cron.job WHERE jobname = 'unrelated-maintenance') = 'SELECT 1',
    'jobs that never named production are untouched';
  ASSERT (SELECT command LIKE '%url := public.internal_function_url(''process-automation-outbox'')%' FROM cron.job WHERE jobname = 'process-automation-outbox-v2'),
    'the v2 job resolves its own project URL at run time';
  ASSERT (SELECT command LIKE '%url:=public.internal_function_url(''send-monthly-performance'')%' FROM cron.job WHERE jobname = 'monthly-performance-queue'),
    'compact url:= syntax is rewritten too';
  ASSERT (SELECT command LIKE '%x-bloom-worker-token%' AND command LIKE '%timeout_milliseconds := 55000%' FROM cron.job WHERE jobname = 'bloom-support-worker'),
    'headers, body and options are preserved';
END $$;

-- 2. Unconfigured project: jobs fail instead of calling production.
DO $$
DECLARE v_job record; v_failed integer := 0;
BEGIN
  FOR v_job IN SELECT jobname, command FROM cron.job WHERE command LIKE '%internal_function_url%' LOOP
    BEGIN
      EXECUTE v_job.command;
    EXCEPTION WHEN not_null_violation THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;
  ASSERT v_failed = 4, format('every rewritten job fails closed without a base URL, got %s', v_failed);
  ASSERT (SELECT count(*) FROM net.captured_requests) = 0, 'nothing is posted anywhere';
END $$;

-- 3. Configured project: each job posts to its own functions with unchanged headers.
INSERT INTO vault.decrypted_secrets VALUES ('internal_functions_base_url', 'https://stagingprojectref00a.supabase.co');
DO $$
DECLARE v_job record;
BEGIN
  FOR v_job IN SELECT command FROM cron.job WHERE command LIKE '%internal_function_url%' LOOP
    EXECUTE v_job.command;
  END LOOP;
  ASSERT (SELECT count(*) FROM net.captured_requests) = 4, 'one post per rewritten job';
  ASSERT NOT EXISTS (SELECT 1 FROM net.captured_requests WHERE url NOT LIKE 'https://stagingprojectref00a.supabase.co/functions/v1/%'),
    'every post goes to this project';
  ASSERT EXISTS (SELECT 1 FROM net.captured_requests WHERE url LIKE '%/process-automation-outbox' AND headers->>'apikey' = 'sb_secret_project_key_0000000000000000'),
    'auth headers are unchanged';
END $$;
TRUNCATE net.captured_requests;

-- 4. Unsubscribe links.
INSERT INTO public.crm_customers VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'reader@example.com');
INSERT INTO public.email_messages(tenant_id, customer_id, email, payload)
VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'reader@example.com', '{"subject":"Hi"}');
DO $$ BEGIN
  ASSERT (SELECT payload->'headers'->>'List-Unsubscribe' FROM public.email_messages ORDER BY id DESC LIMIT 1)
    ~ '^<https://stagingprojectref00a\.supabase\.co/functions/v1/handle-unsubscribe\?token=[a-zA-Z0-9_-]+>$',
    'unsubscribe link points at this project';
  ASSERT (SELECT payload->'headers'->>'List-Unsubscribe-Post' FROM public.email_messages ORDER BY id DESC LIMIT 1) = 'List-Unsubscribe=One-Click',
    'one-click header unchanged';
END $$;

UPDATE vault.decrypted_secrets SET decrypted_secret = 'https://udldmkqwnxhdeztyqcau.supabase.co' WHERE name = 'internal_functions_base_url';
INSERT INTO public.email_messages(tenant_id, customer_id, email, payload)
VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'reader@example.com', '{"subject":"Again"}');
DO $$ BEGIN
  ASSERT (SELECT payload->'headers'->>'List-Unsubscribe' FROM public.email_messages ORDER BY id DESC LIMIT 1)
    = '<https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?token='
      || (SELECT token FROM public.crm_email_preference_tokens LIMIT 1) || '>',
    'production links are byte-for-byte what they were, reusing the existing token';
END $$;

DELETE FROM vault.decrypted_secrets WHERE name = 'internal_functions_base_url';
INSERT INTO public.email_messages(tenant_id, customer_id, email, payload)
VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'reader@example.com', '{"subject":"Unconfigured"}');
DO $$ BEGIN
  ASSERT (SELECT payload->'headers' FROM public.email_messages ORDER BY id DESC LIMIT 1) IS NULL,
    'an unconfigured project adds no unsubscribe link rather than another project''s';
END $$;

-- 5. Trial reminders. The function's own queries already fail in production
-- (EXTRACT(DAY FROM date - date) on a date column), so only its destination is
-- checked here: it must name this project's URL and never production's.
DO $$ BEGIN
  ASSERT (SELECT prosrc FROM pg_proc WHERE proname = 'check_trial_expiration_emails') NOT LIKE '%udldmkqwnxhdeztyqcau%',
    'trial reminders no longer name production';
  ASSERT (SELECT count(*) FROM regexp_matches(
      (SELECT prosrc FROM pg_proc WHERE proname = 'check_trial_expiration_emails'),
      'url := public\.internal_function_url\(''send-trial-reminder''\)', 'g')) = 2,
    'both reminder posts resolve this project''s send-trial-reminder';
END $$;

-- 6. Privileges.
DO $$ BEGIN
  ASSERT NOT has_function_privilege('authenticated', 'public.check_trial_expiration_emails()', 'EXECUTE'),
    'signed-in users can no longer trigger trial emails';
  ASSERT NOT has_function_privilege('anon', 'public.check_trial_expiration_emails()', 'EXECUTE'), 'anon cannot either';
  ASSERT has_function_privilege('service_role', 'public.check_trial_expiration_emails()', 'EXECUTE'), 'service_role still can';
  ASSERT has_function_privilege('authenticated', 'public.internal_function_url(text)', 'EXECUTE'),
    'invoker triggers that build links can resolve the URL';
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.internal_function_url('../auth/v1/admin');
    ASSERT false, 'path traversal must be rejected';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

\echo 'internal functions use this project only: ok'
ROLLBACK;
