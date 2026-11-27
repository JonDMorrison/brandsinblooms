-- Subscriptions are written only by trusted server paths.
--
-- Before this migration any authenticated user could run
--   supabase.from('subscriptions').update({ plan: 'bloom', tier: 'bloom',
--     end_date: '2099-01-01' }).eq('user_id', <own id>)
-- from the browser and grant themselves a paid plan, because the
-- "Users can update their own subscription" policy had USING (auth.uid() =
-- user_id) and no WITH CHECK on any column. "Users can insert their own
-- subscription" likewise let a user insert a row with any plan and dates.
--
-- Legitimate writers after this migration (all bypass RLS):
--   * on_auth_user_created_subscription trigger -> handle_new_user_subscription
--     (SECURITY DEFINER) creates the free_trial row at signup
--   * stripe-webhook, create-checkout, customer-portal, usage-notifications,
--     reset-monthly-usage, oauth-provision-user (service_role)
--   * admin_change_tenant_plan, admin_extend_trial(_by_email),
--     merge_duplicate_accounts, bill_sms_message and the other SECURITY
--     DEFINER RPCs
--
-- The browser keeps read access ("Users can view their own subscription" and
-- "Teammates can view their business subscription" are unchanged).

DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;

-- Defense in depth: without a policy RLS already denies these, but the table
-- also carried full INSERT/UPDATE/DELETE/TRUNCATE grants to anon and
-- authenticated. TRUNCATE is not subject to RLS. Keep SELECT only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.subscriptions FROM anon, authenticated;
