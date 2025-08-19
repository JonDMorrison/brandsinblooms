-- Create email environment enum
CREATE TYPE email_env AS ENUM ('prod', 'dev');

-- Add new columns to email_domains table
ALTER TABLE public.email_domains 
ADD COLUMN IF NOT EXISTS env email_env DEFAULT 'prod',
ADD COLUMN IF NOT EXISTS is_sandbox boolean DEFAULT false;

-- Add global uniqueness constraint on domain
ALTER TABLE public.email_domains 
ADD CONSTRAINT unique_domain_global UNIQUE (domain);

-- Add new columns to email_dns_records table
ALTER TABLE public.email_dns_records
ADD COLUMN IF NOT EXISTS applied_automatically boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS applied_provider text,
ADD COLUMN IF NOT EXISTS provider_record_id text,
ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_domains_domain ON public.email_domains(domain);
CREATE INDEX IF NOT EXISTS idx_email_domains_env ON public.email_domains(env);
CREATE INDEX IF NOT EXISTS idx_email_domains_sandbox ON public.email_domains(is_sandbox);
CREATE INDEX IF NOT EXISTS idx_email_dns_records_domain ON public.email_dns_records(email_domain_id);
CREATE INDEX IF NOT EXISTS idx_email_dns_records_applied ON public.email_dns_records(applied_automatically);