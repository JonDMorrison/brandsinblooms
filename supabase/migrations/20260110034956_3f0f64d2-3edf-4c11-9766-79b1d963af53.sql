-- STEP 2: Create trigger to prevent client-side updates to onboarding_completed_at
-- Only service_role (edge functions) can set this column

-- Create function to check if update is from service role
CREATE OR REPLACE FUNCTION public.protect_onboarding_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if onboarding_completed_at is not being changed
  IF OLD.onboarding_completed_at IS NOT DISTINCT FROM NEW.onboarding_completed_at THEN
    RETURN NEW;
  END IF;
  
  -- Allow if current role is service_role (edge functions, admin)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Check for the custom header set by finalize-onboarding edge function
  -- This is a secondary check using request.jwt.claims
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Block client-side updates to onboarding_completed_at
  RAISE EXCEPTION 'onboarding_completed_at can only be set by the server. Use the finalize-onboarding endpoint.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_onboarding_completed_at_trigger ON public.company_profiles;

CREATE TRIGGER protect_onboarding_completed_at_trigger
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_onboarding_completed_at();

-- Add comment for documentation
COMMENT ON FUNCTION public.protect_onboarding_completed_at() IS 
  'Prevents client-side updates to onboarding_completed_at. Only service_role (edge functions) can modify this column.';