-- Central-login 59, 59/R-02 (the crm-r2-F203 root cause on three more tables): the "System can insert …" policies on
-- analytics_data, hub_interactions and hub_views were created with no role list, so they applied to every Data API role
-- and the publishable key alone could write forged hub views, interactions and analytics rows into any tenant's
-- reporting. Their only writers (content-hub, hub-analytics) use the service role; analytics_data has no writer in code.
-- Each policy is re-created with its current check, for the service role only. Read policies are unchanged.
DROP POLICY IF EXISTS "System can insert analytics data" ON public.analytics_data;
CREATE POLICY "System can insert analytics data" ON public.analytics_data
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert hub interactions" ON public.hub_interactions;
CREATE POLICY "System can insert hub interactions" ON public.hub_interactions
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert hub views" ON public.hub_views;
CREATE POLICY "System can insert hub views" ON public.hub_views
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
