-- Fix watchdog cron job JSON syntax error
-- The concat() method was causing invalid JSON errors

-- First, unschedule the old broken cron job
SELECT cron.unschedule('watchdog-stuck-content');

-- Re-create the watchdog cron job with proper JSON formatting
SELECT cron.schedule(
  'watchdog-stuck-content',
  '*/5 * * * *', -- every 5 minutes
  $$
  select
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/watchdog',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
        body:=jsonb_build_object('time', now()::text, 'trigger', 'cron')
    ) as request_id;
  $$
);