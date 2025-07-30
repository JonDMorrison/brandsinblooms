-- First, let's ensure we have proper user records for CRM functionality
-- This will help restore access to campaigns

-- Insert missing user record if it doesn't exist
INSERT INTO public.users (id, email, name, role, tenant_id, created_by_user_id)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'admin',
  NULL, -- Will be updated after tenant creation
  au.id
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL AND au.id = auth.uid();

-- Create a tenant for the user if they don't have one
INSERT INTO public.tenants (id, name, slug, is_active)
SELECT 
  gen_random_uuid(),
  COALESCE(cp.company_name, 'My Company'),
  LOWER(REPLACE(COALESCE(cp.company_name, 'my-company'), ' ', '-')),
  true
FROM public.company_profiles cp
LEFT JOIN public.users u ON u.id = cp.user_id
LEFT JOIN public.tenants t ON t.id = u.tenant_id
WHERE cp.user_id = auth.uid() AND t.id IS NULL;

-- Update user with tenant_id
UPDATE public.users 
SET tenant_id = (
  SELECT t.id 
  FROM public.tenants t
  JOIN public.company_profiles cp ON cp.company_name = t.name OR (cp.company_name IS NULL AND t.name = 'My Company')
  WHERE cp.user_id = auth.uid()
  LIMIT 1
)
WHERE id = auth.uid() AND tenant_id IS NULL;