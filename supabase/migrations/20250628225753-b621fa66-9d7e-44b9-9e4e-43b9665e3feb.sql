
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule queue-worker to run every minute
SELECT cron.schedule(
  'queue-worker-scheduler',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/queue-worker',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule insights-worker to run daily at 2 AM
SELECT cron.schedule(
  'insights-worker-scheduler',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/insights-worker',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
