BEGIN;
-- Native BloomSuite uses the legacy 'other' order-provider enum. Recognize
-- only an active service-authenticated, exact tenant-bound native connection;
-- keep existing provider and cross-tenant checks unchanged.
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
    SELECT connection.tenant_id, CASE WHEN connection.platform = 'bloomsuite' THEN 'other' ELSE connection.platform END AS provider,
      connection.settings->>'location_id' AS location_id,
      connection.name
    FROM public.pos_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
      AND (connection.platform IN (
        'square', 'clover', 'lightspeed', 'shopify', 'vmx', 'other'
      ) OR (connection.platform = 'bloomsuite' AND connection.is_active
        AND auth.role() = 'service_role'
        AND EXISTS (
          SELECT 1 FROM bloom_pos_private.connections native
          WHERE native.pos_connection_id = connection.id
            AND native.crm_tenant_id = connection.tenant_id AND native.enabled
        )))
    UNION ALL
    SELECT connection.tenant_id, 'square', connection.location_id,
      connection.merchant_name
    FROM public.square_connections AS connection
    WHERE connection.id = NEW.pos_connection_id
    UNION ALL
    SELECT connection.tenant_id, 'clover', connection.merchant_id,
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
    WHEN source.provider IN ('square', 'clover')
      AND source.location_id IS NOT NULL THEN 0
    WHEN source.provider IN ('square', 'clover') THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    IF NEW.provider IS NOT NULL OR NEW.external_location_id IS NOT NULL THEN
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

  IF v_provider NOT IN ('square', 'clover') THEN
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
      v_provider,
      v_external_location,
      coalesce(nullif(btrim(v_display_name), ''),
        initcap(v_provider) || ' Store ' || v_external_location),
      'UTC'
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_pos_order_location() FROM PUBLIC, anon, authenticated;
COMMIT;
