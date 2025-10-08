-- Auto-grant master_admin role to specific emails
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  has_admin_role boolean;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = _user_id;
  
  -- Check if user already has master_admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master_admin'
  ) INTO has_admin_role;
  
  -- Auto-grant master_admin to specific emails if they don't have it
  IF NOT has_admin_role AND user_email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'master_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    has_admin_role := true;
  END IF;
  
  RETURN has_admin_role;
END;
$$;