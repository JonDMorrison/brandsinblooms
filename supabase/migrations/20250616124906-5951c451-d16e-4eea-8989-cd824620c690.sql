
-- Create a table to track trial expiration emails
CREATE TABLE public.trial_expiration_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  days_remaining INTEGER NOT NULL,
  email_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_type TEXT NOT NULL DEFAULT 'trial_expiring',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on trial expiration emails
ALTER TABLE public.trial_expiration_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for trial expiration emails
CREATE POLICY "Users can view their own trial emails" 
  ON public.trial_expiration_emails 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service can create trial emails" 
  ON public.trial_expiration_emails 
  FOR INSERT 
  WITH CHECK (true);

-- Create a function to check for users with 3 days left and send emails
CREATE OR REPLACE FUNCTION public.check_trial_expiration_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  email_count INTEGER := 0;
BEGIN
  -- Find users with exactly 3 days left in their trial who haven't received the email yet
  FOR user_record IN 
    SELECT 
      s.user_id,
      au.email,
      s.end_date,
      EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) as days_left
    FROM public.subscriptions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.trial_expiration_emails tee ON tee.user_id = s.user_id AND tee.email_type = 'trial_expiring'
    WHERE 
      s.plan = 'free_trial'
      AND EXTRACT(DAY FROM (s.end_date - CURRENT_DATE)) = 3
      AND tee.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Call the send-trial-reminder edge function
    PERFORM net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/send-trial-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := json_build_object(
        'user_id', user_record.user_id,
        'email', user_record.email,
        'days_remaining', user_record.days_left
      )::jsonb
    );
    
    -- Record that we sent the email
    INSERT INTO public.trial_expiration_emails (user_id, days_remaining, email_type)
    VALUES (user_record.user_id, user_record.days_left, 'trial_expiring');
    
    email_count := email_count + 1;
  END LOOP;
  
  RETURN email_count;
END;
$$;
