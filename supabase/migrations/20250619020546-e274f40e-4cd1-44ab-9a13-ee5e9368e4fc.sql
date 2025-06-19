
-- Create function to check for existing email before signup
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check
  );
$$;

-- Create function to safely merge duplicate accounts
CREATE OR REPLACE FUNCTION public.merge_duplicate_accounts(
  keep_user_id UUID,
  merge_user_id UUID
)
RETURNS boolean
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

  -- Verify both users exist and have same email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au1 
    JOIN auth.users au2 ON au1.email = au2.email
    WHERE au1.id = keep_user_id AND au2.id = merge_user_id
  ) THEN
    RAISE EXCEPTION 'Users must exist and have the same email address.';
  END IF;

  -- Merge data from various tables (preserve the account we're keeping)
  -- Update campaigns
  UPDATE public.campaigns SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_tasks
  UPDATE public.content_tasks SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_templates
  UPDATE public.content_templates SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update content_assets
  UPDATE public.content_assets SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update social_connections
  UPDATE public.social_connections SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update analytics_settings
  UPDATE public.analytics_settings SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update subscriptions (keep the better plan)
  UPDATE public.subscriptions SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Update token_usage
  UPDATE public.token_usage SET user_id = keep_user_id WHERE user_id = merge_user_id;
  
  -- Merge company profiles (keep most complete one, but preserve tokens)
  UPDATE public.company_profiles 
  SET 
    company_name = COALESCE(cp1.company_name, cp2.company_name),
    company_overview = COALESCE(cp1.company_overview, cp2.company_overview),
    location_info = COALESCE(cp1.location_info, cp2.location_info),
    brand_voice = COALESCE(cp1.brand_voice, cp2.brand_voice),
    target_audience = COALESCE(cp1.target_audience, cp2.target_audience),
    tokens_balance = GREATEST(cp1.tokens_balance, cp2.tokens_balance),
    onboarding_completed_at = COALESCE(cp1.onboarding_completed_at, cp2.onboarding_completed_at)
  FROM public.company_profiles cp1
  LEFT JOIN public.company_profiles cp2 ON cp2.user_id = merge_user_id
  WHERE cp1.user_id = keep_user_id AND public.company_profiles.user_id = keep_user_id;
  
  -- Delete the duplicate profile
  DELETE FROM public.company_profiles WHERE user_id = merge_user_id;
  
  -- Log the merge operation
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    metadata
  ) VALUES (
    keep_user_id,
    'account_merge',
    0,
    (SELECT tokens_balance FROM public.company_profiles WHERE user_id = keep_user_id),
    jsonb_build_object('merged_user_id', merge_user_id, 'merged_at', now())
  );
  
  -- Finally delete the duplicate user from auth
  DELETE FROM auth.users WHERE id = merge_user_id;
  
  RETURN TRUE;
END;
$$;

-- Create function to get duplicate account suggestions
CREATE OR REPLACE FUNCTION public.get_duplicate_merge_suggestions()
RETURNS TABLE (
  email character varying(255),
  accounts jsonb,
  suggested_keep_user_id UUID,
  suggestion_reason TEXT
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
  WITH duplicate_emails AS (
    SELECT au.email, COUNT(*) as account_count
    FROM auth.users au
    JOIN public.company_profiles cp ON cp.user_id = au.id
    GROUP BY au.email
    HAVING COUNT(*) > 1
  ),
  account_details AS (
    SELECT 
      au.email,
      au.id as user_id,
      cp.created_at,
      cp.onboarding_completed_at,
      cp.tokens_balance,
      cp.company_name,
      COALESCE(ct.content_count, 0) as content_count,
      COALESCE(cam.campaign_count, 0) as campaign_count
    FROM auth.users au
    JOIN public.company_profiles cp ON cp.user_id = au.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as content_count 
      FROM public.content_tasks 
      GROUP BY user_id
    ) ct ON ct.user_id = au.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as campaign_count 
      FROM public.campaigns 
      GROUP BY user_id
    ) cam ON cam.user_id = au.id
    WHERE au.email IN (SELECT email FROM duplicate_emails)
  )
  SELECT 
    ad.email::character varying(255),
    jsonb_agg(
      jsonb_build_object(
        'user_id', ad.user_id,
        'created_at', ad.created_at,
        'onboarding_completed_at', ad.onboarding_completed_at,
        'tokens_balance', ad.tokens_balance,
        'company_name', ad.company_name,
        'content_count', ad.content_count,
        'campaign_count', ad.campaign_count
      ) ORDER BY ad.created_at DESC
    ) as accounts,
    (array_agg(ad.user_id ORDER BY 
      CASE WHEN ad.onboarding_completed_at IS NOT NULL THEN 1 ELSE 2 END,
      ad.content_count DESC,
      ad.campaign_count DESC,
      ad.tokens_balance DESC,
      ad.created_at DESC
    ))[1] as suggested_keep_user_id,
    CASE 
      WHEN MAX(CASE WHEN ad.onboarding_completed_at IS NOT NULL THEN 1 ELSE 0 END) = 1 
      THEN 'Most complete profile with onboarding completed'
      WHEN MAX(ad.content_count) > 0 
      THEN 'Account with most content'
      WHEN MAX(ad.campaign_count) > 0 
      THEN 'Account with most campaigns'
      ELSE 'Newest account'
    END as suggestion_reason
  FROM account_details ad
  GROUP BY ad.email;
END;
$$;
