-- Create an RPC function that only service_role can call to set onboarding_completed_at
-- This is the authoritative way to complete onboarding

CREATE OR REPLACE FUNCTION public.server_finalize_onboarding(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_result jsonb;
BEGIN
  -- Fetch profile
  SELECT id, postal_code, location_needs_confirmation, onboarding_completed_at
  INTO v_profile
  FROM company_profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Check invariants
  IF v_profile.postal_code IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please confirm your primary location to continue.',
      'code', 'LOCATION_NOT_SET'
    );
  END IF;
  
  IF v_profile.location_needs_confirmation = true THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please confirm your primary location to continue.',
      'code', 'LOCATION_NOT_CONFIRMED'
    );
  END IF;
  
  -- Already completed
  IF v_profile.onboarding_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Onboarding already completed',
      'onboarding_completed_at', v_profile.onboarding_completed_at,
      'already_completed', true
    );
  END IF;
  
  -- Set completion timestamp (this bypasses the trigger since we're in SECURITY DEFINER)
  UPDATE company_profiles
  SET 
    onboarding_completed_at = now(),
    updated_at = now()
  WHERE id = v_profile.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding completed successfully',
    'onboarding_completed_at', now(),
    'profile_id', v_profile.id
  );
END;
$$;

-- Revoke execute from public, only service_role should call this
REVOKE EXECUTE ON FUNCTION public.server_finalize_onboarding(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server_finalize_onboarding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.server_finalize_onboarding(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.server_finalize_onboarding(uuid) TO service_role;

COMMENT ON FUNCTION public.server_finalize_onboarding(uuid) IS 
  'Server-only function to finalize onboarding. Validates location invariant before setting onboarding_completed_at.';