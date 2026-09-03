-- Attach each shared POS order to its canonical CRM customer when identity is
-- deterministic. Unresolved orders remain visible and explicitly classified;
-- they are never guessed into attribution or purchase history.

ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS crm_customer_id uuid
    REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_resolution_status text,
  ADD COLUMN IF NOT EXISTS customer_resolution_reason text;

ALTER TABLE public.pos_orders
  DROP CONSTRAINT IF EXISTS pos_orders_customer_resolution_status_check;
ALTER TABLE public.pos_orders
  ADD CONSTRAINT pos_orders_customer_resolution_status_check
  CHECK (customer_resolution_status IS NULL OR customer_resolution_status IN (
    'linked', 'unmatched', 'ambiguous', 'missing_identity'
  ));

CREATE INDEX IF NOT EXISTS pos_orders_crm_customer_idx
  ON public.pos_orders (crm_customer_id, order_date DESC)
  WHERE crm_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pos_orders_resolution_status_idx
  ON public.pos_orders (customer_resolution_status, order_date DESC);

-- Backfill only connection-scoped external IDs with exactly one POS customer.
WITH deterministic AS (
  SELECT
    o.id AS order_id,
    (array_agg(pc.id ORDER BY pc.created_at, pc.id))[1] AS pos_customer_id
  FROM public.pos_orders o
  JOIN public.pos_customers pc
    ON pc.pos_connection_id = o.pos_connection_id
   AND pc.external_id = o.external_customer_id
  WHERE o.pos_customer_id IS NULL
    AND o.external_customer_id IS NOT NULL
  GROUP BY o.id
  HAVING count(*) = 1
)
UPDATE public.pos_orders o
SET pos_customer_id = deterministic.pos_customer_id,
    updated_at = now()
FROM deterministic
WHERE o.id = deterministic.order_id;

UPDATE public.pos_orders o
SET crm_customer_id = link.crm_customer_id,
    customer_resolution_status = 'linked',
    customer_resolution_reason = NULL,
    updated_at = now()
FROM public.pos_customers pc
JOIN public.pos_connections conn ON conn.id = pc.pos_connection_id
JOIN public.crm_customer_identity_links link
  ON link.pos_customer_id = pc.id
 AND link.tenant_id = conn.tenant_id
WHERE o.pos_customer_id = pc.id
  AND o.crm_customer_id IS DISTINCT FROM link.crm_customer_id;

UPDATE public.pos_orders o
SET customer_resolution_status = CASE
      WHEN o.external_customer_id IS NULL AND o.pos_customer_id IS NULL
        THEN 'missing_identity'
      WHEN (
        SELECT count(*) FROM public.pos_customers pc
        WHERE pc.pos_connection_id = o.pos_connection_id
          AND pc.external_id = o.external_customer_id
      ) > 1 THEN 'ambiguous'
      ELSE 'unmatched'
    END,
    customer_resolution_reason = CASE
      WHEN o.external_customer_id IS NULL AND o.pos_customer_id IS NULL
        THEN 'Order has no POS customer ID or external customer ID'
      WHEN (
        SELECT count(*) FROM public.pos_customers pc
        WHERE pc.pos_connection_id = o.pos_connection_id
          AND pc.external_id = o.external_customer_id
      ) > 1
        THEN 'Multiple POS customers share this connection-scoped external ID'
      WHEN o.pos_customer_id IS NOT NULL
        THEN 'POS customer has no canonical CRM identity link'
      ELSE 'No POS customer matches this connection-scoped external ID'
    END,
    updated_at = now()
WHERE o.crm_customer_id IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_pos_order_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pos_customer_ids uuid[] := '{}'::uuid[];
  v_crm_customer_ids uuid[] := '{}'::uuid[];
BEGIN
  IF NEW.pos_customer_id IS NULL AND NEW.external_customer_id IS NOT NULL THEN
    SELECT coalesce(array_agg(pc.id ORDER BY pc.created_at), '{}'::uuid[])
      INTO v_pos_customer_ids
    FROM public.pos_customers pc
    WHERE pc.pos_connection_id = NEW.pos_connection_id
      AND pc.external_id = NEW.external_customer_id;

    IF cardinality(v_pos_customer_ids) = 1 THEN
      NEW.pos_customer_id := v_pos_customer_ids[1];
    ELSIF cardinality(v_pos_customer_ids) > 1 THEN
      NEW.crm_customer_id := NULL;
      NEW.customer_resolution_status := 'ambiguous';
      NEW.customer_resolution_reason :=
        'Multiple POS customers share this connection-scoped external ID';
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.pos_customer_id IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT link.crm_customer_id), '{}'::uuid[])
      INTO v_crm_customer_ids
    FROM public.pos_customers pc
    JOIN public.pos_connections conn ON conn.id = pc.pos_connection_id
    JOIN public.crm_customer_identity_links link
      ON link.pos_customer_id = pc.id
     AND link.tenant_id = conn.tenant_id
    WHERE pc.id = NEW.pos_customer_id
      AND pc.pos_connection_id = NEW.pos_connection_id;

    IF cardinality(v_crm_customer_ids) = 1 THEN
      NEW.crm_customer_id := v_crm_customer_ids[1];
      NEW.customer_resolution_status := 'linked';
      NEW.customer_resolution_reason := NULL;
      RETURN NEW;
    ELSIF cardinality(v_crm_customer_ids) > 1 THEN
      NEW.crm_customer_id := NULL;
      NEW.customer_resolution_status := 'ambiguous';
      NEW.customer_resolution_reason :=
        'POS customer resolves to multiple CRM identities';
      RETURN NEW;
    END IF;

    NEW.crm_customer_id := NULL;
    NEW.customer_resolution_status := 'unmatched';
    NEW.customer_resolution_reason :=
      'POS customer has no canonical CRM identity link';
    RETURN NEW;
  END IF;

  NEW.crm_customer_id := NULL;
  IF NEW.external_customer_id IS NULL THEN
    NEW.customer_resolution_status := 'missing_identity';
    NEW.customer_resolution_reason :=
      'Order has no POS customer ID or external customer ID';
  ELSE
    NEW.customer_resolution_status := 'unmatched';
    NEW.customer_resolution_reason :=
      'No POS customer matches this connection-scoped external ID';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_pos_order_customer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pos_order_customer()
  TO service_role;

DROP TRIGGER IF EXISTS trg_resolve_pos_order_customer ON public.pos_orders;
CREATE TRIGGER trg_resolve_pos_order_customer
BEFORE INSERT OR UPDATE OF
  pos_connection_id, pos_customer_id, external_customer_id
ON public.pos_orders
FOR EACH ROW
EXECUTE FUNCTION public.resolve_pos_order_customer();

COMMENT ON COLUMN public.pos_orders.crm_customer_id IS
  'Canonical BloomSuite customer resolved through crm_customer_identity_links.';
COMMENT ON COLUMN public.pos_orders.customer_resolution_status IS
  'Whether customer identity is linked, unmatched, ambiguous, or missing.';
