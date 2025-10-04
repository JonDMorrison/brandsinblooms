-- Update existing tasks with null image_idea to have a default prompt based on their campaign
UPDATE content_tasks ct
SET image_idea = CONCAT(c.theme, ' ', ct.post_type, ' garden'),
    image_generation_status = 'pending'
FROM campaigns c
WHERE ct.campaign_id = c.id 
  AND ct.image_idea IS NULL 
  AND ct.image_generation_status = 'pending'
  AND c.theme IS NOT NULL;