-- Add explicit template and source tracking to crm_campaigns
-- This enables template reuse to be explicit and ID-based, not fuzzy name-based

ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS template_id text;

ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS source_campaign_id uuid REFERENCES public.crm_campaigns(id);

-- Add comments for documentation
COMMENT ON COLUMN public.crm_campaigns.template_id IS 'ID/slug of template this campaign was created from. NULL if not from template.';
COMMENT ON COLUMN public.crm_campaigns.source_campaign_id IS 'ID of campaign this was cloned from. NULL if not cloned.';