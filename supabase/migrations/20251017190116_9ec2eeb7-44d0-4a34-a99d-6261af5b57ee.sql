-- Add overlay opacity and color fields to campaign_blocks table
-- This allows customizing overlay effects on images

ALTER TABLE campaign_blocks 
ADD COLUMN IF NOT EXISTS overlay_opacity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS overlay_color text DEFAULT '#000000';

COMMENT ON COLUMN campaign_blocks.overlay_opacity IS 'Opacity percentage (0-100) for image overlay effect';
COMMENT ON COLUMN campaign_blocks.overlay_color IS 'Hex color code for image overlay';