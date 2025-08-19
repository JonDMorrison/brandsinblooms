-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Tenant users can manage email domains" ON public.email_domains;
DROP POLICY IF EXISTS "Tenant users can view email domains" ON public.email_domains;

-- Create email_domains table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  provider TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  env TEXT NOT NULL DEFAULT 'prod',
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  report_email TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add provider column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_domains' AND column_name='provider') THEN
    ALTER TABLE public.email_domains ADD COLUMN provider TEXT DEFAULT 'manual';
  END IF;
  
  -- Add env column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_domains' AND column_name='env') THEN
    ALTER TABLE public.email_domains ADD COLUMN env TEXT NOT NULL DEFAULT 'prod';
  END IF;
  
  -- Add last_error column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_domains' AND column_name='last_error') THEN
    ALTER TABLE public.email_domains ADD COLUMN last_error TEXT;
  END IF;
END $$;

-- Global uniqueness constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_domains_domain ON public.email_domains (domain);

-- Create email_dns_records table
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

-- Create domain_connect_sessions table
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

-- Enable RLS
ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_connect_sessions ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
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
));

CREATE POLICY "Tenant users can view DNS records" 
ON public.email_dns_records FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.email_domains d 
  JOIN public.users u ON u.tenant_id = d.tenant_id 
  WHERE d.id = email_dns_records.email_domain_id AND u.id = auth.uid()
));

CREATE POLICY "Tenant users can manage domain connect sessions" 
ON public.domain_connect_sessions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.tenant_id = domain_connect_sessions.tenant_id AND u.id = auth.uid()
));