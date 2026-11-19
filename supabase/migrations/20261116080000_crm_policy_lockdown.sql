-- central-login milestone 59 (CRM delta audit), fix pack db1: policy and grant lockdown.
--
-- Closes the policy/grant root cause of: crm-r2-F132 (and the policy half of crm-r2-F181), crm-r2-F152, crm-r2-F155,
-- crm-r2-F203, crm-r2-F171, crm-r2-F168, crm-r2-F169, crm-r2-F170, crm-r2-F164 (policy half), crm-r2-F172,
-- crm-r2-F136, crm-r2-F141, crm-r2-F139, crm-r2-F126, crm-r2-F133, crm-r2-F135, crm-r2-F145, crm-r2-F146,
-- crm-r2-F140, 59/R-cred-01 (pos_connections writes) and the database part of the integrations group's Fix 2
-- (oauth_states) and Fix 4 (pos_connections).
--
-- Every statement is re-runnable (DROP ... IF EXISTS before CREATE, CREATE OR REPLACE, REVOKE). Tables that may be
-- absent on the hosted project (the six governance tables) are reached only through to_regclass guards.
-- Writers of every table below are service-role clients (BYPASSRLS) or SECURITY DEFINER functions owned by postgres
-- (table owner), so they are unaffected; the browser only reads these tables unless a section says otherwise.

-- ============================================================================================================
-- 1. POS and OAuth state tables: pos_customers, pos_connections, oauth_states
--
-- 1a. pos_customers (crm-r2-F132; policy half of crm-r2-F181)
--    Hosted carries "System can manage POS customers" FOR ALL USING (true) with no TO clause, and anon/authenticated
--    hold full grants. Reads move under the customer.read model of the connection's tenant; writes stay with the
--    service role (pos-sync, pos-link-customers) and the definer resolvers.
--    pos_connections reads stay creator-only (1b), so the policy resolves the connection's tenant through a
--    SECURITY DEFINER helper; otherwise a tenant's marketing user or a second admin would see no rows.
-- ============================================================================================================
CREATE OR REPLACE FUNCTION public.can_read_pos_connection_customers(p_pos_connection_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pos_connections AS conn
    WHERE conn.id = p_pos_connection_id
      AND conn.tenant_id IS NOT NULL
      AND public.has_tenant_permission(conn.tenant_id, 'customer.read', NULL)
  );
$function$;

COMMENT ON FUNCTION public.can_read_pos_connection_customers(uuid) IS
  'RLS helper for pos_customers: true when the caller holds customer.read (company level) in the tenant of the POS connection. Returns a boolean only.';

REVOKE ALL ON FUNCTION public.can_read_pos_connection_customers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_pos_connection_customers(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_pos_connection_customers(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "System can manage POS customers" ON public.pos_customers;
DROP POLICY IF EXISTS "Users can view customers from their POS connections" ON public.pos_customers;
DROP POLICY IF EXISTS "Users can manage pos customers for their tenant" ON public.pos_customers;

-- 1b. pos_connections (59/R-cred-01; integrations Fix 4's migration)
--    The policy in force ("Users can manage their own POS connections", FOR ALL USING auth.uid() = user_id, no WITH
--    CHECK, no TO clause) lets any account create rows in any tenant without integrations.manage. Reads stay
--    creator-only; writes also need integrations.manage in the row's tenant (crm_has_permission binds tenant_id to
--    the caller's active tenant). Edge Function writers use the service role.
DROP POLICY IF EXISTS "Users can manage their own POS connections" ON public.pos_connections;
DROP POLICY IF EXISTS "Users can manage pos connections for their tenant" ON public.pos_connections;

-- 1c. oauth_states (integrations Fix 2, database part)
--    State rows are written, read and deleted only by service-role Edge Functions (shopify/lightspeed/cloudflare
--    start and callback); no browser path touches the table. The member policies let a member of one tenant plant a
--    state naming another tenant. Only the service-role policy stays (the hosted state of
--    "Edge functions can manage oauth states").
DROP POLICY IF EXISTS "Users can insert their own oauth states" ON public.oauth_states;
DROP POLICY IF EXISTS "Users can select their own oauth states" ON public.oauth_states;
DROP POLICY IF EXISTS "Users can delete their own oauth states" ON public.oauth_states;
DROP POLICY IF EXISTS "Users can manage their own oauth states" ON public.oauth_states;
DROP POLICY IF EXISTS "Users can manage oauth states for their tenant" ON public.oauth_states;

-- 1d. Drift sweep for the three tables above: the hosted policy set of pos_customers is a deployment fact (crm-r2-F132),
-- so any other PERMISSIVE policy that applies to public, anon or authenticated is dropped too (restrictive policies,
-- service_role-only policies and this migration's own end-state policies, re-created below, are kept). Each drop
-- is reported as a NOTICE so the push output shows the drift.
DO $sweep$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname
    FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename IN ('pos_customers', 'pos_connections', 'oauth_states')
      AND p.permissive = 'PERMISSIVE'
      AND p.roles && ARRAY['public', 'anon', 'authenticated']::name[]
      AND (p.tablename, p.policyname) NOT IN (
        ('pos_customers', 'pos_customers_select_by_customer_read'),
        ('pos_connections', 'Users can view their own POS connections'),
        ('pos_connections', 'Integration managers create their own POS connections'),
        ('pos_connections', 'Integration managers update their own POS connections'),
        ('pos_connections', 'Integration managers delete their own POS connections'))
  LOOP
    RAISE NOTICE 'crm_policy_lockdown: dropping unexpected policy "%" on public.%', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$sweep$;

-- 1e. The end state of the three tables.
-- pos_customers: tenant read under customer.read; no Data API writes.
DROP POLICY IF EXISTS pos_customers_select_by_customer_read ON public.pos_customers;
CREATE POLICY pos_customers_select_by_customer_read
ON public.pos_customers
FOR SELECT
TO authenticated
USING (public.can_read_pos_connection_customers(pos_connection_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_customers FROM anon, authenticated;
REVOKE SELECT ON public.pos_customers FROM anon;

-- pos_connections: creator-only reads; writes need the creator to hold integrations.manage in the row's tenant.
DROP POLICY IF EXISTS "Users can view their own POS connections" ON public.pos_connections;
CREATE POLICY "Users can view their own POS connections"
ON public.pos_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Integration managers create their own POS connections" ON public.pos_connections;
CREATE POLICY "Integration managers create their own POS connections"
ON public.pos_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.crm_has_permission('integrations.manage', tenant_id, NULL));

DROP POLICY IF EXISTS "Integration managers update their own POS connections" ON public.pos_connections;
CREATE POLICY "Integration managers update their own POS connections"
ON public.pos_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.crm_has_permission('integrations.manage', tenant_id, NULL))
WITH CHECK (auth.uid() = user_id AND public.crm_has_permission('integrations.manage', tenant_id, NULL));

DROP POLICY IF EXISTS "Integration managers delete their own POS connections" ON public.pos_connections;
CREATE POLICY "Integration managers delete their own POS connections"
ON public.pos_connections
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- oauth_states: service role only.
DROP POLICY IF EXISTS "Edge functions can manage oauth states" ON public.oauth_states;
CREATE POLICY "Edge functions can manage oauth states"
ON public.oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================================================
-- 2. "Service ..." policies written without a TO clause apply to PUBLIC (crm-r2-F152, crm-r2-F155, crm-r2-F203)
--    Bound to service_role (the 20260501041626 pattern). email_messages also gets the tenant read policy that
--    20260205090000:51-60 meant to create (its nested $$ quoting never ran), so the campaign report
--    (CRMCampaignReport.tsx) and caller-JWT reads keep their own tenant's rows.
-- ============================================================================================================
-- crm-r2-F152: analytics_alerts
DROP POLICY IF EXISTS "service_write_alerts" ON public.analytics_alerts;
CREATE POLICY "service_write_alerts" ON public.analytics_alerts FOR INSERT TO service_role WITH CHECK (true);

-- crm-r2-F155: send-queue tables
DROP POLICY IF EXISTS "Service role can manage all email messages" ON public.email_messages;
CREATE POLICY "Service role can manage all email messages" ON public.email_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their tenant's email messages" ON public.email_messages;
CREATE POLICY "Users can view their tenant's email messages" ON public.email_messages
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT u.tenant_id FROM public.users AS u WHERE u.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Service role can manage all jobs" ON public.email_send_jobs;
CREATE POLICY "Service role can manage all jobs" ON public.email_send_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can manage domain usage" ON public.email_domain_usage;
CREATE POLICY "Service role can manage domain usage" ON public.email_domain_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can manage rate limit state" ON public.sms_rate_limit_state;
CREATE POLICY "Service role can manage rate limit state" ON public.sms_rate_limit_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm-r2-F203: seven service-only INSERT policies
DROP POLICY IF EXISTS "System can insert domain send logs" ON public.domain_send_log;
CREATE POLICY "System can insert domain send logs" ON public.domain_send_log
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service can insert skipped sends" ON public.email_send_skips;
CREATE POLICY "Service can insert skipped sends" ON public.email_send_skips
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can insert tracked links" ON public.email_tracked_links;
CREATE POLICY "Service role can insert tracked links" ON public.email_tracked_links
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can insert click events via tracking" ON public.email_click_events;
DROP POLICY IF EXISTS "Service role can insert click events" ON public.email_click_events;
CREATE POLICY "Service role can insert click events" ON public.email_click_events
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "System can insert tracking events" ON public.email_tracking_events;
CREATE POLICY "System can insert tracking events" ON public.email_tracking_events
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service can insert automation executions" ON public.automation_email_executions;
CREATE POLICY "Service can insert automation executions" ON public.automation_email_executions
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can insert sms_compliance_events" ON public.sms_compliance_events;
CREATE POLICY "Service role can insert sms_compliance_events" ON public.sms_compliance_events
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================================================
-- 3. crm-r2-F171: public preference-token read and public opt-out update
--    The public preference page uses validate-preference-token and update-email-preference (service role);
--    members keep "Users can manage preference tokens/subscriptions for their tenant" (generatePreferenceToken).
--    Guarded so that no statement names a table that is absent (why 20260320130000 failed on hosted).
-- ============================================================================================================
DO $f171$
BEGIN
  IF to_regclass('public.crm_email_preference_tokens') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public can read tokens by token value" ON public.crm_email_preference_tokens';
    EXECUTE 'REVOKE ALL ON public.crm_email_preference_tokens FROM anon';
  END IF;
  IF to_regclass('public.crm_subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public can update opt_out status" ON public.crm_subscriptions';
    EXECUTE 'REVOKE ALL ON public.crm_subscriptions FROM anon';
  END IF;
END
$f171$;

-- ============================================================================================================
-- 4. Governance tables (crm-r2-F168, crm-r2-F169, crm-r2-F170; latent part of crm-r2-F171)
--    Absent on hosted and on the local stack today; wherever they exist, members get read-only access to their own
--    tenant's rows. Writers stay the service role and the SECURITY DEFINER enqueue/claim/record functions.
-- ============================================================================================================
DO $governance$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'email_governance_contact_import_events', 'email_governance_domain_crisis_actions',
    'email_governance_domain_crisis_notifications', 'email_governance_tenant_enforcement_actions',
    'email_governance_tenant_hard_stop_notifications', 'tenant_email_daily_usage'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Tenant members can read" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Tenant members can read" ON public.%I FOR SELECT TO authenticated '
        || 'USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = %I.tenant_id))', t, t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END
$governance$;

-- ============================================================================================================
-- 5. crm-r2-F164 (policy half): system_config is read by master admins (their own policy), the service role and
--    definer getters. The unscoped read policy goes. (The getter grants are another pack's.)
-- ============================================================================================================
DROP POLICY IF EXISTS "Allow read access to system_config" ON public.system_config;

-- ============================================================================================================
-- 6. crm-r2-F172: write the hosted state of plan_definitions into the chain (RLS on, read-only policy).
-- ============================================================================================================
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view plan definitions" ON public.plan_definitions;
CREATE POLICY "Anyone can view plan definitions" ON public.plan_definitions FOR SELECT USING (true);

-- ============================================================================================================
-- 7. crm-r2-F136: open migration_* write policies (the only writer, migration-control, uses the service role).
-- ============================================================================================================
DROP POLICY IF EXISTS "System can insert logs" ON public.migration_job_logs;
DROP POLICY IF EXISTS "System can insert artifacts" ON public.migration_artifacts;
DROP POLICY IF EXISTS "System can update artifacts" ON public.migration_artifacts;

-- ============================================================================================================
-- 8. crm-r2-F141: open notification insert (writers are the service role and definer triggers; super admins keep
--    "Super admins can manage all notifications").
-- ============================================================================================================
DROP POLICY IF EXISTS "System can create notifications" ON public.support_notifications;

-- ============================================================================================================
-- 9. crm-r2-F139: the ticket owner's attachment insert binds the ticket (and the comment, when given) to the
--    caller, as "Users can add comments to their tickets" does. Support agents keep "Support agents can create
--    attachments in their tenant"; super admins keep "Super admins can manage all attachments".
-- ============================================================================================================
DROP POLICY IF EXISTS "Users can upload attachments" ON public.support_attachments;
CREATE POLICY "Users can upload attachments"
ON public.support_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND ticket_id IN (SELECT st.id FROM public.support_tickets AS st WHERE st.user_id = auth.uid())
  AND (
    comment_id IS NULL
    OR comment_id IN (
      SELECT sc.id FROM public.support_comments AS sc WHERE sc.ticket_id = support_attachments.ticket_id
    )
  )
);

-- ============================================================================================================
-- 10. storage.objects (crm-r2-F126, F133, F135, F145, F146, F140)
--     Storage policies are not in the hosted schema export: the go-live runbook checks pg_policies on hosted first.
--     objects.name is qualified wherever a joined table also has a name column.
-- ============================================================================================================
-- crm-r2-F126 media-mms: no browser path overwrites, moves or deletes objects (uploads use upsert false; the delete
-- helpers in src/lib/image have no caller; the admin upload goes through admin-manage-tenant with the service role).
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;

-- crm-r2-F133 content-thumbnails: the only writer (generate-content-thumbnail) uses the service role.
DROP POLICY IF EXISTS "Authenticated users can upload content thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their content thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their content thumbnails" ON storage.objects;

-- crm-r2-F135 campaign-images: every writer names objects <auth.uid()>/... (StudioImageUpload.tsx:333,
-- bloom-assist campaign-photo.ts:124); bind INSERT and DELETE to that first folder.
DROP POLICY IF EXISTS "Users can upload their own campaign images" ON storage.objects;
CREATE POLICY "Users can upload their own campaign images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "Users can delete their own campaign images" ON storage.objects;
CREATE POLICY "Users can delete their own campaign images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- crm-r2-F145 product-images: the first folder is a product id (ProductDetailPage.tsx:457); writes need that product
-- to belong to the caller's tenant.
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload product images" ON storage.objects;
CREATE POLICY "Tenant members can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    JOIN public.users AS u ON u.tenant_id = p.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND p.id::text = (storage.foldername(objects.name))[1]
  )
);
DROP POLICY IF EXISTS "Tenant members can update product images" ON storage.objects;
CREATE POLICY "Tenant members can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    JOIN public.users AS u ON u.tenant_id = p.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND p.id::text = (storage.foldername(objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    JOIN public.users AS u ON u.tenant_id = p.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND p.id::text = (storage.foldername(objects.name))[1]
  )
);
DROP POLICY IF EXISTS "Tenant members can delete product images" ON storage.objects;
CREATE POLICY "Tenant members can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    JOIN public.users AS u ON u.tenant_id = p.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND p.id::text = (storage.foldername(objects.name))[1]
  )
);

-- crm-r2-F146 assets: the only writer (scripts/deploy-embed-assets.ts) uses the service role; both public read
-- policies stay. "Service role can manage assets" had no TO clause (it applied to PUBLIC): bound to service_role.
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage assets" ON storage.objects;
CREATE POLICY "Service role can manage assets"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');

-- crm-r2-F140 support-attachments read: the role branch had no tenant, ticket or folder condition (every sign-up is
-- role admin of its own tenant). Objects are stored as <uploader>/<ticket id>/...; reads now mirror the table's own
-- read policies: the uploader, super admins ("Super admins can manage all attachments"), and an admin, super_admin
-- or support_agent of the ticket's tenant ("Users can view attachments on their tickets").
DROP POLICY IF EXISTS "Users can view support attachments" ON storage.objects;
CREATE POLICY "Users can view support attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (
    (SELECT auth.uid())::text = (storage.foldername(objects.name))[1]
    OR public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.users AS u
      JOIN public.support_tickets AS st ON st.tenant_id = u.tenant_id
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'support_agent'::text])
        AND st.id::text = (storage.foldername(objects.name))[2]
    )
  )
);
