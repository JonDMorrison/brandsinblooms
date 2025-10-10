-- Update subscription for christine@dwntoearth.com to active paid plan
DO $$
DECLARE
  target_user_id uuid;
  existing_subscription_id uuid;
BEGIN
  -- Find the user ID by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'christine@dwntoearth.com';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email christine@dwntoearth.com not found';
  END IF;

  -- Check if subscription exists
  SELECT id INTO existing_subscription_id
  FROM public.subscriptions
  WHERE user_id = target_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE public.subscriptions
    SET 
      plan = 'bloom',
      start_date = CURRENT_DATE,
      end_date = CURRENT_DATE + INTERVAL '1 year',
      billing_interval = 'annual',
      updated_at = now()
    WHERE id = existing_subscription_id;
    
    RAISE NOTICE 'Updated existing subscription for christine@dwntoearth.com';
  ELSE
    -- Create new subscription
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      start_date,
      end_date,
      billing_interval
    ) VALUES (
      target_user_id,
      'bloom',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 year',
      'annual'
    );
    
    RAISE NOTICE 'Created new subscription for christine@dwntoearth.com';
  END IF;

  RAISE NOTICE 'Successfully set christine@dwntoearth.com to active bloom plan (expires %)', CURRENT_DATE + INTERVAL '1 year';
END $$;