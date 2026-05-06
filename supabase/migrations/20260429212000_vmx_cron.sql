-- VMX POS sync cron job: every 15 minutes
SELECT cron.schedule(
  'vmx-sync-all-every-15min',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/vmx-sync-all',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
    body := '{}'::jsonb
  )$$
);