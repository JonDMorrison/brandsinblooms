-- Enable permanent bloom access with CRM for master admin accounts

-- First, let's clean up jon@getclear.ca's duplicate subscriptions and update to bloom
-- Delete the expired subscription record for jon@getclear.ca
DELETE FROM public.subscriptions 
WHERE user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac' 
AND plan = 'free_trial' 
AND end_date < CURRENT_DATE;

-- Update jon@getclear.ca's remaining subscription to bloom with permanent access
UPDATE public.subscriptions 
SET 
  plan = 'bloom',
  start_date = CURRENT_DATE,
  end_date = CURRENT_DATE + INTERVAL '10 years',
  billing_interval = 'annual',
  crm_enabled = true,
  sms_enabled = true,
  contacts_limit = 10000,
  email_quota = 25000,
  sms_quota = 5000,
  email_usage = 0,
  sms_usage = 0,
  max_connections = 25,
  max_posts_per_month = 2500,
  base_token_allowance = 2500,
  updated_at = now()
WHERE user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac';

-- Update jeff@brandsinblooms.com's subscription to bloom with permanent access
UPDATE public.subscriptions 
SET 
  plan = 'bloom',
  start_date = CURRENT_DATE,
  end_date = CURRENT_DATE + INTERVAL '10 years',
  billing_interval = 'annual',
  crm_enabled = true,
  sms_enabled = true,
  contacts_limit = 10000,
  email_quota = 25000,
  sms_quota = 5000,
  email_usage = 0,
  sms_usage = 0,
  max_connections = 25,
  max_posts_per_month = 2500,
  base_token_allowance = 2500,
  updated_at = now()
WHERE user_id = 'df4b2c1a-8e3f-4a5b-9c7d-1e2f3a4b5c6d';

-- Verify the updates
SELECT 
  user_id,
  plan,
  start_date,
  end_date,
  crm_enabled,
  sms_enabled,
  contacts_limit,
  email_quota,
  sms_quota,
  max_connections,
  max_posts_per_month
FROM public.subscriptions 
WHERE user_id IN (
  '2e43e993-fd88-46f6-9a16-be4cc3dcfcac', 
  'df4b2c1a-8e3f-4a5b-9c7d-1e2f3a4b5c6d'
);