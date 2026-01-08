-- Add missing columns for self-healing webhook system
ALTER TABLE public.square_connections 
  ADD COLUMN IF NOT EXISTS webhook_last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_webhook_received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS webhook_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_next_retry_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN public.square_connections.webhook_last_error IS 'Last error message from webhook subscription attempt';
COMMENT ON COLUMN public.square_connections.last_webhook_received_at IS 'Timestamp of last successfully processed webhook event';
COMMENT ON COLUMN public.square_connections.webhook_retry_count IS 'Number of failed webhook subscription attempts';
COMMENT ON COLUMN public.square_connections.webhook_next_retry_at IS 'Next scheduled retry for webhook subscription';