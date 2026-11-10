-- Add preheader_text column to crm_campaigns table for email preview text
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS preheader_text TEXT;

-- Add auto-generation setting to company_profiles feature_flags
UPDATE public.company_profiles 
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"auto_create_weekly_campaigns": true}'::jsonb
WHERE feature_flags IS NULL OR NOT (feature_flags ? 'auto_create_weekly_campaigns');

-- Create cron job to run weekly campaign auto-generation every Monday at 8am PST
-- Note: This uses UTC time, so 8am PST = 3pm UTC (during standard time) or 4pm UTC (during daylight time)
-- Using 4pm UTC to accommodate daylight saving time
SELECT cron.schedule(
  'auto-generate-weekly-campaigns',
  '0 16 * * 1', -- Every Monday at 4pm UTC (8am PST during DST)
  $$
  SELECT
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/auto-generate-weekly-campaigns',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)),
        body:='{"cron_trigger": true}'::jsonb
    ) as request_id;
  $$
);