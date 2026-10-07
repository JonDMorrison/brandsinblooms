\set ON_ERROR_STOP on
SELECT current_database()='bloom_reporting_test' AS isolated_database \gset
\if :isolated_database
\else
  \echo 'Refusing to run outside disposable bloom_reporting_test'
  \quit 3
\endif
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_user::text$$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,role text);
CREATE TABLE public.admin_session_context(admin_user_id uuid PRIMARY KEY,active_tenant_id uuid);
CREATE TABLE public.tenant_locations(id uuid,tenant_id uuid,is_active boolean);
CREATE TABLE public.user_location_access(user_id uuid,tenant_id uuid,location_id uuid);
CREATE TABLE public.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,primary_location_id uuid);
CREATE TABLE public.customer_location_activity(customer_id uuid,tenant_id uuid,location_id uuid);
CREATE FUNCTION public.is_master_admin(id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT id='20000000-0000-4000-8000-000000000001'::uuid$$;
CREATE OR REPLACE FUNCTION public.has_tenant_permission(
  p_tenant_id uuid,
  p_permission text,
  p_location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_has_location boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF coalesce(public.is_master_admin(v_user_id), false) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.admin_session_context AS context
      WHERE context.admin_user_id = v_user_id
        AND context.active_tenant_id = p_tenant_id
    );
  END IF;

  SELECT app_user.role
  INTO v_role
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id
    AND app_user.tenant_id = p_tenant_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_location_access AS access
    JOIN public.tenant_locations AS location
      ON location.tenant_id = access.tenant_id
     AND location.id = access.location_id
     AND location.is_active
    WHERE access.user_id = v_user_id
      AND access.tenant_id = p_tenant_id
      AND (p_location_id IS NULL OR access.location_id = p_location_id)
  ) INTO v_has_location;

  IF v_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  CASE lower(coalesce(p_permission, ''))
    WHEN 'location.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND v_has_location);
    WHEN 'location.manage' THEN RETURN false;
    WHEN 'user.manage' THEN RETURN false;
    WHEN 'customer.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.delete' THEN RETURN false;
    WHEN 'campaign.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'campaign.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'segment.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'segment.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'automation.read' THEN RETURN v_role = 'marketing';
    WHEN 'automation.write' THEN RETURN v_role = 'marketing';
    WHEN 'loyalty.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'loyalty.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'reporting.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'export.customers' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END;
$$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_read ON public.users FOR SELECT TO authenticated USING(id=(SELECT auth.uid()) OR public.is_master_admin((SELECT auth.uid())));
ALTER TABLE public.admin_session_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_read ON public.admin_session_context FOR SELECT TO authenticated USING(admin_user_id=(SELECT auth.uid()));
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_location_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_read ON public.customer_location_activity FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'customer.read',location_id));
CREATE POLICY crm_customers_select_by_scope ON public.crm_customers FOR SELECT TO authenticated USING (
 public.has_tenant_permission(tenant_id,'customer.read',primary_location_id) OR EXISTS (
  SELECT 1 FROM public.customer_location_activity activity WHERE activity.customer_id=crm_customers.id AND activity.tenant_id=crm_customers.tenant_id AND public.has_tenant_permission(activity.tenant_id,'customer.read',activity.location_id))
);
GRANT SELECT ON public.users,public.admin_session_context,public.crm_customers,public.customer_location_activity TO authenticated;
INSERT INTO public.users
 SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',
  CASE n WHEN 1 THEN 'admin' WHEN 2 THEN 'owner' WHEN 3 THEN 'admin' WHEN 4 THEN 'marketing' WHEN 5 THEN 'store_manager' WHEN 6 THEN 'staff' WHEN 7 THEN 'viewer' WHEN 8 THEN 'staff' WHEN 9 THEN 'store_manager' ELSE 'marketing' END
 FROM generate_series(1,10)n;
UPDATE public.users SET tenant_id='10000000-0000-4000-8000-000000000002' WHERE id='20000000-0000-4000-8000-000000000010';
INSERT INTO public.tenant_locations VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',false);
INSERT INTO public.user_location_access SELECT id,tenant_id,'30000000-0000-4000-8000-000000000001'::uuid FROM public.users WHERE role IN('staff','store_manager') AND id<>'20000000-0000-4000-8000-000000000008';
INSERT INTO public.user_location_access VALUES('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
INSERT INTO public.crm_customers SELECT ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<5 THEN '10000000-0000-4000-8000-000000000001'::uuid ELSE '10000000-0000-4000-8000-000000000002'::uuid END,
 CASE WHEN n=2 THEN '30000000-0000-4000-8000-000000000001'::uuid WHEN n=3 THEN '30000000-0000-4000-8000-000000000002'::uuid ELSE NULL END FROM generate_series(1,6)n;
INSERT INTO public.customer_location_activity VALUES('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
CREATE TABLE public.crm_segments(id uuid PRIMARY KEY,tenant_id uuid,location_scope text,primary_location_id uuid);
CREATE TABLE public.segment_location_targets(segment_id uuid,tenant_id uuid,location_id uuid);
CREATE TABLE public.customer_segments(customer_id uuid,segment_id uuid);
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_location_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_segments_manage_by_scope ON public.crm_segments FOR ALL TO authenticated USING(public.has_tenant_permission(tenant_id,'segment.write',primary_location_id)) WITH CHECK(public.has_tenant_permission(tenant_id,'segment.write',primary_location_id));
CREATE POLICY crm_segments_select_by_scope ON public.crm_segments FOR SELECT TO authenticated USING (
 (location_scope='all_locations' AND public.has_tenant_permission(tenant_id,'segment.read',NULL)) OR
 (location_scope='one_location' AND public.has_tenant_permission(tenant_id,'segment.read',primary_location_id)) OR
 (location_scope='selected_locations' AND EXISTS(SELECT 1 FROM public.segment_location_targets t WHERE t.segment_id=crm_segments.id AND t.tenant_id=crm_segments.tenant_id AND public.has_tenant_permission(t.tenant_id,'segment.read',t.location_id)))
);
CREATE POLICY targets_read ON public.segment_location_targets FOR SELECT TO authenticated USING(public.has_tenant_permission(tenant_id,'segment.read',location_id) OR public.has_tenant_permission(tenant_id,'segment.write',location_id));
CREATE POLICY customer_segments_select_by_scope ON public.customer_segments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.crm_customers customer JOIN public.crm_segments segment ON segment.tenant_id=customer.tenant_id WHERE customer.id=customer_segments.customer_id AND segment.id=customer_segments.segment_id));
GRANT SELECT ON public.crm_segments,public.segment_location_targets,public.customer_segments TO authenticated;
INSERT INTO public.crm_segments SELECT ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n=7 THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END,
 CASE WHEN n IN(1,7) THEN 'all_locations' WHEN n IN(2,3) THEN 'one_location' ELSE 'selected_locations' END,
 CASE WHEN n=2 THEN '30000000-0000-4000-8000-000000000001'::uuid WHEN n=3 THEN '30000000-0000-4000-8000-000000000002'::uuid ELSE NULL END FROM generate_series(1,7)n;
INSERT INTO public.segment_location_targets VALUES
 ('50000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
-- Include mismatched-company membership pairs to prove they stay invisible.
INSERT INTO public.customer_segments SELECT c.id,s.id FROM public.crm_customers c CROSS JOIN public.crm_segments s;
CREATE TEMP TABLE expected(user_id uuid,active_tenant uuid,customer_ids uuid[],segment_ids uuid[],membership_pairs text[]);
DO $$DECLARE actor uuid; target uuid; ids uuid[]; segments uuid[]; pairs text[]; n integer; BEGIN
 FOR n IN 1..11 LOOP
  actor:=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  FOREACH target IN ARRAY ARRAY[NULL::uuid,'10000000-0000-4000-8000-000000000001'::uuid,'10000000-0000-4000-8000-000000000002'::uuid] LOOP
   INSERT INTO public.admin_session_context VALUES(actor,target) ON CONFLICT(admin_user_id) DO UPDATE SET active_tenant_id=excluded.active_tenant_id;
   PERFORM set_config('request.jwt.claim.sub',actor::text,true);
   SET LOCAL ROLE authenticated;
   SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO ids FROM public.crm_customers;
   SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO segments FROM public.crm_segments;
   SELECT coalesce(array_agg(customer_id::text||':'||segment_id::text ORDER BY customer_id,segment_id),'{}'::text[]) INTO pairs FROM public.customer_segments;
   RESET ROLE;
   INSERT INTO expected VALUES(actor,target,ids,segments,pairs);
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE public.crm_customers ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN deleted_at timestamptz, ADD COLUMN merged_into_customer_id uuid;
\ir ../../supabase/migrations/20261007222658_crm_customer_page_index.sql
\ir ../../supabase/migrations/20261007222658_crm_customer_page_index.sql
\ir ../../supabase/migrations/20261007223053_crm_customer_read_once.sql
\ir ../../supabase/migrations/20261007223053_crm_customer_read_once.sql
\ir ../../supabase/migrations/20261007224331_crm_segment_read_once.sql
\ir ../../supabase/migrations/20261007224331_crm_segment_read_once.sql
\ir ../../supabase/migrations/20261007224534_crm_membership_read_maps.sql
\ir ../../supabase/migrations/20261007224534_crm_membership_read_maps.sql
\ir ../../supabase/migrations/20261007224709_crm_membership_candidate_scope.sql
\ir ../../supabase/migrations/20261007224709_crm_membership_candidate_scope.sql
\ir ../../supabase/migrations/20261007224846_crm_membership_effective_scope.sql
\ir ../../supabase/migrations/20261007224846_crm_membership_effective_scope.sql
DO $$DECLARE test record; ids uuid[]; segments uuid[]; pairs text[]; BEGIN
 FOR test IN SELECT * FROM expected LOOP
   INSERT INTO public.admin_session_context VALUES(test.user_id,test.active_tenant) ON CONFLICT(admin_user_id) DO UPDATE SET active_tenant_id=excluded.active_tenant_id;
   PERFORM set_config('request.jwt.claim.sub',test.user_id::text,true);
   SET LOCAL ROLE authenticated;
   SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO ids FROM public.crm_customers;
   SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO segments FROM public.crm_segments;
   SELECT coalesce(array_agg(customer_id::text||':'||segment_id::text ORDER BY customer_id,segment_id),'{}'::text[]) INTO pairs FROM public.customer_segments;
   RESET ROLE;
   IF segments IS DISTINCT FROM test.segment_ids OR pairs IS DISTINCT FROM test.membership_pairs THEN RAISE EXCEPTION 'Segment/membership access changed for %, context %',test.user_id,test.active_tenant; END IF;
   IF ids IS DISTINCT FROM test.customer_ids THEN RAISE EXCEPTION 'Authorization changed for user %, context %: expected %, got %',test.user_id,test.active_tenant,test.customer_ids,ids;END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE authenticated;
 SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO ids FROM public.crm_customers;
 RESET ROLE;
 IF cardinality(ids)<>0 THEN RAISE EXCEPTION 'Unauthenticated claims saw customer data';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='public.idx_crm_customers_active_tenant_created'::regclass AND indisvalid) THEN RAISE EXCEPTION 'Customer page index missing or invalid'; END IF;
 IF (SELECT cardinality(customer_ids) FROM expected WHERE user_id='20000000-0000-4000-8000-000000000006' AND active_tenant IS NULL)<>2 THEN RAISE EXCEPTION 'Fixture did not exercise primary and linked active locations';END IF;
 IF (SELECT cardinality(customer_ids) FROM expected WHERE user_id='20000000-0000-4000-8000-000000000008' AND active_tenant IS NULL)<>0 THEN RAISE EXCEPTION 'Inactive location fixture ineffective';END IF;
END $$;
ROLLBACK;
\echo 'PASS: all 33 role/context combinations preserve customers, segments and membership pairs, including active/inactive locations, unknown users, cross-tenant context and unauthenticated denial'
