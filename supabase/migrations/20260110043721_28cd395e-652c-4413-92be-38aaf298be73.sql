-- Add climate profile columns to company_profiles
ALTER TABLE public.company_profiles 
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS climate_archetype TEXT CHECK (climate_archetype IN ('hot_dry', 'hot_humid', 'temperate', 'cool_wet', 'cold', 'coastal', 'mountain', 'subtropical', 'mediterranean')),
  ADD COLUMN IF NOT EXISTS climate_label TEXT,
  ADD COLUMN IF NOT EXISTS climate_confidence TEXT CHECK (climate_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS climate_source TEXT,
  ADD COLUMN IF NOT EXISTS climate_last_updated_at TIMESTAMPTZ;

-- Add USDA zone and frost date columns (nullable - only populated if real data available)
ALTER TABLE public.company_profiles 
  ADD COLUMN IF NOT EXISTS usda_zone TEXT,
  ADD COLUMN IF NOT EXISTS first_frost_date TEXT,
  ADD COLUMN IF NOT EXISTS last_frost_date TEXT,
  ADD COLUMN IF NOT EXISTS climate_data_source TEXT;

-- Create index for climate archetype queries
CREATE INDEX IF NOT EXISTS idx_company_profiles_climate_archetype 
  ON public.company_profiles(climate_archetype) 
  WHERE climate_archetype IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.company_profiles.climate_archetype IS 'Deterministic climate classification: hot_dry, hot_humid, temperate, cool_wet, cold, coastal, mountain, subtropical, mediterranean';
COMMENT ON COLUMN public.company_profiles.climate_label IS 'Human-readable climate description e.g. "Hot & Dry Desert Climate"';
COMMENT ON COLUMN public.company_profiles.usda_zone IS 'USDA Hardiness Zone - only populated from verified data sources';
COMMENT ON COLUMN public.company_profiles.first_frost_date IS 'Average first frost date - only populated from verified data sources';
COMMENT ON COLUMN public.company_profiles.last_frost_date IS 'Average last frost date - only populated from verified data sources';