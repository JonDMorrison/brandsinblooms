
-- Upgrade Maple Park Farm (info@mapleparkfarm.com) to paid Bloom plan
UPDATE public.subscriptions
SET 
  plan = 'bloom',
  end_date = '2026-11-17',
  billing_interval = 'annual',
  updated_at = NOW()
WHERE user_id = 'a0035a78-2509-4bad-80d3-508e610393c0';
