-- Add email authentication fields to company_profiles table
ALTER TABLE public.company_profiles 
ADD COLUMN email_auth_status TEXT DEFAULT 'pending' CHECK (email_auth_status IN ('pending', 'verified', 'failed')),
ADD COLUMN custom_sender_email TEXT,
ADD COLUMN email_domain TEXT,
ADD COLUMN dns_records_verified BOOLEAN DEFAULT false,
ADD COLUMN email_auth_setup_at TIMESTAMP WITH TIME ZONE;