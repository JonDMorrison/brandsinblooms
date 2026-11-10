-- Canonical, tenant-scoped customer identity resolution for every POS source.
-- External POS identity is authoritative; normalized email and mobile are
-- secondary signals. Ambiguous or contradictory signals are recorded for
-- review instead of silently merging two people.

CREATE OR REPLACE FUNCTION public.normalize_customer_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT nullif(lower(btrim(p_email)), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_customer_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 11
      AND left(regexp_replace(p_phone, '[^0-9]', '', 'g'), 1) = '1'
      THEN right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 10)
    WHEN length(regexp_replace(p_phone, '[^0-9]', '', 'g')) BETWEEN 8 AND 15
      THEN regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE null
  END;
$$;

CREATE TABLE IF NOT EXISTS public.crm_customer_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  crm_customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  pos_connection_id uuid REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  pos_customer_id uuid REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  normalized_email text,
  normalized_phone text,
  link_method text NOT NULL CHECK (link_method IN (
    'external_id', 'email', 'phone', 'email_with_conflict',
    'phone_with_conflict', 'created'
  )),
  confidence_score numeric(4,3) NOT NULL CHECK (
    confidence_score >= 0 AND confidence_score <= 1
  ),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_customer_identity_external_unique
  ON public.crm_customer_identity_links (
    tenant_id,
    provider,
    coalesce(pos_connection_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS crm_customer_identity_pos_customer_unique
  ON public.crm_customer_identity_links (tenant_id, pos_customer_id)
  WHERE pos_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_customer_identity_customer_idx
  ON public.crm_customer_identity_links (tenant_id, crm_customer_id);

CREATE TABLE IF NOT EXISTS public.crm_customer_merge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  pos_connection_id uuid REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  external_id text,
  normalized_email text,
  normalized_phone text,
  candidate_customer_ids uuid[] NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'email_phone_disagree', 'ambiguous_email', 'ambiguous_phone',
    'external_identity_signal_conflict'
  )),
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'merged')),
  resolution jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_customer_merge_suggestions_open_unique
  ON public.crm_customer_merge_suggestions (tenant_id, fingerprint)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS crm_customer_merge_suggestions_status_idx
  ON public.crm_customer_merge_suggestions (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_customer_identity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  identity_link_id uuid REFERENCES public.crm_customer_identity_links(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'linked', 'created', 'contact_updated', 'conflict_detected'
  )),
  provider text NOT NULL,
  external_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_customer_identity_events_customer_idx
  ON public.crm_customer_identity_events (tenant_id, crm_customer_id, created_at DESC);

ALTER TABLE public.crm_customer_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_merge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_identity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_customer_identity_links_select_tenant
  ON public.crm_customer_identity_links;
CREATE POLICY crm_customer_identity_links_select_tenant
  ON public.crm_customer_identity_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.tenant_id = crm_customer_identity_links.tenant_id
  ));

DROP POLICY IF EXISTS crm_customer_merge_suggestions_select_tenant
  ON public.crm_customer_merge_suggestions;
CREATE POLICY crm_customer_merge_suggestions_select_tenant
  ON public.crm_customer_merge_suggestions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.tenant_id = crm_customer_merge_suggestions.tenant_id
  ));

DROP POLICY IF EXISTS crm_customer_identity_events_select_tenant
  ON public.crm_customer_identity_events;
CREATE POLICY crm_customer_identity_events_select_tenant
  ON public.crm_customer_identity_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.tenant_id = crm_customer_identity_events.tenant_id
  ));

REVOKE ALL ON public.crm_customer_identity_links FROM anon, authenticated;
REVOKE ALL ON public.crm_customer_merge_suggestions FROM anon, authenticated;
REVOKE ALL ON public.crm_customer_identity_events FROM anon, authenticated;
GRANT SELECT ON public.crm_customer_identity_links TO authenticated;
GRANT SELECT ON public.crm_customer_merge_suggestions TO authenticated;
GRANT SELECT ON public.crm_customer_identity_events TO authenticated;
GRANT ALL ON public.crm_customer_identity_links TO service_role;
GRANT ALL ON public.crm_customer_merge_suggestions TO service_role;
GRANT ALL ON public.crm_customer_identity_events TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_crm_customer_identity(
  p_tenant_id uuid,
  p_provider text,
  p_external_id text,
  p_pos_connection_id uuid DEFAULT NULL,
  p_pos_customer_id uuid DEFAULT NULL,
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
  v_email text := public.normalize_customer_email(p_email);
  v_phone text := public.normalize_customer_phone(p_phone);
  v_customer_id uuid;
  v_link_id uuid;
  v_link_method text;
  v_confidence numeric(4,3);
  v_created boolean := false;
  v_conflict_id uuid;
  v_email_ids uuid[] := '{}'::uuid[];
  v_phone_ids uuid[] := '{}'::uuid[];
  v_candidates uuid[] := '{}'::uuid[];
  v_existing_email text;
  v_existing_phone text;
  v_placeholder_email text;
  v_fingerprint text;
BEGIN
  IF p_tenant_id IS NULL OR v_provider = '' OR v_external_id = '' THEN
    RAISE EXCEPTION 'tenant_id, provider, and external_id are required';
  END IF;

  IF p_pos_connection_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pos_connections pc
    WHERE pc.id = p_pos_connection_id AND pc.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'POS connection does not belong to tenant';
  END IF;

  IF p_pos_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.pos_customers pc
    JOIN public.pos_connections conn ON conn.id = pc.pos_connection_id
    WHERE pc.id = p_pos_customer_id
      AND conn.tenant_id = p_tenant_id
      AND (p_pos_connection_id IS NULL OR conn.id = p_pos_connection_id)
  ) THEN
    RAISE EXCEPTION 'POS customer does not belong to tenant or connection';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':' || v_provider || ':' ||
    coalesce(p_pos_connection_id::text, '') || ':' || v_external_id,
    0
  ));

  SELECT l.id, l.crm_customer_id
    INTO v_link_id, v_customer_id
  FROM public.crm_customer_identity_links l
  WHERE l.tenant_id = p_tenant_id
    AND l.provider = v_provider
    AND l.pos_connection_id IS NOT DISTINCT FROM p_pos_connection_id
    AND l.external_id = v_external_id
  LIMIT 1;

  SELECT coalesce(array_agg(c.id ORDER BY c.created_at), '{}'::uuid[])
    INTO v_email_ids
  FROM public.crm_customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND v_email IS NOT NULL
    AND public.normalize_customer_email(c.email) = v_email;

  SELECT coalesce(array_agg(c.id ORDER BY c.created_at), '{}'::uuid[])
    INTO v_phone_ids
  FROM public.crm_customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND v_phone IS NOT NULL
    AND public.normalize_customer_phone(c.phone) = v_phone;

  IF v_customer_id IS NOT NULL THEN
    v_link_method := 'external_id';
    v_confidence := 1.000;
    v_candidates := ARRAY(
      SELECT DISTINCT candidate
      FROM unnest(v_email_ids || v_phone_ids) candidate
      WHERE candidate <> v_customer_id
    );

    IF cardinality(v_candidates) > 0 THEN
      v_fingerprint := md5(
        v_provider || ':' || coalesce(p_pos_connection_id::text, '') || ':' ||
        v_external_id || ':external:' || array_to_string(v_candidates, ',')
      );
      INSERT INTO public.crm_customer_merge_suggestions (
        tenant_id, provider, pos_connection_id, external_id,
        normalized_email, normalized_phone, candidate_customer_ids,
        reason, fingerprint
      ) VALUES (
        p_tenant_id, v_provider, p_pos_connection_id, v_external_id,
        v_email, v_phone, array_prepend(v_customer_id, v_candidates),
        'external_identity_signal_conflict', v_fingerprint
      ) ON CONFLICT DO NOTHING
      RETURNING id INTO v_conflict_id;

      IF v_conflict_id IS NULL THEN
        SELECT id INTO v_conflict_id
        FROM public.crm_customer_merge_suggestions
        WHERE tenant_id = p_tenant_id AND fingerprint = v_fingerprint AND status = 'open';
      END IF;
    END IF;
  ELSE
    IF cardinality(v_email_ids) = 1 AND cardinality(v_phone_ids) = 1
       AND v_email_ids[1] <> v_phone_ids[1] THEN
      v_customer_id := v_email_ids[1];
      v_link_method := 'email_with_conflict';
      v_confidence := 0.850;
      v_candidates := ARRAY[v_email_ids[1], v_phone_ids[1]];
      v_fingerprint := md5(
        v_provider || ':' || coalesce(p_pos_connection_id::text, '') || ':' ||
        v_external_id || ':disagree:' || array_to_string(v_candidates, ',')
      );
      INSERT INTO public.crm_customer_merge_suggestions (
        tenant_id, provider, pos_connection_id, external_id,
        normalized_email, normalized_phone, candidate_customer_ids,
        reason, fingerprint
      ) VALUES (
        p_tenant_id, v_provider, p_pos_connection_id, v_external_id,
        v_email, v_phone, v_candidates, 'email_phone_disagree', v_fingerprint
      ) ON CONFLICT DO NOTHING
      RETURNING id INTO v_conflict_id;
    ELSIF cardinality(v_email_ids) = 1 THEN
      v_customer_id := v_email_ids[1];
      v_link_method := CASE WHEN cardinality(v_phone_ids) > 1
        THEN 'email_with_conflict' ELSE 'email' END;
      v_confidence := CASE WHEN cardinality(v_phone_ids) > 1 THEN 0.850 ELSE 0.980 END;
    ELSIF cardinality(v_phone_ids) = 1 THEN
      v_customer_id := v_phone_ids[1];
      v_link_method := CASE WHEN cardinality(v_email_ids) > 1
        THEN 'phone_with_conflict' ELSE 'phone' END;
      v_confidence := CASE WHEN cardinality(v_email_ids) > 1 THEN 0.800 ELSE 0.900 END;
    ELSIF cardinality(v_email_ids) > 1 OR cardinality(v_phone_ids) > 1 THEN
      v_candidates := ARRAY(
        SELECT DISTINCT candidate FROM unnest(v_email_ids || v_phone_ids) candidate
      );
      v_fingerprint := md5(
        v_provider || ':' || coalesce(p_pos_connection_id::text, '') || ':' ||
        v_external_id || ':ambiguous:' || array_to_string(v_candidates, ',')
      );
      INSERT INTO public.crm_customer_merge_suggestions (
        tenant_id, provider, pos_connection_id, external_id,
        normalized_email, normalized_phone, candidate_customer_ids,
        reason, fingerprint
      ) VALUES (
        p_tenant_id, v_provider, p_pos_connection_id, v_external_id,
        v_email, v_phone, v_candidates,
        CASE WHEN cardinality(v_email_ids) > 1 THEN 'ambiguous_email'
             ELSE 'ambiguous_phone' END,
        v_fingerprint
      ) ON CONFLICT DO NOTHING
      RETURNING id INTO v_conflict_id;

      IF v_conflict_id IS NULL THEN
        SELECT id INTO v_conflict_id
        FROM public.crm_customer_merge_suggestions
        WHERE tenant_id = p_tenant_id AND fingerprint = v_fingerprint AND status = 'open';
      END IF;

      INSERT INTO public.crm_customer_identity_events (
        tenant_id, event_type, provider, external_id, details
      ) VALUES (
        p_tenant_id, 'conflict_detected', v_provider, v_external_id,
        jsonb_build_object('conflict_id', v_conflict_id, 'candidates', v_candidates)
      );

      RETURN jsonb_build_object(
        'customer_id', NULL,
        'match_method', 'ambiguous',
        'created', false,
        'conflict_id', v_conflict_id
      );
    ELSE
      v_placeholder_email := v_provider || '-' || substr(md5(
        p_tenant_id::text || ':' || coalesce(p_pos_connection_id::text, '') || ':' || v_external_id
      ), 1, 24) || '@noemail.local';

      INSERT INTO public.crm_customers (
        tenant_id, user_id, email, phone, first_name, last_name,
        email_opt_in, sms_opt_in, pos_source, external_id, custom_fields
      ) VALUES (
        p_tenant_id,
        p_user_id,
        coalesce(v_email, v_placeholder_email),
        p_phone,
        nullif(btrim(p_profile->>'first_name'), ''),
        nullif(btrim(p_profile->>'last_name'), ''),
        false,
        false,
        v_provider,
        v_external_id,
        coalesce(p_profile->'custom_fields', '{}'::jsonb) ||
          CASE WHEN v_email IS NULL THEN jsonb_build_object('email_is_placeholder', true)
               ELSE '{}'::jsonb END
      )
      RETURNING id INTO v_customer_id;

      v_created := true;
      v_link_method := 'created';
      v_confidence := 1.000;
    END IF;
  END IF;

  SELECT c.email, c.phone INTO v_existing_email, v_existing_phone
  FROM public.crm_customers c
  WHERE c.id = v_customer_id AND c.tenant_id = p_tenant_id
  FOR UPDATE;

  -- The same external POS identity may report corrected contact information.
  -- Update it only when it does not belong to another customer. Consent and
  -- opt-out fields are intentionally untouched.
  UPDATE public.crm_customers c
  SET
    email = CASE
      WHEN v_email IS NOT NULL
       AND public.normalize_customer_email(c.email) IS DISTINCT FROM v_email
       AND NOT EXISTS (
         SELECT 1 FROM public.crm_customers other
         WHERE other.tenant_id = p_tenant_id
           AND other.id <> c.id
           AND other.deleted_at IS NULL
           AND public.normalize_customer_email(other.email) = v_email
       ) THEN v_email
      ELSE c.email
    END,
    phone = CASE
      WHEN p_phone IS NOT NULL AND v_conflict_id IS NULL THEN p_phone
      ELSE c.phone
    END,
    first_name = coalesce(c.first_name, nullif(btrim(p_profile->>'first_name'), '')),
    last_name = coalesce(c.last_name, nullif(btrim(p_profile->>'last_name'), '')),
    custom_fields = coalesce(c.custom_fields, '{}'::jsonb) ||
      coalesce(p_profile->'custom_fields', '{}'::jsonb),
    updated_at = now()
  WHERE c.id = v_customer_id AND c.tenant_id = p_tenant_id;

  IF v_link_id IS NULL THEN
    INSERT INTO public.crm_customer_identity_links (
      tenant_id, crm_customer_id, provider, pos_connection_id,
      pos_customer_id, external_id, normalized_email, normalized_phone,
      link_method, confidence_score, source_payload
    ) VALUES (
      p_tenant_id, v_customer_id, v_provider, p_pos_connection_id,
      p_pos_customer_id, v_external_id, v_email, v_phone,
      v_link_method, v_confidence, coalesce(p_profile, '{}'::jsonb)
    ) RETURNING id INTO v_link_id;
  ELSE
    UPDATE public.crm_customer_identity_links
    SET pos_customer_id = coalesce(p_pos_customer_id, pos_customer_id),
        normalized_email = coalesce(v_email, normalized_email),
        normalized_phone = coalesce(v_phone, normalized_phone),
        last_seen_at = now(),
        source_payload = source_payload || coalesce(p_profile, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_link_id;
  END IF;

  INSERT INTO public.crm_customer_identity_events (
    tenant_id, crm_customer_id, identity_link_id, event_type,
    provider, external_id, details
  ) VALUES (
    p_tenant_id, v_customer_id, v_link_id,
    CASE WHEN v_created THEN 'created' ELSE 'linked' END,
    v_provider, v_external_id,
    jsonb_build_object(
      'match_method', v_link_method,
      'confidence_score', v_confidence,
      'conflict_id', v_conflict_id
    )
  );

  IF (v_email IS NOT NULL AND public.normalize_customer_email(v_existing_email) IS DISTINCT FROM v_email)
     OR (v_phone IS NOT NULL AND public.normalize_customer_phone(v_existing_phone) IS DISTINCT FROM v_phone) THEN
    INSERT INTO public.crm_customer_identity_events (
      tenant_id, crm_customer_id, identity_link_id, event_type,
      provider, external_id, details
    ) VALUES (
      p_tenant_id, v_customer_id, v_link_id, 'contact_updated',
      v_provider, v_external_id,
      jsonb_build_object(
        'previous_email', v_existing_email,
        'reported_email', v_email,
        'previous_phone', v_existing_phone,
        'reported_phone', p_phone
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'identity_link_id', v_link_id,
    'match_method', v_link_method,
    'confidence_score', v_confidence,
    'created', v_created,
    'conflict_id', v_conflict_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_crm_customer_identity(
  uuid, text, text, uuid, uuid, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_crm_customer_identity(
  uuid, text, text, uuid, uuid, text, text, uuid, jsonb
) TO service_role;

COMMENT ON FUNCTION public.resolve_crm_customer_identity(
  uuid, text, text, uuid, uuid, text, text, uuid, jsonb
) IS 'Resolves a POS identity to one CRM customer without changing consent; ambiguous signals create a merge suggestion.';
