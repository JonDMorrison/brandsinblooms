
-- Create an admin function to get user emails and data
CREATE OR REPLACE FUNCTION public.get_admin_user_data()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  company_name TEXT,
  company_overview TEXT,
  location_info TEXT,
  tokens_balance INTEGER,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  subscription_plan TEXT,
  subscription_status TEXT,
  subscription_end_date DATE
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
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

  RETURN QUERY
  SELECT 
    cp.user_id,
    au.email,
    cp.created_at,
    cp.company_name,
    cp.company_overview,
    cp.location_info,
    cp.tokens_balance,
    cp.onboarding_completed_at,
    s.plan::TEXT as subscription_plan,
    CASE 
      WHEN s.end_date > CURRENT_DATE THEN 'active'
      ELSE 'expired'
    END as subscription_status,
    s.end_date as subscription_end_date
  FROM public.company_profiles cp
  LEFT JOIN auth.users au ON au.id = cp.user_id
  LEFT JOIN public.subscriptions s ON s.user_id = cp.user_id
  ORDER BY cp.created_at DESC;
END;
$$;

-- Create an admin function to delete users completely
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
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

  -- Delete from all related tables first (due to foreign key constraints)
  DELETE FROM public.token_usage WHERE user_id = target_user_id;
  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;
  DELETE FROM public.content_templates WHERE user_id = target_user_id;
  DELETE FROM public.content_assets WHERE user_id = target_user_id;
  DELETE FROM public.social_connections WHERE user_id = target_user_id;
  DELETE FROM public.analytics_settings WHERE user_id = target_user_id;
  DELETE FROM public.team_members WHERE user_id = target_user_id;
  DELETE FROM public.teams WHERE owner_id = target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.company_profiles WHERE user_id = target_user_id;
  DELETE FROM public.onboarding_responses WHERE user_id = target_user_id;
  DELETE FROM public.trial_expiration_emails WHERE user_id = target_user_id;
  
  -- Finally delete from auth.users (this will cascade to other auth tables)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;
