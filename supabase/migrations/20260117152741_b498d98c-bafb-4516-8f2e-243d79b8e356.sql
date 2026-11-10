
-- Fix domain-verify-cron-2m to use hardcoded URL instead of current_setting
SELECT cron.unschedule(14);

SELECT cron.schedule(
  'domain-verify-cron-2m',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/domain-verify-cron',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
      body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Fix process-email-send-queue to use hardcoded auth instead of current_setting
SELECT cron.unschedule(15);

SELECT cron.schedule(
  'process-email-send-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-email-send-queue',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
      body := '{}'::jsonb
  ) AS request_id;
  $$
);
