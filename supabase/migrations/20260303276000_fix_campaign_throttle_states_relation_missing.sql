-- Repair migration: create missing campaign throttle state tables
-- Some environments skipped the original milestone migrations, but runtime RPCs depend on these relations.

CREATE TABLE IF NOT EXISTS public.email_governance_campaign_throttle_states (
  campaign_id UUID PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_throttled BOOLEAN NOT NULL DEFAULT false,
  trigger_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  trigger_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  throttled_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  next_claimable_at TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_tenant
  ON public.email_governance_campaign_throttle_states (tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_claimable
  ON public.email_governance_campaign_throttle_states (is_throttled, next_claimable_at)
  WHERE is_throttled = true;

CREATE TABLE IF NOT EXISTS public.email_governance_campaign_throttle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('activated', 'cleared', 'updated')),
  source TEXT NOT NULL DEFAULT 'system',
  reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_throttle_events_campaign_time
  ON public.email_governance_campaign_throttle_events (campaign_id, created_at DESC);

GRANT SELECT ON public.email_governance_campaign_throttle_states TO service_role;
GRANT SELECT ON public.email_governance_campaign_throttle_events TO service_role;

NOTIFY pgrst, 'reload schema';
