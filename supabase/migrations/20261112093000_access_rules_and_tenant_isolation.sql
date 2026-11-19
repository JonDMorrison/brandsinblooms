-- Access rules and tenant isolation (central-login milestone 45; audit crm-r1-F26, F02, F30, F31, F32, F37,
-- F25 and 21/R-01). Every statement is safe to re-run. Policies the browser relies on are written here so the
-- migration chain matches the hosted project; where a rule changes, the comment says what and why.

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F26: tenants. Any member of a tenant (any role) could update every column of its tenant row:
-- is_active, archived_at, settings, the email_under_review* governance fields, the fallback sender and the
-- default sending domain. The browser only renames its business (AccountPage: name, fallback_from_name), and
-- that page belongs to the tenant's owner or admin. Governance and sender changes go through SECURITY DEFINER
-- functions and service-role Edge Functions, which these limits don't affect.
DROP POLICY IF EXISTS "Tenant members can update their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Tenant owners and admins can update their tenant" ON public.tenants;
CREATE POLICY "Tenant owners and admins can update their tenant"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      public.is_master_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1
        FROM public.users AS app_user
        WHERE app_user.id = (SELECT auth.uid())
          AND app_user.tenant_id = tenants.id
          AND app_user.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      public.is_master_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1
        FROM public.users AS app_user
        WHERE app_user.id = (SELECT auth.uid())
          AND app_user.tenant_id = tenants.id
          AND app_user.role IN ('owner', 'admin')
      )
    )
  );

REVOKE UPDATE ON TABLE public.tenants FROM anon, authenticated;
GRANT UPDATE (name, fallback_from_name) ON TABLE public.tenants TO authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F02: team_members. Every account owns a team (handle_new_user_team), so the branch
-- "EXISTS (SELECT 1 FROM teams WHERE owner_id = auth.uid())" was true for everyone: any signed-in user could
-- insert rows in another account's name and, through UPDATE and DELETE, reach every account's rows. The
-- SELECT policy also queried team_members from inside its own policy, which Postgres refuses ("infinite
-- recursion"), so the Team page could not list members. A row belongs to the account that invited it
-- (invited_by) and is visible to the member it names (user_id); the table has no team or tenant column.
DROP POLICY IF EXISTS "Users can view team members they belong to" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can delete team members" ON public.team_members;

CREATE POLICY "Users can view team members they belong to"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR invited_by = (SELECT auth.uid()));

CREATE POLICY "Team owners can insert team members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (invited_by = (SELECT auth.uid()));

CREATE POLICY "Team owners can update team members"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (invited_by = (SELECT auth.uid()))
  WITH CHECK (invited_by = (SELECT auth.uid()));

CREATE POLICY "Team owners can delete team members"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (invited_by = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.team_members FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.team_members FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F30: app_admin_emails, the master-admin allowlist. Two USING (true) SELECT policies (one with no TO
-- clause, so PUBLIC) let anyone, signed in or not, read every admin address. The only browser read is a
-- caller checking its own address (AdminContext, useIsSuperAdmin: .eq("email", user.email)); the Edge
-- Functions and SECURITY DEFINER checks (is_master_admin, is_super_admin) read it with owner rights.
-- Writes are made by the service role, never from the browser, so the FOR ALL policy keyed on a
-- hard-coded address list goes too: no app code writes through it, and its auth.users subquery fails for
-- the authenticated role once the USING (true) policies no longer short-circuit it.
DROP POLICY IF EXISTS "Super admins can manage admin emails" ON public.app_admin_emails;
DROP POLICY IF EXISTS "System functions can read admin emails" ON public.app_admin_emails;
DROP POLICY IF EXISTS "Allow authenticated users to check admin status" ON public.app_admin_emails;
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.app_admin_emails;
CREATE POLICY "Users can check their own admin status"
  ON public.app_admin_emails
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), '')));

REVOKE ALL ON TABLE public.app_admin_emails FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.app_admin_emails FROM authenticated;
GRANT SELECT ON TABLE public.app_admin_emails TO authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F31: is_super_admin is SECURITY DEFINER but resolved app_admin_emails through the caller's
-- search_path, so a session with its own (for example temporary) app_admin_emails could make it return true.
-- Same body, pinned search_path and schema-qualified names, like is_master_admin.
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_admin_emails
    WHERE email = (SELECT u.email FROM auth.users AS u WHERE u.id = user_id)
  );
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F32: company_profiles. A 2025-12 migration dropped the owner policies; the hosted project carries
-- these five, which hold the owner boundary. Written here unchanged so the chain matches the hosted project.
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can update own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can delete own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can insert own company profile" ON public.company_profiles;
DROP POLICY IF EXISTS "Users can create their own company profile" ON public.company_profiles;
CREATE POLICY "Users can view own company profile"
  ON public.company_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own company profile"
  ON public.company_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company profile"
  ON public.company_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own company profile"
  ON public.company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can create their own company profile"
  ON public.company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F37: users and subscriptions. Their rules lived only on the hosted project. Written here as the
-- hosted project has them (after 20261110230200 for subscriptions): each signed-in user reads only its own
-- row, and neither table takes a write from anon or authenticated, so users.tenant_id, users.role and every
-- subscription column (plan, tier, dates, quotas) change only on the server.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
CREATE POLICY "Users can view their own record"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (id = (SELECT auth.uid()) OR public.is_master_admin((SELECT auth.uid())))
  );
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.users FROM anon, authenticated;
REVOKE SELECT ON TABLE public.users FROM anon;
GRANT SELECT ON TABLE public.users TO authenticated;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.subscriptions FROM anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- crm-r1-F25: check_email_exists answers whether any account uses an address. No app code calls it
-- (useDuplicateManagement is unused); only the service role keeps it.
REVOKE EXECUTE ON FUNCTION public.check_email_exists(text) FROM PUBLIC, anon, authenticated;

-- 21/R-01: the trial-expiration sender and the Notion sync are scheduler and trigger work, never a caller's.
-- Cron jobs run them as postgres, which keeps EXECUTE.
REVOKE EXECUTE ON FUNCTION public.check_trial_expiration_emails() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_internal_notion_sync() FROM PUBLIC, anon, authenticated;
