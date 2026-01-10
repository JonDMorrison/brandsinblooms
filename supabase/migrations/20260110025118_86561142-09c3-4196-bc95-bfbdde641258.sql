-- Add location detection fields to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS location_detection_source text CHECK (location_detection_source IN ('jsonld', 'footer', 'contact', 'regex', 'manual', 'none')),
ADD COLUMN IF NOT EXISTS location_confidence text CHECK (location_confidence IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS location_detection_snippet text,
ADD COLUMN IF NOT EXISTS location_last_detected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS location_detection_candidates jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.company_profiles.location_detection_source IS 'Source of location detection: jsonld (Schema.org), footer, contact page, regex scan, manual entry, or none';
COMMENT ON COLUMN public.company_profiles.location_confidence IS 'Confidence level of detected location: high, medium, or low';
COMMENT ON COLUMN public.company_profiles.location_detection_snippet IS 'Small excerpt showing where location was found for debugging';
COMMENT ON COLUMN public.company_profiles.location_detection_candidates IS 'Array of all detected location candidates when multiple found';
COMMENT ON COLUMN public.company_profiles.location_last_detected_at IS 'Timestamp of last location detection attempt';