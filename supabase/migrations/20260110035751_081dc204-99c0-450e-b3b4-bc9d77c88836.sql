-- Fix trigger to properly detect service_role from edge functions
-- Edge functions using service_role key set role to 'authenticated' but with service claims

CREATE OR REPLACE FUNCTION public.protect_onboarding_completed_at()
RETURNS TRIGGER AS $$
DECLARE
  current_role_val text;
BEGIN
  -- Allow if onboarding_completed_at is not being changed
  IF OLD.onboarding_completed_at IS NOT DISTINCT FROM NEW.onboarding_completed_at THEN
    RETURN NEW;
  END IF;
  
  -- Get current role
  current_role_val := current_setting('role', true);
  
  -- Allow if current role is service_role or postgres (superuser)
  IF current_role_val IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is a service_role client by checking for no RLS bypass
  -- Edge functions with service_role key should be allowed
  -- We detect this by checking if the request has the service_role claim
  BEGIN
    IF (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role' THEN
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims available, continue to block
    NULL;
  END;
  
  -- Block client-side updates to onboarding_completed_at
  RAISE EXCEPTION 'onboarding_completed_at can only be set by the server. Use the finalize-onboarding endpoint.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;