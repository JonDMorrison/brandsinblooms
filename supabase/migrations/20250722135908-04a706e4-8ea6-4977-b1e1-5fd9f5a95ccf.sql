-- Add missing fields to crm_campaigns table for newsletter sync functionality
ALTER TABLE public.crm_campaigns 
ADD COLUMN IF NOT EXISTS synced_from uuid,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add index for better performance when checking sync status
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_synced_from 
ON public.crm_campaigns(synced_from);

-- Create comment to document the synced_from field
COMMENT ON COLUMN public.crm_campaigns.synced_from IS 'References the original theme campaign ID when synced from newsletter';