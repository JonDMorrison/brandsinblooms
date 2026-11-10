-- Secure one-click unsubscribe for opaque preference tokens. New email sends
-- no longer expose forgeable base64(email:tenant) action credentials.

CREATE OR REPLACE FUNCTION public.unsubscribe_customer_by_preference_token(
  p_token TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.crm_email_preference_tokens%ROWTYPE;
  v_customer public.crm_customers%ROWTYPE;
  v_email TEXT;
  v_now TIMESTAMPTZ := now();
  v_consent_changed BOOLEAN;
BEGIN
  IF NULLIF(btrim(COALESCE(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired preference token';
  END IF;

  SELECT *
    INTO v_token
    FROM public.crm_email_preference_tokens
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND OR v_token.expires_at <= v_now THEN
    RAISE EXCEPTION 'Invalid or expired preference token';
  END IF;

  SELECT *
    INTO v_customer
    FROM public.crm_customers
   WHERE id = v_token.customer_id
     AND tenant_id = v_token.tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_email := lower(btrim(COALESCE(v_customer.email, v_token.email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  v_consent_changed := v_customer.email_opt_in IS DISTINCT FROM false;

  UPDATE public.crm_customers
     SET email_opt_in = false,
         opt_out = true,
         email_opt_out_at = CASE
           WHEN v_consent_changed THEN v_now
           ELSE email_opt_out_at
         END,
         email_consent_source = CASE
           WHEN v_consent_changed THEN 'unsubscribe_link'
           ELSE email_consent_source
         END,
         email_consent_method = CASE
           WHEN v_consent_changed THEN 'one_click'
           ELSE email_consent_method
         END,
         email_consent_ip = CASE
           WHEN v_consent_changed THEN p_ip_address
           ELSE email_consent_ip
         END,
         email_consent_details = CASE
           WHEN v_consent_changed THEN jsonb_build_object(
             'source', 'unsubscribe_link',
             'captured_at', v_now,
             'token_purpose', v_token.purpose,
             'user_agent', p_user_agent
           )
           ELSE email_consent_details
         END,
         updated_at = v_now
   WHERE id = v_customer.id
     AND tenant_id = v_customer.tenant_id;

  INSERT INTO public.suppression_list (
    tenant_id,
    customer_id,
    email,
    suppression_type,
    channel,
    reason,
    auto_suppressed,
    suppressed_at,
    lifted_at,
    updated_at
  ) VALUES (
    v_customer.tenant_id,
    v_customer.id,
    v_email,
    'unsubscribed',
    'email',
    'unsubscribe_link',
    false,
    v_now,
    NULL,
    v_now
  )
  ON CONFLICT (tenant_id, email, channel, suppression_type)
  DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    reason = EXCLUDED.reason,
    auto_suppressed = false,
    suppressed_at = v_now,
    lifted_at = NULL,
    lifted_by = NULL,
    updated_at = v_now;

  IF v_consent_changed THEN
    INSERT INTO public.crm_email_consent_events (
      tenant_id,
      customer_id,
      email,
      event_type,
      source,
      user_agent,
      ip_address
    ) VALUES (
      v_customer.tenant_id,
      v_customer.id,
      v_email,
      'opt_out',
      'unsubscribe_link',
      p_user_agent,
      p_ip_address
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenantId', v_customer.tenant_id,
    'customerId', v_customer.id,
    'email', v_email,
    'consentChanged', v_consent_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_customer_by_preference_token(
  TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_customer_by_preference_token(
  TEXT, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';
