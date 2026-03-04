-- Milestone 1 - Core Data Architecture for Email Governance Engine
-- Adds tenant-scoped governance tables for campaigns, messages, events,
-- suppression/audit logs, webhook replay idempotency, reputation snapshots, and batches.

-- =====================================================
-- 1) Campaign tracking (append-only lifecycle events)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_events_tenant_time
  ON public.email_governance_campaign_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_events_campaign_time
  ON public.email_governance_campaign_events (campaign_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_campaign_events_tenant_type_time
  ON public.email_governance_campaign_events (tenant_id, event_type, occurred_at DESC);


-- =====================================================
-- 2) Individual email tracking (governance message identity)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  email_send_job_id UUID REFERENCES public.email_send_jobs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.email_domains(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  queued_at TIMESTAMPTZ,
  first_attempted_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_gov_messages_tenant_email_message
  ON public.email_governance_messages (tenant_id, email_message_id)
  WHERE email_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_gov_messages_tenant_provider_message
  ON public.email_governance_messages (tenant_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_gov_messages_tenant_campaign_status
  ON public.email_governance_messages (tenant_id, campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_messages_tenant_time
  ON public.email_governance_messages (tenant_id, created_at DESC);


-- =====================================================
-- 3) Attempt ledger (per-send attempt history)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_message_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  governance_message_id UUID NOT NULL REFERENCES public.email_governance_messages(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  attempt_status TEXT NOT NULL CHECK (attempt_status IN ('success', 'failed', 'rate_limited', 'skipped')),
  error_code TEXT,
  error_message TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (governance_message_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_attempts_tenant_time
  ON public.email_governance_message_attempts (tenant_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_attempts_campaign_time
  ON public.email_governance_message_attempts (campaign_id, attempted_at DESC);


-- =====================================================
-- 4) Event tracking (delivery/open/click/bounce/etc)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  governance_message_id UUID REFERENCES public.email_governance_messages(id) ON DELETE SET NULL,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.email_domains(id) ON DELETE SET NULL,
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


-- =====================================================
-- 5) Suppression records (append-only governance event log)
-- =====================================================
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


-- =====================================================
-- 6) Tenant reputation snapshots (24h / 30d)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_tenant_reputation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  window_key TEXT NOT NULL CHECK (window_key IN ('24h', '30d')),
  as_of TIMESTAMPTZ NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  complained_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(12, 6) NOT NULL DEFAULT 0,
  complaint_rate NUMERIC(12, 6) NOT NULL DEFAULT 0,
  open_rate NUMERIC(12, 6) NOT NULL DEFAULT 0,
  click_rate NUMERIC(12, 6) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'sql_function',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, window_key, as_of)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_reputation_tenant_window_asof
  ON public.email_governance_tenant_reputation_snapshots (tenant_id, window_key, as_of DESC);


-- =====================================================
-- 7) Domain health logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_domain_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'informational',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_domain_health_tenant_time
  ON public.email_governance_domain_health_logs (tenant_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_domain_health_domain_time
  ON public.email_governance_domain_health_logs (domain_id, observed_at DESC);


-- =====================================================
-- 8) Batch tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  email_send_job_id UUID REFERENCES public.email_send_jobs(id) ON DELETE SET NULL,
  batch_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused')),
  total_messages INTEGER NOT NULL DEFAULT 0,
  processed_messages INTEGER NOT NULL DEFAULT 0,
  sent_messages INTEGER NOT NULL DEFAULT 0,
  failed_messages INTEGER NOT NULL DEFAULT 0,
  skipped_messages INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, batch_index)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_batches_tenant_status_time
  ON public.email_governance_batches (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_batches_campaign
  ON public.email_governance_batches (campaign_id, batch_index);


-- =====================================================
-- 9) Webhook event logs (replay/debug + idempotency)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'resend',
  delivery_id TEXT NOT NULL,
  provider_event_id TEXT,
  provider_message_id TEXT,
  event_type TEXT,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.email_domains(id) ON DELETE SET NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  payload_hash TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'duplicate', 'failed')),
  error_message TEXT,
  linked_event_id UUID REFERENCES public.email_governance_email_events(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_tenant_time
  ON public.email_governance_webhook_deliveries (tenant_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_tenant_status_time
  ON public.email_governance_webhook_deliveries (tenant_id, processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_provider_message
  ON public.email_governance_webhook_deliveries (tenant_id, provider, provider_message_id);


-- =====================================================
-- 10) Governance audit logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'user', 'automation', 'webhook', 'admin')),
  actor_id UUID,
  action_type TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'block', 'warn', 'log')),
  reason TEXT,
  policy_name TEXT,
  policy_version TEXT,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.email_domains(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  governance_message_id UUID REFERENCES public.email_governance_messages(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_gov_audit_tenant_time
  ON public.email_governance_audit_logs (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_audit_tenant_decision_time
  ON public.email_governance_audit_logs (tenant_id, decision, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_gov_audit_campaign_time
  ON public.email_governance_audit_logs (campaign_id, occurred_at DESC);


-- =====================================================
-- 11) RLS policies (tenant reads, service writes)
-- =====================================================
ALTER TABLE public.email_governance_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_message_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_suppression_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_tenant_reputation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_domain_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_governance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Campaign events
DROP POLICY IF EXISTS "email_gov_campaign_events_select" ON public.email_governance_campaign_events;
CREATE POLICY "email_gov_campaign_events_select"
  ON public.email_governance_campaign_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_campaign_events.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_campaign_events_service_all" ON public.email_governance_campaign_events;
CREATE POLICY "email_gov_campaign_events_service_all"
  ON public.email_governance_campaign_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Governance messages
DROP POLICY IF EXISTS "email_gov_messages_select" ON public.email_governance_messages;
CREATE POLICY "email_gov_messages_select"
  ON public.email_governance_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_messages.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_messages_service_all" ON public.email_governance_messages;
CREATE POLICY "email_gov_messages_service_all"
  ON public.email_governance_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Message attempts
DROP POLICY IF EXISTS "email_gov_attempts_select" ON public.email_governance_message_attempts;
CREATE POLICY "email_gov_attempts_select"
  ON public.email_governance_message_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_message_attempts.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_attempts_service_all" ON public.email_governance_message_attempts;
CREATE POLICY "email_gov_attempts_service_all"
  ON public.email_governance_message_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Email events
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

-- Suppression events
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

DROP POLICY IF EXISTS "email_gov_suppression_service_all" ON public.email_governance_suppression_events;
CREATE POLICY "email_gov_suppression_service_all"
  ON public.email_governance_suppression_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Tenant reputation snapshots
DROP POLICY IF EXISTS "email_gov_reputation_select" ON public.email_governance_tenant_reputation_snapshots;
CREATE POLICY "email_gov_reputation_select"
  ON public.email_governance_tenant_reputation_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_tenant_reputation_snapshots.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_reputation_service_all" ON public.email_governance_tenant_reputation_snapshots;
CREATE POLICY "email_gov_reputation_service_all"
  ON public.email_governance_tenant_reputation_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Domain health logs
DROP POLICY IF EXISTS "email_gov_domain_health_select" ON public.email_governance_domain_health_logs;
CREATE POLICY "email_gov_domain_health_select"
  ON public.email_governance_domain_health_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_domain_health_logs.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_domain_health_service_all" ON public.email_governance_domain_health_logs;
CREATE POLICY "email_gov_domain_health_service_all"
  ON public.email_governance_domain_health_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Batches
DROP POLICY IF EXISTS "email_gov_batches_select" ON public.email_governance_batches;
CREATE POLICY "email_gov_batches_select"
  ON public.email_governance_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_batches.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_batches_service_all" ON public.email_governance_batches;
CREATE POLICY "email_gov_batches_service_all"
  ON public.email_governance_batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Webhook deliveries
DROP POLICY IF EXISTS "email_gov_webhook_select" ON public.email_governance_webhook_deliveries;
CREATE POLICY "email_gov_webhook_select"
  ON public.email_governance_webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_webhook_deliveries.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_webhook_service_all" ON public.email_governance_webhook_deliveries;
CREATE POLICY "email_gov_webhook_service_all"
  ON public.email_governance_webhook_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Governance audit logs
DROP POLICY IF EXISTS "email_gov_audit_select" ON public.email_governance_audit_logs;
CREATE POLICY "email_gov_audit_select"
  ON public.email_governance_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_audit_logs.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_audit_service_all" ON public.email_governance_audit_logs;
CREATE POLICY "email_gov_audit_service_all"
  ON public.email_governance_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- 12) Updated-at triggers
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_gov_messages_updated_at') THEN
    CREATE TRIGGER update_email_gov_messages_updated_at
      BEFORE UPDATE ON public.email_governance_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_gov_batches_updated_at') THEN
    CREATE TRIGGER update_email_gov_batches_updated_at
      BEFORE UPDATE ON public.email_governance_batches
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_gov_webhook_updated_at') THEN
    CREATE TRIGGER update_email_gov_webhook_updated_at
      BEFORE UPDATE ON public.email_governance_webhook_deliveries
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- =====================================================
-- 13) Rolling snapshot helper (24h + 30d)
-- =====================================================
CREATE OR REPLACE FUNCTION public.refresh_email_governance_tenant_reputation_snapshot(
  p_tenant_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  window_key TEXT,
  snapshot_id UUID,
  sent_count INTEGER,
  delivered_count INTEGER,
  bounced_count INTEGER,
  complained_count INTEGER,
  opened_count INTEGER,
  clicked_count INTEGER,
  unsubscribed_count INTEGER,
  bounce_rate NUMERIC,
  complaint_rate NUMERIC,
  open_rate NUMERIC,
  click_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TEXT;
  v_start TIMESTAMPTZ;
  v_sent INTEGER;
  v_delivered INTEGER;
  v_bounced INTEGER;
  v_complained INTEGER;
  v_opened INTEGER;
  v_clicked INTEGER;
  v_unsubscribed INTEGER;
  v_open_base NUMERIC;
  v_snapshot_id UUID;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  FOREACH v_window IN ARRAY ARRAY['24h', '30d']
  LOOP
    v_start := CASE
      WHEN v_window = '24h' THEN p_as_of - INTERVAL '24 hours'
      ELSE p_as_of - INTERVAL '30 days'
    END;

    SELECT
      COUNT(*) FILTER (WHERE event_type = 'sent')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'delivered')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'bounced')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'complained')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'opened')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'clicked')::INTEGER,
      COUNT(*) FILTER (WHERE event_type = 'unsubscribed')::INTEGER
    INTO
      v_sent,
      v_delivered,
      v_bounced,
      v_complained,
      v_opened,
      v_clicked,
      v_unsubscribed
    FROM public.email_governance_email_events e
    WHERE e.tenant_id = p_tenant_id
      AND COALESCE(e.event_ts_provider, e.ingested_at) >= v_start
      AND COALESCE(e.event_ts_provider, e.ingested_at) <= p_as_of;

    v_sent := COALESCE(v_sent, 0);
    v_delivered := COALESCE(v_delivered, 0);
    v_bounced := COALESCE(v_bounced, 0);
    v_complained := COALESCE(v_complained, 0);
    v_opened := COALESCE(v_opened, 0);
    v_clicked := COALESCE(v_clicked, 0);
    v_unsubscribed := COALESCE(v_unsubscribed, 0);

    v_open_base := GREATEST(v_delivered, v_sent, 1);

    INSERT INTO public.email_governance_tenant_reputation_snapshots (
      tenant_id,
      window_key,
      as_of,
      sent_count,
      delivered_count,
      bounced_count,
      complained_count,
      opened_count,
      clicked_count,
      unsubscribed_count,
      bounce_rate,
      complaint_rate,
      open_rate,
      click_rate,
      source,
      computed_at
    ) VALUES (
      p_tenant_id,
      v_window,
      p_as_of,
      v_sent,
      v_delivered,
      v_bounced,
      v_complained,
      v_opened,
      v_clicked,
      v_unsubscribed,
      (v_bounced::NUMERIC / GREATEST(v_sent, 1)),
      (v_complained::NUMERIC / GREATEST(v_sent, 1)),
      (v_opened::NUMERIC / v_open_base),
      (v_clicked::NUMERIC / v_open_base),
      'sql_function',
      now()
    )
    ON CONFLICT (tenant_id, window_key, as_of)
    DO UPDATE SET
      sent_count = EXCLUDED.sent_count,
      delivered_count = EXCLUDED.delivered_count,
      bounced_count = EXCLUDED.bounced_count,
      complained_count = EXCLUDED.complained_count,
      opened_count = EXCLUDED.opened_count,
      clicked_count = EXCLUDED.clicked_count,
      unsubscribed_count = EXCLUDED.unsubscribed_count,
      bounce_rate = EXCLUDED.bounce_rate,
      complaint_rate = EXCLUDED.complaint_rate,
      open_rate = EXCLUDED.open_rate,
      click_rate = EXCLUDED.click_rate,
      source = EXCLUDED.source,
      computed_at = EXCLUDED.computed_at
    RETURNING id INTO v_snapshot_id;

    window_key := v_window;
    snapshot_id := v_snapshot_id;
    sent_count := v_sent;
    delivered_count := v_delivered;
    bounced_count := v_bounced;
    complained_count := v_complained;
    opened_count := v_opened;
    clicked_count := v_clicked;
    unsubscribed_count := v_unsubscribed;
    bounce_rate := (v_bounced::NUMERIC / GREATEST(v_sent, 1));
    complaint_rate := (v_complained::NUMERIC / GREATEST(v_sent, 1));
    open_rate := (v_opened::NUMERIC / v_open_base);
    click_rate := (v_clicked::NUMERIC / v_open_base);

    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_snapshot(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_email_governance_tenant_reputation_snapshot(UUID, TIMESTAMPTZ) TO service_role;
