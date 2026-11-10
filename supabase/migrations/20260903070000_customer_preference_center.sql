-- Customer preference-center updates must change profile data, consent audit,
-- and suppression state atomically. Only service-role Edge Functions may call
-- this RPC; the public page itself never receives database access.

CREATE OR REPLACE FUNCTION public.update_customer_preference_center(
  p_token TEXT,
  p_email_opt_in BOOLEAN,
  p_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_gardening_experience TEXT DEFAULT NULL,
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
  v_allowed_topics CONSTANT TEXT[] := ARRAY[
    'houseplants',
    'vegetable_gardening',
    'annuals',
    'perennials',
    'trees_shrubs',
    'native_plants',
    'pollinators',
    'containers',
    'workshops',
    'deals_promotions'
  ]::TEXT[];
  v_topics TEXT[];
  v_email TEXT;
  v_now TIMESTAMPTZ := now();
  v_custom_fields JSONB;
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

  SELECT COALESCE(array_agg(topic ORDER BY topic), ARRAY[]::TEXT[])
    INTO v_topics
    FROM (
      SELECT DISTINCT btrim(value) AS topic
        FROM unnest(COALESCE(p_topics, ARRAY[]::TEXT[])) AS value
       WHERE btrim(value) = ANY(v_allowed_topics)
    ) allowed;

  IF p_gardening_experience IS NOT NULL
     AND p_gardening_experience NOT IN ('beginner', 'intermediate', 'experienced') THEN
    RAISE EXCEPTION 'Invalid gardening experience';
  END IF;

  v_email := lower(btrim(COALESCE(v_customer.email, v_token.email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  v_consent_changed := v_customer.email_opt_in IS DISTINCT FROM p_email_opt_in;
  v_custom_fields := COALESCE(v_customer.custom_fields, '{}'::JSONB)
    || jsonb_build_object(
      'customer_selected_interests', to_jsonb(v_topics),
      'gardening_experience', to_jsonb(p_gardening_experience),
      'preference_center_source', 'customer',
      'preference_center_updated_at', v_now,
      'interest_houseplants', 'houseplants' = ANY(v_topics),
      'interest_vegetable_gardening', 'vegetable_gardening' = ANY(v_topics),
      'interest_annuals', 'annuals' = ANY(v_topics),
      'interest_perennials', 'perennials' = ANY(v_topics),
      'interest_trees_shrubs', 'trees_shrubs' = ANY(v_topics),
      'interest_native_plants', 'native_plants' = ANY(v_topics),
      'interest_pollinators', 'pollinators' = ANY(v_topics),
      'interest_containers', 'containers' = ANY(v_topics),
      'interest_workshops', 'workshops' = ANY(v_topics),
      'interest_deals_promotions', 'deals_promotions' = ANY(v_topics)
    );

  UPDATE public.crm_customers
     SET custom_fields = v_custom_fields,
         email_opt_in = p_email_opt_in,
         opt_out = NOT p_email_opt_in,
         email_opt_in_at = CASE
           WHEN p_email_opt_in AND v_consent_changed THEN v_now
           ELSE email_opt_in_at
         END,
         email_opt_out_at = CASE
           WHEN NOT p_email_opt_in AND v_consent_changed THEN v_now
           WHEN p_email_opt_in AND v_consent_changed THEN NULL
           ELSE email_opt_out_at
         END,
         email_consent_source = CASE
           WHEN v_consent_changed THEN 'preference_center'
           ELSE email_consent_source
         END,
         email_consent_method = CASE
           WHEN v_consent_changed THEN 'token_link'
           ELSE email_consent_method
         END,
         email_consent_ip = CASE
           WHEN v_consent_changed THEN p_ip_address
           ELSE email_consent_ip
         END,
         email_consent_details = CASE
           WHEN v_consent_changed THEN jsonb_build_object(
             'source', 'preference_center',
             'captured_at', v_now,
             'token_purpose', v_token.purpose,
             'user_agent', p_user_agent
           )
           ELSE email_consent_details
         END,
         updated_at = v_now
   WHERE id = v_customer.id
     AND tenant_id = v_customer.tenant_id;

  IF p_email_opt_in THEN
    -- Explicit preference-center opt-in lifts only an unsubscribe. Bounce and
    -- complaint suppressions remain active and cannot be cleared here.
    UPDATE public.suppression_list
       SET lifted_at = v_now,
           lifted_by = NULL,
           updated_at = v_now
     WHERE tenant_id = v_customer.tenant_id
       AND lower(email) = v_email
       AND channel = 'email'
       AND suppression_type = 'unsubscribed'
       AND lifted_at IS NULL;
  ELSE
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
      'preference_center_opt_out',
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
  END IF;

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
      CASE WHEN p_email_opt_in THEN 'opt_in' ELSE 'opt_out' END,
      'preference_center',
      p_user_agent,
      p_ip_address
    );
  END IF;

  RETURN jsonb_build_object(
    'emailOptIn', p_email_opt_in,
    'interests', to_jsonb(v_topics),
    'gardeningExperience', p_gardening_experience,
    'consentChanged', v_consent_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_customer_preference_center(
  TEXT, BOOLEAN, TEXT[], TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_preference_center(
  TEXT, BOOLEAN, TEXT[], TEXT, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';
