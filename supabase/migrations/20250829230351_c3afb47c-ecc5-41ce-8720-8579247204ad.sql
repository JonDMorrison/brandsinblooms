-- Enable cron extension for scheduling watchdog function
SELECT cron.schedule(
  'watchdog-stuck-content',
  '*/5 * * * *', -- every 5 minutes
  $$
  select
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/watchdog',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA1ODQzNCwiZXhwIjoyMDY0NjM0NDM0fQ.vPrVJkNYIzSy36qYTG_FgSCgCfCNsGKNLmMSNTlM2Q4"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);