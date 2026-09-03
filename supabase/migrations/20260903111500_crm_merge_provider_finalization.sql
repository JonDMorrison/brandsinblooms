-- Finalize quarantined Shopify/Lightspeed duplicates inside the same audited
-- merge transaction. Provider rows are staged through the duplicate so the
-- core merge records them, while their true pre-stage state is retained for
-- an exact operational rollback.

ALTER TABLE public.crm_customer_merge_history
  ADD COLUMN IF NOT EXISTS staged_provider_references jsonb;

CREATE OR REPLACE FUNCTION public.tombstone_merged_crm_customer_alias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.merged_into_customer_id IS NULL
     AND NEW.merged_into_customer_id IS NOT NULL THEN
    -- Release unique routing keys for the canonical survivor. Originals remain
    -- in the service-only merge snapshot and are restored by rollback.
    NEW.email := 'merged+' || NEW.id::text || '@invalid.bloomsuite.local';
    NEW.pos_source := NULL;
    NEW.external_id := NULL;
    NEW.square_customer_id := NULL;
    NEW.clover_customer_id := NULL;
  ELSIF OLD.merged_into_customer_id IS NOT NULL
        AND NEW.merged_into_customer_id IS NULL THEN
    -- Rollback restores the duplicate snapshot before the survivor snapshot.
    -- Release provider keys that finalization may have assigned to the survivor
    -- so the duplicate restore cannot violate its original unique identity.
    UPDATE public.crm_customers
    SET pos_source = NULL,
        external_id = NULL,
        square_customer_id = NULL,
        clover_customer_id = NULL
    WHERE id = OLD.merged_into_customer_id
      AND tenant_id = OLD.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tombstone_merged_crm_customer_alias_trigger
  ON public.crm_customers;
CREATE TRIGGER tombstone_merged_crm_customer_alias_trigger
  BEFORE UPDATE OF merged_into_customer_id ON public.crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.tombstone_merged_crm_customer_alias();

CREATE OR REPLACE FUNCTION public.merge_external_provider_customer_suggestion(
  p_suggestion_id uuid,
  p_survivor_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text,
  p_performed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_suggestion public.crm_customer_merge_suggestions%ROWTYPE;
  v_provider_row_id uuid;
  v_provider_previous_contact uuid;
  v_provider_previous_updated_at timestamptz;
  v_order_rows jsonb := '[]'::jsonb;
  v_existing_link_id uuid;
  v_existing_link_customer_id uuid;
  v_created_link_id uuid;
  v_history_id uuid;
  v_merge_result jsonb;
  v_resolution jsonb;
  v_staged jsonb;
BEGIN
  SELECT * INTO v_suggestion
  FROM public.crm_customer_merge_suggestions
  WHERE id = p_suggestion_id
  FOR UPDATE;

  IF v_suggestion.id IS NULL OR v_suggestion.status <> 'open' THEN
    RAISE EXCEPTION 'an open merge suggestion is required';
  END IF;
  IF v_suggestion.provider NOT IN ('lightspeed', 'shopify')
     OR nullif(btrim(v_suggestion.external_id), '') IS NULL THEN
    RAISE EXCEPTION 'suggestion must identify a supported external provider customer';
  END IF;
  IF NOT v_suggestion.candidate_customer_ids @>
    ARRAY[p_survivor_customer_id, p_duplicate_customer_id] THEN
    RAISE EXCEPTION 'suggestion does not contain both customers';
  END IF;

  IF v_suggestion.provider = 'lightspeed' THEN
    SELECT c.id, c.contact_id, c.updated_at
    INTO v_provider_row_id, v_provider_previous_contact, v_provider_previous_updated_at
    FROM public.lightspeed_customers c
    WHERE c.tenant_id = v_suggestion.tenant_id
      AND c.lightspeed_customer_id = v_suggestion.external_id
    FOR UPDATE;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'previous_contact_id', s.contact_id
    ) ORDER BY s.id), '[]'::jsonb)
    INTO v_order_rows
    FROM public.lightspeed_sales s
    WHERE s.tenant_id = v_suggestion.tenant_id
      AND s.lightspeed_customer_id = v_suggestion.external_id;
  ELSE
    SELECT c.id, c.contact_id, c.updated_at
    INTO v_provider_row_id, v_provider_previous_contact, v_provider_previous_updated_at
    FROM public.shopify_customers c
    WHERE c.tenant_id = v_suggestion.tenant_id
      AND c.shopify_customer_id = v_suggestion.external_id
    FOR UPDATE;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'previous_contact_id', o.contact_id
    ) ORDER BY o.id), '[]'::jsonb)
    INTO v_order_rows
    FROM public.shopify_orders o
    WHERE o.tenant_id = v_suggestion.tenant_id
      AND o.shopify_customer_id = v_suggestion.external_id;
  END IF;

  IF v_provider_row_id IS NULL THEN
    RAISE EXCEPTION 'provider customer row not found';
  END IF;
  IF v_provider_previous_contact IS NOT NULL
     AND v_provider_previous_contact NOT IN (
       p_survivor_customer_id, p_duplicate_customer_id
     ) THEN
    RAISE EXCEPTION 'provider customer is linked to a customer outside the suggestion';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_order_rows) row_data
    WHERE nullif(row_data->>'previous_contact_id', '')::uuid IS NOT NULL
      AND nullif(row_data->>'previous_contact_id', '')::uuid NOT IN (
        p_survivor_customer_id, p_duplicate_customer_id
      )
  ) THEN
    RAISE EXCEPTION 'provider order is linked to a customer outside the suggestion';
  END IF;

  SELECT l.id, l.crm_customer_id
  INTO v_existing_link_id, v_existing_link_customer_id
  FROM public.crm_customer_identity_links l
  WHERE l.tenant_id = v_suggestion.tenant_id
    AND l.provider = v_suggestion.provider
    AND l.external_id = v_suggestion.external_id
  FOR UPDATE;

  IF v_existing_link_id IS NOT NULL
     AND v_existing_link_customer_id NOT IN (
       p_survivor_customer_id, p_duplicate_customer_id
     ) THEN
    RAISE EXCEPTION 'identity ledger is linked outside the suggestion';
  END IF;

  -- Stage all provider references through the duplicate. The merge engine will
  -- capture and move them; staged_provider_references remembers their original
  -- null/survivor state so rollback can restore the quarantine exactly.
  IF v_suggestion.provider = 'lightspeed' THEN
    UPDATE public.lightspeed_customers
    SET contact_id = p_duplicate_customer_id
    WHERE id = v_provider_row_id;
    UPDATE public.lightspeed_sales
    SET contact_id = p_duplicate_customer_id
    WHERE tenant_id = v_suggestion.tenant_id
      AND lightspeed_customer_id = v_suggestion.external_id;
  ELSE
    UPDATE public.shopify_customers
    SET contact_id = p_duplicate_customer_id
    WHERE id = v_provider_row_id;
    UPDATE public.shopify_orders
    SET contact_id = p_duplicate_customer_id
    WHERE tenant_id = v_suggestion.tenant_id
      AND shopify_customer_id = v_suggestion.external_id;
  END IF;

  IF v_existing_link_id IS NULL THEN
    INSERT INTO public.crm_customer_identity_links (
      tenant_id, crm_customer_id, provider, external_id,
      normalized_email, normalized_phone, link_method, confidence_score,
      source_payload
    )
    SELECT
      v_suggestion.tenant_id, p_duplicate_customer_id,
      v_suggestion.provider, v_suggestion.external_id,
      v_suggestion.normalized_email, v_suggestion.normalized_phone,
      'external_id', 1.000,
      jsonb_build_object('staged_by', 'merge_external_provider_customer_suggestion')
    RETURNING id INTO v_created_link_id;
  END IF;

  v_merge_result := public.merge_crm_customers(
    v_suggestion.tenant_id,
    p_survivor_customer_id,
    p_duplicate_customer_id,
    p_reason,
    p_suggestion_id,
    p_performed_by
  );
  v_history_id := (v_merge_result->>'history_id')::uuid;

  v_staged := jsonb_build_object(
    'provider', v_suggestion.provider,
    'external_id', v_suggestion.external_id,
    'provider_row_id', v_provider_row_id,
    'provider_previous_contact_id', v_provider_previous_contact,
    'provider_previous_updated_at', v_provider_previous_updated_at,
    'order_rows', v_order_rows,
    'created_identity_link_id', v_created_link_id
  );

  UPDATE public.crm_customer_merge_history
  SET staged_provider_references = v_staged
  WHERE id = v_history_id;

  v_resolution := public.resolve_external_provider_customer_identity(
    v_suggestion.tenant_id,
    v_suggestion.provider,
    v_suggestion.external_id,
    p_performed_by
  );

  IF nullif(v_resolution->>'customer_id', '')::uuid IS DISTINCT FROM
     p_survivor_customer_id THEN
    RAISE EXCEPTION 'provider resolver did not return the selected survivor';
  END IF;

  RETURN v_merge_result || jsonb_build_object(
    'provider', v_suggestion.provider,
    'external_id', v_suggestion.external_id,
    'provider_resolution', v_resolution,
    'finalized', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_staged_provider_references_after_rollback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staged jsonb := NEW.staged_provider_references;
  v_order jsonb;
  v_changed integer;
  v_previous_contact uuid;
BEGIN
  IF OLD.status <> 'applied' OR NEW.status <> 'rolled_back'
     OR v_staged IS NULL THEN
    RETURN NEW;
  END IF;

  v_previous_contact := nullif(v_staged->>'provider_previous_contact_id', '')::uuid;

  IF v_staged->>'provider' = 'lightspeed' THEN
    UPDATE public.lightspeed_customers
    SET contact_id = v_previous_contact,
        updated_at = (v_staged->>'provider_previous_updated_at')::timestamptz
    WHERE id = (v_staged->>'provider_row_id')::uuid
      AND contact_id = NEW.duplicate_customer_id;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'staged provider customer changed after merge'; END IF;

    FOR v_order IN SELECT value FROM jsonb_array_elements(v_staged->'order_rows')
    LOOP
      UPDATE public.lightspeed_sales
      SET contact_id = nullif(v_order->>'previous_contact_id', '')::uuid
      WHERE id = (v_order->>'id')::uuid
        AND contact_id = NEW.duplicate_customer_id;
      GET DIAGNOSTICS v_changed = ROW_COUNT;
      IF v_changed <> 1 THEN RAISE EXCEPTION 'staged provider sale changed after merge'; END IF;
    END LOOP;
  ELSIF v_staged->>'provider' = 'shopify' THEN
    UPDATE public.shopify_customers
    SET contact_id = v_previous_contact,
        updated_at = (v_staged->>'provider_previous_updated_at')::timestamptz
    WHERE id = (v_staged->>'provider_row_id')::uuid
      AND contact_id = NEW.duplicate_customer_id;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'staged provider customer changed after merge'; END IF;

    FOR v_order IN SELECT value FROM jsonb_array_elements(v_staged->'order_rows')
    LOOP
      UPDATE public.shopify_orders
      SET contact_id = nullif(v_order->>'previous_contact_id', '')::uuid
      WHERE id = (v_order->>'id')::uuid
        AND contact_id = NEW.duplicate_customer_id;
      GET DIAGNOSTICS v_changed = ROW_COUNT;
      IF v_changed <> 1 THEN RAISE EXCEPTION 'staged provider order changed after merge'; END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'unsupported staged provider in merge history';
  END IF;

  IF nullif(v_staged->>'created_identity_link_id', '')::uuid IS NOT NULL THEN
    DELETE FROM public.crm_customer_identity_links
    WHERE id = (v_staged->>'created_identity_link_id')::uuid
      AND crm_customer_id = NEW.duplicate_customer_id;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'staged identity link changed after merge'; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restore_staged_provider_references_after_rollback_trigger
  ON public.crm_customer_merge_history;
CREATE TRIGGER restore_staged_provider_references_after_rollback_trigger
  AFTER UPDATE OF status ON public.crm_customer_merge_history
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_staged_provider_references_after_rollback();

REVOKE ALL ON FUNCTION public.tombstone_merged_crm_customer_alias()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_external_provider_customer_suggestion(uuid, uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_staged_provider_references_after_rollback()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_external_provider_customer_suggestion(uuid, uuid, uuid, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.merge_external_provider_customer_suggestion(uuid, uuid, uuid, text, uuid) IS
  'Atomically stages, merges, and re-resolves a quarantined Shopify or Lightspeed customer suggestion.';
