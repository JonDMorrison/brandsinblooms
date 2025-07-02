-- Step 3: Delete seasonally inappropriate campaigns 
-- For seasonally mismatched campaigns, also handle content_tasks
WITH seasonal_mismatches AS (
  SELECT id FROM campaigns 
  WHERE deleted_at IS NULL 
  AND (
    -- Winter themes in summer months (Jun-Aug)
    (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
     LIKE ANY(ARRAY['%winter%', '%holiday%', '%christmas%', '%snow%', '%frost%']) 
     AND EXTRACT(MONTH FROM start_date) IN (6,7,8))
    OR
    -- Spring themes in fall/winter months (Oct-Jan)  
    (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
     LIKE ANY(ARRAY['%spring%', '%seed starting%', '%early season%']) 
     AND EXTRACT(MONTH FROM start_date) IN (10,11,12,1))
  )
)
-- First delete content_tasks for seasonally inappropriate campaigns
DELETE FROM content_tasks 
WHERE campaign_id IN (SELECT id FROM seasonal_mismatches);

-- Then delete the campaigns themselves
DELETE FROM campaigns 
WHERE id IN (
  SELECT id FROM campaigns 
  WHERE deleted_at IS NULL 
  AND (
    -- Winter themes in summer months (Jun-Aug)
    (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
     LIKE ANY(ARRAY['%winter%', '%holiday%', '%christmas%', '%snow%', '%frost%']) 
     AND EXTRACT(MONTH FROM start_date) IN (6,7,8))
    OR
    -- Spring themes in fall/winter months (Oct-Jan)  
    (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
     LIKE ANY(ARRAY['%spring%', '%seed starting%', '%early season%']) 
     AND EXTRACT(MONTH FROM start_date) IN (10,11,12,1))
  )
);