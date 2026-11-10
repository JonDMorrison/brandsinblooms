-- Give provider-native customer syncs the same canonical identity guarantees
-- as the shared POS pipeline. Provider IDs outrank email and phone, duplicate
-- provider IDs are quarantined for review, and consent is never modified.

ALTER TABLE public.crm_customer_identity_links
  DROP CONSTRAINT IF EXISTS crm_customer_identity_links_link_method_check;
ALTER TABLE public.crm_customer_identity_links
  ADD CONSTRAINT crm_customer_identity_links_link_method_check
  CHECK (link_method IN (
    'external_id', 'provider_external_id', 'email', 'phone',
    'email_with_conflict', 'phone_with_conflict', 'created'
  ));

CREATE OR REPLACE FUNCTION public.resolve_provider_customer_identity(
  p_tenant_id uuid,
  p_provider text,
  p_external_id text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_profile jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider text := lower(btrim(p_provider));
  v_external_id text := btrim(p_external_id);
  v_candidates uuid[] := '{}'::uuid[];
  v_customer_id uuid;
  v_result jsonb;
  v_fingerprint text;
  v_conflict_id uuid;
BEGIN
  IF p_tenant_id IS NULL
     OR v_provider NOT IN ('square', 'clover')
     OR v_external_id = '' THEN
    RAISE EXCEPTION 'tenant_id, supported provider, and external_id are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':provider:' || v_provider || ':' || v_external_id,
    0
  ));

  SELECT coalesce(array_agg(c.id ORDER BY c.created_at, c.id), '{}'::uuid[])
    INTO v_candidates
  FROM public.crm_customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND CASE v_provider
      WHEN 'square' THEN c.square_customer_id = v_external_id
      WHEN 'clover' THEN c.clover_customer_id = v_external_id
      ELSE false
    END;

  IF cardinality(v_candidates) > 1 THEN
    v_fingerprint := md5(
      v_provider || ':provider:' || p_tenant_id::text || ':' ||
      v_external_id || ':' || array_to_string(v_candidates, ',')
    );

    INSERT INTO public.crm_customer_merge_suggestions (
      tenant_id, provider, external_id, normalized_email, normalized_phone,
      candidate_customer_ids, reason, fingerprint
    ) VALUES (
      p_tenant_id, v_provider, v_external_id,
      public.normalize_customer_email(p_email),
      public.normalize_customer_phone(p_phone),
      v_candidates, 'ambiguous_external_id', v_fingerprint
    ) ON CONFLICT DO NOTHING
    RETURNING id INTO v_conflict_id;

    IF v_conflict_id IS NULL THEN
      SELECT id INTO v_conflict_id
      FROM public.crm_customer_merge_suggestions
      WHERE tenant_id = p_tenant_id
        AND fingerprint = v_fingerprint
        AND status = 'open';
    END IF;

    RETURN jsonb_build_object(
      'customer_id', NULL,
      'match_method', 'ambiguous_provider_external_id',
      'created', false,
      'conflict_id', v_conflict_id
    );
  END IF;

  IF cardinality(v_candidates) = 1 THEN
    v_customer_id := v_candidates[1];

    INSERT INTO public.crm_customer_identity_links (
      tenant_id, crm_customer_id, provider, external_id,
      normalized_email, normalized_phone, link_method, confidence_score,
      source_payload
    ) VALUES (
      p_tenant_id, v_customer_id, v_provider, v_external_id,
      public.normalize_customer_email(p_email),
      public.normalize_customer_phone(p_phone),
      'provider_external_id', 1.000, coalesce(p_profile, '{}'::jsonb)
    ) ON CONFLICT DO NOTHING;
  END IF;

  v_result := public.resolve_crm_customer_identity(
    p_tenant_id,
    v_provider,
    v_external_id,
    NULL,
    NULL,
    p_email,
    p_phone,
    p_user_id,
    p_profile
  );

  v_customer_id := nullif(v_result->>'customer_id', '')::uuid;
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.crm_customers c
    SET square_customer_id = CASE
          WHEN v_provider = 'square' THEN v_external_id
          ELSE c.square_customer_id
        END,
        clover_customer_id = CASE
          WHEN v_provider = 'clover' THEN v_external_id
          ELSE c.clover_customer_id
        END,
        pos_source = coalesce(c.pos_source, v_provider),
        updated_at = now()
    WHERE c.id = v_customer_id
      AND c.tenant_id = p_tenant_id;
  END IF;

  RETURN v_result || jsonb_build_object('provider', v_provider);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_provider_customer_identity(
  uuid, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_provider_customer_identity(
  uuid, text, text, text, text, uuid, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_provider_customer_identity_batch(
  p_tenant_id uuid,
  p_provider text,
  p_user_id uuid,
  p_customers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_resolved integer := 0;
  v_created integer := 0;
  v_ambiguous integer := 0;
  v_failed integer := 0;
BEGIN
  IF jsonb_typeof(p_customers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'customers must be a JSON array';
  END IF;

  FOR v_customer IN SELECT value FROM jsonb_array_elements(p_customers)
  LOOP
    v_total := v_total + 1;
    BEGIN
      v_result := public.resolve_provider_customer_identity(
        p_tenant_id,
        p_provider,
        v_customer->>'external_id',
        v_customer->>'email',
        v_customer->>'phone',
        p_user_id,
        jsonb_build_object(
          'first_name', nullif(v_customer->>'first_name', ''),
          'last_name', nullif(v_customer->>'last_name', ''),
          'custom_fields', jsonb_build_object(
            'pos_tags', coalesce(v_customer->'tags', '[]'::jsonb),
            'provider_created_at', v_customer->>'created_at',
            'provider_updated_at', v_customer->>'updated_at'
          )
        )
      );

      IF v_result->>'customer_id' IS NULL THEN
        v_ambiguous := v_ambiguous + 1;
      ELSE
        v_resolved := v_resolved + 1;
        IF coalesce((v_result->>'created')::boolean, false) THEN
          v_created := v_created + 1;
        END IF;
      END IF;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'external_id', v_customer->>'external_id',
        'result', v_result
      ));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'external_id', v_customer->>'external_id',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'resolved', v_resolved,
    'created', v_created,
    'ambiguous', v_ambiguous,
    'failed', v_failed,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_provider_customer_identity_batch(
  uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_provider_customer_identity_batch(
  uuid, text, uuid, jsonb
) TO service_role;

