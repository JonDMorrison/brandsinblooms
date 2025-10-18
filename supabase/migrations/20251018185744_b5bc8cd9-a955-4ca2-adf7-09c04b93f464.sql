
-- Add missing newsletter header fields to campaign_blocks table
ALTER TABLE public.campaign_blocks
ADD COLUMN IF NOT EXISTS subtitle text,
ADD COLUMN IF NOT EXISTS issue_number text,
ADD COLUMN IF NOT EXISTS publish_date text,
ADD COLUMN IF NOT EXISTS background_image_url text,
ADD COLUMN IF NOT EXISTS alt_text text;

-- Add helpful comment
COMMENT ON COLUMN public.campaign_blocks.subtitle IS 'Newsletter subheading or subtitle text';
COMMENT ON COLUMN public.campaign_blocks.issue_number IS 'Newsletter issue number (e.g., "47")';
COMMENT ON COLUMN public.campaign_blocks.publish_date IS 'Newsletter publish date in ISO format';
COMMENT ON COLUMN public.campaign_blocks.background_image_url IS 'Background image URL for header blocks';
COMMENT ON COLUMN public.campaign_blocks.alt_text IS 'Alt text for images';
