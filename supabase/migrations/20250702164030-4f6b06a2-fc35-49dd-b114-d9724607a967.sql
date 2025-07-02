-- Create the missing user record for the existing user
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  created_by_user_id,
  created_at
) VALUES (
  '05f06ff6-3dc2-485c-a228-b0a1363ef25b',
  'Jeremy Buttawipo',
  'jeremy@buttawipo.com',
  'admin',
  '05f06ff6-3dc2-485c-a228-b0a1363ef25b',
  now()
) ON CONFLICT (id) DO NOTHING;