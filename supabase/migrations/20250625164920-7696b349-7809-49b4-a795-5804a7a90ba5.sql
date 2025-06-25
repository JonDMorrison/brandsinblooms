
-- Create a function to reset a master admin account for testing
CREATE OR REPLACE FUNCTION public.reset_master_admin_account(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  -- Only allow super admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  -- Only allow resetting your own account or other super admin accounts
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = target_user_id
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) THEN
    RAISE EXCEPTION 'Can only reset super admin accounts.';
  END IF;

  -- Delete all content and data for the account
  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;
  DELETE FROM public.token_usage WHERE user_id = target_user_id;
  DELETE FROM public.content_templates WHERE user_id = target_user_id;
  DELETE FROM public.content_assets WHERE user_id = target_user_id;
  DELETE FROM public.social_connections WHERE user_id = target_user_id;
  DELETE FROM public.analytics_settings WHERE user_id = target_user_id;
  DELETE FROM public.social_posts WHERE user_id = target_user_id;
  DELETE FROM public.onboarding_responses WHERE user_id = target_user_id;

  -- Reset company profile to initial state
  UPDATE public.company_profiles 
  SET 
    company_name = NULL,
    company_overview = NULL,
    brand_voice = NULL,
    tone_of_writing = NULL,
    target_audience = NULL,
    ideal_customer = NULL,
    unique_selling_points = NULL,
    company_values = NULL,
    seasonal_focus = NULL,
    specializations = NULL,
    location_info = NULL,
    tokens_balance = 100,
    tokens_reset_at = now() + INTERVAL '1 month',
    first_content_generated = false,
    onboarding_completed_at = NULL,
    first_welcome_dismissed = false,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Reset subscription to trial if needed
  UPDATE public.subscriptions 
  SET 
    plan = 'free_trial',
    start_date = CURRENT_DATE,
    end_date = CURRENT_DATE + INTERVAL '7 days',
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the reset action
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    metadata
  ) VALUES (
    target_user_id,
    'admin_reset',
    0,
    100,
    jsonb_build_object('reset_by', auth.uid(), 'reset_at', now())
  );

  RETURN TRUE;
END;
$$;
