-- Clean up duplicate campaigns and fix seasonal mismatches
-- Step 1: Delete exact duplicates, keeping only one per week_number/title/start_date combination
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

-- Step 2: Delete seasonally inappropriate campaigns 
-- (Winter content in summer months, Spring content in fall, etc.)
DELETE FROM campaigns 
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
  OR
  -- Summer themes in winter months (Dec-Feb)
  (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
   LIKE ANY(ARRAY['%summer%', '%heat%', '%drought%', '%irrigation%']) 
   AND EXTRACT(MONTH FROM start_date) IN (12,1,2))
  OR
  -- Fall themes in spring months (Mar-May)
  (LOWER(title || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, '')) 
   LIKE ANY(ARRAY['%fall%', '%autumn%', '%harvest%', '%cleanup%']) 
   AND EXTRACT(MONTH FROM start_date) IN (3,4,5))
);

-- Step 3: Update remaining campaigns to ensure week_number matches calendar weeks
-- Calculate correct ISO week number for each campaign's start_date
UPDATE campaigns 
SET week_number = EXTRACT(WEEK FROM start_date)
WHERE deleted_at IS NULL 
AND week_number != EXTRACT(WEEK FROM start_date);