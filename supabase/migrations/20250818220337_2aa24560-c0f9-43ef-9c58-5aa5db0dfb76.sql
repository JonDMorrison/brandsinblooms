-- Create the missing update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phase B: Advanced domain management features

-- Add Domain Connect and provider integration columns
ALTER TABLE domains 
ADD COLUMN domain_connect_supported BOOLEAN DEFAULT false,
ADD COLUMN domain_connect_template_id TEXT,
ADD COLUMN provider_type TEXT, -- 'cloudflare', 'route53', 'manual', 'domain_connect'
ADD COLUMN provider_credentials JSONB DEFAULT '{}',
ADD COLUMN auto_dns_enabled BOOLEAN DEFAULT false,
ADD COLUMN acme_challenge_type TEXT DEFAULT 'http-01', -- 'http-01', 'dns-01'
ADD COLUMN acme_challenge_token TEXT,
ADD COLUMN acme_challenge_response TEXT,
ADD COLUMN certificate_issued_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN certificate_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN health_check_frequency INTEGER DEFAULT 300; -- seconds

-- Add domain provider integrations table
CREATE TABLE domain_provider_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  provider_type TEXT NOT NULL, -- 'cloudflare', 'route53'
  provider_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add domain health monitoring table
CREATE TABLE domain_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  check_type TEXT NOT NULL, -- 'dns', 'tls', 'http'
  status TEXT NOT NULL, -- 'healthy', 'warning', 'error'
  details JSONB NOT NULL DEFAULT '{}',
  response_time_ms INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add domain connect sessions table
CREATE TABLE domain_connect_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  registrar_name TEXT,
  template_id TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE domain_provider_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_connect_sessions ENABLE ROW LEVEL SECURITY;

-- Domain provider integrations policies
CREATE POLICY "Tenant users can manage provider integrations" 
ON domain_provider_integrations FOR ALL
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = domain_provider_integrations.tenant_id 
  AND u.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = domain_provider_integrations.tenant_id 
  AND u.id = auth.uid()
));

-- Domain health checks policies
CREATE POLICY "Tenant users can view domain health checks" 
ON domain_health_checks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM domains d
  JOIN users u ON u.tenant_id = d.tenant_id
  WHERE d.id = domain_health_checks.domain_id 
  AND u.id = auth.uid()
));

-- Domain Connect sessions policies
CREATE POLICY "Tenant users can manage domain connect sessions" 
ON domain_connect_sessions FOR ALL
USING (EXISTS (
  SELECT 1 FROM domains d
  JOIN users u ON u.tenant_id = d.tenant_id
  WHERE d.id = domain_connect_sessions.domain_id 
  AND u.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM domains d
  JOIN users u ON u.tenant_id = d.tenant_id
  WHERE d.id = domain_connect_sessions.domain_id 
  AND u.id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_domain_provider_integrations_updated_at
  BEFORE UPDATE ON domain_provider_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_connect_sessions_updated_at
  BEFORE UPDATE ON domain_connect_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();