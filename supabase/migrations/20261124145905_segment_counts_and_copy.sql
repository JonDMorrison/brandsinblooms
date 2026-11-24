-- workspace-qa3 #2: segment counts and copies that are not capped at 1,000 rows.

-- 1. Segment member counts are maintained by a FOR EACH ROW trigger that runs
--    COUNT(*) per inserted/deleted row, so copying 23,648 rows ran 23,648
--    counts over a growing set and timed out. The trigger function now skips
--    that work while a bulk copy (below) has set a transaction-local flag; the
--    copy writes the final count once. Every other insert/delete behaves as
--    before.
CREATE OR REPLACE FUNCTION public.update_segment_customer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('bloomsuite.bulk_segment_copy', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Update the count for the affected segment
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_segments
    SET customer_count = (SELECT COUNT(*) FROM customer_segments WHERE segment_id = NEW.segment_id)
    WHERE id = NEW.segment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crm_segments
    SET customer_count = (SELECT COUNT(*) FROM customer_segments WHERE segment_id = OLD.segment_id)
    WHERE id = OLD.segment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 2. Per-segment counts and a distinct "customers reached" total, computed in
--    the database instead of by downloading membership rows.
CREATE OR REPLACE FUNCTION public.segment_membership_summary(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_counts jsonb;
  v_distinct bigint;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);

  SELECT coalesce(jsonb_object_agg(per_segment.segment_id::text, per_segment.members), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT membership.segment_id, count(*) AS members
    FROM public.customer_segments AS membership
    JOIN public.crm_segments AS segment ON segment.id = membership.segment_id
    WHERE segment.tenant_id = p_tenant_id
      AND segment.deleted_at IS NULL
    GROUP BY membership.segment_id
  ) AS per_segment;

  SELECT count(DISTINCT membership.customer_id)
  INTO v_distinct
  FROM public.customer_segments AS membership
  JOIN public.crm_segments AS segment ON segment.id = membership.segment_id
  JOIN public.crm_customers AS customer ON customer.id = membership.customer_id
  WHERE segment.tenant_id = p_tenant_id
    AND segment.deleted_at IS NULL
    AND customer.tenant_id = p_tenant_id
    AND customer.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'segment_counts', v_counts,
    'distinct_customers', v_distinct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.segment_membership_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.segment_membership_summary(uuid) TO authenticated, service_role;

-- 3. Server-side copy of a static segment's members into a new, empty segment.
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
  v_source public.crm_segments%ROWTYPE;
  v_target public.crm_segments%ROWTYPE;
  v_inserted integer;
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

  IF EXISTS (SELECT 1 FROM public.customer_segments WHERE segment_id = p_target_segment_id) THEN
    RAISE EXCEPTION 'The new segment already has members';
  END IF;

  PERFORM set_config('bloomsuite.bulk_segment_copy', 'on', true);

  INSERT INTO public.customer_segments (customer_id, segment_id, assigned_by_user_id)
  SELECT membership.customer_id, p_target_segment_id, auth.uid()
  FROM public.customer_segments AS membership
  JOIN public.crm_customers AS customer ON customer.id = membership.customer_id
  WHERE membership.segment_id = p_source_segment_id
    AND customer.tenant_id = v_target.tenant_id
  ON CONFLICT (customer_id, segment_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  PERFORM set_config('bloomsuite.bulk_segment_copy', 'off', true);

  UPDATE public.crm_segments
  SET customer_count = (
    SELECT count(*) FROM public.customer_segments WHERE segment_id = p_target_segment_id
  )
  WHERE id = p_target_segment_id;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_segment_members(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_segment_members(uuid, uuid) TO authenticated, service_role;
