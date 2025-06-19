
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin required.';
  END IF;

  -- Delete from all related tables in the correct order (respecting foreign key constraints)
  -- Delete content_tasks BEFORE campaigns (since content_tasks references campaigns)
  DELETE FROM public.content_tasks WHERE user_id = target_user_id;
  DELETE FROM public.campaigns WHERE user_id = target_user_id;
  
  -- Delete other related records
  DELETE FROM public.token_usage WHERE user_id = target_user_id;
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
$function$
