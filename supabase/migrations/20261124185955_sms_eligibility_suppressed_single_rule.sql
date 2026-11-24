-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).

-- QA pass 4 follow-up #1: one SMS eligibility rule, now excluding suppressed
-- customers.
--
-- What crm_customers.opt_out means: it is the email unsubscribe flag. It is
-- set by unsubscribe_customer_by_preference_token (the email unsubscribe link,
-- together with email_opt_in = false and email_opt_out_at) and by
-- merge_crm_customers on the retired duplicate (which is also deleted,
-- suppressed and opted out of both channels). SMS STOP
-- (apply_mta_inbound_sms) and staff consent changes
-- (set_customer_marketing_consent) never set it; they clear sms_opt_in and
-- write SMS consent records and SMS suppressions instead.
-- 20260903142617_atomic_channel_consent_management already ruled that "email
-- opt-out state is intentionally ignored" for SMS. So the single rule does NOT
-- exclude opt_out = true. On Burnett's (2026-11-24) all 91 SMS-eligible
-- customers with opt_out = true have email_opt_in = false and an
-- email_opt_out_at, and no SMS opt-out.
--
-- crm_customers.suppressed = true is now always excluded from SMS.
--
-- The rule lives in public.sms_eligible_customers (set) and
-- public.check_sms_send_eligibility (one row). get_sms_audience_estimate and
-- filter_sms_eligible_customer_ids already read sms_eligible_customers, so they
-- pick the change up unchanged. count_sms_campaign_recipients and
-- get_sms_persona_recipient_page had their own copy (which excluded opt_out and
-- did not check deleted, merged, phone length, consent records or the SMS
-- suppression list); they now read sms_eligible_customers too, so Send Now's
-- count, the persona enqueue page, the wizard estimate and the send-time check
-- agree.

create or replace function public.sms_eligible_customers(p_tenant_id uuid)
returns table (customer_id uuid)
language sql
stable
security definer
set search_path to ''
as $function$
  with candidate as (
    select
      customer.id,
      regexp_replace(coalesce(customer.phone, ''), '[^0-9]', '', 'g') as raw_digits
    from public.crm_customers as customer
    where customer.tenant_id = p_tenant_id
      and customer.deleted_at is null
      and customer.merged_into_customer_id is null
      and customer.suppressed is not true
      and customer.sms_opt_in is true
      and customer.sms_consent is distinct from false
      and customer.sms_opt_in_at is not null
      and nullif(trim(customer.sms_consent_source), '') is not null
  ),
  normalized as (
    select
      candidate.id,
      case
        when length(candidate.raw_digits) = 11 and left(candidate.raw_digits, 1) = '1'
          then right(candidate.raw_digits, 10)
        else candidate.raw_digits
      end as digits
    from candidate
  )
  select normalized.id
  from normalized
  where length(normalized.digits) = 10
    and coalesce((
      select consent.status
      from public.customer_consents as consent
      where consent.customer_id = normalized.id
        and consent.channel = 'sms'
      order by consent.consent_timestamp desc, consent.created_at desc, consent.id desc
      limit 1
    ), 'opted_in') = 'opted_in'
    and not exists (
      select 1
      from public.suppression_list as suppression
      where suppression.tenant_id = p_tenant_id
        and suppression.channel = 'sms'
        and suppression.lifted_at is null
        and (
          suppression.customer_id = normalized.id
          or regexp_replace(coalesce(suppression.phone, ''), '[^0-9]', '', 'g')
            in (normalized.digits, '1' || normalized.digits)
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.check_sms_send_eligibility(p_tenant_id uuid, p_customer_id uuid, p_recipient text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  IF v_customer.suppressed IS TRUE THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'SMS_SUPPRESSED',
      'reason', 'Customer is suppressed'
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
$function$;

CREATE OR REPLACE FUNCTION public.count_sms_campaign_recipients(p_campaign_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_campaign public.crm_sms_campaigns%ROWTYPE; v_system_segment_type text; v_count bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT campaign.* INTO v_campaign FROM public.crm_sms_campaigns AS campaign WHERE campaign.id=p_campaign_id;
  IF v_campaign.id IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  v_system_segment_type := v_campaign.metrics #>> '{segment_filter,system_segment_type}';
  -- Eligibility is public.sms_eligible_customers, the one SMS rule.
  SELECT count(*) INTO v_count
  FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible
  JOIN public.crm_customers AS customer
    ON customer.id = eligible.customer_id AND customer.tenant_id = v_campaign.tenant_id
  WHERE (v_campaign.segment_id IS NULL OR EXISTS (SELECT 1 FROM public.customer_segments AS membership WHERE membership.segment_id=v_campaign.segment_id AND membership.customer_id=customer.id))
    AND (coalesce(cardinality(v_campaign.targeting_persona_ids),0)=0 OR CASE lower(coalesce(v_campaign.targeting_logic,'any'))
      WHEN 'all' THEN NOT EXISTS (SELECT 1 FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id) WHERE NOT EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id=target.persona_id))
      ELSE EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id=ANY(v_campaign.targeting_persona_ids)) END)
    AND CASE coalesce(v_system_segment_type,'')
      WHEN 'high-value' THEN coalesce(customer.total_spent,0)>=500
      WHEN 'new-customers' THEN customer.created_at>=now()-interval '30 days'
      WHEN 'frequent-buyers' THEN coalesce(customer.order_count,0)>=3
      WHEN 'perks-members' THEN EXISTS (SELECT 1 FROM public.customer_loyalty_metrics AS loyalty WHERE loyalty.customer_id=customer.id AND loyalty.is_perks_member)
      ELSE true END;
  RETURN coalesce(v_count,0);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_sms_persona_recipient_page(p_campaign_id uuid, p_after_customer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, first_name text, last_name text, phone text, email text, custom_fields jsonb, lifetime_value numeric, total_spent numeric, tags text[], is_vip boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_campaign public.crm_sms_campaigns%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT campaign.* INTO v_campaign FROM public.crm_sms_campaigns AS campaign WHERE campaign.id=p_campaign_id;
 IF v_campaign.id IS NULL OR coalesce(cardinality(v_campaign.targeting_persona_ids),0)=0 THEN RETURN; END IF;
 -- Eligibility is public.sms_eligible_customers, the one SMS rule.
 RETURN QUERY SELECT customer.id,customer.first_name,customer.last_name,customer.phone,customer.email,customer.custom_fields,customer.lifetime_value,customer.total_spent,customer.tags,customer.is_vip
 FROM public.sms_eligible_customers(v_campaign.tenant_id) AS eligible
 JOIN public.crm_customers AS customer
   ON customer.id = eligible.customer_id AND customer.tenant_id = v_campaign.tenant_id
 WHERE (p_after_customer_id IS NULL OR customer.id>p_after_customer_id)
 AND CASE lower(coalesce(v_campaign.targeting_logic,'any')) WHEN 'all' THEN NOT EXISTS (SELECT 1 FROM unnest(v_campaign.targeting_persona_ids) AS target(persona_id) WHERE NOT EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id=target.persona_id))
 ELSE EXISTS (SELECT 1 FROM public.customer_personas AS assignment WHERE assignment.customer_id=customer.id AND assignment.persona_id=ANY(v_campaign.targeting_persona_ids)) END
 ORDER BY customer.id LIMIT least(greatest(coalesce(p_limit,1000),1),5000);
END; $function$;
