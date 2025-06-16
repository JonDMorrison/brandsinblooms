
-- Update the check_trial_expiration_emails function to handle both expiring and expired trials
CREATE OR REPLACE FUNCTION public.check_trial_expiration_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  email_count INTEGER := 0;
BEGIN
  -- Find users with exactly 3 days left in their trial who haven't received the expiring email yet
  FOR user_record IN 
    SELECT 
      s.user_id,
      au.email,
      s.end_date,
      EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) as days_left,
      'trial_expiring' as email_type
    FROM public.subscriptions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.trial_expiration_emails tee ON tee.user_id = s.user_id AND tee.email_type = 'trial_expiring'
    WHERE 
      s.plan = 'free_trial'
      AND EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) = 3
      AND tee.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Call the send-trial-reminder edge function for expiring trial
    PERFORM net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-trial-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'user_id', user_record.user_id,
        'email', user_record.email,
        'days_remaining', user_record.days_left,
        'email_type', user_record.email_type
      )::jsonb
    );
    
    -- Record that we sent the email
    INSERT INTO public.trial_expiration_emails (user_id, days_remaining, email_type)
    VALUES (user_record.user_id, user_record.days_left, 'trial_expiring');
    
    email_count := email_count + 1;
  END LOOP;
  
  -- Find users whose trial has expired (0 or negative days) who haven't received the expired email yet
  FOR user_record IN 
    SELECT 
      s.user_id,
      au.email,
      s.end_date,
      EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) as days_left,
      'trial_expired' as email_type
    FROM public.subscriptions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.trial_expiration_emails tee ON tee.user_id = s.user_id AND tee.email_type = 'trial_expired'
    WHERE 
      s.plan = 'free_trial'
      AND EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) <= 0
      AND tee.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Call the send-trial-reminder edge function for expired trial
    PERFORM net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-trial-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'user_id', user_record.user_id,
        'email', user_record.email,
        'days_remaining', user_record.days_left,
        'email_type', user_record.email_type
      )::jsonb
    );
    
    -- Record that we sent the email
    INSERT INTO public.trial_expiration_emails (user_id, days_remaining, email_type)
    VALUES (user_record.user_id, user_record.days_left, 'trial_expired');
    
    email_count := email_count + 1;
  END LOOP;
  
  RETURN email_count;
END;
$$;
