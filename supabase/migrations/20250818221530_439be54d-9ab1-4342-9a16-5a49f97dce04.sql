-- Add tables for OAuth states and domain setup sessions
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policies for oauth_states
CREATE POLICY "Users can manage oauth states for their tenant" ON public.oauth_states
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tenant_id = oauth_states.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Add oauth_connected column to domain_provider_integrations
ALTER TABLE public.domain_provider_integrations 
ADD COLUMN IF NOT EXISTS oauth_connected BOOLEAN DEFAULT false;

-- Create domain_setup_sessions table
CREATE TABLE IF NOT EXISTS public.domain_setup_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  setup_type TEXT NOT NULL,
  records_to_create JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_integration_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.domain_setup_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for domain_setup_sessions
CREATE POLICY "Users can manage setup sessions for their domains" ON public.domain_setup_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM domains d
    JOIN users u ON u.tenant_id = d.tenant_id
    WHERE d.id = domain_setup_sessions.domain_id 
    AND u.id = auth.uid()
  )
);

-- Create domain_activity_logs table
CREATE TABLE IF NOT EXISTS public.domain_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.domain_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for domain_activity_logs
CREATE POLICY "Users can view activity logs for their domains" ON public.domain_activity_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM domains d
    JOIN users u ON u.tenant_id = d.tenant_id
    WHERE d.id = domain_activity_logs.domain_id 
    AND u.id = auth.uid()
  )
);

-- Add setup columns to domains table
ALTER TABLE public.domains 
ADD COLUMN IF NOT EXISTS setup_type TEXT,
ADD COLUMN IF NOT EXISTS dns_provider TEXT,
ADD COLUMN IF NOT EXISTS last_setup_at TIMESTAMP WITH TIME ZONE;

-- Create updated_at triggers
CREATE TRIGGER update_domain_setup_sessions_updated_at
  BEFORE UPDATE ON public.domain_setup_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_domain_setup_sessions_domain_id ON public.domain_setup_sessions(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_activity_logs_domain_id ON public.domain_activity_logs(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_activity_logs_created_at ON public.domain_activity_logs(created_at DESC);