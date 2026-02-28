-- Repair migration: create missing email governance events table.
--
-- Fixes runtime error:
--   relation "public.email_governance_email_events" does not exist

CREATE TABLE IF NOT EXISTS public.email_governance_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Intentionally no FK constraints here: some environments are missing
  -- parts of the governance schema, and this repair migration must be
  -- able to apply independently.
  tenant_id UUID NOT NULL,
  campaign_id UUID,
  governance_message_id UUID,
  email_message_id UUID,
  customer_id UUID,
  domain_id UUID,
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  provider_event_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  event_ts_provider TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_delivery_id TEXT,
  is_mpp_guess BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency for webhook replay / duplicate provider deliveries
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_gov_events_provider_idempotency
  ON public.email_governance_email_events (tenant_id, provider, provider_message_id, event_type, event_ts_provider)
  WHERE provider_message_id IS NOT NULL AND event_ts_provider IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_gov_events_provider_event
  ON public.email_governance_email_events (tenant_id, provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_event_time
  ON public.email_governance_email_events (tenant_id, event_type, event_ts_provider DESC, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_time
  ON public.email_governance_email_events (tenant_id, event_ts_provider DESC, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_campaign_time
  ON public.email_governance_email_events (tenant_id, campaign_id, event_ts_provider DESC, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_domain_time
  ON public.email_governance_email_events (tenant_id, domain_id, event_ts_provider DESC, ingested_at DESC);


ALTER TABLE public.email_governance_email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_gov_events_select" ON public.email_governance_email_events;
CREATE POLICY "email_gov_events_select"
  ON public.email_governance_email_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_email_events.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_events_service_all" ON public.email_governance_email_events;
CREATE POLICY "email_gov_events_service_all"
  ON public.email_governance_email_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
