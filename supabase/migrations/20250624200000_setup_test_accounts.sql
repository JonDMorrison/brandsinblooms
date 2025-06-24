
-- Create test accounts with PRO access
-- This migration sets up specific test accounts that bypass subscription restrictions

-- Insert test user subscriptions (these will be created after the users sign up)
-- We'll use a function to handle this after user creation

-- Create a function to grant PRO access to test accounts
CREATE OR REPLACE FUNCTION public.grant_test_account_pro_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_emails text[] := ARRAY[
    'reviewer+test@brandsinblooms.com',
    'FB_TEST_USER_EMAIL'
  ];
BEGIN
  -- Check if this is a test account
  IF NEW.email = ANY(test_emails) THEN
    -- Create a PRO subscription for test accounts
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      start_date,
      end_date,
      billing_interval,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      'bloom',  -- Highest tier
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '10 years',  -- Effectively permanent
      'annual',
      NOW(),
      NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
      plan = 'bloom',
      end_date = CURRENT_DATE + INTERVAL '10 years',
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically grant PRO access to test accounts
DROP TRIGGER IF EXISTS grant_test_pro_access_trigger ON auth.users;
CREATE TRIGGER grant_test_pro_access_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_test_account_pro_access();

-- Create a function to check if an email is a test account
CREATE OR REPLACE FUNCTION public.is_test_account(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_emails text[] := ARRAY[
    'reviewer+test@brandsinblooms.com',
    'FB_TEST_USER_EMAIL'
  ];
BEGIN
  RETURN user_email = ANY(test_emails);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_test_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_test_account(text) TO anon;
