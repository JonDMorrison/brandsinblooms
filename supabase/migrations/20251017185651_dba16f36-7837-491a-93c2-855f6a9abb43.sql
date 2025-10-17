-- Add darkOverlayOpacity field to campaign_blocks table
-- This allows storing the dark overlay opacity value for background images
-- to improve text contrast

ALTER TABLE campaign_blocks 
ADD COLUMN IF NOT EXISTS dark_overlay_opacity integer DEFAULT 0;

COMMENT ON COLUMN campaign_blocks.dark_overlay_opacity IS 'Opacity percentage (0-100) for dark overlay on background images to improve text contrast';