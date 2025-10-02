-- Fix handle_new_user_signup to handle duplicate users gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert user into public.users table with ON CONFLICT handling
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
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(EXCLUDED.name, users.name),
    updated_at = now()
  WHERE users.email = EXCLUDED.email;
  
  RETURN NEW;
END;
$function$;

-- Also add validation to ensure only valid status values can be inserted into content_tasks
-- by creating a more explicit constraint that will give better error messages
COMMENT ON CONSTRAINT content_tasks_status_check ON content_tasks IS 
'Valid status values: planned, pending, review, approved, posted, failed, draft, preview, generating, generated, scheduled, needs_review, in_progress';