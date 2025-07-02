-- Additional cleanup: Fix seasonal content mismatches and standardize campaign titles
-- Step 1: Remove "Week X" references from campaign titles and update seasonal content

-- Update spring themes that are scheduled in summer/fall months
UPDATE campaigns 
SET 
  title = CASE 
    WHEN title LIKE '%Container Garden Success%' AND EXTRACT(MONTH FROM start_date) IN (7,8) 
    THEN 'Summer Container Gardens'
    WHEN title LIKE '%Early Season%' AND EXTRACT(MONTH FROM start_date) IN (7,8)
    THEN 'Mid-Summer Care'
    WHEN title LIKE '%Spring%' AND EXTRACT(MONTH FROM start_date) IN (7,8)
    THEN 'Summer Care Tips'
    ELSE REGEXP_REPLACE(title, ' - Week \d+', '')
  END,
  theme = CASE 
    WHEN theme LIKE '%spring%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8)
    THEN REPLACE(REPLACE(theme, 'spring', 'summer'), 'Spring', 'Summer')
    WHEN theme LIKE '%early season%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8)
    THEN REPLACE(REPLACE(theme, 'early season', 'mid-summer'), 'Early season', 'Mid-summer')
    ELSE theme
  END,
  description = CASE 
    WHEN description LIKE '%spring%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8)
    THEN REPLACE(REPLACE(description, 'spring', 'summer'), 'Spring', 'Summer')
    WHEN description LIKE '%early season%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8)
    THEN REPLACE(REPLACE(description, 'early season', 'mid-summer'), 'Early season', 'Mid-summer')
    ELSE description
  END
WHERE deleted_at IS NULL 
AND (
  title LIKE '% - Week %' OR
  (theme LIKE '%spring%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8)) OR
  (theme LIKE '%early season%' AND EXTRACT(MONTH FROM start_date) IN (6,7,8))
);

-- Step 2: Update any remaining seasonal mismatches
UPDATE campaigns 
SET 
  theme = CASE 
    WHEN EXTRACT(MONTH FROM start_date) IN (3,4,5) AND theme NOT LIKE '%spring%' 
    THEN 'Spring gardening focus'
    WHEN EXTRACT(MONTH FROM start_date) IN (6,7,8) AND theme NOT LIKE '%summer%'
    THEN 'Summer gardening focus'  
    WHEN EXTRACT(MONTH FROM start_date) IN (9,10,11) AND theme NOT LIKE '%fall%' AND theme NOT LIKE '%autumn%'
    THEN 'Fall gardening focus'
    WHEN EXTRACT(MONTH FROM start_date) IN (12,1,2) AND theme NOT LIKE '%winter%'
    THEN 'Winter gardening focus'
    ELSE theme
  END,
  description = CASE 
    WHEN EXTRACT(MONTH FROM start_date) IN (3,4,5) 
    THEN 'Spring seasonal garden center focus with planting and preparation tips'
    WHEN EXTRACT(MONTH FROM start_date) IN (6,7,8)
    THEN 'Summer seasonal garden center focus with care and maintenance tips'  
    WHEN EXTRACT(MONTH FROM start_date) IN (9,10,11)
    THEN 'Fall seasonal garden center focus with planting and preparation for winter'
    WHEN EXTRACT(MONTH FROM start_date) IN (12,1,2)
    THEN 'Winter seasonal garden center focus with indoor gardening and planning'
    ELSE description
  END
WHERE deleted_at IS NULL 
AND (theme IS NULL OR description IS NULL OR theme = '' OR description = '');