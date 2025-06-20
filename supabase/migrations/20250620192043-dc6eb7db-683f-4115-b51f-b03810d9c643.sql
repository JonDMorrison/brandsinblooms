
-- First, let's see what tenants exist
SELECT id, name, created_at FROM public.tenants ORDER BY created_at;

-- Let's also check your user info
SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac';

-- Check the users table structure to see if tenant_id is stored there
SELECT id, name, email, tenant_id FROM public.users WHERE email = 'jon@getclear.ca';
