-- Repair the SMS queue schema, make job claiming atomic, and enforce a
-- service-only consent decision immediately before provider delivery.

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS billable_units integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billed_at timestamptz;

ALTER TABLE public.sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_billable_units_check;
ALTER TABLE public.sms_messages
  ADD CONSTRAINT sms_messages_billable_units_check
  CHECK (billable_units > 0);

-- Backfill in separate, deterministic passes. Historical direct/test sends can
-- legitimately remain tenantless; all newly enqueued campaign messages are
-- tenant-scoped by the worker.
UPDATE public.sms_messages m
SET tenant_id = c.tenant_id
FROM public.crm_customers c
WHERE m.tenant_id IS NULL
  AND c.id = m.customer_id;

UPDATE public.sms_messages m
SET tenant_id = campaign.tenant_id
FROM public.crm_sms_campaigns campaign
WHERE m.tenant_id IS NULL
  AND campaign.id = m.campaign_id;

UPDATE public.sms_messages m
SET tenant_id = job.tenant_id
FROM public.sms_send_jobs job
WHERE m.tenant_id IS NULL
  AND m.id = ANY(job.recipient_message_ids);

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_status_schedule
  ON public.sms_messages (tenant_id, status, scheduled_at);

-- Never release historical queued SMS after repairing the worker. They are no
-- longer timely and may no longer reflect current consent.
UPDATE public.sms_messages
SET status = 'failed',
    error_code = 'STALE_MESSAGE',
    error_message = 'Expired without sending after exceeding the 24-hour safety window',
    failure_type = 'permanent',
    dead_lettered_at = now(),
    updated_at = now()
WHERE status = 'queued'
  AND coalesce(scheduled_at, created_at) < now() - interval '24 hours';

UPDATE public.sms_send_jobs j
SET status = 'failed',
    error_message = 'All queued messages expired before delivery',
    dead_lettered_at = now(),
    claimed_at = NULL,
    claimed_by = NULL,
    claim_token = NULL,
    updated_at = now()
WHERE j.status IN ('pending', 'in_progress')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sms_messages m
    WHERE m.id = ANY(j.recipient_message_ids)
      AND m.status = 'queued'
      AND m.dead_lettered_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.check_sms_send_eligibility(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_recipient text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer public.crm_customers%ROWTYPE;
  v_recipient_digits text;
  v_customer_digits text;
  v_latest_consent_status text;
BEGIN
  IF p_tenant_id IS NULL OR p_customer_id IS NULL OR nullif(trim(p_recipient), '') IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_RECIPIENT_UNRESOLVED',
      'reason', 'SMS requires a tenant-scoped customer and recipient'
    );
  END IF;

  SELECT c.*
  INTO v_customer
  FROM public.crm_customers c
  WHERE c.id = p_customer_id
    AND c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND c.merged_into_customer_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_CUSTOMER_UNAVAILABLE',
      'reason', 'Customer is unavailable, merged, deleted, or belongs to another tenant'
    );
  END IF;

  v_recipient_digits := regexp_replace(p_recipient, '[^0-9]', '', 'g');
  v_customer_digits := regexp_replace(coalesce(v_customer.phone, ''), '[^0-9]', '', 'g');
  IF length(v_recipient_digits) = 11 AND left(v_recipient_digits, 1) = '1' THEN
    v_recipient_digits := right(v_recipient_digits, 10);
  END IF;
  IF length(v_customer_digits) = 11 AND left(v_customer_digits, 1) = '1' THEN
    v_customer_digits := right(v_customer_digits, 10);
  END IF;

  IF length(v_recipient_digits) <> 10 OR v_recipient_digits <> v_customer_digits THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_RECIPIENT_CHANGED',
      'reason', 'Queued recipient no longer matches the customer profile'
    );
  END IF;

  IF v_customer.sms_opt_in IS DISTINCT FROM true
     OR coalesce(v_customer.opt_out, false)
     OR v_customer.sms_consent IS false THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_OPTED_OUT',
      'reason', 'Customer is not currently opted in to SMS'
    );
  END IF;

  IF v_customer.sms_opt_in_at IS NULL
     OR nullif(trim(v_customer.sms_consent_source), '') IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_CONSENT_UNPROVEN',
      'reason', 'SMS consent is missing its date or source'
    );
  END IF;

  SELECT cc.status
  INTO v_latest_consent_status
  FROM public.customer_consents cc
  WHERE cc.customer_id = p_customer_id
    AND cc.channel = 'sms'
  ORDER BY cc.consent_timestamp DESC, cc.created_at DESC, cc.id DESC
  LIMIT 1;

  IF FOUND AND v_latest_consent_status <> 'opted_in' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_CONSENT_REVOKED',
      'reason', 'The latest SMS consent record is not opted in'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'SMS_ELIGIBLE',
    'reason', 'Documented SMS consent is active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_sms_send_eligibility(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_sms_send_eligibility(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_sms_send_jobs(
  p_limit integer,
  p_worker_id text,
  p_claim_token uuid,
  p_stale_minutes integer DEFAULT 15,
  p_max_attempts integer DEFAULT 3
)
RETURNS SETOF public.sms_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'limit must be between 1 and 100';
  END IF;
  IF nullif(trim(p_worker_id), '') IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'worker_id and claim_token are required';
  END IF;
  IF p_stale_minutes IS NULL OR p_stale_minutes NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'stale_minutes must be between 1 and 1440';
  END IF;
  IF p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'max_attempts must be between 1 and 20';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.sms_send_jobs j
    WHERE j.status IN ('pending', 'in_progress')
      AND j.attempts < p_max_attempts
      AND j.dead_lettered_at IS NULL
      AND (j.scheduled_at IS NULL OR j.scheduled_at <= now())
      AND (
        j.status = 'pending'
        OR j.claimed_at IS NULL
        OR j.claimed_at < now() - make_interval(mins => p_stale_minutes)
      )
    ORDER BY j.priority ASC, j.created_at ASC, j.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.sms_send_jobs j
  SET status = 'in_progress',
      claimed_at = now(),
      claimed_by = p_worker_id,
      claim_token = p_claim_token,
      attempts = j.attempts + 1,
      updated_at = now()
  FROM candidates c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sms_send_jobs(integer, text, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sms_send_jobs(integer, text, uuid, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bill_sms_message(
  p_tenant_id uuid,
  p_message_id uuid,
  p_billable_units integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_message public.sms_messages%ROWTYPE;
  v_subscription_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_message_id IS NULL
     OR p_billable_units IS NULL OR p_billable_units < 1 THEN
    RETURN false;
  END IF;

  SELECT m.*
  INTO v_message
  FROM public.sms_messages m
  WHERE m.id = p_message_id
    AND m.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_message.billed_at IS NOT NULL
     OR v_message.status NOT IN ('sent', 'delivered') THEN
    RETURN false;
  END IF;

  SELECT s.id
  INTO v_subscription_id
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.tenant_id = p_tenant_id
    AND s.deleted_at IS NULL
    AND current_date BETWEEN s.start_date AND s.end_date
  ORDER BY s.updated_at DESC, s.id
  LIMIT 1
  FOR UPDATE OF s;

  IF v_subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET sms_usage = coalesce(sms_usage, 0) + p_billable_units,
        overage_sms_this_month = CASE
          WHEN sms_quota IS NULL THEN coalesce(overage_sms_this_month, 0)
          ELSE coalesce(overage_sms_this_month, 0)
            + greatest(coalesce(sms_usage, 0) + p_billable_units - sms_quota, 0)
            - greatest(coalesce(sms_usage, 0) - sms_quota, 0)
        END,
        updated_at = now()
    WHERE id = v_subscription_id;
  END IF;

  UPDATE public.sms_messages
  SET billable_units = p_billable_units,
      billed_at = now(),
      updated_at = now()
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.bill_sms_message(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bill_sms_message(uuid, uuid, integer)
  TO service_role;

COMMENT ON FUNCTION public.check_sms_send_eligibility(uuid, uuid, text)
  IS 'Fails closed unless a canonical tenant customer has current, dated, sourced SMS consent and the queued phone is unchanged.';
COMMENT ON FUNCTION public.claim_sms_send_jobs(integer, text, uuid, integer, integer)
  IS 'Atomically claims due SMS jobs with stale-claim recovery and SKIP LOCKED concurrency safety.';
COMMENT ON FUNCTION public.bill_sms_message(uuid, uuid, integer)
  IS 'Idempotently records an accepted SMS and increments the active tenant subscription usage once.';

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('sms-campaign-enqueue-worker-v2', 'sms-queue-worker-v2')
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'sms-campaign-enqueue-worker-v2',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/sms-campaign-enqueue-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', public.get_service_role_key()
        ),
        body := '{}'::jsonb
      );
    $cron$
  );

  PERFORM cron.schedule(
    'sms-queue-worker-v2',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/sms-queue-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', public.get_service_role_key()
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END;
$$;

