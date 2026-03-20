-- FIX: [issue #30] - Add ON DELETE SET NULL to crm_campaigns.segment_id FK
ALTER TABLE crm_campaigns DROP CONSTRAINT IF EXISTS crm_campaigns_segment_id_fkey;
ALTER TABLE crm_campaigns ADD CONSTRAINT crm_campaigns_segment_id_fkey
  FOREIGN KEY (segment_id) REFERENCES crm_segments(id) ON DELETE SET NULL;

-- FIX: [issue #31] - Add FK from customer_segments.segment_id to crm_segments
ALTER TABLE customer_segments ADD CONSTRAINT fk_customer_segments_segment
  FOREIGN KEY (segment_id) REFERENCES crm_segments(id) ON DELETE CASCADE;

-- FIX: [issue #32] - Consolidate duplicate segments table
-- Note: The 'segments' table duplicates 'crm_segments'. Adding a comment for visibility.
-- Migration to drop 'segments' table should be done after verifying no code references it.
COMMENT ON TABLE segments IS 'DEPRECATED: Use crm_segments instead. See issue #32.';
