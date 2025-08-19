-- Create domain_connect_sessions table first
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

-- Create email_dns_records table if missing  
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

-- Enable RLS on new tables
ALTER TABLE public.domain_connect_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dns_records ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for new tables
CREATE POLICY "Tenant users can manage domain connect sessions" 
ON public.domain_connect_sessions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = domain_connect_sessions.tenant_id AND u.id = auth.uid()
));

CREATE POLICY "Tenant users can view DNS records" 
ON public.email_dns_records FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.email_domains d 
  JOIN public.users u ON u.tenant_id = d.tenant_id 
  WHERE d.id = email_dns_records.email_domain_id AND u.id = auth.uid()
));