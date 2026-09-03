-- Normalize POS store identifiers into tenant locations and maintain exact
-- customer/location activity from the durable receipt ledger.

ALTER TABLE public.tenant_locations
  ADD COLUMN source_system text NOT NULL DEFAULT 'manual';

ALTER TABLE public.tenant_locations
  DROP CONSTRAINT tenant_locations_tenant_id_external_location_id_key;

ALTER TABLE public.tenant_locations
  ADD CONSTRAINT tenant_locations_source_external_key
  UNIQUE (tenant_id, source_system, external_location_id);

ALTER TABLE public.tenant_locations
  ADD CONSTRAINT tenant_locations_source_system_check
  CHECK (source_system IN (
    'manual', 'vmx', 'square', 'clover', 'lightspeed', 'shopify', 'other'
  ));

ALTER TABLE public.pos_receipts
  ADD COLUMN location_id uuid;

ALTER TABLE public.pos_receipts
  ADD CONSTRAINT pos_receipts_location_tenant_fkey
  FOREIGN KEY (tenant_id, location_id)
  REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

CREATE INDEX pos_receipts_tenant_location_customer_date_idx
  ON public.pos_receipts(
    tenant_id,
    location_id,
    external_customer_id,
    post_date DESC
  )
  WHERE location_id IS NOT NULL AND external_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_pos_location(
  p_tenant_id uuid,
  p_provider text,
  p_external_location_id text,
  p_display_name text DEFAULT NULL,
  p_timezone text DEFAULT 'UTC'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_external_id text := nullif(trim(coalesce(p_external_location_id, '')), '');
  v_timezone text := trim(coalesce(p_timezone, 'UTC'));
  v_location_id uuid;
  v_name text;
BEGIN
  IF p_tenant_id IS NULL OR v_external_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_provider NOT IN (
    'vmx', 'square', 'clover', 'lightspeed', 'shopify', 'other'
  ) THEN
    RAISE EXCEPTION 'Unsupported POS provider';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone
  ) THEN
    RAISE EXCEPTION 'Unknown IANA timezone';
  END IF;

  v_name := left(
    coalesce(
      nullif(trim(p_display_name), ''),
      upper(v_provider) || ' Store ' || v_external_id
    ),
    160
  );

  INSERT INTO public.tenant_locations(
    tenant_id,
    name,
    external_location_id,
    source_system,
    timezone,
    is_active
  ) VALUES (
    p_tenant_id,
    v_name,
    v_external_id,
    v_provider,
    v_timezone,
    true
  )
  ON CONFLICT (tenant_id, source_system, external_location_id)
  DO NOTHING
  RETURNING id INTO v_location_id;

  IF v_location_id IS NULL THEN
    SELECT location.id
    INTO v_location_id
    FROM public.tenant_locations AS location
    WHERE location.tenant_id = p_tenant_id
      AND location.source_system = v_provider
      AND location.external_location_id = v_external_id;
  END IF;

  RETURN v_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_pos_location(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pos_location(uuid, text, text, text, text)
  TO service_role;

-- Create the current VMX store catalog before attaching receipt foreign keys.
INSERT INTO public.tenant_locations(
  tenant_id,
  name,
  external_location_id,
  source_system,
  timezone,
  is_active
)
SELECT DISTINCT
  receipt.tenant_id,
  'VMX Store ' || trim(receipt.division_id),
  trim(receipt.division_id),
  'vmx',
  'UTC',
  true
FROM public.pos_receipts AS receipt
WHERE nullif(trim(receipt.division_id), '') IS NOT NULL
ON CONFLICT (tenant_id, source_system, external_location_id) DO NOTHING;

UPDATE public.pos_receipts AS receipt
SET location_id = location.id
FROM public.tenant_locations AS location
WHERE location.tenant_id = receipt.tenant_id
  AND location.source_system = 'vmx'
  AND location.external_location_id = trim(receipt.division_id)
  AND receipt.location_id IS DISTINCT FROM location.id;

CREATE OR REPLACE FUNCTION public.assign_vmx_receipt_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VMX receipt location assignment requires service authorization'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(NEW.division_id), '') IS NULL THEN
    NEW.location_id := NULL;
    RETURN NEW;
  END IF;

  NEW.location_id := public.resolve_pos_location(
    NEW.tenant_id,
    'vmx',
    NEW.division_id,
    'VMX Store ' || trim(NEW.division_id),
    'UTC'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_vmx_receipt_location()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_vmx_receipt_location_trigger
  ON public.pos_receipts;
CREATE TRIGGER assign_vmx_receipt_location_trigger
BEFORE INSERT OR UPDATE OF tenant_id, division_id
ON public.pos_receipts
FOR EACH ROW
EXECUTE FUNCTION public.assign_vmx_receipt_location();

CREATE OR REPLACE FUNCTION public.recompute_vmx_customer_locations(
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
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant is required';
  END IF;

  WITH candidates AS (
    SELECT
      link.external_id,
      link.crm_customer_id AS customer_id,
      1 AS priority,
      link.last_seen_at
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id
      AND link.provider = 'vmx'
      AND link.external_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids)
      )

    UNION ALL

    SELECT
      customer.external_id,
      customer.id,
      2,
      customer.updated_at
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.pos_source = 'vmx'
      AND customer.external_id IS NOT NULL
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND (
        p_external_customer_ids IS NULL OR
        customer.external_id = ANY(p_external_customer_ids)
      )
  ),
  affected_customers AS (
    SELECT DISTINCT customer_id
    FROM candidates
  )
  DELETE FROM public.customer_location_activity AS activity
  USING affected_customers, public.tenant_locations AS location
  WHERE activity.tenant_id = p_tenant_id
    AND activity.customer_id = affected_customers.customer_id
    AND activity.location_id = location.id
    AND location.tenant_id = p_tenant_id
    AND location.source_system = 'vmx';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  WITH candidates AS (
    SELECT
      link.external_id,
      link.crm_customer_id AS customer_id,
      1 AS priority,
      link.last_seen_at
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id
      AND link.provider = 'vmx'
      AND link.external_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids)
      )

    UNION ALL

    SELECT
      customer.external_id,
      customer.id,
      2,
      customer.updated_at
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.pos_source = 'vmx'
      AND customer.external_id IS NOT NULL
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND (
        p_external_customer_ids IS NULL OR
        customer.external_id = ANY(p_external_customer_ids)
      )
  ),
  resolved AS (
    SELECT DISTINCT ON (external_id)
      external_id,
      customer_id
    FROM candidates
    ORDER BY external_id, priority, last_seen_at DESC NULLS LAST, customer_id
  ),
  aggregates AS (
    SELECT
      receipt.tenant_id,
      resolved.customer_id,
      receipt.location_id,
      min(receipt.post_date) AS first_purchase_at,
      max(receipt.post_date) AS last_purchase_at,
      count(DISTINCT receipt.external_receipt_id)::integer AS visit_count,
      round(sum(coalesce(
        receipt.total,
        coalesce(receipt.subtotal, 0) + coalesce(receipt.tax, 0),
        0
      )), 2) AS total_spend
    FROM public.pos_receipts AS receipt
    JOIN resolved
      ON resolved.external_id = receipt.external_customer_id
    WHERE receipt.tenant_id = p_tenant_id
      AND receipt.location_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        receipt.external_customer_id = ANY(p_external_customer_ids)
      )
    GROUP BY receipt.tenant_id, resolved.customer_id, receipt.location_id
  )
  INSERT INTO public.customer_location_activity(
    tenant_id,
    customer_id,
    location_id,
    first_purchase_at,
    last_purchase_at,
    visit_count,
    total_spend,
    updated_at
  )
  SELECT
    aggregate.tenant_id,
    aggregate.customer_id,
    aggregate.location_id,
    aggregate.first_purchase_at,
    aggregate.last_purchase_at,
    aggregate.visit_count,
    aggregate.total_spend,
    now()
  FROM aggregates AS aggregate
  ON CONFLICT (customer_id, location_id)
  DO UPDATE SET
    first_purchase_at = EXCLUDED.first_purchase_at,
    last_purchase_at = EXCLUDED.last_purchase_at,
    visit_count = EXCLUDED.visit_count,
    total_spend = EXCLUDED.total_spend,
    updated_at = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  WITH candidates AS (
    SELECT
      link.external_id,
      link.crm_customer_id AS customer_id,
      1 AS priority,
      link.last_seen_at
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id
      AND link.provider = 'vmx'
      AND link.external_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids)
      )

    UNION ALL

    SELECT
      customer.external_id,
      customer.id,
      2,
      customer.updated_at
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.pos_source = 'vmx'
      AND customer.external_id IS NOT NULL
      AND customer.deleted_at IS NULL
      AND customer.merged_into_customer_id IS NULL
      AND (
        p_external_customer_ids IS NULL OR
        customer.external_id = ANY(p_external_customer_ids)
      )
  ),
  resolved AS (
    SELECT DISTINCT ON (external_id)
      external_id,
      customer_id
    FROM candidates
    ORDER BY external_id, priority, last_seen_at DESC NULLS LAST, customer_id
  ),
  ranked AS (
    SELECT
      activity.customer_id,
      activity.location_id,
      row_number() OVER (
        PARTITION BY activity.customer_id
        ORDER BY
          activity.last_purchase_at DESC NULLS LAST,
          activity.total_spend DESC,
          activity.location_id
      ) AS rank
    FROM public.customer_location_activity AS activity
    JOIN resolved ON resolved.customer_id = activity.customer_id
    JOIN public.tenant_locations AS location
      ON location.tenant_id = activity.tenant_id
     AND location.id = activity.location_id
     AND location.source_system = 'vmx'
    WHERE activity.tenant_id = p_tenant_id
  )
  UPDATE public.crm_customers AS customer
  SET primary_location_id = ranked.location_id,
      store_id = location.external_location_id,
      store_name = location.name,
      updated_at = now()
  FROM ranked
  JOIN public.tenant_locations AS location
    ON location.tenant_id = p_tenant_id
   AND location.id = ranked.location_id
  WHERE ranked.rank = 1
    AND customer.id = ranked.customer_id
    AND customer.tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_customers = ROW_COUNT;

  -- If an external identity was remapped, remove an obsolete VMX primary
  -- location from the previous customer after its activity rows are cleared.
  WITH candidates AS (
    SELECT link.crm_customer_id AS customer_id
    FROM public.crm_customer_identity_links AS link
    WHERE link.tenant_id = p_tenant_id
      AND link.provider = 'vmx'
      AND link.external_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        link.external_id = ANY(p_external_customer_ids)
      )
    UNION
    SELECT customer.id
    FROM public.crm_customers AS customer
    WHERE customer.tenant_id = p_tenant_id
      AND customer.pos_source = 'vmx'
      AND customer.external_id IS NOT NULL
      AND (
        p_external_customer_ids IS NULL OR
        customer.external_id = ANY(p_external_customer_ids)
      )
  )
  UPDATE public.crm_customers AS customer
  SET primary_location_id = NULL,
      store_id = NULL,
      store_name = NULL,
      updated_at = now()
  FROM candidates, public.tenant_locations AS primary_location
  WHERE customer.id = candidates.customer_id
    AND customer.tenant_id = p_tenant_id
    AND primary_location.tenant_id = p_tenant_id
    AND primary_location.id = customer.primary_location_id
    AND primary_location.source_system = 'vmx'
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_location_activity AS activity
      JOIN public.tenant_locations AS active_location
        ON active_location.tenant_id = activity.tenant_id
       AND active_location.id = activity.location_id
       AND active_location.source_system = 'vmx'
      WHERE activity.tenant_id = p_tenant_id
        AND activity.customer_id = customer.id
    );

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'deleted_activity_rows', v_deleted,
    'activity_rows', v_upserted,
    'customers_updated', v_customers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_vmx_customer_locations(uuid, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_vmx_customer_locations(uuid, text[])
  TO service_role;

DO $backfill$
DECLARE
  v_tenant record;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT receipt.tenant_id
    FROM public.pos_receipts AS receipt
    WHERE receipt.location_id IS NOT NULL
  LOOP
    PERFORM public.recompute_vmx_customer_locations(v_tenant.tenant_id, NULL);
  END LOOP;
END;
$backfill$;

COMMENT ON COLUMN public.tenant_locations.source_system IS
  'System that owns the external store identifier; manual locations have no external identifier.';
COMMENT ON COLUMN public.pos_receipts.location_id IS
  'Normalized tenant location derived from the VMX division identifier.';
COMMENT ON FUNCTION public.recompute_vmx_customer_locations(uuid, text[]) IS
  'Rebuilds exact per-store activity and primary store from the durable VMX receipt ledger.';
