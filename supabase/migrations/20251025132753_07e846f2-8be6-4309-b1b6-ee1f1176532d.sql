-- Add unique constraint to prevent duplicate blocks with same order_index
-- This ensures database-level protection against race conditions

-- First, clean up any existing duplicates by keeping only the most recent version
WITH duplicates AS (
  SELECT 
    id,
    campaign_id,
    order_index,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY campaign_id, order_index ORDER BY created_at DESC) as rn
  FROM campaign_blocks
)
DELETE FROM campaign_blocks
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add a unique constraint on (campaign_id, order_index) to prevent future duplicates
-- Note: This will fail if there are still duplicates after the cleanup above
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_blocks_unique_order 
ON campaign_blocks(campaign_id, order_index);

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_campaign_blocks_unique_order IS 
'Ensures each campaign has only one block per order_index position, preventing race condition duplicates';