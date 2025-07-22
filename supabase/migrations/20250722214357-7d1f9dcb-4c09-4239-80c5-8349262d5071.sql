-- Add auto-send fields to crm_campaigns table
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS send_reasoning TEXT,
ADD COLUMN IF NOT EXISTS predicted_segment_ids TEXT[];

-- Add auto-send settings to company_profiles feature_flags
UPDATE public.company_profiles 
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"auto_send_campaigns": true, "smart_timing_enabled": true}'::jsonb
WHERE feature_flags IS NULL OR NOT (feature_flags ? 'auto_send_campaigns');

-- Create cron job for auto-sending campaigns every hour
SELECT cron.schedule(
  'auto-send-campaigns',
  '0 * * * *', -- Every hour
  $$
  SELECT
    net.http_post(
        url:='https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/auto-send-campaigns',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM"}'::jsonb,
        body:='{"cron_trigger": true}'::jsonb
    ) as request_id;
  $$
);