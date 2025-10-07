
-- Direct trial extension for kristy@windermeregardencentre.com
DO $$
DECLARE
  target_user_id uuid;
  old_end_date date;
  new_end_date date;
BEGIN
  -- Find the user
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = 'kristy@windermeregardencentre.com';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: kristy@windermeregardencentre.com';
  END IF;

  -- Get current end date
  SELECT end_date INTO old_end_date
  FROM public.subscriptions
  WHERE user_id = target_user_id
  AND plan = 'free_trial';

  IF old_end_date IS NULL THEN
    RAISE EXCEPTION 'No active trial found for user';
  END IF;

  -- Extend the trial by 60 days
  UPDATE public.subscriptions
  SET 
    end_date = end_date + INTERVAL '60 days',
    updated_at = now()
  WHERE user_id = target_user_id
  AND plan = 'free_trial'
  RETURNING end_date INTO new_end_date;

  RAISE NOTICE 'Trial extended for kristy@windermeregardencentre.com from % to %', old_end_date, new_end_date;
END $$;
