-- workspace-qa3 #2 (follow-up): copy segment members in keyset batches so each
-- API call stays well inside the 8s statement timeout for large segments
-- (largest tenant has 107k customers; one-shot copy runs ~90 us/row).
CREATE OR REPLACE FUNCTION public.copy_segment_members_batch(
  p_source_segment_id uuid,
  p_target_segment_id uuid,
  p_after_customer_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_source public.crm_segments%ROWTYPE;
  v_target public.crm_segments%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 10000), 1), 20000);
  v_inserted integer := 0;
  v_scanned integer := 0;
  v_last uuid;
BEGIN
  SELECT * INTO v_source FROM public.crm_segments WHERE id = p_source_segment_id;
  SELECT * INTO v_target FROM public.crm_segments WHERE id = p_target_segment_id;

  IF v_source.id IS NULL OR v_target.id IS NULL
     OR v_source.tenant_id IS DISTINCT FROM v_target.tenant_id THEN
    RAISE EXCEPTION 'Segment not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_tenant_access(v_target.tenant_id);

  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND NOT (
    public.has_tenant_permission(v_target.tenant_id, 'segment.write', v_target.primary_location_id)
    AND public.has_tenant_permission(v_target.tenant_id, 'customer.write', NULL)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to copy segment members' USING ERRCODE = '42501';
  END IF;

  IF v_target.deleted_at IS NOT NULL OR v_target.auto_update THEN
    RAISE EXCEPTION 'Members can only be copied into an active static segment';
  END IF;

  IF p_after_customer_id IS NULL
     AND EXISTS (SELECT 1 FROM public.customer_segments WHERE segment_id = p_target_segment_id) THEN
    RAISE EXCEPTION 'The new segment already has members';
  END IF;

  PERFORM set_config('bloomsuite.bulk_segment_copy', 'on', true);

  WITH page AS (
    SELECT membership.customer_id
    FROM public.customer_segments AS membership
    JOIN public.crm_customers AS customer ON customer.id = membership.customer_id
    WHERE membership.segment_id = p_source_segment_id
      AND customer.tenant_id = v_target.tenant_id
      AND (p_after_customer_id IS NULL OR membership.customer_id > p_after_customer_id)
    ORDER BY membership.customer_id
    LIMIT v_limit
  ),
  inserted AS (
    INSERT INTO public.customer_segments (customer_id, segment_id, assigned_by_user_id)
    SELECT page.customer_id, p_target_segment_id, auth.uid()
    FROM page
    ON CONFLICT (customer_id, segment_id) DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM page),
    (SELECT max(page.customer_id::text)::uuid FROM page),
    (SELECT count(*) FROM inserted)
  INTO v_scanned, v_last, v_inserted;

  PERFORM set_config('bloomsuite.bulk_segment_copy', 'off', true);

  UPDATE public.crm_segments
  SET customer_count = (
    SELECT count(*) FROM public.customer_segments WHERE segment_id = p_target_segment_id
  )
  WHERE id = p_target_segment_id;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'last_customer_id', v_last,
    'done', v_scanned < v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.copy_segment_members_batch(uuid, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_segment_members_batch(uuid, uuid, uuid, integer) TO authenticated, service_role;

-- The one-shot copy now walks the batches (for SQL/service use).
CREATE OR REPLACE FUNCTION public.copy_segment_members(
  p_source_segment_id uuid,
  p_target_segment_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_after uuid;
  v_total integer := 0;
  v_batch jsonb;
BEGIN
  LOOP
    v_batch := public.copy_segment_members_batch(p_source_segment_id, p_target_segment_id, v_after, 10000);
    v_total := v_total + (v_batch->>'inserted')::integer;
    EXIT WHEN (v_batch->>'done')::boolean;
    v_after := (v_batch->>'last_customer_id')::uuid;
  END LOOP;
  RETURN v_total;
END;
$$;
