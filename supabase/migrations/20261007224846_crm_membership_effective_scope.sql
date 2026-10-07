-- Match has_tenant_permission's existing choice exactly: a master admin uses
-- ONLY its saved active company; everyone else uses ONLY their assigned company.
-- Do not scan a master's unrelated home company before checking its active one.
-- Both parent RLS policies still independently enforce every permission.
ALTER POLICY customer_segments_select_by_scope ON public.customer_segments USING (
  ((SELECT jsonb_object_agg(visible_customer_map.id::text,visible_customer_map.tenant_id::text)
    FROM public.crm_customers visible_customer_map
    WHERE visible_customer_map.tenant_id = (SELECT CASE
      WHEN public.is_master_admin((SELECT auth.uid())) THEN
        (SELECT context.active_tenant_id FROM public.admin_session_context context WHERE context.admin_user_id=(SELECT auth.uid()))
      ELSE (SELECT app_user.tenant_id FROM public.users app_user WHERE app_user.id=(SELECT auth.uid()))
    END))->>customer_id::text)
  =
  ((SELECT jsonb_object_agg(visible_segment_map.id::text,visible_segment_map.tenant_id::text)
    FROM public.crm_segments visible_segment_map
    WHERE visible_segment_map.tenant_id = (SELECT CASE
      WHEN public.is_master_admin((SELECT auth.uid())) THEN
        (SELECT context.active_tenant_id FROM public.admin_session_context context WHERE context.admin_user_id=(SELECT auth.uid()))
      ELSE (SELECT app_user.tenant_id FROM public.users app_user WHERE app_user.id=(SELECT auth.uid()))
    END))->>segment_id::text)
);
