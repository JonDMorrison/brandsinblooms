-- Migrate data from dedicated columns back into content JSON
UPDATE campaign_blocks
SET content = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(content, '{}'::jsonb),
          '{subtitle}',
          to_jsonb(COALESCE(subtitle, '')),
          true
        ),
        '{issueNumber}',
        to_jsonb(COALESCE(issue_number, '')),
        true
      ),
      '{publishDate}',
      to_jsonb(COALESCE(publish_date, '')),
      true
    ),
    '{backgroundImageUrl}',
    to_jsonb(COALESCE(background_image_url, '')),
    true
  ),
  '{altText}',
  to_jsonb(COALESCE(alt_text, '')),
  true
)
WHERE subtitle IS NOT NULL 
   OR issue_number IS NOT NULL 
   OR publish_date IS NOT NULL 
   OR background_image_url IS NOT NULL 
   OR alt_text IS NOT NULL;

-- Drop the dedicated columns
ALTER TABLE public.campaign_blocks DROP COLUMN IF EXISTS subtitle;
ALTER TABLE public.campaign_blocks DROP COLUMN IF EXISTS issue_number;
ALTER TABLE public.campaign_blocks DROP COLUMN IF EXISTS publish_date;
ALTER TABLE public.campaign_blocks DROP COLUMN IF EXISTS background_image_url;
ALTER TABLE public.campaign_blocks DROP COLUMN IF EXISTS alt_text;