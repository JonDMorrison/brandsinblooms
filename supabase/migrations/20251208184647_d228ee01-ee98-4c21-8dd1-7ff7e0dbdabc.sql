-- Add brand text color column to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS brand_text_color text DEFAULT '#1f2937';