-- Milestone 2 - Webhook Event Processing Engine
-- Adds retry/backoff/DLQ support and expands event contract for deferred/rejected.

-- =====================================================
-- 1) Expand governance event types
-- =====================================================
ALTER TABLE public.email_governance_email_events
  DROP CONSTRAINT IF EXISTS email_governance_email_events_event_type_check;

ALTER TABLE public.email_governance_email_events
  ADD CONSTRAINT email_governance_email_events_event_type_check
  CHECK (
    event_type IN (
      'sent',
      'delivered',
      'opened',
      'clicked',
      'bounced',
      'complained',
      'unsubscribed',
      'deferred',
      'rejected'
    )
  );


-- =====================================================
-- 2) Add retry/backoff and claim metadata to webhook deliveries
-- =====================================================
ALTER TABLE public.email_governance_webhook_deliveries
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

ALTER TABLE public.email_governance_webhook_deliveries
  DROP CONSTRAINT IF EXISTS email_governance_webhook_deliveries_processing_status_check;

ALTER TABLE public.email_governance_webhook_deliveries
  ADD CONSTRAINT email_governance_webhook_deliveries_processing_status_check
  CHECK (
    processing_status IN (
      'received',
      'processing',
      'processed',
      'duplicate',
      'retrying',
      'failed',
      'dead_lettered'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_retry_due
  ON public.email_governance_webhook_deliveries (processing_status, next_retry_at)
  WHERE dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_claimable
  ON public.email_governance_webhook_deliveries (processing_status, claimed_at, received_at)
  WHERE processing_status IN ('received', 'retrying', 'processing')
    AND dead_lettered_at IS NULL;


-- =====================================================
-- 3) Dead-letter queue table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_governance_webhook_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_delivery_id UUID NOT NULL REFERENCES public.email_governance_webhook_deliveries(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  event_type TEXT,
  provider_message_id TEXT,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.email_domains(id) ON DELETE SET NULL,
  failure_stage TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 8,
  last_error_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (webhook_delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_email_gov_webhook_dlq_tenant_time
  ON public.email_governance_webhook_dead_letters (tenant_id, dead_lettered_at DESC);

ALTER TABLE public.email_governance_webhook_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_gov_webhook_dlq_select" ON public.email_governance_webhook_dead_letters;
CREATE POLICY "email_gov_webhook_dlq_select"
  ON public.email_governance_webhook_dead_letters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = email_governance_webhook_dead_letters.tenant_id
    )
  );

DROP POLICY IF EXISTS "email_gov_webhook_dlq_service_all" ON public.email_governance_webhook_dead_letters;
CREATE POLICY "email_gov_webhook_dlq_service_all"
  ON public.email_governance_webhook_dead_letters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- 4) Claim RPC for retry worker
-- =====================================================
CREATE OR REPLACE FUNCTION public.claim_email_governance_webhook_deliveries(
  p_batch_size INT DEFAULT 50,
  p_worker_id TEXT DEFAULT 'email-webhook-worker',
  p_claim_token UUID DEFAULT gen_random_uuid(),
  p_stale_after_minutes INT DEFAULT 10
)
RETURNS SETOF public.email_governance_webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed_ids UUID[];
BEGIN
  WITH claimable AS (
    SELECT id
    FROM public.email_governance_webhook_deliveries
    WHERE dead_lettered_at IS NULL
      AND (
        processing_status IN ('received', 'retrying')
        OR (
          processing_status = 'processing'
          AND (claimed_at IS NULL OR claimed_at < (NOW() - make_interval(mins => p_stale_after_minutes)))
        )
      )
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY received_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.email_governance_webhook_deliveries d
    SET
      processing_status = 'processing',
      claimed_at = NOW(),
      claimed_by = p_worker_id,
      claim_token = p_claim_token,
      retry_count = COALESCE(d.retry_count, 0) + 1,
      updated_at = NOW()
    WHERE d.id IN (SELECT id FROM claimable)
    RETURNING d.id
  )
  SELECT ARRAY_AGG(id) INTO v_claimed_ids
  FROM claimed;

  RETURN QUERY
  SELECT *
  FROM public.email_governance_webhook_deliveries
  WHERE id = ANY(COALESCE(v_claimed_ids, ARRAY[]::UUID[]));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_governance_webhook_deliveries(INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_governance_webhook_deliveries(INT, TEXT, UUID, INT) TO service_role;
