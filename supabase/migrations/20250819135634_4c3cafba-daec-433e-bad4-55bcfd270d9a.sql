-- Create domain_connect_sessions table without policies
CREATE TABLE IF NOT EXISTS public.domain_connect_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  domain TEXT NOT NULL,
  template_id TEXT,
  registrar TEXT,
  params JSONB DEFAULT '{}',
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create email_dns_records table without policies
CREATE TABLE IF NOT EXISTS public.email_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  purpose TEXT NOT NULL,
  applied_automatically BOOLEAN DEFAULT false,
  applied_provider TEXT,
  provider_record_id TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint for DNS records
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_dns_records_domain_type_name 
ON public.email_dns_records (email_domain_id, type, name);