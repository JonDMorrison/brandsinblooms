
-- Add tenant_id column to scheduled_posts if it doesn't exist
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Update existing scheduled_posts with tenant_id from related content_tasks
UPDATE scheduled_posts sp
SET tenant_id = ct.tenant_id
FROM content_tasks ct
WHERE sp.content_id = ct.id
  AND sp.tenant_id IS NULL;
