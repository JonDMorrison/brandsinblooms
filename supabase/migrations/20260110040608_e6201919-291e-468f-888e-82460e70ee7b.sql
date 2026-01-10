-- 1) Update protect_onboarding_completed_at to use session flag instead of pg_stat_activity
CREATE OR REPLACE FUNCTION public.protect_onboarding_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check if onboarding_completed_at is being changed
  IF OLD.onboarding_completed_at IS DISTINCT FROM NEW.onboarding_completed_at THEN
    -- Allow if session flag is set by server_finalize_onboarding
    IF current_setting('app.finalizing_onboarding', true) = 'true' THEN
      RETURN NEW;
    END IF;
    
    -- Allow service_role, postgres, supabase_admin
    IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin') THEN
      RETURN NEW;
    END IF;
    
    -- Block all other attempts
    RAISE EXCEPTION 'onboarding_completed_at can only be set by the server. Use the finalize-onboarding endpoint.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Update server_finalize_onboarding to set the session flag
CREATE OR REPLACE FUNCTION public.server_finalize_onboarding(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_postal_code text;
  v_needs_confirmation boolean;
  v_result jsonb;
BEGIN
  -- Set session flag to allow trigger bypass
  PERFORM set_config('app.finalizing_onboarding', 'true', true);

  -- Find the user's company profile
  SELECT id, postal_code, location_needs_confirmation
  INTO v_profile_id, v_postal_code, v_needs_confirmation
  FROM public.company_profiles
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if profile exists
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No company profile found for this user',
      'code', 'PROFILE_NOT_FOUND'
    );
  END IF;

  -- Validate postal_code is set
  IF v_postal_code IS NULL OR v_postal_code = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Please confirm your primary location to continue.',
      'code', 'LOCATION_NOT_SET'
    );
  END IF;

  -- Validate location is confirmed
  IF v_needs_confirmation IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Please confirm your primary location to continue.',
      'code', 'LOCATION_NOT_CONFIRMED'
    );
  END IF;

  -- Set onboarding_completed_at
  UPDATE public.company_profiles
  SET onboarding_completed_at = now(),
      updated_at = now()
  WHERE id = v_profile_id;

  -- Return success with the profile details
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Onboarding completed successfully',
    'profile_id', id,
    'onboarding_completed_at', onboarding_completed_at
  )
  INTO v_result
  FROM public.company_profiles
  WHERE id = v_profile_id;

  RETURN v_result;
END;
$$;