-- Drop existing check_sms_quota function to recreate with new parameter name
DROP FUNCTION IF EXISTS public.check_sms_quota(integer, text);
DROP FUNCTION IF EXISTS public.check_sms_quota(integer, uuid);
DROP FUNCTION IF EXISTS public.check_sms_quota(uuid, integer);

-- Create function to check SMS quota before sending
CREATE OR REPLACE FUNCTION public.check_sms_quota(
  p_tenant_id uuid,
  p_estimated_units int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_quota int;
  v_usage int;
  v_remaining int;
BEGIN
  -- Find user for this tenant
  SELECT id INTO v_user_id
  FROM users
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'No user found for tenant',
      'quota', 0,
      'usage', 0,
      'remaining', 0,
      'estimatedUnits', p_estimated_units
    );
  END IF;
  
  -- Get quota and usage
  SELECT 
    COALESCE(sms_quota, 0),
    COALESCE(sms_usage, 0)
  INTO v_quota, v_usage
  FROM subscriptions
  WHERE user_id = v_user_id;
  
  IF v_quota IS NULL THEN
    v_quota := 0;
    v_usage := 0;
  END IF;
  
  v_remaining := v_quota - v_usage;
  
  RETURN jsonb_build_object(
    'allowed', v_remaining >= p_estimated_units,
    'quota', v_quota,
    'usage', v_usage,
    'remaining', v_remaining,
    'estimatedUnits', p_estimated_units
  );
END;
$$;