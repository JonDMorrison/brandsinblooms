-- Create function to enable CRM for a user
CREATE OR REPLACE FUNCTION enable_crm_for_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the company profile to enable CRM
  UPDATE public.company_profiles 
  SET feature_flags = jsonb_set(
    COALESCE(feature_flags, '{}'::jsonb), 
    '{crm_enabled}', 
    'true'::jsonb
  ),
  updated_at = now()
  WHERE user_id = target_user_id;
  
  RETURN TRUE;
END;
$$;