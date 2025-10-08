-- Revert is_master_admin to pure role check (no writes)
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'master_admin');
$$;

-- Seed master_admin role for primary admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master_admin'::app_role
FROM auth.users
WHERE email IN ('jon@getclear.ca', 'jeff@brandsinblooms.com')
ON CONFLICT (user_id, role) DO NOTHING;
