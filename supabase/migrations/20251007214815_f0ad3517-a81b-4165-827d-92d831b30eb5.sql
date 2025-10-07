
-- Complete the admin_extend_trial function
CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_tenant_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  me text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Extend the trial for all users in the tenant
  UPDATE subscriptions
  SET 
    end_date = end_date + (p_days || ' days')::interval,
    updated_at = now()
  WHERE user_id IN (
    SELECT id FROM users WHERE tenant_id = p_tenant_id
  )
  AND plan = 'free_trial';
END;
$$;

-- Also create a simpler function to extend trial by user email
CREATE OR REPLACE FUNCTION public.admin_extend_trial_by_email(p_email text, p_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE 
  me text;
  target_user_id uuid;
  old_end_date date;
  new_end_date date;
BEGIN
  -- Check admin authorization
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find the user
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = p_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_email;
  END IF;

  -- Get current end date and extend it
  SELECT end_date INTO old_end_date
  FROM subscriptions
  WHERE user_id = target_user_id
  AND plan = 'free_trial';

  IF old_end_date IS NULL THEN
    RAISE EXCEPTION 'No active trial found for user: %', p_email;
  END IF;

  -- Extend the trial
  UPDATE subscriptions
  SET 
    end_date = end_date + (p_days || ' days')::interval,
    updated_at = now()
  WHERE user_id = target_user_id
  AND plan = 'free_trial'
  RETURNING end_date INTO new_end_date;

  RETURN jsonb_build_object(
    'success', true,
    'email', p_email,
    'old_end_date', old_end_date,
    'new_end_date', new_end_date,
    'days_extended', p_days
  );
END;
$$;
