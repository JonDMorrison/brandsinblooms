-- Create cron job to process email send queue every minute
SELECT cron.schedule(
  'process-email-send-queue',
  '* * * * *',  -- every minute
  $$
  SELECT
    net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-email-send-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);