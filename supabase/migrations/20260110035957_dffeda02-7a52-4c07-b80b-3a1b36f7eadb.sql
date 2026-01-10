-- Update trigger to exempt the server_finalize_onboarding function
-- The trigger needs to allow updates from within SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.protect_onboarding_completed_at()
RETURNS TRIGGER AS $$
DECLARE
  current_role_val text;
  calling_function text;
BEGIN
  -- Allow if onboarding_completed_at is not being changed
  IF OLD.onboarding_completed_at IS NOT DISTINCT FROM NEW.onboarding_completed_at THEN
    RETURN NEW;
  END IF;
  
  -- Get the calling function from the call stack
  -- pg_catalog.pg_backend_pid() with query inspection
  SELECT routine_name INTO calling_function
  FROM information_schema.routines
  WHERE specific_schema = 'public'
    AND routine_name = 'server_finalize_onboarding'
  LIMIT 1;
  
  -- Check if we're being called from server_finalize_onboarding
  -- by examining the function call stack
  IF EXISTS (
    SELECT 1 FROM pg_stat_activity 
    WHERE pid = pg_backend_pid() 
    AND query LIKE '%server_finalize_onboarding%'
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Get current role
  current_role_val := current_setting('role', true);
  
  -- Allow if current role is postgres (superuser) or service_role
  IF current_role_val IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  
  -- Block client-side updates to onboarding_completed_at
  RAISE EXCEPTION 'onboarding_completed_at can only be set by the server. Use the finalize-onboarding endpoint.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;