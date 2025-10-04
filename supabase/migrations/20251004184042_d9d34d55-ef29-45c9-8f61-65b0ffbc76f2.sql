-- Fix AI image generation by ensuring all tasks have image_idea set

-- Update tasks with campaign themes
UPDATE content_tasks ct
SET image_idea = CONCAT(c.theme, ' ', ct.post_type, ' garden'),
    image_generation_status = 'pending'
FROM campaigns c
WHERE ct.campaign_id = c.id 
  AND ct.image_idea IS NULL 
  AND c.theme IS NOT NULL;

-- Update remaining tasks without campaign or theme (use post_type as fallback)
UPDATE content_tasks
SET image_idea = CONCAT(post_type, ' garden scene'),
    image_generation_status = 'pending'
WHERE image_idea IS NULL 
  AND image_generation_status = 'pending'
  AND post_type IS NOT NULL;

-- Reset Unsplash images to trigger AI generation instead
UPDATE content_tasks
SET image_url = NULL,
    image_generation_status = 'pending',
    image_source = NULL
WHERE image_source = 'unsplash'
  AND image_idea IS NOT NULL
  AND image_generation_status != 'complete';