-- Fix: auth.users AFTER INSERT trigger crashes because public.users.tenant_id
-- may have a NOT NULL constraint, but handle_new_user_signup() never supplies it.
-- Step 1: Make tenant_id nullable so signup doesn't crash.
-- Step 2: Re-declare handle_new_user_signup() to ensure the latest version is live.

-- 1. Allow NULL tenant_id on public.users (tenant is assigned later during onboarding)
ALTER TABLE public.users ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Re-declare the signup trigger function (identical to 20251003143408 latest version)
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update the mirrored public.users row for the new auth user
  INSERT INTO public.users (
    id,
    name,
    email,
    role,
    created_by_user_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'admin', -- New users are admins of their own workspace
    NEW.id   -- Self-created
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;
