-- Add stripe_customer_id to subscriptions so we stop doing email-based lookups
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for reverse lookups (webhook → user)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
ON public.subscriptions (stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
