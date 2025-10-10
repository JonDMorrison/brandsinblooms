-- Fix Christine's banner by setting an active trial
WITH target_user AS (
  SELECT id FROM auth.users WHERE email = 'christine@dwntoearth.com'
)
UPDATE public.subscriptions s
SET 
  plan = 'free_trial',
  end_date = CURRENT_DATE + INTERVAL '365 days',
  updated_at = now()
FROM target_user tu
WHERE s.user_id = tu.id
  AND s.plan IN ('expired','free_trial');