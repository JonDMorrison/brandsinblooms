-- Add contact and footer-related fields to company_profiles
ALTER TABLE public.company_profiles
ADD COLUMN IF NOT EXISTS company_phone text,
ADD COLUMN IF NOT EXISTS company_email text,
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state_province text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS pinterest_url text,
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS footer_legal_text text;

-- Migrate existing phone number from feature_flags if it exists
UPDATE public.company_profiles
SET company_phone = (feature_flags->>'company_phone')::text
WHERE feature_flags->>'company_phone' IS NOT NULL
  AND company_phone IS NULL;