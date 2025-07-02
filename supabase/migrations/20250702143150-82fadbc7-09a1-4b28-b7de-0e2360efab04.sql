-- Safe cleanup approach: Update content_tasks to point to remaining campaigns before deletion
-- Step 1: For each set of duplicate campaigns, update content_tasks to point to the first (oldest) campaign
WITH duplicate_campaigns AS (
  SELECT 
    id,
    week_number,
    title,
    start_date,
    ROW_NUMBER() OVER (
      PARTITION BY week_number, title, start_date 
      ORDER BY created_at ASC
    ) as row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY week_number, title, start_date 
      ORDER BY created_at ASC
    ) as keep_campaign_id
  FROM campaigns 
  WHERE deleted_at IS NULL
),
campaigns_to_update AS (
  SELECT id, keep_campaign_id 
  FROM duplicate_campaigns 
  WHERE row_num > 1
)
UPDATE content_tasks 
SET campaign_id = ctu.keep_campaign_id
FROM campaigns_to_update ctu
WHERE content_tasks.campaign_id = ctu.id;

-- Step 2: Now safe to delete duplicate campaigns
WITH duplicate_campaigns AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY week_number, title, start_date 
      ORDER BY created_at ASC
    ) as row_num
  FROM campaigns 
  WHERE deleted_at IS NULL
)
DELETE FROM campaigns 
WHERE id IN (
  SELECT id FROM duplicate_campaigns WHERE row_num > 1
);