-- Fix signup failure: replace email-based upsert with id-based upsert in handle_new_user_signup
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