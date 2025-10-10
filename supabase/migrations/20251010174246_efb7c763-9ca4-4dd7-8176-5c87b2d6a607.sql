-- Extend trial for christine@dwntoearth.com to remove trial banner
UPDATE public.subscriptions
SET 
  end_date = CURRENT_DATE + INTERVAL '365 days',
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'christine@dwntoearth.com'
)
AND plan = 'free_trial';