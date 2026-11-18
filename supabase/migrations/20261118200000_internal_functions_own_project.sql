-- Point every internal function call at THIS project instead of production.
--
-- Builds on 20261118190000_internal_notion_sync_own_project.sql, which added
-- public.internal_functions_base_url() (Vault secret internal_functions_base_url).
--
-- Before this migration, pg_cron jobs and two functions hard-coded
-- https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/... A non-production
-- project running these migrations woke production's workers every minute,
-- wrote production unsubscribe links into its own emails, and (through
-- check_trial_expiration_emails) could post trial users' email addresses to
-- production. All of these now use this project's own base URL and fail closed
-- when it is not configured.
--
-- Also, verified against production before writing this:
-- - Six legacy cron jobs owned by supabase_read_only_user embed a plaintext
--   bearer token and fail on every run ("permission denied for function
--   http_post"). Each duplicates a working *-v2 job on the same schedule.
--   The migration role cannot alter or unschedule another role's jobs
--   ("permission denied for table job"), so they are left in place and named
--   in a WARNING; removing them needs a superuser (Supabase support). Jobs of
--   that shape owned by the migration role are unscheduled.
-- - check_trial_expiration_emails() is SECURITY DEFINER and was executable by
--   every signed-in user, though nothing calls it. EXECUTE is limited to
--   service_role.

CREATE OR REPLACE FUNCTION public.internal_function_url(p_slug text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base_url text;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9_-]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid internal function name: %', p_slug;
  END IF;
  v_base_url := public.internal_functions_base_url();
  IF v_base_url IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_base_url || '/functions/v1/' || p_slug;
END;
$$;

-- The result is this project's public functions URL, not a secret. Triggers
-- that build customer-facing links run as the inserting role, so it must be
-- callable by the API roles as well as service_role.
REVOKE ALL ON FUNCTION public.internal_function_url(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_function_url(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.internal_function_url(text) IS
  'This project''s own edge-function URL for a function name, or null when internal_functions_base_url is not configured. Never returns another project''s URL.';

-- Unsubscribe headers: unchanged except the link's origin.
CREATE OR REPLACE FUNCTION public.apply_bulk_email_unsubscribe_headers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_headers jsonb;
  v_unsubscribe_url text;
BEGIN
  IF NEW.payload IS NULL OR jsonb_typeof(NEW.payload) <> 'object' THEN
    RETURN NEW;
  END IF;
  -- Only real recipients can have actionable preference links.
  IF NEW.customer_id IS NULL OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Links must point at this project's own handle-unsubscribe. A project
  -- without a configured base URL gets no link rather than another project's.
  v_unsubscribe_url := public.internal_function_url('handle-unsubscribe');
  IF v_unsubscribe_url IS NULL THEN
    RAISE WARNING 'Unsubscribe headers skipped because internal_functions_base_url is not set for this project';
    RETURN NEW;
  END IF;
  SELECT token INTO v_token
  FROM public.crm_email_preference_tokens
  WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id
    AND purpose = 'manage_preferences' AND expires_at > now() + interval '30 days'
  ORDER BY expires_at DESC LIMIT 1;
  IF v_token IS NULL THEN
    -- This function remains SECURITY INVOKER. Token access retains existing RLS.
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_customers
      WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Email recipient does not belong to the sending account';
    END IF;
    v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
    INSERT INTO public.crm_email_preference_tokens
      (tenant_id,customer_id,email,token,purpose,expires_at)
    VALUES (NEW.tenant_id,NEW.customer_id,NEW.email,v_token,
      'manage_preferences',now() + interval '2 years');
  END IF;
  IF v_token !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid email preference token format';
  END IF;
  v_headers := CASE WHEN jsonb_typeof(NEW.payload->'headers')='object'
    THEN NEW.payload->'headers' ELSE '{}'::jsonb END;
  NEW.payload := jsonb_set(NEW.payload,'{headers}',v_headers || jsonb_build_object(
    'List-Unsubscribe','<' || v_unsubscribe_url || '?token=' || v_token || '>',
    'List-Unsubscribe-Post','List-Unsubscribe=One-Click'),true);
  RETURN NEW;
END;
$$;

-- Trial reminders: unchanged except the destination. With no configured base
-- URL, net.http_post receives a null URL and the call fails, rolling back the
-- "email sent" bookkeeping instead of reaching another project.
CREATE OR REPLACE FUNCTION public.check_trial_expiration_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_record RECORD;
  email_count INTEGER := 0;
BEGIN
  -- Find users with exactly 2 days left in their trial who haven't received the expiring email yet
  FOR user_record IN
    SELECT
      s.user_id,
      au.email,
      s.end_date,
      EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) as days_left,
      'trial_expiring' as email_type
    FROM public.subscriptions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.trial_expiration_emails tee ON tee.user_id = s.user_id AND tee.email_type = 'trial_expiring'
    WHERE
      s.plan = 'free_trial'
      AND EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) = 2
      AND tee.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Call the send-trial-reminder edge function for expiring trial
    PERFORM net.http_post(
      url := public.internal_function_url('send-trial-reminder'),
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'user_id', user_record.user_id,
        'email', user_record.email,
        'days_remaining', user_record.days_left,
        'email_type', user_record.email_type
      )::jsonb
    );

    -- Record that we sent the email
    INSERT INTO public.trial_expiration_emails (user_id, days_remaining, email_type)
    VALUES (user_record.user_id, user_record.days_left, 'trial_expiring');

    email_count := email_count + 1;
  END LOOP;

  -- Find users whose trial has expired (0 or negative days) who haven't received the expired email yet
  FOR user_record IN
    SELECT
      s.user_id,
      au.email,
      s.end_date,
      EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) as days_left,
      'trial_expired' as email_type
    FROM public.subscriptions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.trial_expiration_emails tee ON tee.user_id = s.user_id AND tee.email_type = 'trial_expired'
    WHERE
      s.plan = 'free_trial'
      AND EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) <= 0
      AND tee.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Call the send-trial-reminder edge function for expired trial
    PERFORM net.http_post(
      url := public.internal_function_url('send-trial-reminder'),
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'user_id', user_record.user_id,
        'email', user_record.email,
        'days_remaining', user_record.days_left,
        'email_type', user_record.email_type
      )::jsonb
    );

    -- Record that we sent the email
    INSERT INTO public.trial_expiration_emails (user_id, days_remaining, email_type)
    VALUES (user_record.user_id, user_record.days_left, 'trial_expired');

    email_count := email_count + 1;
  END LOOP;

  RETURN email_count;
END;
$function$;

-- Nothing in the app calls this. It reads auth.users as its owner, so it must
-- not be reachable through the API.
REVOKE ALL ON FUNCTION public.check_trial_expiration_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_expiration_emails() TO service_role;

-- Scheduled jobs.
DO $$
DECLARE
  v_job record;
  v_command text;
BEGIN
  -- Legacy jobs with a plaintext bearer token in their command. In production
  -- every one fails ("permission denied for function http_post") and has a
  -- working *-v2 twin that reads the key from Vault. Only this role's own jobs
  -- can be unscheduled here.
  FOR v_job IN
    SELECT jobid, jobname FROM cron.job
    WHERE username = current_user
      AND command ~ 'Bearer [A-Za-z0-9._-]{40,}'
      AND command NOT LIKE '%get_service_role_key%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
    RAISE NOTICE 'Unscheduled legacy job % (plaintext credential)', v_job.jobname;
  END LOOP;

  -- Every remaining job of this role that names production's functions URL
  -- now resolves this project's own URL each time it runs.
  FOR v_job IN
    SELECT jobid, jobname, command FROM cron.job
    WHERE username = current_user
      AND command ~ '''https://udldmkqwnxhdeztyqcau\.supabase\.co/functions/v1/[a-z0-9_-]+'''
  LOOP
    v_command := regexp_replace(
      v_job.command,
      '''https://udldmkqwnxhdeztyqcau\.supabase\.co/functions/v1/([a-z0-9_-]+)''',
      'public.internal_function_url(''\1'')',
      'g'
    );
    PERFORM cron.alter_job(v_job.jobid, command := v_command);
  END LOOP;

  -- Jobs owned by other roles cannot be changed from here. Name them so the
  -- remaining work is visible in the migration output.
  FOR v_job IN
    SELECT jobid, jobname, username FROM cron.job
    WHERE username <> current_user AND command LIKE '%udldmkqwnxhdeztyqcau%'
  LOOP
    RAISE WARNING 'Job % (id %, owned by %) still names production and needs a superuser to remove it',
      v_job.jobname, v_job.jobid, v_job.username;
  END LOOP;
END $$;
