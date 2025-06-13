
-- Add missing columns to company_profiles table for first-time user experience
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS first_content_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS first_welcome_dismissed BOOLEAN DEFAULT FALSE;
