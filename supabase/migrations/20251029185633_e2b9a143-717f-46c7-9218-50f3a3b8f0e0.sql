-- Drop existing oauth_states table if it exists
DROP TABLE IF EXISTS public.oauth_states CASCADE;

-- Create oauth_states table for temporary state token storage
CREATE TABLE public.oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  domain_prefix TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX idx_oauth_states_token ON public.oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role policy (edge functions)
CREATE POLICY "Edge functions can manage oauth states"
ON public.oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$;