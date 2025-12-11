-- Add unique constraint for idempotency on email_tracking_events
-- This prevents duplicate events from being inserted even under race conditions

-- First, create a unique index on the combination of fields that identify a unique event
-- We use a partial index with an expression to extract email_id from the jsonb event_data
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tracking_events_idempotency 
ON email_tracking_events (
  campaign_id, 
  customer_email, 
  event_type, 
  ((event_data->>'email_id')::text)
)
WHERE event_data->>'email_id' IS NOT NULL;

-- Add index for faster lookups by campaign_id (for metrics calculations)
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_campaign_id 
ON email_tracking_events (campaign_id);

-- Add index for faster lookups by event_type
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_event_type 
ON email_tracking_events (event_type);

-- Add index for faster lookups by customer_email (for unsubscribe lookups)
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_customer_email 
ON email_tracking_events (customer_email);

-- Add index for created_at to support time-based queries
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_created_at 
ON email_tracking_events (created_at DESC);

-- Add comment explaining the idempotency strategy
COMMENT ON INDEX idx_email_tracking_events_idempotency IS 
'Ensures idempotency for webhook events - prevents duplicate events based on (campaign_id, email, event_type, resend_email_id)';