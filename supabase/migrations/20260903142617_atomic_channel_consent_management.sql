-- Make staff-managed consent a single auditable transaction. Generic customer
-- updates must never change a channel flag without updating its evidence,
-- canonical consent row, suppression state, and history together.

ALTER TABLE public.crm_email_consent_events
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_basis text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_sms_consent_events
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_basis text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_email_consent_events
  DROP CONSTRAINT IF EXISTS crm_email_consent_events_basis_check;
ALTER TABLE public.crm_email_consent_events
  ADD CONSTRAINT crm_email_consent_events_basis_check
  CHECK (consent_basis IS NULL OR consent_basis IN ('express', 'implied', 'revoked'));

ALTER TABLE public.crm_sms_consent_events
  DROP CONSTRAINT IF EXISTS crm_sms_consent_events_basis_check;
ALTER TABLE public.crm_sms_consent_events
  ADD CONSTRAINT crm_sms_consent_events_basis_check
  CHECK (consent_basis IS NULL OR consent_basis IN ('express', 'implied', 'revoked'));

CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_tenant_phone_channel_type_unique
  ON public.suppression_list (tenant_id, phone, channel, suppression_type)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_customer_marketing_consent(
  p_customer_id uuid,
  p_channel text,
  p_opt_in boolean,
  p_source text,
  p_consent_basis text DEFAULT NULL,
  p_evidence text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_customer public.crm_customers%ROWTYPE;
  v_now timestamptz := statement_timestamp();
  v_channel text := lower(trim(coalesce(p_channel, '')));
  v_source text := lower(trim(coalesce(p_source, '')));
  v_basis text := lower(trim(coalesce(p_consent_basis, '')));
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_email text;
  v_phone text;
  v_changed boolean;
  v_cancelled_messages integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_channel NOT IN ('email', 'sms') THEN
    RAISE EXCEPTION 'Channel must be email or sms';
  END IF;

  IF p_opt_in IS NULL THEN
    RAISE EXCEPTION 'Consent decision is required';
  END IF;

  IF v_source NOT IN (
    'in_store', 'web_form', 'written_request', 'phone_request',
    'customer_service', 'admin_correction'
  ) THEN
    RAISE EXCEPTION 'A documented consent source is required';
  END IF;

  IF p_opt_in AND v_basis NOT IN ('express', 'implied') THEN
    RAISE EXCEPTION 'Opt-in requires an express or implied consent basis';
  END IF;

  IF p_opt_in AND length(v_evidence) < 10 THEN
    RAISE EXCEPTION 'Opt-in evidence must describe how consent was obtained';
  END IF;

  SELECT customer.*
  INTO v_customer
  FROM public.crm_customers AS customer
  INNER JOIN public.users AS app_user
    ON app_user.id = v_actor_id
   AND app_user.tenant_id = customer.tenant_id
  WHERE customer.id = p_customer_id
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL
  FOR UPDATE OF customer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or access denied' USING ERRCODE = '42501';
  END IF;

  v_email := lower(trim(coalesce(v_customer.email, '')));
  v_phone := nullif(trim(coalesce(v_customer.phone, '')), '');

  IF v_channel = 'email' AND v_email = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;
  IF v_channel = 'sms' AND v_phone IS NULL THEN
    RAISE EXCEPTION 'Customer phone is required';
  END IF;

  IF v_channel = 'email' THEN
    v_changed := v_customer.email_opt_in IS DISTINCT FROM p_opt_in
      OR v_customer.email_consent IS DISTINCT FROM p_opt_in;

    UPDATE public.crm_customers
    SET email_opt_in = p_opt_in,
        email_consent = p_opt_in,
        opt_out = NOT p_opt_in,
        email_opt_in_at = CASE WHEN p_opt_in THEN v_now ELSE email_opt_in_at END,
        email_opt_out_at = CASE WHEN p_opt_in THEN NULL ELSE v_now END,
        email_consent_source = v_source,
        email_consent_method = CASE
          WHEN p_opt_in THEN 'admin_documented_' || v_basis
          ELSE 'admin_opt_out'
        END,
        email_consent_ip = p_ip_address,
        email_consent_details = jsonb_build_object(
          'actor_user_id', v_actor_id,
          'source', v_source,
          'basis', CASE WHEN p_opt_in THEN v_basis ELSE 'revoked' END,
          'evidence', v_evidence,
          'captured_at', v_now,
          'user_agent', p_user_agent
        ),
        updated_at = v_now
    WHERE id = v_customer.id;

    IF p_opt_in THEN
      -- Documented consent may lift an unsubscribe. It can never lift a hard
      -- bounce or complaint suppression.
      UPDATE public.suppression_list
      SET lifted_at = v_now,
          lifted_by = v_actor_id,
          updated_at = v_now
      WHERE tenant_id = v_customer.tenant_id
        AND lower(email) = v_email
        AND channel = 'email'
        AND suppression_type = 'unsubscribed'
        AND lifted_at IS NULL;
    ELSE
      INSERT INTO public.suppression_list (
        tenant_id, customer_id, email, suppression_type, channel, reason,
        auto_suppressed, suppressed_at, lifted_at, updated_at
      ) VALUES (
        v_customer.tenant_id, v_customer.id, v_email, 'unsubscribed', 'email',
        'documented_admin_opt_out', false, v_now, NULL, v_now
      )
      ON CONFLICT (tenant_id, email, channel, suppression_type)
      DO UPDATE SET
        customer_id = excluded.customer_id,
        reason = excluded.reason,
        auto_suppressed = false,
        suppressed_at = v_now,
        lifted_at = NULL,
        lifted_by = NULL,
        updated_at = v_now;
    END IF;

    INSERT INTO public.crm_email_consent_events (
      tenant_id, customer_id, email, event_type, source, user_agent,
      ip_address, actor_user_id, consent_basis, evidence
    ) VALUES (
      v_customer.tenant_id, v_customer.id, v_email,
      CASE WHEN p_opt_in THEN 'opt_in' ELSE 'opt_out' END,
      v_source, p_user_agent, p_ip_address, v_actor_id,
      CASE WHEN p_opt_in THEN v_basis ELSE 'revoked' END,
      jsonb_build_object('note', v_evidence, 'status_changed', v_changed)
    );
  ELSE
    v_changed := v_customer.sms_opt_in IS DISTINCT FROM p_opt_in
      OR v_customer.sms_consent IS DISTINCT FROM p_opt_in;

    UPDATE public.crm_customers
    SET sms_opt_in = p_opt_in,
        sms_consent = p_opt_in,
        sms_opt_in_at = CASE WHEN p_opt_in THEN v_now ELSE sms_opt_in_at END,
        sms_opt_out_at = CASE WHEN p_opt_in THEN NULL ELSE v_now END,
        sms_consent_source = v_source,
        sms_consent_method = CASE
          WHEN p_opt_in THEN 'admin_documented_' || v_basis
          ELSE 'admin_opt_out'
        END,
        sms_consent_ip = p_ip_address,
        sms_consent_details = jsonb_build_object(
          'actor_user_id', v_actor_id,
          'source', v_source,
          'basis', CASE WHEN p_opt_in THEN v_basis ELSE 'revoked' END,
          'evidence', v_evidence,
          'captured_at', v_now,
          'user_agent', p_user_agent
        ),
        updated_at = v_now
    WHERE id = v_customer.id;

    IF p_opt_in THEN
      UPDATE public.suppression_list
      SET lifted_at = v_now,
          lifted_by = v_actor_id,
          updated_at = v_now
      WHERE tenant_id = v_customer.tenant_id
        AND channel = 'sms'
        AND suppression_type = 'unsubscribed'
        AND lifted_at IS NULL
        AND (
          customer_id = v_customer.id
          OR regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') =
             regexp_replace(v_phone, '[^0-9]', '', 'g')
        );
    ELSE
      INSERT INTO public.suppression_list (
        tenant_id, customer_id, phone, suppression_type, channel, reason,
        auto_suppressed, suppressed_at, lifted_at, updated_at
      ) VALUES (
        v_customer.tenant_id, v_customer.id, v_phone, 'unsubscribed', 'sms',
        'documented_admin_opt_out', false, v_now, NULL, v_now
      )
      ON CONFLICT (tenant_id, phone, channel, suppression_type)
        WHERE phone IS NOT NULL
      DO UPDATE SET
        customer_id = excluded.customer_id,
        reason = excluded.reason,
        auto_suppressed = false,
        suppressed_at = v_now,
        lifted_at = NULL,
        lifted_by = NULL,
        updated_at = v_now;

      WITH cancelled AS (
        UPDATE public.sms_messages
        SET status = 'failed',
            failure_type = 'compliance',
            error_code = 'SMS_OPTED_OUT',
            error_message = 'Recipient opted out before delivery',
            dead_lettered_at = v_now,
            updated_at = v_now
        WHERE customer_id = v_customer.id
          AND status = 'queued'
        RETURNING 1
      )
      SELECT count(*)::integer INTO v_cancelled_messages FROM cancelled;
    END IF;

    INSERT INTO public.crm_sms_consent_events (
      tenant_id, customer_id, phone, event_type, source, user_agent,
      ip_address, actor_user_id, consent_basis, evidence
    ) VALUES (
      v_customer.tenant_id, v_customer.id, v_phone,
      CASE WHEN p_opt_in THEN 'opt_in' ELSE 'opt_out' END,
      v_source, p_user_agent, p_ip_address, v_actor_id,
      CASE WHEN p_opt_in THEN v_basis ELSE 'revoked' END,
      jsonb_build_object('note', v_evidence, 'status_changed', v_changed)
    );
  END IF;

  INSERT INTO public.customer_consents (
    customer_id, channel, status, consent_timestamp, created_at, updated_at
  ) VALUES (
    v_customer.id, v_channel,
    CASE WHEN p_opt_in THEN 'opted_in' ELSE 'opted_out' END,
    v_now, v_now, v_now
  )
  ON CONFLICT (customer_id, channel) DO UPDATE
  SET status = excluded.status,
      consent_timestamp = excluded.consent_timestamp,
      updated_at = v_now;

  RETURN jsonb_build_object(
    'customerId', v_customer.id,
    'tenantId', v_customer.tenant_id,
    'channel', v_channel,
    'optedIn', p_opt_in,
    'statusChanged', v_changed,
    'source', v_source,
    'consentBasis', CASE WHEN p_opt_in THEN v_basis ELSE 'revoked' END,
    'recordedAt', v_now,
    'cancelledQueuedMessages', v_cancelled_messages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_marketing_consent(
  uuid, text, boolean, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_marketing_consent(
  uuid, text, boolean, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.set_customer_marketing_consent(
  uuid, text, boolean, text, text, text, text, text
) IS 'Atomically records documented staff-managed email or SMS consent, history, suppression state, and queued-SMS cancellation.';

-- Email's legacy opt_out/suppressed flags must never decide SMS eligibility.
-- The final delivery gate uses only SMS-specific consent and suppression state.
CREATE OR REPLACE FUNCTION public.check_sms_send_eligibility(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_recipient text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  SELECT customer.*
  INTO v_customer
  FROM public.crm_customers AS customer
  WHERE customer.id = p_customer_id
    AND customer.tenant_id = p_tenant_id
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL;

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

  SELECT consent.status
  INTO v_latest_consent_status
  FROM public.customer_consents AS consent
  WHERE consent.customer_id = p_customer_id
    AND consent.channel = 'sms'
  ORDER BY consent.consent_timestamp DESC, consent.created_at DESC, consent.id DESC
  LIMIT 1;

  IF FOUND AND v_latest_consent_status <> 'opted_in' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_CONSENT_REVOKED',
      'reason', 'The latest SMS consent record is not opted in'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.suppression_list AS suppression
    WHERE suppression.tenant_id = p_tenant_id
      AND suppression.channel = 'sms'
      AND suppression.lifted_at IS NULL
      AND (
        suppression.customer_id = p_customer_id
        OR regexp_replace(coalesce(suppression.phone, ''), '[^0-9]', '', 'g') IN (
          v_recipient_digits,
          '1' || v_recipient_digits
        )
      )
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_SUPPRESSED',
      'reason', 'Recipient is on the active SMS suppression list'
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

COMMENT ON FUNCTION public.check_sms_send_eligibility(uuid, uuid, text) IS
  'Fails closed at SMS delivery using channel-specific consent and suppression state; email opt-out state is intentionally ignored.';


-- Keep the dashboard audience consistent with the final delivery gate.
CREATE OR REPLACE FUNCTION public.get_sms_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_subscribers bigint := 0;
  v_sent bigint := 0;
  v_delivered bigint := 0;
  v_clicks bigint := 0;
  v_queued bigint := 0;
  v_current_sent bigint := 0;
  v_current_delivered bigint := 0;
  v_current_clicks bigint := 0;
  v_previous_sent bigint := 0;
  v_previous_delivered bigint := 0;
  v_previous_clicks bigint := 0;
  v_now timestamptz := statement_timestamp();
  v_current_start timestamptz;
  v_previous_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT app_user.tenant_id
  INTO v_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id;

  v_current_start := v_now - interval '30 days';
  v_previous_start := v_now - interval '60 days';

  SELECT count(*)
  INTO v_subscribers
  FROM public.crm_customers AS customer
  WHERE (
      (v_tenant_id IS NOT NULL AND customer.tenant_id = v_tenant_id)
      OR (v_tenant_id IS NULL AND customer.user_id = v_user_id)
    )
    AND customer.sms_opt_in = true
    AND customer.sms_consent IS DISTINCT FROM false
    AND customer.sms_opt_in_at IS NOT NULL
    AND nullif(trim(customer.sms_consent_source), '') IS NOT NULL
    AND nullif(trim(customer.phone), '') IS NOT NULL
    AND customer.deleted_at IS NULL
    AND customer.merged_into_customer_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_consents AS consent
      WHERE consent.customer_id = customer.id
        AND consent.channel = 'sms'
        AND consent.status <> 'opted_in'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.suppression_list AS suppression
      WHERE suppression.tenant_id = customer.tenant_id
        AND suppression.channel = 'sms'
        AND suppression.lifted_at IS NULL
        AND (
          suppression.customer_id = customer.id
          OR regexp_replace(coalesce(suppression.phone, ''), '[^0-9]', '', 'g') =
             regexp_replace(customer.phone, '[^0-9]', '', 'g')
        )
    );

  WITH scoped_messages AS (
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    LEFT JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NOT NULL
      AND message.tenant_id = v_tenant_id
      AND (campaign.id IS NULL OR campaign.source IS DISTINCT FROM 'segment_send')

    UNION ALL

    -- Legacy rows predate sms_messages.tenant_id and remain attributable
    -- through their campaign without forcing an OR across the indexed path.
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NOT NULL
      AND message.tenant_id IS NULL
      AND campaign.tenant_id = v_tenant_id
      AND campaign.source IS DISTINCT FROM 'segment_send'

    UNION ALL

    -- Preserve the legacy pre-tenant user fallback during onboarding.
    SELECT
      message.status,
      message.created_at,
      coalesce(message.links_clicked, 0)::bigint AS links_clicked
    FROM public.sms_messages AS message
    JOIN public.crm_sms_campaigns AS campaign
      ON campaign.id = message.campaign_id
    WHERE v_tenant_id IS NULL
      AND campaign.user_id = v_user_id
      AND campaign.source IS DISTINCT FROM 'segment_send'
  )
  SELECT
    count(*) FILTER (WHERE status IN ('sent', 'delivered', 'failed')),
    count(*) FILTER (WHERE status = 'delivered'),
    coalesce(sum(links_clicked), 0),
    count(*) FILTER (WHERE status = 'queued'),
    count(*) FILTER (
      WHERE status IN ('sent', 'delivered', 'failed')
        AND created_at >= v_current_start
    ),
    count(*) FILTER (
      WHERE status = 'delivered'
        AND created_at >= v_current_start
    ),
    coalesce(sum(links_clicked) FILTER (WHERE created_at >= v_current_start), 0),
    count(*) FILTER (
      WHERE status IN ('sent', 'delivered', 'failed')
        AND created_at >= v_previous_start
        AND created_at < v_current_start
    ),
    count(*) FILTER (
      WHERE status = 'delivered'
        AND created_at >= v_previous_start
        AND created_at < v_current_start
    ),
    coalesce(sum(links_clicked) FILTER (
      WHERE created_at >= v_previous_start
        AND created_at < v_current_start
    ), 0)
  INTO
    v_sent,
    v_delivered,
    v_clicks,
    v_queued,
    v_current_sent,
    v_current_delivered,
    v_current_clicks,
    v_previous_sent,
    v_previous_delivered,
    v_previous_clicks
  FROM scoped_messages;

  RETURN jsonb_build_object(
    'subscribers', v_subscribers,
    'sent', v_sent,
    'delivered', v_delivered,
    'clicks', v_clicks,
    'queued_messages', v_queued,
    'current_sent', v_current_sent,
    'current_delivered', v_current_delivered,
    'current_clicks', v_current_clicks,
    'previous_sent', v_previous_sent,
    'previous_delivered', v_previous_delivered,
    'previous_clicks', v_previous_clicks,
    'generated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sms_dashboard_stats()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sms_dashboard_stats()
TO authenticated, service_role;

COMMENT ON FUNCTION public.get_sms_dashboard_stats() IS
  'Returns exact tenant-scoped SMS audience, delivery, click, and queue totals for the authenticated dashboard.';
