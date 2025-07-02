-- Update content tasks to ensure they are properly associated with their campaign owners
UPDATE content_tasks 
SET user_id = campaigns.user_id
FROM campaigns 
WHERE content_tasks.campaign_id = campaigns.id 
  AND content_tasks.user_id != campaigns.user_id;

-- Also ensure tenant_id matches between content_tasks and campaigns where applicable
UPDATE content_tasks 
SET tenant_id = campaigns.tenant_id
FROM campaigns 
WHERE content_tasks.campaign_id = campaigns.id 
  AND content_tasks.tenant_id != campaigns.tenant_id;