-- Add automation_ready and rendered_preview_html columns
ALTER TABLE public.saved_campaign_templates
ADD COLUMN IF NOT EXISTS automation_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rendered_preview_html text;

-- Add index for automation_ready filtering
CREATE INDEX IF NOT EXISTS idx_saved_campaign_templates_automation_ready 
ON public.saved_campaign_templates(automation_ready) WHERE automation_ready = true;