-- Create table to track OAuth code usage and prevent reuse
CREATE TABLE IF NOT EXISTS public.oauth_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policy
ALTER TABLE public.oauth_code_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own code usage records
CREATE POLICY "Users can view their own oauth code usage" 
ON public.oauth_code_usage 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own code usage records  
CREATE POLICY "Users can insert their own oauth code usage" 
ON public.oauth_code_usage 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_oauth_code_usage_code_hash ON public.oauth_code_usage(code_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_code_usage_user_id ON public.oauth_code_usage(user_id);

-- Clean up old records (older than 24 hours) to prevent table bloat
CREATE OR REPLACE FUNCTION cleanup_old_oauth_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.oauth_code_usage 
  WHERE created_at < (now() - INTERVAL '24 hours');
END;
$$;