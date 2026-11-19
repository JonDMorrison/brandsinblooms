-- Central login milestone 50 (Wave 5c, decision 62): the subscription half of the retired
-- 20260428090000_oauth_subscription_status_and_webhooks.sql, carried forward unchanged.
--
-- That file was never applied on the hosted project (none of its tables or columns is in the hosted schema) and was
-- removed with the April "Login with CRM" server, because its webhook tables reference the server's public.oauth_clients.
-- Its subscription statements are not part of that server: stripe-webhook and _shared/subscriptionSnapshot.ts read these
-- columns, so they keep shipping with the chain exactly as before (statements copied verbatim, in their order).
-- Forward-only; no earlier migration is edited.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IS NULL OR status IN (
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'expired'
      ));
  END IF;
END;
$$;

UPDATE public.subscriptions
SET
  current_period_start = COALESCE(current_period_start, start_date::timestamptz),
  current_period_end = COALESCE(current_period_end, end_date::timestamptz),
  trial_end = COALESCE(
    trial_end,
    CASE
      WHEN plan = 'free_trial'::public.subscription_plan THEN end_date::timestamptz
      ELSE NULL
    END
  ),
  status = COALESCE(
    status,
    CASE
      WHEN deleted_at IS NOT NULL THEN 'canceled'
      WHEN plan = 'free_trial'::public.subscription_plan AND end_date >= CURRENT_DATE THEN 'trialing'
      WHEN plan = 'expired'::public.subscription_plan OR end_date < CURRENT_DATE THEN 'expired'
      ELSE 'active'
    END
  );

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
