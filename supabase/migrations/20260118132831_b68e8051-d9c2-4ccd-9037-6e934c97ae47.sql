-- Sync overlap_behavior column from flow_state for all automations
-- This ensures the database column matches what was saved in the UI
UPDATE crm_automations 
SET overlap_behavior = COALESCE(
  flow_state->'nodes'->0->'data'->>'overlapBehavior',
  'ignore'
)
WHERE flow_state IS NOT NULL 
  AND flow_state->'nodes'->0 IS NOT NULL
  AND (
    overlap_behavior IS NULL 
    OR overlap_behavior != COALESCE(flow_state->'nodes'->0->'data'->>'overlapBehavior', 'ignore')
  );