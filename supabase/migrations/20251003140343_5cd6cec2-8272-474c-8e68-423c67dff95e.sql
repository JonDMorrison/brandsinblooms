-- Add unique constraint to users.email to fix signup error
-- The handle_new_user_signup trigger uses ON CONFLICT (email) which requires this constraint

ALTER TABLE public.users 
ADD CONSTRAINT users_email_unique UNIQUE (email);