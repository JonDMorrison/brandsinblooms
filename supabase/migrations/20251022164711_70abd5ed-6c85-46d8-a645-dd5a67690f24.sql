-- Add brand color columns to company_profiles table
ALTER TABLE company_profiles 
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#22c55e',
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#f59e0b';

-- Add comment to document the columns
COMMENT ON COLUMN company_profiles.brand_primary_color IS 'Primary brand color used for CTA buttons and key UI elements';
COMMENT ON COLUMN company_profiles.brand_secondary_color IS 'Secondary brand color used for headers and accents';
COMMENT ON COLUMN company_profiles.brand_accent_color IS 'Accent brand color used for highlights and special elements';