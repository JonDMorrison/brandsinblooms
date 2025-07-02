-- Step 4: Update remaining campaigns to ensure week_number matches calendar weeks
-- Calculate correct ISO week number for each campaign's start_date
UPDATE campaigns 
SET week_number = EXTRACT(WEEK FROM start_date)
WHERE deleted_at IS NULL 
AND week_number != EXTRACT(WEEK FROM start_date);

-- Step 5: Add constraint to prevent future week/date mismatches
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_week_date_consistency 
CHECK (week_number = EXTRACT(WEEK FROM start_date));