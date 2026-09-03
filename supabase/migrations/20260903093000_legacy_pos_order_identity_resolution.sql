-- Resolve orders written by the legacy Square/Clover adapters, which store
-- their connection IDs outside pos_connections. Historical sync jobs retain
-- the tenant boundary after a provider connection is rotated or deleted.
-- Identity is attached only when both tenant and external customer ID resolve
-- to exactly one active CRM customer.

ALTER TABLE public.crm_customer_merge_suggestions
  DROP CONSTRAINT IF EXISTS crm_customer_merge_suggestions_reason_check;
ALTER TABLE public.crm_customer_merge_suggestions
  ADD CONSTRAINT crm_customer_merge_suggestions_reason_check
  CHECK (reason IN (
    'email_phone_disagree',
    'ambiguous_email',
    'ambiguous_phone',
    'external_identity_signal_conflict',
    'ambiguous_external_id'
  ));

CREATE OR REPLACE FUNCTION public.resolve_pos_order_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pos_customer_ids uuid[] := '{}'::uuid[];
  v_crm_customer_ids uuid[] := '{}'::uuid[];
  v_tenant_ids uuid[] := '{}'::uuid[];
  v_provider text;
  v_fingerprint text;
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

  -- Legacy provider adapters write the provider connection ID directly to
  -- pos_orders. Establish the provider before consulting its tenant history.
  IF EXISTS (
    SELECT 1 FROM public.square_connections sc
    WHERE sc.id = NEW.pos_connection_id
  ) OR EXISTS (
    SELECT 1 FROM public.pos_sync_jobs j
    WHERE j.connection_id = NEW.pos_connection_id
      AND lower(j.connection_type) = 'square'
  ) THEN
    v_provider := 'square';
  ELSIF EXISTS (
    SELECT 1 FROM public.clover_connections cc
    WHERE cc.id = NEW.pos_connection_id
  ) OR EXISTS (
    SELECT 1 FROM public.pos_sync_jobs j
    WHERE j.connection_id = NEW.pos_connection_id
      AND lower(j.connection_type) = 'clover'
  ) THEN
    v_provider := 'clover';
  END IF;

  IF NEW.external_customer_id IS NOT NULL AND v_provider IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT source.tenant_id), '{}'::uuid[])
      INTO v_tenant_ids
    FROM (
      SELECT sc.tenant_id
      FROM public.square_connections sc
      WHERE v_provider = 'square' AND sc.id = NEW.pos_connection_id
      UNION ALL
      SELECT cc.tenant_id
      FROM public.clover_connections cc
      WHERE v_provider = 'clover' AND cc.id = NEW.pos_connection_id
      UNION ALL
      SELECT j.tenant_id
      FROM public.pos_sync_jobs j
      WHERE j.connection_id = NEW.pos_connection_id
        AND lower(j.connection_type) = v_provider
    ) source
    WHERE source.tenant_id IS NOT NULL;

    IF cardinality(v_tenant_ids) > 1 THEN
      NEW.crm_customer_id := NULL;
      NEW.customer_resolution_status := 'ambiguous';
      NEW.customer_resolution_reason :=
        'Provider connection history resolves to multiple tenants';
      RETURN NEW;
    ELSIF cardinality(v_tenant_ids) = 1 THEN
      SELECT coalesce(array_agg(c.id ORDER BY c.created_at, c.id), '{}'::uuid[])
        INTO v_crm_customer_ids
      FROM public.crm_customers c
      WHERE c.tenant_id = v_tenant_ids[1]
        AND c.deleted_at IS NULL
        AND CASE v_provider
          WHEN 'square' THEN c.square_customer_id = NEW.external_customer_id
          WHEN 'clover' THEN c.clover_customer_id = NEW.external_customer_id
          ELSE false
        END;

      IF cardinality(v_crm_customer_ids) = 1 THEN
        NEW.crm_customer_id := v_crm_customer_ids[1];
        NEW.customer_resolution_status := 'linked';
        NEW.customer_resolution_reason := NULL;
        RETURN NEW;
      ELSIF cardinality(v_crm_customer_ids) > 1 THEN
        v_fingerprint := md5(
          v_provider || ':legacy:' || v_tenant_ids[1]::text || ':' ||
          NEW.external_customer_id || ':' || array_to_string(v_crm_customer_ids, ',')
        );

        INSERT INTO public.crm_customer_merge_suggestions (
          tenant_id, provider, external_id, candidate_customer_ids,
          reason, fingerprint
        ) VALUES (
          v_tenant_ids[1], v_provider, NEW.external_customer_id,
          v_crm_customer_ids, 'ambiguous_external_id', v_fingerprint
        ) ON CONFLICT DO NOTHING;

        NEW.crm_customer_id := NULL;
        NEW.customer_resolution_status := 'ambiguous';
        NEW.customer_resolution_reason :=
          'Multiple CRM customers share this provider customer ID';
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  NEW.crm_customer_id := NULL;
  IF NEW.external_customer_id IS NULL THEN
    NEW.customer_resolution_status := 'missing_identity';
    NEW.customer_resolution_reason :=
      'Order has no POS customer ID or external customer ID';
  ELSE
    NEW.customer_resolution_status := 'unmatched';
    NEW.customer_resolution_reason := CASE
      WHEN v_provider IS NULL
        THEN 'No provider or POS customer record exists for this connection'
      WHEN cardinality(v_tenant_ids) = 0
        THEN 'Provider connection has no deterministic tenant history'
      ELSE 'No CRM customer matches this provider customer ID'
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_pos_order_customer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pos_order_customer()
  TO service_role;

-- Re-evaluate provider orders whenever their CRM-side external identity is
-- added, changed, duplicated, restored, or soft-deleted.
CREATE OR REPLACE FUNCTION public.reconcile_provider_orders_from_crm_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_square_ids text[] := '{}'::text[];
  v_clover_ids text[] := '{}'::text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_square_ids := array_remove(ARRAY[NEW.square_customer_id], NULL);
    v_clover_ids := array_remove(ARRAY[NEW.clover_customer_id], NULL);
  ELSE
    v_square_ids := array_remove(
      ARRAY[OLD.square_customer_id, NEW.square_customer_id], NULL
    );
    v_clover_ids := array_remove(
      ARRAY[OLD.clover_customer_id, NEW.clover_customer_id], NULL
    );
  END IF;

  IF cardinality(v_square_ids) > 0 THEN
    UPDATE public.pos_orders o
    SET external_customer_id = o.external_customer_id
    WHERE o.external_customer_id = ANY(v_square_ids)
      AND (
        EXISTS (
          SELECT 1 FROM public.square_connections sc
          WHERE sc.id = o.pos_connection_id AND sc.tenant_id = NEW.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM public.pos_sync_jobs j
          WHERE j.connection_id = o.pos_connection_id
            AND j.tenant_id = NEW.tenant_id
            AND lower(j.connection_type) = 'square'
        )
      );
  END IF;

  IF cardinality(v_clover_ids) > 0 THEN
    UPDATE public.pos_orders o
    SET external_customer_id = o.external_customer_id
    WHERE o.external_customer_id = ANY(v_clover_ids)
      AND (
        EXISTS (
          SELECT 1 FROM public.clover_connections cc
          WHERE cc.id = o.pos_connection_id AND cc.tenant_id = NEW.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM public.pos_sync_jobs j
          WHERE j.connection_id = o.pos_connection_id
            AND j.tenant_id = NEW.tenant_id
            AND lower(j.connection_type) = 'clover'
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_provider_orders_from_crm_customer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_provider_orders_from_crm_customer()
  TO service_role;

DROP TRIGGER IF EXISTS trg_reconcile_provider_orders_from_crm_customer
  ON public.crm_customers;
CREATE TRIGGER trg_reconcile_provider_orders_from_crm_customer
AFTER INSERT OR UPDATE OF square_customer_id, clover_customer_id, deleted_at
ON public.crm_customers
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_provider_orders_from_crm_customer();

-- Re-run the resolver for all non-canonical orders. Assigning a column to
-- itself intentionally fires the guarded BEFORE UPDATE resolver trigger.
UPDATE public.pos_orders
SET external_customer_id = external_customer_id
WHERE crm_customer_id IS NULL;
