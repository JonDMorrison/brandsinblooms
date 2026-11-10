-- Equivalent to the original EXISTS join: both parent records must be visible
-- through their own RLS policies and their tenant IDs must match. Scalar maps
-- are built once per statement, not once per member in a large audience.
-- Maps contain only ID->tenant-ID pairs. Nothing is stored or returned to users.
DO $migration$
DECLARE original_qual text;
BEGIN
  SELECT qual INTO original_qual FROM pg_policies WHERE schemaname='public'
    AND tablename='customer_segments' AND policyname='customer_segments_select_by_scope';
  IF original_qual IS NULL THEN RAISE EXCEPTION 'Customer membership policy not found'; END IF;
  IF strpos(original_qual,'visible_customer_map')>0 THEN RETURN; END IF;
  IF regexp_replace(original_qual,'\s+','','g') <> regexp_replace(
    '(EXISTS ( SELECT 1 FROM (crm_customers customer JOIN crm_segments segment ON ((segment.tenant_id = customer.tenant_id))) WHERE ((customer.id = customer_segments.customer_id) AND (segment.id = customer_segments.segment_id))))','\s+','','g') THEN
    RAISE EXCEPTION 'Membership policy differs from the reviewed parent-visibility join';
  END IF;
  EXECUTE $policy$
    ALTER POLICY customer_segments_select_by_scope ON public.customer_segments USING (
      ((SELECT jsonb_object_agg(visible_customer_map.id::text,visible_customer_map.tenant_id::text)
          FROM public.crm_customers visible_customer_map)->>customer_id::text)
      =
      ((SELECT jsonb_object_agg(visible_segment_map.id::text,visible_segment_map.tenant_id::text)
          FROM public.crm_segments visible_segment_map)->>segment_id::text)
    )
  $policy$;
END $migration$;
