-- Add template_id column to track template origins
ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS template_source text;

-- Create index for better performance on template queries
CREATE INDEX IF NOT EXISTS idx_crm_automations_template_source 
ON crm_automations(template_source) 
WHERE template_source IS NOT NULL;