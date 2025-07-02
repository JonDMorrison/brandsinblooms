-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Insert user into public.users table
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
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically create user record on signup
DROP TRIGGER IF EXISTS on_auth_user_created_user_record ON auth.users;
CREATE TRIGGER on_auth_user_created_user_record
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_signup();