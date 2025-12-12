-- ============================================
-- Scalable SMS Campaign Queues Schema
-- ============================================

-- 1.1 Add campaign send control fields to crm_sms_campaigns
ALTER TABLE crm_sms_campaigns
ADD COLUMN IF NOT EXISTS enqueue_status text NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS enqueue_started_at timestamptz,
ADD COLUMN IF NOT EXISTS enqueue_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS enqueue_cursor_customer_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_recipients_estimate bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_enqueued bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS sending_identity_id uuid,
ADD COLUMN IF NOT EXISTS priority_mode text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS enqueue_claimed_at timestamptz,
ADD COLUMN IF NOT EXISTS enqueue_claimed_by text;

-- 1.2 Add is_vip flag to customers
ALTER TABLE crm_customers
ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

-- Create index for VIP lookups
CREATE INDEX IF NOT EXISTS idx_crm_customers_is_vip 
ON crm_customers (tenant_id, is_vip) 
WHERE is_vip = true;

-- 1.3 Add queue partition fields to sms_send_jobs
ALTER TABLE sms_send_jobs
ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS partition_key text,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Create index for job picking by priority and schedule
CREATE INDEX IF NOT EXISTS idx_sms_jobs_ready
ON sms_send_jobs (status, priority, scheduled_at, created_at)
WHERE status IN ('pending', 'in_progress');

-- 1.4 Create rate limit state table
CREATE TABLE IF NOT EXISTS sms_rate_limit_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sending_identity_id uuid NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  sent_in_window int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sending_identity_id)
);

-- Enable RLS on rate limit table
ALTER TABLE sms_rate_limit_state ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limit state
CREATE POLICY "Service role can manage rate limit state" ON sms_rate_limit_state
  FOR ALL USING (true);

-- 2. Create atomic claim function for campaign enqueueing
CREATE OR REPLACE FUNCTION claim_sms_campaign_enqueue(
  p_campaign_id uuid,
  p_worker_id text,
  p_stale_minutes int DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_current_claimed_at timestamptz;
  v_stale_threshold timestamptz;
  v_claimed boolean := false;
BEGIN
  v_stale_threshold := now() - (p_stale_minutes || ' minutes')::interval;

  -- Try to claim atomically
  UPDATE crm_sms_campaigns
  SET 
    enqueue_status = 'enqueuing',
    enqueue_started_at = COALESCE(enqueue_started_at, now()),
    enqueue_claimed_at = now(),
    enqueue_claimed_by = p_worker_id,
    updated_at = now()
  WHERE id = p_campaign_id
    AND (
      -- Not started yet
      enqueue_status = 'not_started'
      -- Or enqueuing but stale (worker crashed)
      OR (enqueue_status = 'enqueuing' AND (enqueue_claimed_at IS NULL OR enqueue_claimed_at < v_stale_threshold))
    )
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$$;

-- 3. Create rate limit token reservation function
CREATE OR REPLACE FUNCTION reserve_sms_send_tokens(
  p_tenant_id uuid,
  p_sending_identity_id uuid,
  p_tokens int,
  p_window_ms int DEFAULT 1000,
  p_max_tokens int DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_sent_in_window int;
  v_window_interval interval;
BEGIN
  v_window_interval := (p_window_ms || ' milliseconds')::interval;

  -- Upsert and check in one operation
  INSERT INTO sms_rate_limit_state (tenant_id, sending_identity_id, window_start, sent_in_window, updated_at)
  VALUES (p_tenant_id, p_sending_identity_id, now(), 0, now())
  ON CONFLICT (tenant_id, sending_identity_id)
  DO UPDATE SET
    -- Reset window if expired
    window_start = CASE 
      WHEN sms_rate_limit_state.window_start + v_window_interval < now() 
      THEN now() 
      ELSE sms_rate_limit_state.window_start 
    END,
    sent_in_window = CASE 
      WHEN sms_rate_limit_state.window_start + v_window_interval < now() 
      THEN 0 
      ELSE sms_rate_limit_state.sent_in_window 
    END,
    updated_at = now()
  RETURNING window_start, sent_in_window INTO v_window_start, v_sent_in_window;

  -- Check if we can reserve tokens
  IF v_sent_in_window + p_tokens <= p_max_tokens THEN
    -- Reserve the tokens
    UPDATE sms_rate_limit_state
    SET sent_in_window = sent_in_window + p_tokens, updated_at = now()
    WHERE tenant_id = p_tenant_id AND sending_identity_id = p_sending_identity_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION claim_sms_campaign_enqueue TO authenticated;
GRANT EXECUTE ON FUNCTION claim_sms_campaign_enqueue TO service_role;
GRANT EXECUTE ON FUNCTION reserve_sms_send_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_sms_send_tokens TO service_role;