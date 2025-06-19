
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_admin_user_data();

-- Recreate the function with the correct return type
CREATE OR REPLACE FUNCTION public.get_admin_user_data()
RETURNS TABLE (
  user_id UUID,
  email character varying(255),  -- Changed from TEXT to match auth.users.email column type
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
