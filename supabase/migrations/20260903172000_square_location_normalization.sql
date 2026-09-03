-- Persist Square's store identifier on every order and derive customer/store
-- activity from the immutable POS order ledger. Historical orders without a
-- captured Square location remain explicitly unassigned instead of guessed.

ALTER TABLE public.pos_orders
  ADD COLUMN tenant_id uuid,
  ADD COLUMN provider text,
  ADD COLUMN external_location_id text,
  ADD COLUMN location_id uuid;

ALTER TABLE public.pos_orders
  ADD CONSTRAINT pos_orders_provider_check
  CHECK (provider IS NULL OR provider IN (
    'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
  ));

ALTER TABLE public.pos_orders
  ADD CONSTRAINT pos_orders_tenant_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.pos_orders
  ADD CONSTRAINT pos_orders_location_tenant_fkey
  FOREIGN KEY (tenant_id, location_id)
  REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

CREATE INDEX pos_orders_tenant_provider_location_customer_date_idx
  ON public.pos_orders(
    tenant_id, provider, location_id, external_customer_id, order_date DESC
  )
  WHERE tenant_id IS NOT NULL AND provider IS NOT NULL;

-- Replace connection-owner policies with the same corporate/location access
-- model used by CRM customers. Service workers continue to bypass RLS.
DROP POLICY IF EXISTS "Users can insert orders for their POS connections"
  ON public.pos_orders;
DROP POLICY IF EXISTS "Users can insert own tenant pos orders"
  ON public.pos_orders;
DROP POLICY IF EXISTS "Users can update orders for their POS connections"
  ON public.pos_orders;
DROP POLICY IF EXISTS "Users can update own tenant pos orders"
  ON public.pos_orders;
DROP POLICY IF EXISTS "Users can view orders from their POS connections"
  ON public.pos_orders;
DROP POLICY IF EXISTS "Users can view own tenant pos orders"
  ON public.pos_orders;

CREATE POLICY pos_orders_location_select ON public.pos_orders
FOR SELECT TO authenticated
USING (
  tenant_id IS NOT NULL AND
  public.has_tenant_permission(tenant_id, 'customer.read', location_id)
);

CREATE POLICY pos_orders_location_insert ON public.pos_orders
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL AND
  public.has_tenant_permission(tenant_id, 'customer.write', location_id)
);

CREATE POLICY pos_orders_location_update ON public.pos_orders
FOR UPDATE TO authenticated
USING (
  tenant_id IS NOT NULL AND
  public.has_tenant_permission(tenant_id, 'customer.write', location_id)
)
WITH CHECK (
  tenant_id IS NOT NULL AND
  public.has_tenant_permission(tenant_id, 'customer.write', location_id)
);

-- Preserve tenant/provider history for every order whose provider connection
-- still exists. The existing order identity trigger separately owns customer
-- matching and ambiguity classification.
UPDATE public.pos_orders AS order_row
SET tenant_id = source.tenant_id,
    provider = source.provider,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (candidate.id)
    candidate.id, candidate.tenant_id, candidate.provider
  FROM (
    SELECT connection.id, connection.tenant_id,
      connection.platform AS provider, 2 AS priority
    FROM public.pos_connections AS connection
    WHERE connection.platform IN (
      'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
    )
    UNION ALL
    SELECT connection.id, connection.tenant_id, 'square', 1
    FROM public.square_connections AS connection
    UNION ALL
    SELECT connection.id, connection.tenant_id, 'clover', 1
    FROM public.clover_connections AS connection
    UNION ALL
    SELECT history.connection_id,
      (array_agg(history.tenant_id ORDER BY history.tenant_id))[1],
      min(lower(history.connection_type)), 3
    FROM public.pos_sync_jobs AS history
    WHERE lower(history.connection_type) IN (
      'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
    )
    GROUP BY history.connection_id
    HAVING count(DISTINCT history.tenant_id) = 1
       AND count(DISTINCT lower(history.connection_type)) = 1
  ) AS candidate
  ORDER BY candidate.id, candidate.priority
) AS source
WHERE source.id = order_row.pos_connection_id
  AND (
    order_row.tenant_id IS DISTINCT FROM source.tenant_id OR
    order_row.provider IS DISTINCT FROM source.provider
  );

-- Square orders can carry a location on either the payment or its linked
-- order. A connection-level location is a safe fallback only when Square was
-- explicitly configured for that single location.
UPDATE public.pos_orders AS order_row
SET external_location_id = coalesce(
      nullif(btrim(order_row.raw_data #>> '{payment,location_id}'), ''),
      nullif(btrim(order_row.raw_data #>> '{order,location_id}'), ''),
      nullif(btrim(order_row.raw_data #>> '{invoice,location_id}'), ''),
      (
        SELECT nullif(btrim(connection.location_id), '')
        FROM public.square_connections AS connection
        WHERE connection.id = order_row.pos_connection_id
          AND connection.tenant_id = order_row.tenant_id
      )
    ),
    updated_at = now()
WHERE order_row.provider = 'square'
  AND order_row.external_location_id IS NULL
  AND coalesce(
    nullif(btrim(order_row.raw_data #>> '{payment,location_id}'), ''),
    nullif(btrim(order_row.raw_data #>> '{order,location_id}'), ''),
    nullif(btrim(order_row.raw_data #>> '{invoice,location_id}'), ''),
    (
      SELECT nullif(btrim(connection.location_id), '')
      FROM public.square_connections AS connection
      WHERE connection.id = order_row.pos_connection_id
        AND connection.tenant_id = order_row.tenant_id
    )
  ) IS NOT NULL;

INSERT INTO public.tenant_locations(
  tenant_id, name, external_location_id, source_system, timezone, is_active
)
SELECT DISTINCT
  order_row.tenant_id,
  coalesce(
    (
      SELECT nullif(btrim(connection.merchant_name), '')
      FROM public.square_connections AS connection
      WHERE connection.id = order_row.pos_connection_id
        AND connection.tenant_id = order_row.tenant_id
    ),
    'Square Store ' || order_row.external_location_id
  ),
  order_row.external_location_id,
  'square',
  'UTC',
  true
FROM public.pos_orders AS order_row
WHERE order_row.provider = 'square'
  AND order_row.external_location_id IS NOT NULL
ON CONFLICT (tenant_id, source_system, external_location_id) DO NOTHING;

UPDATE public.pos_orders AS order_row
SET location_id = location.id,
    updated_at = now()
FROM public.tenant_locations AS location
WHERE location.tenant_id = order_row.tenant_id
  AND location.source_system = 'square'
  AND location.external_location_id = order_row.external_location_id
  AND order_row.provider = 'square'
  AND order_row.location_id IS DISTINCT FROM location.id;

CREATE OR REPLACE FUNCTION public.assign_pos_order_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_provider text;
  v_connection_location text;
  v_display_name text;
  v_external_location text;
BEGIN
  SELECT source.tenant_id, source.provider, source.location_id, source.name
  INTO v_tenant_id, v_provider, v_connection_location, v_display_name
  FROM (
    SELECT connection.tenant_id, connection.platform AS provider,
      connection.settings->>'location_id' AS location_id,
      connection.name
    FROM public.pos_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
      AND connection.platform IN (
        'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
      )
    UNION ALL
    SELECT connection.tenant_id, 'square', connection.location_id,
      connection.merchant_name
    FROM public.square_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
    UNION ALL
    SELECT connection.tenant_id, 'clover', NULL::text,
      connection.merchant_name
    FROM public.clover_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
    UNION ALL
    SELECT
      (array_agg(history.tenant_id ORDER BY history.tenant_id))[1],
      min(lower(history.connection_type)), NULL::text, NULL::text
    FROM public.pos_sync_jobs AS history
    WHERE history.connection_id = NEW.pos_connection_id
      AND lower(history.connection_type) IN (
        'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
      )
    GROUP BY history.connection_id
    HAVING count(DISTINCT history.tenant_id) = 1
       AND count(DISTINCT lower(history.connection_type)) = 1
  ) AS source
  ORDER BY CASE
    WHEN source.provider = 'square' AND source.location_id IS NOT NULL THEN 0
    WHEN source.provider = 'square' THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    IF NEW.provider = 'square' OR NEW.external_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'POS order connection is not registered'
        USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.users AS actor
      WHERE actor.id = auth.uid() AND actor.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'POS order location assignment is not authorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'POS order location assignment requires authorization'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'POS order tenant does not match its connection'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.provider IS NOT NULL AND NEW.provider IS DISTINCT FROM v_provider THEN
    RAISE EXCEPTION 'POS order provider does not match its connection'
      USING ERRCODE = '23514';
  END IF;

  NEW.tenant_id := v_tenant_id;
  NEW.provider := v_provider;

  IF v_provider <> 'square' THEN
    RETURN NEW;
  END IF;

  v_external_location := coalesce(
    nullif(btrim(NEW.external_location_id), ''),
    nullif(btrim(NEW.raw_data #>> '{payment,location_id}'), ''),
    nullif(btrim(NEW.raw_data #>> '{order,location_id}'), ''),
    nullif(btrim(NEW.raw_data #>> '{invoice,location_id}'), ''),
    nullif(btrim(v_connection_location), '')
  );
  NEW.external_location_id := v_external_location;

  IF v_external_location IS NULL THEN
    NEW.location_id := NULL;
  ELSE
    NEW.location_id := public.resolve_pos_location(
      v_tenant_id,
      'square',
      v_external_location,
      coalesce(nullif(btrim(v_display_name), ''),
        'Square Store ' || v_external_location),
      'UTC'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_pos_order_location()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_pos_order_location_trigger ON public.pos_orders;
CREATE TRIGGER assign_pos_order_location_trigger
BEFORE INSERT OR UPDATE OF
  pos_connection_id, tenant_id, provider, external_location_id, raw_data
ON public.pos_orders
FOR EACH ROW EXECUTE FUNCTION public.assign_pos_order_location();

CREATE OR REPLACE FUNCTION public.recompute_square_customer_locations(
  p_tenant_id uuid,
  p_external_customer_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer := 0;
  v_upserted integer := 0;
  v_customers integer := 0;
  v_access jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant is required';
  END IF;

  IF auth.role() = 'authenticated' THEN
    v_access := public.get_current_crm_access();
    IF (v_access->>'tenantId')::uuid IS DISTINCT FROM p_tenant_id
       OR v_access->>'role' NOT IN ('owner_admin', 'marketing') THEN
      RAISE EXCEPTION 'Square reconciliation requires owner or marketing access'
        USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role'
        AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Square reconciliation requires authorization'
      USING ERRCODE = '42501';
  END IF;

  WITH candidate_customers AS (
    SELECT order_row.crm_customer_id AS customer_id
    FROM public.pos_orders AS order_row
    JOIN public.crm_customers AS customer
      ON customer.id = order_row.crm_customer_id
     AND customer.tenant_id = p_tenant_id
    WHERE order_row.tenant_id = p_tenant_id
      AND order_row.provider = 'square'
      AND (p_external_customer_ids IS NULL OR
        order_row.external_customer_id = ANY(p_external_customer_ids))
    UNION
    SELECT link.crm_customer_id
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id AND link.provider = 'square'
      AND (p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids))
      AND (p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids))
    UNION
    SELECT customer.id
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND coalesce(customer.square_customer_id,
        CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
        IS NOT NULL
      AND (p_external_customer_ids IS NULL OR
        coalesce(customer.square_customer_id,
          CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
          = ANY(p_external_customer_ids))
  )
  DELETE FROM public.customer_location_activity AS activity
  USING candidate_customers, public.tenant_locations AS location
  WHERE activity.tenant_id = p_tenant_id
    AND activity.customer_id = candidate_customers.customer_id
    AND activity.location_id = location.id
    AND location.tenant_id = p_tenant_id
    AND location.source_system = 'square';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  WITH identity_candidates AS (
    SELECT link.external_id, link.crm_customer_id AS customer_id,
      1 AS priority, link.last_seen_at
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id AND link.provider = 'square'
    UNION ALL
    SELECT coalesce(customer.square_customer_id,
        CASE WHEN customer.pos_source = 'square' THEN customer.external_id END),
      customer.id, 2, customer.updated_at
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND coalesce(customer.square_customer_id,
        CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
        IS NOT NULL
      AND (p_external_customer_ids IS NULL OR
        coalesce(customer.square_customer_id,
          CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
          = ANY(p_external_customer_ids))
  ),
  preferred_candidates AS (
    SELECT identity_candidates.*,
      min(priority) OVER (PARTITION BY external_id) AS preferred_priority
    FROM identity_candidates
  ),
  identities AS (
    SELECT external_id,
      (array_agg(customer_id ORDER BY customer_id))[1] AS customer_id
    FROM preferred_candidates
    WHERE priority = preferred_priority
    GROUP BY external_id
    HAVING count(DISTINCT customer_id) = 1
  ),
  resolved_orders AS (
    SELECT order_row.*,
      coalesce(direct_customer.id, identities.customer_id) AS resolved_customer_id
    FROM public.pos_orders AS order_row
    LEFT JOIN public.crm_customers AS direct_customer
      ON direct_customer.id = order_row.crm_customer_id
     AND direct_customer.tenant_id = order_row.tenant_id
     AND direct_customer.deleted_at IS NULL
     AND direct_customer.merged_into_customer_id IS NULL
    LEFT JOIN identities
      ON identities.external_id = order_row.external_customer_id
    WHERE order_row.tenant_id = p_tenant_id
      AND order_row.provider = 'square'
      AND order_row.location_id IS NOT NULL
      AND upper(coalesce(order_row.status, '')) IN ('COMPLETED', 'REFUNDED', 'PAID')
      AND (p_external_customer_ids IS NULL OR
        order_row.external_customer_id = ANY(p_external_customer_ids))
  ),
  aggregates AS (
    SELECT tenant_id, resolved_customer_id AS customer_id, location_id,
      min(order_date) AS first_purchase_at,
      max(order_date) AS last_purchase_at,
      count(*)::integer AS visit_count,
      round(sum(greatest(coalesce(total_amount, 0) -
        coalesce(refund_amount, 0), 0)), 2) AS total_spend
    FROM resolved_orders
    WHERE resolved_customer_id IS NOT NULL
    GROUP BY tenant_id, resolved_customer_id, location_id
  )
  INSERT INTO public.customer_location_activity(
    tenant_id, customer_id, location_id, first_purchase_at,
    last_purchase_at, visit_count, total_spend, updated_at
  )
  SELECT tenant_id, customer_id, location_id, first_purchase_at,
    last_purchase_at, visit_count, total_spend, now()
  FROM aggregates
  ON CONFLICT (customer_id, location_id) DO UPDATE SET
    first_purchase_at = excluded.first_purchase_at,
    last_purchase_at = excluded.last_purchase_at,
    visit_count = excluded.visit_count,
    total_spend = excluded.total_spend,
    updated_at = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  WITH affected AS (
    SELECT order_row.crm_customer_id AS customer_id
    FROM public.pos_orders AS order_row
    JOIN public.crm_customers AS customer
      ON customer.id = order_row.crm_customer_id
     AND customer.tenant_id = p_tenant_id
    WHERE order_row.tenant_id = p_tenant_id
      AND order_row.provider = 'square'
      AND (p_external_customer_ids IS NULL OR
        order_row.external_customer_id = ANY(p_external_customer_ids))
    UNION
    SELECT link.crm_customer_id
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id AND link.provider = 'square'
      AND (p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids))
    UNION
    SELECT customer.id
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND coalesce(customer.square_customer_id,
        CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
        IS NOT NULL
      AND (p_external_customer_ids IS NULL OR
        coalesce(customer.square_customer_id,
          CASE WHEN customer.pos_source = 'square' THEN customer.external_id END)
          = ANY(p_external_customer_ids))
  ),
  ranked AS (
    SELECT activity.customer_id, activity.location_id,
      row_number() OVER (
        PARTITION BY activity.customer_id
        ORDER BY activity.last_purchase_at DESC NULLS LAST,
          activity.total_spend DESC, activity.location_id
      ) AS rank
    FROM public.customer_location_activity AS activity
    JOIN affected ON affected.customer_id = activity.customer_id
    WHERE activity.tenant_id = p_tenant_id
  )
  UPDATE public.crm_customers AS customer
  SET primary_location_id = ranked.location_id,
      store_id = location.external_location_id,
      store_name = location.name,
      updated_at = now()
  FROM ranked
  JOIN public.tenant_locations AS location
    ON location.tenant_id = p_tenant_id AND location.id = ranked.location_id
  WHERE ranked.rank = 1
    AND customer.id = ranked.customer_id
    AND customer.tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_customers = ROW_COUNT;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'deleted_activity_rows', v_deleted,
    'activity_rows', v_upserted,
    'customers_updated', v_customers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_square_customer_locations(uuid, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_square_customer_locations(uuid, text[])
  TO authenticated, service_role;

-- Historical customer/location activity is reconciled after this migration in
-- bounded external-customer batches. Keeping that rebuild outside the schema
-- transaction avoids holding DDL locks while a large customer ledger is ranked.

COMMENT ON COLUMN public.pos_orders.tenant_id IS
  'Durable tenant boundary copied from the provider connection.';
COMMENT ON COLUMN public.pos_orders.external_location_id IS
  'Provider-native store identifier retained for reconciliation.';
COMMENT ON COLUMN public.pos_orders.location_id IS
  'Normalized BloomSuite tenant location for this order.';
COMMENT ON FUNCTION public.recompute_square_customer_locations(uuid, text[]) IS
  'Rebuilds exact Square customer/store activity from normalized POS orders.';
