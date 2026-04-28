CREATE TABLE IF NOT EXISTS public.oauth_webhook_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  signing_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oauth_webhook_registrations_https_url_check
    CHECK (webhook_url ~ '^https://'),
  CONSTRAINT oauth_webhook_registrations_client_url_unique
    UNIQUE (client_id, webhook_url)
);

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

CREATE TABLE IF NOT EXISTS public.oauth_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_registration_id UUID NOT NULL REFERENCES public.oauth_webhook_registrations(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  webhook_id TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_webhook_registrations_client_active
  ON public.oauth_webhook_registrations (client_id, is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_webhook_registrations_events_gin
  ON public.oauth_webhook_registrations USING gin (events);

CREATE INDEX IF NOT EXISTS idx_oauth_webhook_logs_registration_created_at
  ON public.oauth_webhook_logs (webhook_registration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_webhook_logs_event_created_at
  ON public.oauth_webhook_logs (event, created_at DESC);

ALTER TABLE public.oauth_webhook_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oauth_webhook_registrations_service_all" ON public.oauth_webhook_registrations;
CREATE POLICY "oauth_webhook_registrations_service_all"
  ON public.oauth_webhook_registrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "oauth_webhook_logs_service_all" ON public.oauth_webhook_logs;
CREATE POLICY "oauth_webhook_logs_service_all"
  ON public.oauth_webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.oauth_webhook_registrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_webhook_logs FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.oauth_webhook_registrations TO service_role;
GRANT ALL ON TABLE public.oauth_webhook_logs TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_oauth_webhook_registrations_updated_at'
  ) THEN
    CREATE TRIGGER update_oauth_webhook_registrations_updated_at
      BEFORE UPDATE ON public.oauth_webhook_registrations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

INSERT INTO public.oauth_webhook_registrations (
  client_id,
  webhook_url,
  events,
  signing_secret,
  is_active
)
VALUES (
  'bloomsuite-cms',
  'https://cms.invalid/api/webhooks/crm',
  ARRAY[
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'subscription.trial_ending',
    'user.updated',
    'user.deleted'
  ]::TEXT[],
  encode(gen_random_bytes(32), 'hex'),
  true
)
ON CONFLICT (client_id, webhook_url) DO UPDATE SET
  events = EXCLUDED.events,
  is_active = EXCLUDED.is_active,
  updated_at = now();