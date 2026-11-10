-- Scheduled SMS campaigns need an atomic bridge into the existing enqueue and
-- dispatch pipeline.  Expired campaigns are failed closed so a long outage can
-- never cause an unexpectedly late customer send.

CREATE INDEX IF NOT EXISTS crm_sms_campaigns_due_schedule_idx
  ON public.crm_sms_campaigns (scheduled_at, id)
  WHERE status = 'scheduled'
    AND enqueued = false
    AND enqueue_status = 'not_started';

CREATE OR REPLACE FUNCTION public.claim_due_sms_campaign_for_enqueue(
  p_worker_id text,
  p_max_lateness interval DEFAULT interval '24 hours'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  -- Never surprise customers by delivering a campaign days or months late.
  UPDATE public.crm_sms_campaigns AS campaign
  SET status = 'failed',
      enqueue_status = 'failed',
      enqueued = false,
      enqueue_claimed_at = NULL,
      enqueue_claimed_by = NULL,
      metrics = coalesce(campaign.metrics, '{}'::jsonb) || jsonb_build_object(
        'error', 'Scheduled send expired before it could be queued',
        'schedule_expired_at', now()
      ),
      updated_at = now()
  WHERE campaign.status = 'scheduled'
    AND campaign.scheduled_at < now() - p_max_lateness
    AND campaign.enqueued = false
    AND campaign.enqueue_status = 'not_started';

  SELECT campaign.id
  INTO v_campaign_id
  FROM public.crm_sms_campaigns AS campaign
  WHERE campaign.status = 'scheduled'
    AND campaign.scheduled_at <= now()
    AND campaign.scheduled_at >= now() - p_max_lateness
    AND campaign.enqueued = false
    AND campaign.enqueue_status = 'not_started'
  ORDER BY campaign.scheduled_at, campaign.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.crm_sms_campaigns AS campaign
  SET status = 'queued',
      enqueue_claimed_at = now(),
      enqueue_claimed_by = p_worker_id,
      metrics = coalesce(campaign.metrics, '{}'::jsonb) || jsonb_build_object(
        'scheduled_claimed_at', now()
      ),
      updated_at = now()
  WHERE campaign.id = v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_sms_campaign_for_enqueue(text, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_sms_campaign_for_enqueue(text, interval)
  TO service_role;

COMMENT ON FUNCTION public.claim_due_sms_campaign_for_enqueue(text, interval)
  IS 'Atomically moves one due scheduled SMS campaign into the enqueue pipeline and fails expired schedules closed.';

CREATE OR REPLACE FUNCTION public.count_sms_campaign_recipients(
  p_campaign_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.crm_sms_campaigns%ROWTYPE;
  v_system_segment_type text;
  v_count bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT campaign.*
  INTO v_campaign
  FROM public.crm_sms_campaigns AS campaign
  WHERE campaign.id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  v_system_segment_type := v_campaign.metrics #>> '{segment_filter,system_segment_type}';

  SELECT count(*)
  INTO v_count
  FROM public.crm_customers AS customer
  WHERE customer.tenant_id = v_campaign.tenant_id
    AND customer.sms_opt_in
    AND customer.sms_opt_in_at IS NOT NULL
    AND nullif(customer.sms_consent_source, '') IS NOT NULL
    AND nullif(customer.phone, '') IS NOT NULL
    AND NOT coalesce(customer.opt_out, false)
    AND NOT coalesce(customer.suppressed, false)
    AND (
      v_campaign.segment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.customer_segments AS membership
        WHERE membership.segment_id = v_campaign.segment_id
          AND membership.customer_id = customer.id
      )
    )
    AND (
      coalesce(cardinality(v_campaign.targeting_persona_ids), 0) = 0
      OR CASE lower(coalesce(v_campaign.targeting_logic, 'any'))
        WHEN 'all' THEN NOT EXISTS (
          SELECT 1
          FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id)
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.customer_personas AS assignment
            WHERE assignment.customer_id = customer.id
              AND assignment.persona_id = target.persona_id
          )
        )
        ELSE EXISTS (
          SELECT 1
          FROM public.customer_personas AS assignment
          WHERE assignment.customer_id = customer.id
            AND assignment.persona_id = ANY(v_campaign.targeting_persona_ids)
        )
      END
    )
    AND CASE coalesce(v_system_segment_type, '')
      WHEN 'high-value' THEN coalesce(customer.total_spent, 0) >= 500
      WHEN 'new-customers' THEN customer.created_at >= now() - interval '30 days'
      WHEN 'frequent-buyers' THEN coalesce(customer.order_count, 0) >= 3
      WHEN 'perks-members' THEN EXISTS (
        SELECT 1
        FROM public.customer_loyalty_metrics AS loyalty
        WHERE loyalty.customer_id = customer.id
          AND loyalty.is_perks_member
      )
      ELSE true
    END;

  RETURN coalesce(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.count_sms_campaign_recipients(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_sms_campaign_recipients(uuid)
  TO service_role;

COMMENT ON FUNCTION public.count_sms_campaign_recipients(uuid)
  IS 'Counts the current consent-safe recipients for an SMS campaign across all, segment, persona, and system audiences.';

CREATE OR REPLACE FUNCTION public.get_sms_persona_recipient_page(
  p_campaign_id uuid,
  p_after_customer_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  custom_fields jsonb,
  lifetime_value numeric,
  total_spent numeric,
  tags text[],
  is_vip boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.crm_sms_campaigns%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT campaign.*
  INTO v_campaign
  FROM public.crm_sms_campaigns AS campaign
  WHERE campaign.id = p_campaign_id;

  IF v_campaign.id IS NULL OR coalesce(cardinality(v_campaign.targeting_persona_ids), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT customer.id,
         customer.first_name,
         customer.last_name,
         customer.phone,
         customer.email,
         customer.custom_fields,
         customer.lifetime_value,
         customer.total_spent,
         customer.tags,
         customer.is_vip
  FROM public.crm_customers AS customer
  WHERE customer.tenant_id = v_campaign.tenant_id
    AND (p_after_customer_id IS NULL OR customer.id > p_after_customer_id)
    AND customer.sms_opt_in
    AND customer.sms_opt_in_at IS NOT NULL
    AND nullif(customer.sms_consent_source, '') IS NOT NULL
    AND nullif(customer.phone, '') IS NOT NULL
    AND NOT coalesce(customer.opt_out, false)
    AND NOT coalesce(customer.suppressed, false)
    AND CASE lower(coalesce(v_campaign.targeting_logic, 'any'))
      WHEN 'all' THEN NOT EXISTS (
        SELECT 1
        FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.customer_personas AS assignment
          WHERE assignment.customer_id = customer.id
            AND assignment.persona_id = target.persona_id
        )
      )
      ELSE EXISTS (
        SELECT 1
        FROM public.customer_personas AS assignment
        WHERE assignment.customer_id = customer.id
          AND assignment.persona_id = ANY(v_campaign.targeting_persona_ids)
      )
    END
  ORDER BY customer.id
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sms_persona_recipient_page(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sms_persona_recipient_page(uuid, uuid, integer)
  TO service_role;

COMMENT ON FUNCTION public.get_sms_persona_recipient_page(uuid, uuid, integer)
  IS 'Returns one stable, consent-safe page of the exact any/all persona audience saved on an SMS campaign.';
