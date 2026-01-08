-- Add webhook state columns to ALL POS connection tables
-- This is required by the POS Integration Contract

-- ============================================
-- CLOVER_CONNECTIONS
-- ============================================
ALTER TABLE public.clover_connections 
  ADD COLUMN IF NOT EXISTS webhooks_subscribed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS webhooks_last_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS webhook_last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_webhook_received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS webhook_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_next_retry_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.clover_connections.webhooks_subscribed IS 'Whether webhooks are confirmed active';
COMMENT ON COLUMN public.clover_connections.webhook_subscription_id IS 'Clover webhook subscription ID';
COMMENT ON COLUMN public.clover_connections.last_webhook_received_at IS 'Timestamp of last successfully processed webhook';

-- ============================================
-- LIGHTSPEED_CONNECTIONS
-- ============================================
-- Note: lightspeed_connections already has webhook_registered, rename for consistency
ALTER TABLE public.lightspeed_connections 
  ADD COLUMN IF NOT EXISTS webhooks_subscribed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS webhooks_last_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS webhook_last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_webhook_received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS webhook_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_next_retry_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing webhook_registered data
UPDATE public.lightspeed_connections 
SET webhooks_subscribed = webhook_registered 
WHERE webhook_registered IS NOT NULL AND webhooks_subscribed IS NULL;

COMMENT ON COLUMN public.lightspeed_connections.webhooks_subscribed IS 'Whether webhooks are confirmed active';
COMMENT ON COLUMN public.lightspeed_connections.webhook_subscription_id IS 'Lightspeed webhook subscription ID';
COMMENT ON COLUMN public.lightspeed_connections.last_webhook_received_at IS 'Timestamp of last successfully processed webhook';

-- ============================================
-- Create index for health check queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_square_connections_webhook_health 
  ON public.square_connections(webhooks_subscribed, webhook_next_retry_at) 
  WHERE status = 'connected';

CREATE INDEX IF NOT EXISTS idx_clover_connections_webhook_health 
  ON public.clover_connections(webhooks_subscribed, webhook_next_retry_at) 
  WHERE status = 'connected';

CREATE INDEX IF NOT EXISTS idx_lightspeed_connections_webhook_health 
  ON public.lightspeed_connections(webhooks_subscribed, webhook_next_retry_at) 
  WHERE status = 'connected';