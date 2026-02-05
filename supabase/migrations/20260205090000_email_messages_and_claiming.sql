-- Fault-tolerant, duplicate-proof email campaign sending
-- Adds per-recipient email_messages ledger and atomic job-claiming for workers.

-- ==========================================================
-- 1) email_messages: source-of-truth per recipient per campaign
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  domain_id UUID,
  email TEXT NOT NULL,
  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  resend_id TEXT,

  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_token UUID,
  dead_lettered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One recipient may only exist once per campaign (hard dedupe guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_campaign_customer
  ON public.email_messages (campaign_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_status
  ON public.email_messages (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_email_messages_claimable
  ON public.email_messages (status, claimed_at, created_at)
  WHERE status IN ('queued', 'sending');

-- RLS
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Allow tenant users to view their tenant's messages (read-only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_messages' AND policyname = 'Users can view their tenant\'s email messages'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Users can view their tenant's email messages"
      ON public.email_messages FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    $$;
  END IF;

  -- Service role can manage all messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_messages' AND policyname = 'Service role can manage all email messages'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Service role can manage all email messages"
      ON public.email_messages FOR ALL
      USING (true)
      WITH CHECK (true);
    $$;
  END IF;
END$$;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_messages_updated_at'
  ) THEN
    EXECUTE $$
      CREATE TRIGGER update_email_messages_updated_at
        BEFORE UPDATE ON public.email_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    $$;
  END IF;
END$$;


-- ==========================================================
-- 2) Extend email_send_jobs for safe claiming + message IDs
-- ==========================================================

ALTER TABLE public.email_send_jobs
  ADD COLUMN IF NOT EXISTS recipient_message_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claim_token UUID;

-- Prevent duplicate batch creation per campaign
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_send_jobs_campaign_batch
  ON public.email_send_jobs (campaign_id, batch_index);

CREATE INDEX IF NOT EXISTS idx_email_send_jobs_claimable
  ON public.email_send_jobs (status, claimed_at, created_at)
  WHERE status IN ('pending', 'in_progress');


-- ==========================================================
-- 3) Atomic job claiming RPC (crash-safe, parallel-safe)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.claim_email_send_jobs(
  batch_size INT DEFAULT 10,
  worker_id TEXT DEFAULT 'worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  stale_after_minutes INT DEFAULT 10
)
RETURNS SETOF public.email_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT id
    FROM email_send_jobs
    WHERE (
      status = 'pending'
      OR (
        status = 'in_progress'
        AND (claimed_at IS NULL OR claimed_at < (NOW() - make_interval(mins => stale_after_minutes)))
      )
    )
    ORDER BY created_at ASC, batch_index ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE email_send_jobs j
    SET
      status = 'in_progress',
      claimed_at = NOW(),
      claimed_by = worker_id,
      claim_token = p_claim_token,
      attempts = attempts + 1,
      updated_at = NOW()
    WHERE j.id IN (SELECT id FROM claimable)
    RETURNING j.id
  )
  SELECT ARRAY_AGG(id) INTO claimed_ids FROM claimed;

  RETURN QUERY
  SELECT *
  FROM email_send_jobs
  WHERE id = ANY(COALESCE(claimed_ids, ARRAY[]::UUID[]));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_send_jobs(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_jobs(INT, TEXT, UUID, INT) TO service_role;


-- ==========================================================
-- 4) Idempotent campaign send gate
-- ==========================================================

CREATE OR REPLACE FUNCTION public.ensure_campaign_sending(p_campaign_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  current_status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st TEXT;
BEGIN
  SELECT status INTO st
  FROM crm_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF st IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Campaign not found'::TEXT;
    RETURN;
  END IF;

  IF st IN ('sent') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign already sent'::TEXT;
    RETURN;
  END IF;

  IF st IN ('failed') THEN
    RETURN QUERY SELECT FALSE, st, 'Campaign previously failed - reset to draft first'::TEXT;
    RETURN;
  END IF;

  IF st IN ('draft', 'scheduled', 'queued', 'partially_queued') THEN
    UPDATE crm_campaigns
    SET
      status = 'sending',
      send_started_at = COALESCE(send_started_at, NOW()),
      send_error = NULL
    WHERE id = p_campaign_id;

    RETURN QUERY SELECT TRUE, 'sending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF st = 'sending' THEN
    -- Already in-flight; treat as idempotent resume.
    RETURN QUERY SELECT TRUE, st, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, st, 'Campaign cannot be sent from status: ' || st;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_sending(UUID) TO service_role;


-- ==========================================================
-- 5) Hard daily quota reservation (domain + tenant fallback)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.email_domain_daily_usage (
  domain_id UUID NOT NULL REFERENCES public.email_domains(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  daily_limit INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (domain_id, day)
);

CREATE TABLE IF NOT EXISTS public.tenant_email_daily_usage (
  tenant_id UUID NOT NULL,
  day DATE NOT NULL,
  daily_limit INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day)
);

CREATE OR REPLACE FUNCTION public.reserve_email_daily_capacity(
  p_tenant_id UUID,
  p_domain_id UUID,
  p_tokens INT DEFAULT 1,
  p_default_tenant_limit INT DEFAULT 5000
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  dom_limit INT;
  cur_used INT;
BEGIN
  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RETURN TRUE;
  END IF;

  IF p_domain_id IS NOT NULL THEN
    SELECT COALESCE(daily_limit, 5000) INTO dom_limit
    FROM email_domains
    WHERE id = p_domain_id;

    dom_limit := COALESCE(dom_limit, 5000);

    INSERT INTO email_domain_daily_usage(domain_id, day, daily_limit, used)
    VALUES (p_domain_id, today, dom_limit, 0)
    ON CONFLICT (domain_id, day)
    DO UPDATE SET daily_limit = EXCLUDED.daily_limit;

    SELECT used INTO cur_used
    FROM email_domain_daily_usage
    WHERE domain_id = p_domain_id AND day = today
    FOR UPDATE;

    IF (cur_used + p_tokens) > dom_limit THEN
      RETURN FALSE;
    END IF;

    UPDATE email_domain_daily_usage
    SET used = used + p_tokens, updated_at = NOW()
    WHERE domain_id = p_domain_id AND day = today;

    RETURN TRUE;
  END IF;

  -- Tenant fallback when no domain is present
  INSERT INTO tenant_email_daily_usage(tenant_id, day, daily_limit, used)
  VALUES (p_tenant_id, today, p_default_tenant_limit, 0)
  ON CONFLICT (tenant_id, day)
  DO UPDATE SET daily_limit = EXCLUDED.daily_limit;

  SELECT used INTO cur_used
  FROM tenant_email_daily_usage
  WHERE tenant_id = p_tenant_id AND day = today
  FOR UPDATE;

  IF (cur_used + p_tokens) > p_default_tenant_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE tenant_email_daily_usage
  SET used = used + p_tokens, updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND day = today;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_email_daily_capacity(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_daily_capacity(UUID, UUID, INT, INT) TO service_role;


-- ==========================================================
-- 6) Metrics helper RPC (authoritative progress visibility)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_campaign_email_message_counts(p_campaign_ids UUID[])
RETURNS TABLE (
  campaign_id UUID,
  total INTEGER,
  queued INTEGER,
  sending INTEGER,
  sent INTEGER,
  failed INTEGER,
  skipped INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    campaign_id,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
    COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
    COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
    COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
    COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
  FROM public.email_messages
  WHERE campaign_id = ANY(p_campaign_ids)
  GROUP BY campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_email_message_counts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_email_message_counts(UUID[]) TO service_role;


