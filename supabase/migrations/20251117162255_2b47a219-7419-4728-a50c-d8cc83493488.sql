
-- Upgrade Garden Grove Nursery (jamie@gardengrove.com) to paid Bloom plan
UPDATE public.subscriptions
SET 
  plan = 'bloom',
  end_date = '2026-11-17',
  billing_interval = 'annual',
  updated_at = NOW()
WHERE user_id = 'a0d2a3bd-4b8d-4fd6-babf-1615bf7ed78e';
