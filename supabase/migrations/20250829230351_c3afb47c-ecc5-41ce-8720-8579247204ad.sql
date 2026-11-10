-- Enable cron extension for scheduling watchdog function
SELECT cron.schedule(
  'watchdog-stuck-content',
  '*/5 * * * *', -- every 5 minutes
  $$
  select
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/watchdog',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);