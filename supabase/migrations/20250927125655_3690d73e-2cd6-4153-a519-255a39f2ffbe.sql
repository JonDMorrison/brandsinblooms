-- Add missing headline column to campaign_blocks table
ALTER TABLE campaign_blocks ADD COLUMN IF NOT EXISTS headline TEXT;