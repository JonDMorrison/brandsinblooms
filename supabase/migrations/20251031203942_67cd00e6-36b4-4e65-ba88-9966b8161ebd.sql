-- First, clean up existing duplicates
-- Keep the oldest task for each (campaign_id, post_type, user_id) combination
WITH duplicate_tasks AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, post_type, user_id 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM content_tasks
  WHERE campaign_id IS NOT NULL 
    AND post_type IS NOT NULL 
    AND user_id IS NOT NULL
)
DELETE FROM content_tasks
WHERE id IN (
  SELECT id 
  FROM duplicate_tasks 
  WHERE row_num > 1
);

-- Now add the unique constraint to prevent future duplicates
ALTER TABLE content_tasks 
ADD CONSTRAINT unique_campaign_post_type_user 
UNIQUE (campaign_id, post_type, user_id);

-- Create index to improve query performance for duplicate checks
CREATE INDEX IF NOT EXISTS idx_content_tasks_campaign_type_user 
ON content_tasks(campaign_id, post_type, user_id);