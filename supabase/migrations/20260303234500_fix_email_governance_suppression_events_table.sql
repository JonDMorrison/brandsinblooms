-- Repair migration: recreate email_governance_suppression_events if missing.
-- Fixes runtime error: relation "public.email_governance_suppression_events" does not exist

CREATE TABLE IF NOT EXISTS public.email_governance_suppression_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  suppression_type TEXT NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',
  source_event_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_gov_suppression_source_event
  ON public.email_governance_suppression_events (tenant_id, email, channel, suppression_type, source, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_gov_suppression_tenant_time
  ON public.email_governance_suppression_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_suppression_tenant_email
  ON public.email_governance_suppression_events (tenant_id, email, occurred_at DESC);

ALTER TABLE public.email_governance_suppression_events ENABLE ROW LEVEL SECURITY;

-- Tenant reads
DROP POLICY IF EXISTS "email_gov_suppression_select" ON public.email_governance_suppression_events;
CREATE POLICY "email_gov_suppression_select"
  ON public.email_governance_suppression_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_suppression_events.tenant_id
    )
  );

-- Service writes
DROP POLICY IF EXISTS "email_gov_suppression_service_all" ON public.email_governance_suppression_events;
CREATE POLICY "email_gov_suppression_service_all"
  ON public.email_governance_suppression_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Not strictly required for table creation, but keeps tooling in sync.
NOTIFY pgrst, 'reload schema';
