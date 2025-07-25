-- Make start_date and week_number nullable in campaigns table
ALTER TABLE campaigns 
ALTER COLUMN start_date DROP NOT NULL,
ALTER COLUMN week_number DROP NOT NULL;

-- Add default values to help with existing data
UPDATE campaigns 
SET start_date = created_at::date 
WHERE start_date IS NULL;

UPDATE campaigns 
SET week_number = EXTRACT(week FROM created_at)
WHERE week_number IS NULL;