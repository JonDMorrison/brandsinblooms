-- Add username column to social_connections table for Instagram integration
ALTER TABLE public.social_connections 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.social_connections.username IS 'Instagram username or display name for the connected account';