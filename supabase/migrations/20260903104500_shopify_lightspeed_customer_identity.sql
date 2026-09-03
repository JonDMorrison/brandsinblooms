-- Make Shopify and Lightspeed customer IDs authoritative, provider-scoped
-- identity keys. The resolver reads the provider row that was already stored,
-- preserves all BloomSuite consent/suppression state, and writes the canonical
-- CRM contact back to the provider table.

CREATE OR REPLACE FUNCTION public.resolve_external_provider_customer_identity(
  p_tenant_id uuid,
  p_provider text,
  p_external_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider text := lower(btrim(p_provider));
  v_external_id text := btrim(p_external_id);
  v_provider_row jsonb;
  v_candidates uuid[] := '{}'::uuid[];
  v_customer_id uuid;
  v_result jsonb;
  v_fingerprint text;
  v_conflict_id uuid;
  v_tags text[] := '{}'::text[];
BEGIN
  IF p_tenant_id IS NULL
     OR v_provider NOT IN ('shopify', 'lightspeed')
     OR v_external_id = '' THEN
    RAISE EXCEPTION 'tenant_id, supported provider, and external_id are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':external-provider:' || v_provider || ':' || v_external_id,
    0
  ));

  IF v_provider = 'shopify' THEN
    SELECT to_jsonb(c) INTO v_provider_row
    FROM public.shopify_customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.shopify_customer_id = v_external_id;
  ELSE
    SELECT to_jsonb(c) INTO v_provider_row
    FROM public.lightspeed_customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.lightspeed_customer_id = v_external_id;
  END IF;

  IF v_provider_row IS NULL THEN
    RAISE EXCEPTION 'provider customer does not belong to tenant';
  END IF;

  -- Preserve deterministic links made by the legacy importers before the
  -- identity ledger existed. Conflicting provider links are quarantined.
  SELECT coalesce(array_agg(DISTINCT candidate ORDER BY candidate), '{}'::uuid[])
    INTO v_candidates
  FROM (
    SELECT nullif(v_provider_row->>'contact_id', '')::uuid AS candidate
    UNION ALL
    SELECT c.id
    FROM public.crm_customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.deleted_at IS NULL
      AND c.pos_source = v_provider
      AND c.external_id = v_external_id
  ) candidates
  JOIN public.crm_customers c
    ON c.id = candidate
   AND c.tenant_id = p_tenant_id
   AND c.deleted_at IS NULL;

  IF cardinality(v_candidates) > 1 THEN
    v_fingerprint := md5(
      v_provider || ':external-provider:' || p_tenant_id::text || ':' ||
      v_external_id || ':' || array_to_string(v_candidates, ',')
    );

    INSERT INTO public.crm_customer_merge_suggestions (
      tenant_id, provider, external_id, normalized_email, normalized_phone,
      candidate_customer_ids, reason, fingerprint
    ) VALUES (
      p_tenant_id, v_provider, v_external_id,
      public.normalize_customer_email(v_provider_row->>'email'),
      public.normalize_customer_phone(v_provider_row->>'phone'),
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

    -- A legacy contact_id is not safe when provider-native evidence points at
    -- more than one CRM profile. Quarantine the row until the merge suggestion
    -- is resolved so orders cannot continue attaching to a guessed customer.
    IF v_provider = 'shopify' THEN
      UPDATE public.shopify_customers
      SET contact_id = NULL,
          updated_at = now()
      WHERE tenant_id = p_tenant_id
        AND shopify_customer_id = v_external_id;
      UPDATE public.shopify_orders
      SET contact_id = NULL
      WHERE tenant_id = p_tenant_id
        AND shopify_customer_id = v_external_id;
    ELSE
      UPDATE public.lightspeed_customers
      SET contact_id = NULL,
          updated_at = now()
      WHERE tenant_id = p_tenant_id
        AND lightspeed_customer_id = v_external_id;
      UPDATE public.lightspeed_sales
      SET contact_id = NULL
      WHERE tenant_id = p_tenant_id
        AND lightspeed_customer_id = v_external_id;
    END IF;

    RETURN jsonb_build_object(
      'customer_id', NULL,
      'match_method', 'ambiguous_provider_external_id',
      'created', false,
      'conflict_id', v_conflict_id,
      'provider', v_provider
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
      public.normalize_customer_email(v_provider_row->>'email'),
      public.normalize_customer_phone(v_provider_row->>'phone'),
      'provider_external_id', 1.000,
      jsonb_build_object('provider_customer', v_provider_row)
    ) ON CONFLICT DO NOTHING;
  END IF;

  v_result := public.resolve_crm_customer_identity(
    p_tenant_id,
    v_provider,
    v_external_id,
    NULL,
    NULL,
    v_provider_row->>'email',
    v_provider_row->>'phone',
    p_user_id,
    jsonb_build_object(
      'first_name', nullif(v_provider_row->>'first_name', ''),
      'last_name', nullif(v_provider_row->>'last_name', ''),
      'custom_fields', jsonb_build_object(
        'provider', v_provider,
        'provider_customer_id', v_external_id,
        'provider_accepts_marketing', CASE
          WHEN v_provider = 'shopify' THEN v_provider_row->'accepts_marketing'
          ELSE NULL
        END,
        'provider_customer_group_id', CASE
          WHEN v_provider = 'lightspeed' THEN v_provider_row->'customer_group_id'
          ELSE NULL
        END
      )
    )
  );

  v_customer_id := nullif(v_result->>'customer_id', '')::uuid;
  IF v_customer_id IS NULL THEN
    RETURN v_result || jsonb_build_object('provider', v_provider);
  END IF;

  IF jsonb_typeof(v_provider_row->'tags') = 'array' THEN
    v_tags := ARRAY(
      SELECT jsonb_array_elements_text(v_provider_row->'tags')
    );
  END IF;

  IF v_provider = 'shopify' THEN
    UPDATE public.shopify_customers
    SET contact_id = v_customer_id,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND shopify_customer_id = v_external_id;

    UPDATE public.shopify_orders
    SET contact_id = v_customer_id
    WHERE tenant_id = p_tenant_id
      AND shopify_customer_id = v_external_id
      AND contact_id IS DISTINCT FROM v_customer_id;

    UPDATE public.crm_customers c
    SET total_spent = coalesce(
          nullif(v_provider_row->>'total_spent', '')::numeric,
          c.total_spent
        ),
        lifetime_value = coalesce(
          nullif(v_provider_row->>'total_spent', '')::numeric,
          c.lifetime_value
        ),
        tags = ARRAY(
          SELECT DISTINCT tag
          FROM unnest(coalesce(c.tags, '{}'::text[]) || v_tags) tag
          WHERE tag IS NOT NULL AND tag <> ''
        ),
        pos_source = coalesce(c.pos_source, 'shopify'),
        updated_at = now()
    WHERE c.id = v_customer_id
      AND c.tenant_id = p_tenant_id;
  ELSE
    UPDATE public.lightspeed_customers
    SET contact_id = v_customer_id,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND lightspeed_customer_id = v_external_id;

    UPDATE public.lightspeed_sales
    SET contact_id = v_customer_id
    WHERE tenant_id = p_tenant_id
      AND lightspeed_customer_id = v_external_id
      AND contact_id IS DISTINCT FROM v_customer_id;

    UPDATE public.crm_customers c
    SET total_spent = coalesce(
          nullif(v_provider_row->>'total_spend', '')::numeric,
          c.total_spent
        ),
        lifetime_value = coalesce(
          nullif(v_provider_row->>'total_spend', '')::numeric,
          c.lifetime_value
        ),
        loyalty_rewards_balance = coalesce(
          nullif(v_provider_row->>'loyalty_balance', '')::numeric,
          c.loyalty_rewards_balance
        ),
        tags = ARRAY(
          SELECT DISTINCT tag
          FROM unnest(coalesce(c.tags, '{}'::text[]) || v_tags) tag
          WHERE tag IS NOT NULL AND tag <> ''
        ),
        pos_source = coalesce(c.pos_source, 'lightspeed'),
        external_id = CASE
          WHEN c.pos_source IS NULL OR c.pos_source = 'lightspeed'
            THEN v_external_id
          ELSE c.external_id
        END,
        updated_at = now()
    WHERE c.id = v_customer_id
      AND c.tenant_id = p_tenant_id;
  END IF;

  RETURN v_result || jsonb_build_object('provider', v_provider);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_external_provider_customer_identity(
  uuid, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_external_provider_customer_identity(
  uuid, text, text, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_external_provider_customer_identity_batch(
  p_tenant_id uuid,
  p_provider text,
  p_user_id uuid,
  p_external_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_external_id text;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_resolved integer := 0;
  v_created integer := 0;
  v_ambiguous integer := 0;
  v_failed integer := 0;
BEGIN
  IF jsonb_typeof(p_external_ids) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'external_ids must be a JSON array';
  END IF;

  FOR v_external_id IN
    SELECT DISTINCT btrim(value)
    FROM jsonb_array_elements_text(p_external_ids)
    WHERE nullif(btrim(value), '') IS NOT NULL
  LOOP
    v_total := v_total + 1;
    BEGIN
      v_result := public.resolve_external_provider_customer_identity(
        p_tenant_id, p_provider, v_external_id, p_user_id
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
        'external_id', v_external_id,
        'result', v_result
      ));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'external_id', v_external_id,
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

REVOKE ALL ON FUNCTION public.resolve_external_provider_customer_identity_batch(
  uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_external_provider_customer_identity_batch(
  uuid, text, uuid, jsonb
) TO service_role;

-- Orders arriving after customer resolution inherit the ledger link at write
-- time. If an order arrives first, the resolver above backfills it as soon as
-- that provider customer is resolved.
CREATE OR REPLACE FUNCTION public.attach_external_provider_order_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider text;
  v_external_id text;
  v_customer_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'shopify_orders' THEN
    v_provider := 'shopify';
    v_external_id := NEW.shopify_customer_id;
  ELSIF TG_TABLE_NAME = 'lightspeed_sales' THEN
    v_provider := 'lightspeed';
    v_external_id := NEW.lightspeed_customer_id;
  ELSE
    RETURN NEW;
  END IF;

  IF nullif(btrim(v_external_id), '') IS NULL THEN
    NEW.contact_id := NULL;
    RETURN NEW;
  END IF;

  SELECT link.crm_customer_id INTO v_customer_id
  FROM public.crm_customer_identity_links link
  WHERE link.tenant_id = NEW.tenant_id
    AND link.provider = v_provider
    AND link.pos_connection_id IS NULL
    AND link.external_id = v_external_id
  LIMIT 1;

  NEW.contact_id := v_customer_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_external_provider_order_identity()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shopify_orders_attach_identity
  ON public.shopify_orders;
CREATE TRIGGER shopify_orders_attach_identity
BEFORE INSERT OR UPDATE OF tenant_id, shopify_customer_id
ON public.shopify_orders
FOR EACH ROW
EXECUTE FUNCTION public.attach_external_provider_order_identity();

DROP TRIGGER IF EXISTS lightspeed_sales_attach_identity
  ON public.lightspeed_sales;
CREATE TRIGGER lightspeed_sales_attach_identity
BEFORE INSERT OR UPDATE OF tenant_id, lightspeed_customer_id
ON public.lightspeed_sales
FOR EACH ROW
EXECUTE FUNCTION public.attach_external_provider_order_identity();

-- Establish ledger links for the existing Lightspeed population. Seed the
-- already-deterministic legacy links set-wise, then run the full resolver only
-- for the small remainder. This keeps production migration time bounded while
-- retaining the exact same ambiguity and consent guarantees.
WITH candidate_pairs AS (
  SELECT l.tenant_id, l.lightspeed_customer_id, l.contact_id AS candidate
  FROM public.lightspeed_customers l
  JOIN public.crm_customers c
    ON c.id = l.contact_id
   AND c.tenant_id = l.tenant_id
   AND c.deleted_at IS NULL
  WHERE l.contact_id IS NOT NULL
  UNION
  SELECT l.tenant_id, l.lightspeed_customer_id, c.id
  FROM public.lightspeed_customers l
  JOIN public.crm_customers c
    ON c.tenant_id = l.tenant_id
   AND c.deleted_at IS NULL
   AND c.pos_source = 'lightspeed'
   AND c.external_id = l.lightspeed_customer_id
), deterministic AS (
  SELECT tenant_id, lightspeed_customer_id, min(candidate::text)::uuid AS customer_id
  FROM candidate_pairs
  GROUP BY tenant_id, lightspeed_customer_id
  HAVING count(DISTINCT candidate) = 1
)
INSERT INTO public.crm_customer_identity_links (
  tenant_id, crm_customer_id, provider, external_id,
  normalized_email, normalized_phone, link_method, confidence_score,
  source_payload
)
SELECT
  l.tenant_id,
  d.customer_id,
  'lightspeed',
  l.lightspeed_customer_id,
  public.normalize_customer_email(l.email),
  public.normalize_customer_phone(l.phone),
  'provider_external_id',
  1.000,
  jsonb_build_object('provider_customer_id', l.id, 'migration', true)
FROM deterministic d
JOIN public.lightspeed_customers l
  ON l.tenant_id = d.tenant_id
 AND l.lightspeed_customer_id = d.lightspeed_customer_id
ON CONFLICT DO NOTHING;

UPDATE public.lightspeed_customers l
SET contact_id = link.crm_customer_id,
    updated_at = now()
FROM public.crm_customer_identity_links link
WHERE link.tenant_id = l.tenant_id
  AND link.provider = 'lightspeed'
  AND link.pos_connection_id IS NULL
  AND link.external_id = l.lightspeed_customer_id
  AND l.contact_id IS DISTINCT FROM link.crm_customer_id;

-- Remaining rows have no deterministic legacy link (normally no-email
-- customers or a unique email-only match), so resolve them individually.
DO $$
DECLARE
  v_customer record;
BEGIN
  FOR v_customer IN
    SELECT l.tenant_id, l.lightspeed_customer_id
    FROM public.lightspeed_customers l
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.crm_customer_identity_links link
      WHERE link.tenant_id = l.tenant_id
        AND link.provider = 'lightspeed'
        AND link.pos_connection_id IS NULL
        AND link.external_id = l.lightspeed_customer_id
    )
    ORDER BY l.tenant_id, l.lightspeed_customer_id
  LOOP
    PERFORM public.resolve_external_provider_customer_identity(
      v_customer.tenant_id,
      'lightspeed',
      v_customer.lightspeed_customer_id,
      NULL
    );
  END LOOP;
END;
$$;

-- Apply the completed ledger to historical sales in one set-based pass. The
-- two unresolved provider conflicts remain deliberately unlinked.
UPDATE public.lightspeed_sales s
SET contact_id = NULL
WHERE EXISTS (
    SELECT 1
    FROM public.lightspeed_customers c
    WHERE c.tenant_id = s.tenant_id
      AND c.lightspeed_customer_id = s.lightspeed_customer_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_customer_identity_links link
    WHERE link.tenant_id = s.tenant_id
      AND link.provider = 'lightspeed'
      AND link.pos_connection_id IS NULL
      AND link.external_id = s.lightspeed_customer_id
  );

UPDATE public.lightspeed_sales s
SET contact_id = link.crm_customer_id
FROM public.crm_customer_identity_links link
WHERE link.tenant_id = s.tenant_id
  AND link.provider = 'lightspeed'
  AND link.pos_connection_id IS NULL
  AND link.external_id = s.lightspeed_customer_id
  AND s.contact_id IS DISTINCT FROM link.crm_customer_id;
