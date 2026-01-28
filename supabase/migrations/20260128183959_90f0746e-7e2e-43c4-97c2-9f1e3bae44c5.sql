-- Add unique constraint for atomic rate limit upserts
-- This enables ON CONFLICT ... DO UPDATE for race-condition-free increments

-- First, drop existing records that would violate the constraint (dedup by keeping highest count)
DELETE FROM form_rate_limits a
USING form_rate_limits b
WHERE a.form_id = b.form_id 
  AND a.ip_hash = b.ip_hash 
  AND a.window_start = b.window_start
  AND a.id < b.id;

-- Add the unique constraint
ALTER TABLE form_rate_limits 
ADD CONSTRAINT form_rate_limits_form_ip_window_unique 
UNIQUE (form_id, ip_hash, window_start);

-- Add index for efficient lookups if not exists
CREATE INDEX IF NOT EXISTS idx_form_rate_limits_lookup 
ON form_rate_limits (form_id, ip_hash, window_start DESC);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT form_rate_limits_form_ip_window_unique ON form_rate_limits IS 
'Enables atomic UPSERT for rate limiting - prevents race conditions in burst traffic';