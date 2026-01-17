
-- Fix domain-verify-cron-2m to use hardcoded URL instead of current_setting
SELECT cron.unschedule(14);

SELECT cron.schedule(
  'domain-verify-cron-2m',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/domain-verify-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM"}'::jsonb,
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
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM"}'::jsonb,
      body := '{}'::jsonb
  ) AS request_id;
  $$
);
