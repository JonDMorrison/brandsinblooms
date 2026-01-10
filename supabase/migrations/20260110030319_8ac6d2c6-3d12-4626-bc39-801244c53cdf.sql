-- Add location_needs_confirmation field to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS location_needs_confirmation boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.company_profiles.location_needs_confirmation IS 'True if location detection has low confidence, multiple candidates, or missing postal code - requires user confirmation';