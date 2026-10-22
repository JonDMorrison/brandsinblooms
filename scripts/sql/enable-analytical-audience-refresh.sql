-- Release activation only: run AFTER reviewed migration and worker deployment.
-- Reuses existing service credential; does not create credentials or grants.
SELECT cron.schedule('analytical-audience-refresh-worker','* * * * *',
 $job$SELECT net.http_post(
  url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/refresh-analytical-audiences',
  headers := jsonb_build_object('Content-Type','application/json','apikey',public.get_service_role_key(),'Authorization','Bearer '||public.get_service_role_key()),body := '{}'::jsonb);$job$);
