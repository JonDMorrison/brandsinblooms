-- Create pg_cron job for domain verification
-- This runs every 2 minutes to check and verify pending domains

-- First, enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the domain verification cron job
SELECT cron.schedule(
    'domain-verify-cron-2m',
    '*/2 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/domain-verify-cron',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduling for PostgreSQL - used for domain verification retries';