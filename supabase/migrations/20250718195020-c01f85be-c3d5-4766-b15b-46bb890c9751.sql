
-- Add tags column to saved_campaign_templates table
ALTER TABLE public.saved_campaign_templates 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add thumbnail_url column if it doesn't exist (it already exists based on schema)
-- ALTER TABLE public.saved_campaign_templates 
-- ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Create index on tags for better filtering performance
CREATE INDEX IF NOT EXISTS idx_saved_campaign_templates_tags 
ON public.saved_campaign_templates USING GIN(tags);

-- Update RLS policy to ensure users can only see their own templates or public ones
DROP POLICY IF EXISTS "Users can view public templates" ON public.saved_campaign_templates;
CREATE POLICY "Users can view public templates" 
ON public.saved_campaign_templates 
FOR SELECT 
USING (is_public = true OR auth.uid() = user_id);
