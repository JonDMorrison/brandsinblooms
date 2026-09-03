-- Turn historical identity collisions into an owner-reviewed queue. Detection
-- never merges records. A merge is explicit, audited, reversible, and delegates
-- to the existing fail-closed merge engine.

CREATE OR REPLACE FUNCTION public.seed_historical_customer_merge_suggestions(
  p_tenant_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 50000);
  v_inserted integer := 0;
  v_open integer := 0;
BEGIN
  WITH signals AS MATERIALIZED (
    SELECT
      customer.tenant_id,
      array_agg(customer.id ORDER BY customer.id) AS candidate_ids,
      public.normalize_customer_email(customer.email) AS normalized_email,
      NULL::text AS normalized_phone
    FROM public.crm_customers AS customer
    WHERE customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND public.normalize_customer_email(customer.email) IS NOT NULL
      AND (p_tenant_id IS NULL OR customer.tenant_id = p_tenant_id)
    GROUP BY customer.tenant_id, public.normalize_customer_email(customer.email)
    HAVING count(*) > 1

    UNION ALL

    SELECT
      customer.tenant_id,
      array_agg(customer.id ORDER BY customer.id) AS candidate_ids,
      NULL::text AS normalized_email,
      public.normalize_customer_phone(customer.phone) AS normalized_phone
    FROM public.crm_customers AS customer
    WHERE customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND public.normalize_customer_phone(customer.phone) IS NOT NULL
      AND (p_tenant_id IS NULL OR customer.tenant_id = p_tenant_id)
    GROUP BY customer.tenant_id, public.normalize_customer_phone(customer.phone)
    HAVING count(*) > 1
  ), combined AS (
    SELECT
      signal.tenant_id,
      signal.candidate_ids,
      max(signal.normalized_email) AS normalized_email,
      max(signal.normalized_phone) AS normalized_phone
    FROM signals AS signal
    GROUP BY signal.tenant_id, signal.candidate_ids
  ), pending AS (
    SELECT combined.*
    FROM combined
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.crm_customer_merge_suggestions AS suggestion
      WHERE suggestion.tenant_id = combined.tenant_id
        AND suggestion.status = 'open'
        AND suggestion.candidate_customer_ids = combined.candidate_ids
    )
    ORDER BY combined.tenant_id, combined.candidate_ids
    LIMIT v_limit
  ), inserted AS (
    INSERT INTO public.crm_customer_merge_suggestions (
      id,
      tenant_id,
      provider,
      normalized_email,
      normalized_phone,
      candidate_customer_ids,
      reason,
      fingerprint
    )
    SELECT
      pg_catalog.gen_random_uuid(),
      pending.tenant_id,
      'historical_scan',
      pending.normalized_email,
      pending.normalized_phone,
      pending.candidate_ids,
      CASE
        WHEN pending.normalized_email IS NOT NULL THEN 'ambiguous_email'
        ELSE 'ambiguous_phone'
      END,
      'historical:' || pg_catalog.md5(
        pending.tenant_id::text || ':' || array_to_string(pending.candidate_ids, ':')
      )
    FROM pending
    ON CONFLICT (tenant_id, fingerprint) WHERE status = 'open'
    DO UPDATE SET
      normalized_email = coalesce(
        public.crm_customer_merge_suggestions.normalized_email,
        excluded.normalized_email
      ),
      normalized_phone = coalesce(
        public.crm_customer_merge_suggestions.normalized_phone,
        excluded.normalized_phone
      ),
      updated_at = pg_catalog.now()
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  SELECT count(*)
  INTO v_open
  FROM public.crm_customer_merge_suggestions AS suggestion
  WHERE suggestion.status = 'open'
    AND (p_tenant_id IS NULL OR suggestion.tenant_id = p_tenant_id)
    AND (
      SELECT count(*)
      FROM public.crm_customers AS customer
      WHERE customer.tenant_id = suggestion.tenant_id
        AND customer.id = ANY(suggestion.candidate_customer_ids)
        AND customer.deleted_at IS NULL
        AND customer.merged_into_customer_id IS NULL
    ) >= 2;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'openCount', v_open,
    'limit', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_historical_customer_merge_suggestions(uuid, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_historical_customer_merge_suggestions(uuid, integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.scan_current_tenant_customer_duplicates(
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_tenant_id uuid;
BEGIN
  v_access := public.get_current_crm_access();
  IF v_access->>'role' <> 'owner_admin' THEN
    RAISE EXCEPTION 'Duplicate review requires owner or admin access'
      USING ERRCODE = '42501';
  END IF;

  v_tenant_id := (v_access->>'tenantId')::uuid;
  RETURN public.seed_historical_customer_merge_suggestions(
    v_tenant_id,
    least(greatest(coalesce(p_limit, 5000), 1), 5000)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_merge_review_queue(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access jsonb;
  v_tenant_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_open_count integer;
  v_items jsonb;
BEGIN
  v_access := public.get_current_crm_access();
  IF v_access->>'role' <> 'owner_admin' THEN
    RAISE EXCEPTION 'Duplicate review requires owner or admin access'
      USING ERRCODE = '42501';
  END IF;
  v_tenant_id := (v_access->>'tenantId')::uuid;

  WITH reviewable AS MATERIALIZED (
    SELECT suggestion.*
    FROM public.crm_customer_merge_suggestions AS suggestion
    WHERE suggestion.tenant_id = v_tenant_id
      AND suggestion.status = 'open'
      AND (
        SELECT count(*)
        FROM public.crm_customers AS active_customer
        WHERE active_customer.tenant_id = v_tenant_id
          AND active_customer.id = ANY(suggestion.candidate_customer_ids)
          AND active_customer.deleted_at IS NULL
          AND active_customer.merged_into_customer_id IS NULL
      ) >= 2
  ), page AS (
    SELECT reviewable.*
    FROM reviewable
    ORDER BY reviewable.created_at, reviewable.id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*) FROM reviewable),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', page.id,
        'provider', page.provider,
        'reason', page.reason,
        'normalizedEmail', page.normalized_email,
        'normalizedPhone', page.normalized_phone,
        'createdAt', page.created_at,
        'customers', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'id', customer.id,
              'firstName', customer.first_name,
              'lastName', customer.last_name,
              'email', customer.email,
              'phone', customer.phone,
              'createdAt', customer.created_at,
              'lastPurchaseDate', customer.last_purchase_date,
              'totalSpent', coalesce(customer.total_spent, customer.lifetime_value, 0),
              'emailOptIn', coalesce(customer.email_opt_in, false),
              'smsOptIn', coalesce(customer.sms_opt_in, false),
              'suppressed', coalesce(customer.suppressed, false)
                OR customer.email_opt_out_at IS NOT NULL
                OR customer.sms_opt_out_at IS NOT NULL,
              'posOrders', (
                SELECT count(*) FROM public.pos_orders AS purchase
                WHERE purchase.crm_customer_id = customer.id
              ),
              'emailSends', (
                SELECT count(*) FROM public.crm_email_sends AS email_send
                WHERE email_send.customer_id = customer.id
              ),
              'smsMessages', (
                SELECT count(*) FROM public.sms_messages AS sms
                WHERE sms.customer_id = customer.id
              ),
              'loyaltyEntries', (
                SELECT count(*) FROM public.loyalty_points_transactions AS loyalty
                WHERE loyalty.customer_id = customer.id
              ),
              'identityLinks', (
                SELECT count(*) FROM public.crm_customer_identity_links AS identity_link
                WHERE identity_link.crm_customer_id = customer.id
              )
            ) ORDER BY customer.created_at, customer.id
          ), '[]'::jsonb)
          FROM public.crm_customers AS customer
          WHERE customer.tenant_id = v_tenant_id
            AND customer.id = ANY(page.candidate_customer_ids)
            AND customer.deleted_at IS NULL
            AND customer.merged_into_customer_id IS NULL
        )
      ) ORDER BY page.created_at, page.id
    ), '[]'::jsonb)
  INTO v_open_count, v_items
  FROM page;

  RETURN jsonb_build_object(
    'openCount', coalesce(v_open_count, 0),
    'limit', v_limit,
    'offset', v_offset,
    'items', coalesce(v_items, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_customer_merge_review(
  p_suggestion_id uuid,
  p_survivor_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_access jsonb;
  v_tenant_id uuid;
  v_suggestion public.crm_customer_merge_suggestions%ROWTYPE;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_result jsonb;
  v_history_id uuid;
  v_remaining uuid[];
  v_history_ids jsonb;
BEGIN
  v_access := public.get_current_crm_access();
  IF v_access->>'role' <> 'owner_admin' THEN
    RAISE EXCEPTION 'Duplicate review requires owner or admin access'
      USING ERRCODE = '42501';
  END IF;
  v_tenant_id := (v_access->>'tenantId')::uuid;

  IF v_action NOT IN ('merge', 'dismiss')
     OR length(v_reason) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'A valid action and reason are required';
  END IF;

  SELECT suggestion.*
  INTO v_suggestion
  FROM public.crm_customer_merge_suggestions AS suggestion
  WHERE suggestion.id = p_suggestion_id
    AND suggestion.tenant_id = v_tenant_id
    AND suggestion.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open duplicate suggestion not found';
  END IF;

  IF v_action = 'dismiss' THEN
    UPDATE public.crm_customer_merge_suggestions
    SET status = 'dismissed',
        resolution = jsonb_build_object('action', 'dismissed', 'reason', v_reason),
        resolved_by = v_actor,
        resolved_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = v_suggestion.id;

    RETURN jsonb_build_object('status', 'dismissed', 'suggestionId', v_suggestion.id);
  END IF;

  IF p_survivor_customer_id IS NULL
     OR p_duplicate_customer_id IS NULL
     OR p_survivor_customer_id = p_duplicate_customer_id
     OR NOT v_suggestion.candidate_customer_ids @>
       ARRAY[p_survivor_customer_id, p_duplicate_customer_id]
  THEN
    RAISE EXCEPTION 'Choose two different customers from the suggestion';
  END IF;

  IF v_suggestion.provider IN ('lightspeed', 'shopify')
     AND nullif(btrim(v_suggestion.external_id), '') IS NOT NULL THEN
    RETURN public.merge_external_provider_customer_suggestion(
      v_suggestion.id,
      p_survivor_customer_id,
      p_duplicate_customer_id,
      v_reason,
      v_actor
    );
  END IF;

  v_result := public.merge_crm_customers(
    v_tenant_id,
    p_survivor_customer_id,
    p_duplicate_customer_id,
    v_reason,
    NULL,
    v_actor
  );
  v_history_id := (v_result->>'history_id')::uuid;
  v_remaining := array_remove(v_suggestion.candidate_customer_ids, p_duplicate_customer_id);
  v_history_ids := coalesce(v_suggestion.resolution->'mergeHistoryIds', '[]'::jsonb)
    || jsonb_build_array(v_history_id);

  UPDATE public.crm_customer_merge_suggestions
  SET candidate_customer_ids = v_remaining,
      status = CASE WHEN cardinality(v_remaining) < 2 THEN 'merged' ELSE 'open' END,
      resolution = coalesce(resolution, '{}'::jsonb) || jsonb_build_object(
        'lastAction', 'merged',
        'lastReason', v_reason,
        'lastSurvivorCustomerId', p_survivor_customer_id,
        'lastDuplicateCustomerId', p_duplicate_customer_id,
        'mergeHistoryIds', v_history_ids
      ),
      resolved_by = CASE WHEN cardinality(v_remaining) < 2 THEN v_actor ELSE NULL END,
      resolved_at = CASE WHEN cardinality(v_remaining) < 2 THEN pg_catalog.now() ELSE NULL END,
      updated_at = pg_catalog.now()
  WHERE id = v_suggestion.id;

  RETURN v_result || jsonb_build_object(
    'suggestionId', v_suggestion.id,
    'remainingCandidates', cardinality(v_remaining)
  );
END;
$$;

-- Direct table access previously allowed every signed-in tenant role to inspect
-- candidate PII. The reviewed RPC above is the only authenticated read path.
REVOKE SELECT ON public.crm_customer_merge_suggestions FROM authenticated;

REVOKE ALL ON FUNCTION public.scan_current_tenant_customer_duplicates(integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_current_tenant_customer_duplicates(integer)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_customer_merge_review_queue(integer, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_merge_review_queue(integer, integer)
TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_customer_merge_review(uuid, uuid, uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_customer_merge_review(uuid, uuid, uuid, text, text)
TO authenticated;

-- Build the initial review queue without mutating any customer. Subsequent
-- scans are owner-triggered and tenant-scoped.
SELECT public.seed_historical_customer_merge_suggestions(NULL, 50000);

COMMENT ON FUNCTION public.get_customer_merge_review_queue(integer, integer) IS
  'Returns owner-only duplicate candidates with contact, consent, purchase, message, loyalty, and identity evidence.';
COMMENT ON FUNCTION public.resolve_customer_merge_review(uuid, uuid, uuid, text, text) IS
  'Explicitly dismisses or performs one audited, reversible, fail-closed customer merge.';
