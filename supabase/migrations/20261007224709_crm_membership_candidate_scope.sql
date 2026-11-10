-- Bound parent-map reads by saved server-side account/context companies before
-- applying the parents' unchanged RLS checks. The permission model allows only
-- these candidates; a saved context is not itself permission to read its data.
-- This avoids invoking RLS against every unrelated company's parent rows.
ALTER POLICY customer_segments_select_by_scope ON public.customer_segments USING (
  ((SELECT jsonb_object_agg(visible_customer_map.id::text,visible_customer_map.tenant_id::text)
    FROM public.crm_customers visible_customer_map
    WHERE visible_customer_map.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users app_user WHERE app_user.id=(SELECT auth.uid())
      UNION
      SELECT context.active_tenant_id FROM public.admin_session_context context WHERE context.admin_user_id=(SELECT auth.uid())
    ))->>customer_id::text)
  =
  ((SELECT jsonb_object_agg(visible_segment_map.id::text,visible_segment_map.tenant_id::text)
    FROM public.crm_segments visible_segment_map
    WHERE visible_segment_map.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users app_user WHERE app_user.id=(SELECT auth.uid())
      UNION
      SELECT context.active_tenant_id FROM public.admin_session_context context WHERE context.admin_user_id=(SELECT auth.uid())
    ))->>segment_id::text)
);
