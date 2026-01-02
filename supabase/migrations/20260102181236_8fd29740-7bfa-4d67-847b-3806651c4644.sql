-- Add priority column to email_dns_records for MX record support
ALTER TABLE public.email_dns_records 
ADD COLUMN IF NOT EXISTS priority integer;

-- Add source column to track origin of records (resend, system, user)
ALTER TABLE public.email_dns_records 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'resend';

-- Update type column to include MX type
-- First ensure the constraint allows MX
-- The type column currently allows 'TXT' | 'CNAME', we need to add 'MX'
-- Check if it's an enum or just text - if text, no change needed
-- If it has a check constraint, we need to update it

-- Add comment for clarity
COMMENT ON COLUMN public.email_dns_records.priority IS 'MX record priority (required for MX type)';
COMMENT ON COLUMN public.email_dns_records.source IS 'Source of record: resend, system, user';