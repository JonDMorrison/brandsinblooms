
-- Add a source field to campaigns table to track how campaigns are created
ALTER TABLE campaigns ADD COLUMN source text DEFAULT 'system';

-- Update existing campaigns to have 'system' source by default
UPDATE campaigns SET source = 'system' WHERE source IS NULL;
