-- Create email_domains table (one domain across the whole system)
CREATE TABLE IF NOT EXISTS public.email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  provider TEXT DEFAULT 'manual', -- 'domain_connect' | 'cloudflare' | 'manual'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'verifying'|'active'|'error'
  env TEXT NOT NULL DEFAULT 'prod', -- 'prod'|'dev'
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  report_email TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global uniqueness constraint (critical for multi-tenancy)
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_domains_domain ON public.email_domains (domain);

-- Create email_dns_records table (what Resend requires)
CREATE TABLE IF NOT EXISTS public.email_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'TXT'|'CNAME'
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  purpose TEXT NOT NULL, -- 'dkim'|'spf'|'return_path'|'verification'|'dmarc'
  applied_automatically BOOLEAN DEFAULT false,
  applied_provider TEXT,
  provider_record_id TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for DNS records
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_dns_records_domain_type_name 
ON public.email_dns_records (email_domain_id, type, name);

-- Create domain_connect_sessions table
CREATE TABLE IF NOT EXISTS public.domain_connect_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  domain TEXT NOT NULL,
  template_id TEXT,
  registrar TEXT,
  params JSONB DEFAULT '{}',
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated'|'authorized'|'applied'|'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_connect_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_domains
CREATE POLICY "Tenant users can view email domains" 
ON public.email_domains FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = email_domains.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Tenant users can manage email domains" 
ON public.email_domains FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = email_domains.tenant_id AND u.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = email_domains.tenant_id AND u.id = auth.uid()
));

-- RLS policies for email_dns_records
CREATE POLICY "Tenant users can view DNS records" 
ON public.email_dns_records FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.email_domains d 
  JOIN public.users u ON u.tenant_id = d.tenant_id 
  WHERE d.id = email_dns_records.email_domain_id AND u.id = auth.uid()
));

-- RLS policies for domain_connect_sessions
CREATE POLICY "Tenant users can manage domain connect sessions" 
ON public.domain_connect_sessions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = domain_connect_sessions.tenant_id AND u.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = domain_connect_sessions.tenant_id AND u.id = auth.uid()
));

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.update_email_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_domains_updated_at
  BEFORE UPDATE ON public.email_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_domains_updated_at();