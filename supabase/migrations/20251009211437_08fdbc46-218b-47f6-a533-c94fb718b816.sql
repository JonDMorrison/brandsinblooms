-- Add task_id column to scheduled_posts table to link directly to content_tasks
ALTER TABLE scheduled_posts
ADD COLUMN task_id uuid REFERENCES content_tasks(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_scheduled_posts_task_id ON scheduled_posts(task_id);

-- Backfill task_id for existing scheduled posts by matching content_id to generated_content
-- This is a best-effort backfill - some may not have matching content_tasks
UPDATE scheduled_posts sp
SET task_id = (
  SELECT ct.id 
  FROM content_tasks ct
  WHERE ct.id = sp.content_id
  LIMIT 1
)
WHERE sp.task_id IS NULL;