CREATE TABLE IF NOT EXISTS public.pos_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN (
    'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
  )),
  connection_id uuid NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS pos_webhook_events_tenant_created_idx
  ON public.pos_webhook_events(tenant_id, created_at DESC);

ALTER TABLE public.pos_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pos_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pos_webhook_events TO service_role;

COMMENT ON TABLE public.pos_webhook_events IS
  'Service-only durable provider event ledger used to prevent webhook replay.';
