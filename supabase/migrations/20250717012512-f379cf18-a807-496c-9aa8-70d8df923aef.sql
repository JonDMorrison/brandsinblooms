-- Add CRM onboarding completion tracking to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN crm_onboarding_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;