-- Milestone 59 (central-login, CRM delta fixes), pack db3a: tenant, permission and store-scope bindings on customer
-- and campaign tables. Applies after 20261116080000 (db1) and 20261116080100 (db2); uses no object they add.
--
-- Records closed (database half): crm-r2-F180, F186 (S2 location-bound reads); F202, F182, F183 (planting half),
-- F191 (direct path) (S3 composite customer keys + restrictive parent-tenant guards); F137, F149, F187, F188 (S4
-- permission-bound writes); F138 (customer_sources); F123, F185 (send state needs campaign.send); F129, F150, F151
-- (automation tables follow automation.read / automation.write); F124, F176 + F102 (service-written child tables:
-- members read only); F80 (crm_outbox); F89 (segment visibility on campaign_segments links); F119 (campaigns /
-- content_tasks writes bound to the caller's tenant).
--
-- Every policy dropped below exists under the same name in the hosted schema (crm-schema.sql, 2026-11-10) and in the
-- local catalog; every expression kept is copied from the local catalog (pg_policies, search_path ''). Writers that
-- keep working: SECURITY DEFINER functions (owner postgres) and service-role clients bypass RLS and the revoked
-- grants; browser writers are listed per block. Composite keys are added NOT VALID and then validated at the end of
-- this file: the owner's read-only pre-check (59-proof/fix-db3a/precheck-counts.sql) must report 0 for each key
-- first, otherwise VALIDATE fails and the whole migration rolls back without changing anything.
-- ---------------------------------------------------------------------------------------------------------
-- S2 (crm-r2-F180, crm-r2-F186): customer child tables, provider copies and the identity ledger are read only by
-- members who hold company-wide customer.read in the row tenant, or whose crm_customers RLS shows the referenced
-- customer in that tenant (the EXISTS runs under the caller's crm_customers_select_by_scope, so store-bound staff
-- and store managers see only their stores' customers). Both branches stay inside users.tenant_id membership, so
-- no reader gains a row the previous membership-only policy hid. Rows with no customer are company-wide only.
-- Generated from the local catalog by 59-proof/fix-db3a/work/gen_s2.py.
-- ---------------------------------------------------------------------------------------------------------

-- shopify_customers
DROP POLICY IF EXISTS "Users can view their tenant's Shopify customers" ON public.shopify_customers;
DROP POLICY IF EXISTS shopify_customers_select_by_customer_scope ON public.shopify_customers;
CREATE POLICY shopify_customers_select_by_customer_scope ON public.shopify_customers FOR SELECT TO authenticated
  USING (
    shopify_customers.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (shopify_customers.contact_id IS NOT NULL
      AND shopify_customers.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = shopify_customers.contact_id AND customer.tenant_id = shopify_customers.tenant_id))
  );

-- lightspeed_customers
DROP POLICY IF EXISTS "Users can view their tenant's Lightspeed customers" ON public.lightspeed_customers;
DROP POLICY IF EXISTS lightspeed_customers_select_by_customer_scope ON public.lightspeed_customers;
CREATE POLICY lightspeed_customers_select_by_customer_scope ON public.lightspeed_customers FOR SELECT TO authenticated
  USING (
    lightspeed_customers.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (lightspeed_customers.contact_id IS NOT NULL
      AND lightspeed_customers.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = lightspeed_customers.contact_id AND customer.tenant_id = lightspeed_customers.tenant_id))
  );

-- shopify_orders
DROP POLICY IF EXISTS "Users can view their tenant's Shopify orders" ON public.shopify_orders;
DROP POLICY IF EXISTS shopify_orders_select_by_customer_scope ON public.shopify_orders;
CREATE POLICY shopify_orders_select_by_customer_scope ON public.shopify_orders FOR SELECT TO authenticated
  USING (
    shopify_orders.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (shopify_orders.contact_id IS NOT NULL
      AND shopify_orders.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = shopify_orders.contact_id AND customer.tenant_id = shopify_orders.tenant_id))
  );

-- lightspeed_sales
DROP POLICY IF EXISTS "Users can view their tenant's Lightspeed sales" ON public.lightspeed_sales;
DROP POLICY IF EXISTS lightspeed_sales_select_by_customer_scope ON public.lightspeed_sales;
CREATE POLICY lightspeed_sales_select_by_customer_scope ON public.lightspeed_sales FOR SELECT TO authenticated
  USING (
    lightspeed_sales.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (lightspeed_sales.contact_id IS NOT NULL
      AND lightspeed_sales.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = lightspeed_sales.contact_id AND customer.tenant_id = lightspeed_sales.tenant_id))
  );

-- crm_email_consent_events
DROP POLICY IF EXISTS "Users can view consent events for their tenant" ON public.crm_email_consent_events;
DROP POLICY IF EXISTS "Users can view own tenant email consent events" ON public.crm_email_consent_events;
DROP POLICY IF EXISTS crm_email_consent_events_select_by_customer_scope ON public.crm_email_consent_events;
CREATE POLICY crm_email_consent_events_select_by_customer_scope ON public.crm_email_consent_events FOR SELECT TO authenticated
  USING (
    crm_email_consent_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_email_consent_events.customer_id IS NOT NULL
      AND crm_email_consent_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_email_consent_events.customer_id AND customer.tenant_id = crm_email_consent_events.tenant_id))
  );

-- crm_sms_consent_events
DROP POLICY IF EXISTS "Users can view SMS consent events for their tenant" ON public.crm_sms_consent_events;
DROP POLICY IF EXISTS crm_sms_consent_events_select_by_customer_scope ON public.crm_sms_consent_events;
CREATE POLICY crm_sms_consent_events_select_by_customer_scope ON public.crm_sms_consent_events FOR SELECT TO authenticated
  USING (
    crm_sms_consent_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_sms_consent_events.customer_id IS NOT NULL
      AND crm_sms_consent_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_sms_consent_events.customer_id AND customer.tenant_id = crm_sms_consent_events.tenant_id))
  );

-- sms_inbound_messages
DROP POLICY IF EXISTS "Tenant users can view inbound SMS" ON public.sms_inbound_messages;
DROP POLICY IF EXISTS sms_inbound_messages_select_by_customer_scope ON public.sms_inbound_messages;
CREATE POLICY sms_inbound_messages_select_by_customer_scope ON public.sms_inbound_messages FOR SELECT TO authenticated
  USING (
    sms_inbound_messages.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (sms_inbound_messages.customer_id IS NOT NULL
      AND sms_inbound_messages.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = sms_inbound_messages.customer_id AND customer.tenant_id = sms_inbound_messages.tenant_id))
  );

-- sms_compliance_events
DROP POLICY IF EXISTS "Users can view their tenant sms_compliance_events" ON public.sms_compliance_events;
DROP POLICY IF EXISTS sms_compliance_events_select_by_customer_scope ON public.sms_compliance_events;
CREATE POLICY sms_compliance_events_select_by_customer_scope ON public.sms_compliance_events FOR SELECT TO authenticated
  USING (
    sms_compliance_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (sms_compliance_events.customer_id IS NOT NULL
      AND sms_compliance_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = sms_compliance_events.customer_id AND customer.tenant_id = sms_compliance_events.tenant_id))
  );

-- suppression_list
DROP POLICY IF EXISTS "Users can view suppression list for their tenant" ON public.suppression_list;
DROP POLICY IF EXISTS suppression_list_select_by_customer_scope ON public.suppression_list;
CREATE POLICY suppression_list_select_by_customer_scope ON public.suppression_list FOR SELECT TO authenticated
  USING (
    suppression_list.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (suppression_list.customer_id IS NOT NULL
      AND suppression_list.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = suppression_list.customer_id AND customer.tenant_id = suppression_list.tenant_id))
    -- address-only bounced / manual rows: the reporting roles that may add or lift them (crm-r2-F149)
    OR (suppression_list.customer_id IS NULL
      AND suppression_list.suppression_type IN ('bounced', 'manual')
      AND suppression_list.tenant_id IN (
        SELECT app_user.tenant_id FROM public.users AS app_user
        WHERE app_user.id = (SELECT auth.uid())
          AND public.has_tenant_permission(app_user.tenant_id, 'reporting.read', NULL)))
  );

-- form_submissions
DROP POLICY IF EXISTS "Users can view submissions for their tenant" ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_select_by_customer_scope ON public.form_submissions;
CREATE POLICY form_submissions_select_by_customer_scope ON public.form_submissions FOR SELECT TO authenticated
  USING (
    form_submissions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (form_submissions.customer_id IS NOT NULL
      AND form_submissions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = form_submissions.customer_id AND customer.tenant_id = form_submissions.tenant_id))
  );

-- crm_email_preference_tokens
DROP POLICY IF EXISTS "Users can manage preference tokens for their tenant" ON public.crm_email_preference_tokens;
DROP POLICY IF EXISTS crm_email_preference_tokens_select_by_customer_scope ON public.crm_email_preference_tokens;
CREATE POLICY crm_email_preference_tokens_select_by_customer_scope ON public.crm_email_preference_tokens FOR SELECT TO authenticated
  USING (
    crm_email_preference_tokens.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_email_preference_tokens.customer_id IS NOT NULL
      AND crm_email_preference_tokens.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_email_preference_tokens.customer_id AND customer.tenant_id = crm_email_preference_tokens.tenant_id))
  );
DROP POLICY IF EXISTS crm_email_preference_tokens_insert_by_membership ON public.crm_email_preference_tokens;
CREATE POLICY crm_email_preference_tokens_insert_by_membership ON public.crm_email_preference_tokens FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_email_preference_tokens.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_email_preference_tokens_update_by_membership ON public.crm_email_preference_tokens;
CREATE POLICY crm_email_preference_tokens_update_by_membership ON public.crm_email_preference_tokens FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_email_preference_tokens.tenant_id) AND (u.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_email_preference_tokens.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_email_preference_tokens_delete_by_membership ON public.crm_email_preference_tokens;
CREATE POLICY crm_email_preference_tokens_delete_by_membership ON public.crm_email_preference_tokens FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_email_preference_tokens.tenant_id) AND (u.id = auth.uid())))));

-- crm_activity_events
DROP POLICY IF EXISTS "crm_activity_events_select" ON public.crm_activity_events;
DROP POLICY IF EXISTS crm_activity_events_select_by_customer_scope ON public.crm_activity_events;
CREATE POLICY crm_activity_events_select_by_customer_scope ON public.crm_activity_events FOR SELECT TO authenticated
  USING (
    crm_activity_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_activity_events.customer_id IS NOT NULL
      AND crm_activity_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_activity_events.customer_id AND customer.tenant_id = crm_activity_events.tenant_id))
  );

-- email_send_skips
DROP POLICY IF EXISTS "Users can view their tenant skipped sends" ON public.email_send_skips;
DROP POLICY IF EXISTS email_send_skips_select_by_customer_scope ON public.email_send_skips;
CREATE POLICY email_send_skips_select_by_customer_scope ON public.email_send_skips FOR SELECT TO authenticated
  USING (
    email_send_skips.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (email_send_skips.customer_id IS NOT NULL
      AND email_send_skips.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = email_send_skips.customer_id AND customer.tenant_id = email_send_skips.tenant_id))
  );

-- email_test_sends
DROP POLICY IF EXISTS "Users can view their tenant test sends" ON public.email_test_sends;
DROP POLICY IF EXISTS email_test_sends_select_by_customer_scope ON public.email_test_sends;
CREATE POLICY email_test_sends_select_by_customer_scope ON public.email_test_sends FOR SELECT TO authenticated
  USING (
    email_test_sends.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (email_test_sends.customer_id IS NOT NULL
      AND email_test_sends.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = email_test_sends.customer_id AND customer.tenant_id = email_test_sends.tenant_id))
  );

-- email_tracked_links
DROP POLICY IF EXISTS "Users can view their tenant tracked links" ON public.email_tracked_links;
DROP POLICY IF EXISTS email_tracked_links_select_by_customer_scope ON public.email_tracked_links;
CREATE POLICY email_tracked_links_select_by_customer_scope ON public.email_tracked_links FOR SELECT TO authenticated
  USING (
    email_tracked_links.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (email_tracked_links.customer_id IS NOT NULL
      AND email_tracked_links.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = email_tracked_links.customer_id AND customer.tenant_id = email_tracked_links.tenant_id))
  );

-- email_click_events
DROP POLICY IF EXISTS "Users can view their tenant click events" ON public.email_click_events;
DROP POLICY IF EXISTS email_click_events_select_by_customer_scope ON public.email_click_events;
CREATE POLICY email_click_events_select_by_customer_scope ON public.email_click_events FOR SELECT TO authenticated
  USING (
    email_click_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (email_click_events.customer_id IS NOT NULL
      AND email_click_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = email_click_events.customer_id AND customer.tenant_id = email_click_events.tenant_id))
  );

-- automation_email_executions
DROP POLICY IF EXISTS "Users can view their tenant automation executions" ON public.automation_email_executions;
DROP POLICY IF EXISTS automation_email_executions_select_by_customer_scope ON public.automation_email_executions;
CREATE POLICY automation_email_executions_select_by_customer_scope ON public.automation_email_executions FOR SELECT TO authenticated
  USING (
    automation_email_executions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (automation_email_executions.customer_id IS NOT NULL
      AND automation_email_executions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = automation_email_executions.customer_id AND customer.tenant_id = automation_email_executions.tenant_id))
  );

-- automation_runs
DROP POLICY IF EXISTS "Users can view their tenant automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS automation_runs_select_by_customer_scope ON public.automation_runs;
CREATE POLICY automation_runs_select_by_customer_scope ON public.automation_runs FOR SELECT TO authenticated
  USING (
    automation_runs.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (automation_runs.customer_id IS NOT NULL
      AND automation_runs.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = automation_runs.customer_id AND customer.tenant_id = automation_runs.tenant_id))
  );

-- automation_trigger_events
DROP POLICY IF EXISTS "Users can view their tenant trigger events" ON public.automation_trigger_events;
DROP POLICY IF EXISTS automation_trigger_events_select_by_customer_scope ON public.automation_trigger_events;
CREATE POLICY automation_trigger_events_select_by_customer_scope ON public.automation_trigger_events FOR SELECT TO authenticated
  USING (
    automation_trigger_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (automation_trigger_events.customer_id IS NOT NULL
      AND automation_trigger_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = automation_trigger_events.customer_id AND customer.tenant_id = automation_trigger_events.tenant_id))
  );

-- form_automation_executions
DROP POLICY IF EXISTS "Users can view their tenant's execution logs" ON public.form_automation_executions;
DROP POLICY IF EXISTS form_automation_executions_select_by_customer_scope ON public.form_automation_executions;
CREATE POLICY form_automation_executions_select_by_customer_scope ON public.form_automation_executions FOR SELECT TO authenticated
  USING (
    form_automation_executions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (form_automation_executions.customer_id IS NOT NULL
      AND form_automation_executions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = form_automation_executions.customer_id AND customer.tenant_id = form_automation_executions.tenant_id))
  );

-- campaign_revenue_attributions
DROP POLICY IF EXISTS "Tenant users can view campaign revenue attribution" ON public.campaign_revenue_attributions;
DROP POLICY IF EXISTS campaign_revenue_attributions_select_by_customer_scope ON public.campaign_revenue_attributions;
CREATE POLICY campaign_revenue_attributions_select_by_customer_scope ON public.campaign_revenue_attributions FOR SELECT TO authenticated
  USING (
    campaign_revenue_attributions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (campaign_revenue_attributions.customer_id IS NOT NULL
      AND campaign_revenue_attributions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = campaign_revenue_attributions.customer_id AND customer.tenant_id = campaign_revenue_attributions.tenant_id))
  );

-- customer_loyalty_metrics
DROP POLICY IF EXISTS "Tenant users can view loyalty metrics" ON public.customer_loyalty_metrics;
DROP POLICY IF EXISTS customer_loyalty_metrics_select_by_customer_scope ON public.customer_loyalty_metrics;
CREATE POLICY customer_loyalty_metrics_select_by_customer_scope ON public.customer_loyalty_metrics FOR SELECT TO authenticated
  USING (
    customer_loyalty_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_loyalty_metrics.customer_id IS NOT NULL
      AND customer_loyalty_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_loyalty_metrics.customer_id AND customer.tenant_id = customer_loyalty_metrics.tenant_id))
  );

-- loyalty_points_transactions
DROP POLICY IF EXISTS "Tenant users can view loyalty point transactions" ON public.loyalty_points_transactions;
DROP POLICY IF EXISTS loyalty_points_transactions_select_by_customer_scope ON public.loyalty_points_transactions;
CREATE POLICY loyalty_points_transactions_select_by_customer_scope ON public.loyalty_points_transactions FOR SELECT TO authenticated
  USING (
    loyalty_points_transactions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (loyalty_points_transactions.customer_id IS NOT NULL
      AND loyalty_points_transactions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = loyalty_points_transactions.customer_id AND customer.tenant_id = loyalty_points_transactions.tenant_id))
  );

-- perks_enrollment_events
DROP POLICY IF EXISTS "Tenant users can view loyalty enrollment events" ON public.perks_enrollment_events;
DROP POLICY IF EXISTS perks_enrollment_events_select_by_customer_scope ON public.perks_enrollment_events;
CREATE POLICY perks_enrollment_events_select_by_customer_scope ON public.perks_enrollment_events FOR SELECT TO authenticated
  USING (
    perks_enrollment_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (perks_enrollment_events.customer_id IS NOT NULL
      AND perks_enrollment_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = perks_enrollment_events.customer_id AND customer.tenant_id = perks_enrollment_events.tenant_id))
  );

-- loyalty_provider_accounts
DROP POLICY IF EXISTS "Tenant users can view provider loyalty accounts" ON public.loyalty_provider_accounts;
DROP POLICY IF EXISTS loyalty_provider_accounts_select_by_customer_scope ON public.loyalty_provider_accounts;
CREATE POLICY loyalty_provider_accounts_select_by_customer_scope ON public.loyalty_provider_accounts FOR SELECT TO authenticated
  USING (
    loyalty_provider_accounts.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (loyalty_provider_accounts.customer_id IS NOT NULL
      AND loyalty_provider_accounts.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = loyalty_provider_accounts.customer_id AND customer.tenant_id = loyalty_provider_accounts.tenant_id))
  );

-- loyalty_provider_balance_snapshots
DROP POLICY IF EXISTS "Tenant users can view provider loyalty snapshots" ON public.loyalty_provider_balance_snapshots;
DROP POLICY IF EXISTS loyalty_provider_balance_snapshots_select_by_customer_scope ON public.loyalty_provider_balance_snapshots;
CREATE POLICY loyalty_provider_balance_snapshots_select_by_customer_scope ON public.loyalty_provider_balance_snapshots FOR SELECT TO authenticated
  USING (
    loyalty_provider_balance_snapshots.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (loyalty_provider_balance_snapshots.customer_id IS NOT NULL
      AND loyalty_provider_balance_snapshots.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = loyalty_provider_balance_snapshots.customer_id AND customer.tenant_id = loyalty_provider_balance_snapshots.tenant_id))
  );

-- customer_identity_metrics
DROP POLICY IF EXISTS "Users can view their tenant's identity metrics" ON public.customer_identity_metrics;
DROP POLICY IF EXISTS customer_identity_metrics_select_by_customer_scope ON public.customer_identity_metrics;
CREATE POLICY customer_identity_metrics_select_by_customer_scope ON public.customer_identity_metrics FOR SELECT TO authenticated
  USING (
    customer_identity_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_identity_metrics.customer_id IS NOT NULL
      AND customer_identity_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_identity_metrics.customer_id AND customer.tenant_id = customer_identity_metrics.tenant_id))
  );

-- customer_email_metrics
DROP POLICY IF EXISTS "Users can view their tenant's email metrics" ON public.customer_email_metrics;
DROP POLICY IF EXISTS customer_email_metrics_select_by_customer_scope ON public.customer_email_metrics;
CREATE POLICY customer_email_metrics_select_by_customer_scope ON public.customer_email_metrics FOR SELECT TO authenticated
  USING (
    customer_email_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_email_metrics.customer_id IS NOT NULL
      AND customer_email_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_email_metrics.customer_id AND customer.tenant_id = customer_email_metrics.tenant_id))
  );

-- customer_sms_metrics
DROP POLICY IF EXISTS "Users can view their tenant's sms metrics" ON public.customer_sms_metrics;
DROP POLICY IF EXISTS customer_sms_metrics_select_by_customer_scope ON public.customer_sms_metrics;
CREATE POLICY customer_sms_metrics_select_by_customer_scope ON public.customer_sms_metrics FOR SELECT TO authenticated
  USING (
    customer_sms_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_sms_metrics.customer_id IS NOT NULL
      AND customer_sms_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_sms_metrics.customer_id AND customer.tenant_id = customer_sms_metrics.tenant_id))
  );

-- customer_engagement_summary
DROP POLICY IF EXISTS "Users can view their tenant's engagement summary" ON public.customer_engagement_summary;
DROP POLICY IF EXISTS customer_engagement_summary_select_by_customer_scope ON public.customer_engagement_summary;
CREATE POLICY customer_engagement_summary_select_by_customer_scope ON public.customer_engagement_summary FOR SELECT TO authenticated
  USING (
    customer_engagement_summary.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_engagement_summary.customer_id IS NOT NULL
      AND customer_engagement_summary.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_engagement_summary.customer_id AND customer.tenant_id = customer_engagement_summary.tenant_id))
  );

-- customer_cross_channel_metrics
DROP POLICY IF EXISTS "Users can view cross-channel metrics for their tenant" ON public.customer_cross_channel_metrics;
DROP POLICY IF EXISTS customer_cross_channel_metrics_select_by_customer_scope ON public.customer_cross_channel_metrics;
CREATE POLICY customer_cross_channel_metrics_select_by_customer_scope ON public.customer_cross_channel_metrics FOR SELECT TO authenticated
  USING (
    customer_cross_channel_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_cross_channel_metrics.customer_id IS NOT NULL
      AND customer_cross_channel_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_cross_channel_metrics.customer_id AND customer.tenant_id = customer_cross_channel_metrics.tenant_id))
  );

-- customer_post_purchase_metrics
DROP POLICY IF EXISTS "Users can view post-purchase metrics for their tenant" ON public.customer_post_purchase_metrics;
DROP POLICY IF EXISTS customer_post_purchase_metrics_select_by_customer_scope ON public.customer_post_purchase_metrics;
CREATE POLICY customer_post_purchase_metrics_select_by_customer_scope ON public.customer_post_purchase_metrics FOR SELECT TO authenticated
  USING (
    customer_post_purchase_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_post_purchase_metrics.customer_id IS NOT NULL
      AND customer_post_purchase_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_post_purchase_metrics.customer_id AND customer.tenant_id = customer_post_purchase_metrics.tenant_id))
  );

-- incentive_tracking
DROP POLICY IF EXISTS "Users can view incentives for their tenant" ON public.incentive_tracking;
DROP POLICY IF EXISTS incentive_tracking_select_by_customer_scope ON public.incentive_tracking;
CREATE POLICY incentive_tracking_select_by_customer_scope ON public.incentive_tracking FOR SELECT TO authenticated
  USING (
    incentive_tracking.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (incentive_tracking.customer_id IS NOT NULL
      AND incentive_tracking.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = incentive_tracking.customer_id AND customer.tenant_id = incentive_tracking.tenant_id))
  );

-- customer_lifecycle_metrics
DROP POLICY IF EXISTS "Users can view lifecycle metrics for their tenant" ON public.customer_lifecycle_metrics;
DROP POLICY IF EXISTS customer_lifecycle_metrics_select_by_customer_scope ON public.customer_lifecycle_metrics;
CREATE POLICY customer_lifecycle_metrics_select_by_customer_scope ON public.customer_lifecycle_metrics FOR SELECT TO authenticated
  USING (
    customer_lifecycle_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_lifecycle_metrics.customer_id IS NOT NULL
      AND customer_lifecycle_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_lifecycle_metrics.customer_id AND customer.tenant_id = customer_lifecycle_metrics.tenant_id))
  );

-- customer_lifecycle_events
DROP POLICY IF EXISTS "Users can view lifecycle events for their tenant" ON public.customer_lifecycle_events;
DROP POLICY IF EXISTS customer_lifecycle_events_select_by_customer_scope ON public.customer_lifecycle_events;
CREATE POLICY customer_lifecycle_events_select_by_customer_scope ON public.customer_lifecycle_events FOR SELECT TO authenticated
  USING (
    customer_lifecycle_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_lifecycle_events.customer_id IS NOT NULL
      AND customer_lifecycle_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_lifecycle_events.customer_id AND customer.tenant_id = customer_lifecycle_events.tenant_id))
  );

-- customer_content_intent_metrics
DROP POLICY IF EXISTS "Users can view content intent metrics for their tenant" ON public.customer_content_intent_metrics;
DROP POLICY IF EXISTS customer_content_intent_metrics_select_by_customer_scope ON public.customer_content_intent_metrics;
CREATE POLICY customer_content_intent_metrics_select_by_customer_scope ON public.customer_content_intent_metrics FOR SELECT TO authenticated
  USING (
    customer_content_intent_metrics.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_content_intent_metrics.customer_id IS NOT NULL
      AND customer_content_intent_metrics.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_content_intent_metrics.customer_id AND customer.tenant_id = customer_content_intent_metrics.tenant_id))
  );

-- content_interaction_events
DROP POLICY IF EXISTS "Users can view content interaction events for their tenant" ON public.content_interaction_events;
DROP POLICY IF EXISTS content_interaction_events_select_by_customer_scope ON public.content_interaction_events;
CREATE POLICY content_interaction_events_select_by_customer_scope ON public.content_interaction_events FOR SELECT TO authenticated
  USING (
    content_interaction_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (content_interaction_events.customer_id IS NOT NULL
      AND content_interaction_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = content_interaction_events.customer_id AND customer.tenant_id = content_interaction_events.tenant_id))
  );

-- customer_risk_signals
DROP POLICY IF EXISTS "Users can view risk signals for their tenant" ON public.customer_risk_signals;
DROP POLICY IF EXISTS customer_risk_signals_select_by_customer_scope ON public.customer_risk_signals;
CREATE POLICY customer_risk_signals_select_by_customer_scope ON public.customer_risk_signals FOR SELECT TO authenticated
  USING (
    customer_risk_signals.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_risk_signals.customer_id IS NOT NULL
      AND customer_risk_signals.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_risk_signals.customer_id AND customer.tenant_id = customer_risk_signals.tenant_id))
  );

-- negative_behavior_events
DROP POLICY IF EXISTS "Users can view negative events for their tenant" ON public.negative_behavior_events;
DROP POLICY IF EXISTS negative_behavior_events_select_by_customer_scope ON public.negative_behavior_events;
CREATE POLICY negative_behavior_events_select_by_customer_scope ON public.negative_behavior_events FOR SELECT TO authenticated
  USING (
    negative_behavior_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (negative_behavior_events.customer_id IS NOT NULL
      AND negative_behavior_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = negative_behavior_events.customer_id AND customer.tenant_id = negative_behavior_events.tenant_id))
  );

-- customer_ai_insights
DROP POLICY IF EXISTS "Users can view their tenant's insights" ON public.customer_ai_insights;
DROP POLICY IF EXISTS customer_ai_insights_select_by_customer_scope ON public.customer_ai_insights;
CREATE POLICY customer_ai_insights_select_by_customer_scope ON public.customer_ai_insights FOR SELECT TO authenticated
  USING (
    customer_ai_insights.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_ai_insights.customer_id IS NOT NULL
      AND customer_ai_insights.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_ai_insights.customer_id AND customer.tenant_id = customer_ai_insights.tenant_id))
  );

-- customer_sources
DROP POLICY IF EXISTS "Users can view sources for their tenant customers" ON public.customer_sources;
DROP POLICY IF EXISTS customer_sources_select_by_customer_scope ON public.customer_sources;
CREATE POLICY customer_sources_select_by_customer_scope ON public.customer_sources FOR SELECT TO authenticated
  USING (
    customer_sources.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (customer_sources.customer_id IS NOT NULL
      AND customer_sources.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = customer_sources.customer_id AND customer.tenant_id = customer_sources.tenant_id))
  );

-- analytics_events
DROP POLICY IF EXISTS "Users can manage analytics events for their tenant" ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_select_by_customer_scope ON public.analytics_events;
CREATE POLICY analytics_events_select_by_customer_scope ON public.analytics_events FOR SELECT TO authenticated
  USING (
    analytics_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (analytics_events.contact_id IS NOT NULL
      AND analytics_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = analytics_events.contact_id AND customer.tenant_id = analytics_events.tenant_id))
  );
DROP POLICY IF EXISTS analytics_events_insert_by_membership ON public.analytics_events;
CREATE POLICY analytics_events_insert_by_membership ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = analytics_events.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS analytics_events_update_by_membership ON public.analytics_events;
CREATE POLICY analytics_events_update_by_membership ON public.analytics_events FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = analytics_events.tenant_id) AND (u.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = analytics_events.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS analytics_events_delete_by_membership ON public.analytics_events;
CREATE POLICY analytics_events_delete_by_membership ON public.analytics_events FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = analytics_events.tenant_id) AND (u.id = auth.uid())))));

-- campaign_attribution
DROP POLICY IF EXISTS "Users can view attribution for their tenant" ON public.campaign_attribution;
DROP POLICY IF EXISTS campaign_attribution_select_by_customer_scope ON public.campaign_attribution;
CREATE POLICY campaign_attribution_select_by_customer_scope ON public.campaign_attribution FOR SELECT TO authenticated
  USING (
    campaign_attribution.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (campaign_attribution.contact_id IS NOT NULL
      AND campaign_attribution.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = campaign_attribution.contact_id AND customer.tenant_id = campaign_attribution.tenant_id))
  );

-- crm_outbox
DROP POLICY IF EXISTS "Users can access outbox in their tenant" ON public.crm_outbox;
DROP POLICY IF EXISTS "Users can manage outbox for their tenant" ON public.crm_outbox;
DROP POLICY IF EXISTS crm_outbox_select_by_customer_scope ON public.crm_outbox;
CREATE POLICY crm_outbox_select_by_customer_scope ON public.crm_outbox FOR SELECT TO authenticated
  USING (
    crm_outbox.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_outbox.customer_id IS NOT NULL
      AND crm_outbox.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_outbox.customer_id AND customer.tenant_id = crm_outbox.tenant_id))
  );

-- crm_subscriptions
DROP POLICY IF EXISTS "Users can manage subscriptions for their tenant" ON public.crm_subscriptions;
DROP POLICY IF EXISTS crm_subscriptions_select_by_customer_scope ON public.crm_subscriptions;
CREATE POLICY crm_subscriptions_select_by_customer_scope ON public.crm_subscriptions FOR SELECT TO authenticated
  USING (
    crm_subscriptions.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_subscriptions.customer_id IS NOT NULL
      AND crm_subscriptions.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_subscriptions.customer_id AND customer.tenant_id = crm_subscriptions.tenant_id))
  );
DROP POLICY IF EXISTS crm_subscriptions_insert_by_membership ON public.crm_subscriptions;
CREATE POLICY crm_subscriptions_insert_by_membership ON public.crm_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_subscriptions.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_subscriptions_update_by_membership ON public.crm_subscriptions;
CREATE POLICY crm_subscriptions_update_by_membership ON public.crm_subscriptions FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_subscriptions.tenant_id) AND (u.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_subscriptions.tenant_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_subscriptions_delete_by_membership ON public.crm_subscriptions;
CREATE POLICY crm_subscriptions_delete_by_membership ON public.crm_subscriptions FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM public.users u WHERE ((u.tenant_id = crm_subscriptions.tenant_id) AND (u.id = auth.uid())))));

-- crm_customer_identity_events
DROP POLICY IF EXISTS "crm_customer_identity_events_select_tenant" ON public.crm_customer_identity_events;
DROP POLICY IF EXISTS crm_customer_identity_events_select_by_customer_scope ON public.crm_customer_identity_events;
CREATE POLICY crm_customer_identity_events_select_by_customer_scope ON public.crm_customer_identity_events FOR SELECT TO authenticated
  USING (
    crm_customer_identity_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_customer_identity_events.crm_customer_id IS NOT NULL
      AND crm_customer_identity_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_customer_identity_events.crm_customer_id AND customer.tenant_id = crm_customer_identity_events.tenant_id))
  );

-- crm_customer_identity_links
DROP POLICY IF EXISTS "crm_customer_identity_links_select_tenant" ON public.crm_customer_identity_links;
DROP POLICY IF EXISTS crm_customer_identity_links_select_by_customer_scope ON public.crm_customer_identity_links;
CREATE POLICY crm_customer_identity_links_select_by_customer_scope ON public.crm_customer_identity_links FOR SELECT TO authenticated
  USING (
    crm_customer_identity_links.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (crm_customer_identity_links.crm_customer_id IS NOT NULL
      AND crm_customer_identity_links.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = crm_customer_identity_links.crm_customer_id AND customer.tenant_id = crm_customer_identity_links.tenant_id))
  );

-- crm_customer_identity_failures
DROP POLICY IF EXISTS "crm_customer_identity_failures_select_tenant" ON public.crm_customer_identity_failures;
DROP POLICY IF EXISTS crm_customer_identity_failures_select_by_customer_scope ON public.crm_customer_identity_failures;
CREATE POLICY crm_customer_identity_failures_select_by_customer_scope ON public.crm_customer_identity_failures FOR SELECT TO authenticated
  USING (
    crm_customer_identity_failures.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
  );

-- sms_messages
DROP POLICY IF EXISTS "Users can manage SMS messages for their tenant campaigns" ON public.sms_messages;
DROP POLICY IF EXISTS sms_messages_select_by_customer_scope ON public.sms_messages;
CREATE POLICY sms_messages_select_by_customer_scope ON public.sms_messages FOR SELECT TO authenticated
  USING (
    sms_messages.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (sms_messages.customer_id IS NOT NULL
      AND sms_messages.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = sms_messages.customer_id AND customer.tenant_id = sms_messages.tenant_id))
    -- legacy rows written before sms_messages.tenant_id existed take the campaign tenant
    OR (sms_messages.tenant_id IS NULL AND EXISTS (
      SELECT 1 FROM public.crm_sms_campaigns AS campaign
      WHERE campaign.id = sms_messages.campaign_id
        AND (
      campaign.tenant_id IN (
            SELECT app_user.tenant_id FROM public.users AS app_user
            WHERE app_user.id = (SELECT auth.uid())
              AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
          OR (sms_messages.customer_id IS NOT NULL
            AND campaign.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
            AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                        WHERE customer.id = sms_messages.customer_id AND customer.tenant_id = campaign.tenant_id)))))
  );

-- email_governance_email_events
DROP POLICY IF EXISTS "email_gov_events_select" ON public.email_governance_email_events;
DROP POLICY IF EXISTS email_governance_email_events_select_by_customer_scope ON public.email_governance_email_events;
CREATE POLICY email_governance_email_events_select_by_customer_scope ON public.email_governance_email_events FOR SELECT TO authenticated
  USING (
    email_governance_email_events.tenant_id IN (
      SELECT app_user.tenant_id FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
    OR (email_governance_email_events.customer_id IS NOT NULL
      AND email_governance_email_events.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                  WHERE customer.id = email_governance_email_events.customer_id AND customer.tenant_id = email_governance_email_events.tenant_id))
  );

-- automation_events
DROP POLICY IF EXISTS "Users can manage events for their tenant automations" ON public.automation_events;
DROP POLICY IF EXISTS automation_events_select_by_customer_scope ON public.automation_events;
CREATE POLICY automation_events_select_by_customer_scope ON public.automation_events FOR SELECT TO authenticated
  USING (
    EXISTS (
    SELECT 1 FROM public.crm_automations AS automation
    WHERE automation.id = automation_events.automation_id
      AND (
    automation.tenant_id IN (
          SELECT app_user.tenant_id FROM public.users AS app_user
          WHERE app_user.id = (SELECT auth.uid())
            AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
        OR (automation_events.customer_id IS NOT NULL
          AND automation.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
          AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                      WHERE customer.id = automation_events.customer_id AND customer.tenant_id = automation.tenant_id))))
  );
DROP POLICY IF EXISTS automation_events_insert_by_membership ON public.automation_events;
CREATE POLICY automation_events_insert_by_membership ON public.automation_events FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = automation_events.automation_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS automation_events_update_by_membership ON public.automation_events;
CREATE POLICY automation_events_update_by_membership ON public.automation_events FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = automation_events.automation_id) AND (u.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = automation_events.automation_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS automation_events_delete_by_membership ON public.automation_events;
CREATE POLICY automation_events_delete_by_membership ON public.automation_events FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = automation_events.automation_id) AND (u.id = auth.uid())))));

-- crm_automation_logs
DROP POLICY IF EXISTS "Users can access automation logs in their tenant" ON public.crm_automation_logs;
DROP POLICY IF EXISTS "Users can manage automation logs for their tenant" ON public.crm_automation_logs;
DROP POLICY IF EXISTS crm_automation_logs_select_by_customer_scope ON public.crm_automation_logs;
CREATE POLICY crm_automation_logs_select_by_customer_scope ON public.crm_automation_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
    SELECT 1 FROM public.crm_automations AS automation
    WHERE automation.id = crm_automation_logs.automation_id
      AND (
    automation.tenant_id IN (
          SELECT app_user.tenant_id FROM public.users AS app_user
          WHERE app_user.id = (SELECT auth.uid())
            AND public.has_tenant_permission(app_user.tenant_id, 'customer.read', NULL))
        OR (crm_automation_logs.customer_id IS NOT NULL
          AND automation.tenant_id IN (SELECT app_user.tenant_id FROM public.users AS app_user WHERE app_user.id = (SELECT auth.uid()))
          AND EXISTS (SELECT 1 FROM public.crm_customers AS customer
                      WHERE customer.id = crm_automation_logs.customer_id AND customer.tenant_id = automation.tenant_id))))
  );
DROP POLICY IF EXISTS crm_automation_logs_insert_by_membership ON public.crm_automation_logs;
CREATE POLICY crm_automation_logs_insert_by_membership ON public.crm_automation_logs FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = crm_automation_logs.automation_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_automation_logs_update_by_membership ON public.crm_automation_logs;
CREATE POLICY crm_automation_logs_update_by_membership ON public.crm_automation_logs FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = crm_automation_logs.automation_id) AND (u.id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = crm_automation_logs.automation_id) AND (u.id = auth.uid())))));
DROP POLICY IF EXISTS crm_automation_logs_delete_by_membership ON public.crm_automation_logs;
CREATE POLICY crm_automation_logs_delete_by_membership ON public.crm_automation_logs FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM (public.crm_automations a JOIN public.users u ON ((u.tenant_id = a.tenant_id))) WHERE ((a.id = crm_automation_logs.automation_id) AND (u.id = auth.uid())))));

-- ---------------------------------------------------------------------------------------------------------
-- S3 (crm-r2-F202, F182, F183 planting half, F191 direct path): a child row's customer must belong to the row's
-- own tenant. The single-column keys to crm_customers(id) are replaced, under the same constraint names and with the
-- same ON DELETE action, by composite keys on the existing UNIQUE (tenant_id, id) (crm_customers_tenant_id_id_key),
-- the pattern customer_location_activity and the web-push tables already use. Keeping one key per column keeps
-- PostgREST's single crm_customers relationship (embeds such as crm_customers!inner(...) keep resolving).
-- merge_crm_customers discovers keys by pg_constraint; a composite key also lists tenant_id, whose count by the
-- duplicate customer id is always 0, so the merge skips it.
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public.lightspeed_customers DROP CONSTRAINT IF EXISTS lightspeed_customers_contact_id_fkey;
ALTER TABLE public.lightspeed_customers ADD CONSTRAINT lightspeed_customers_contact_id_fkey
  FOREIGN KEY (tenant_id, contact_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (contact_id) NOT VALID;
ALTER TABLE public.lightspeed_sales DROP CONSTRAINT IF EXISTS lightspeed_sales_contact_id_fkey;
ALTER TABLE public.lightspeed_sales ADD CONSTRAINT lightspeed_sales_contact_id_fkey
  FOREIGN KEY (tenant_id, contact_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (contact_id) NOT VALID;
ALTER TABLE public.crm_email_consent_events DROP CONSTRAINT IF EXISTS crm_email_consent_events_customer_id_fkey;
ALTER TABLE public.crm_email_consent_events ADD CONSTRAINT crm_email_consent_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.crm_email_preference_tokens DROP CONSTRAINT IF EXISTS crm_email_preference_tokens_customer_id_fkey;
ALTER TABLE public.crm_email_preference_tokens ADD CONSTRAINT crm_email_preference_tokens_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.crm_sms_consent_events DROP CONSTRAINT IF EXISTS crm_sms_consent_events_customer_id_fkey;
ALTER TABLE public.crm_sms_consent_events ADD CONSTRAINT crm_sms_consent_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.customer_identity_metrics DROP CONSTRAINT IF EXISTS customer_identity_metrics_customer_id_fkey;
ALTER TABLE public.customer_identity_metrics ADD CONSTRAINT customer_identity_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_identity_metrics DROP CONSTRAINT IF EXISTS customer_identity_metrics_signup_referrer_id_fkey;
ALTER TABLE public.customer_identity_metrics ADD CONSTRAINT customer_identity_metrics_signup_referrer_id_fkey
  FOREIGN KEY (tenant_id, signup_referrer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (signup_referrer_id) NOT VALID;
ALTER TABLE public.customer_email_metrics DROP CONSTRAINT IF EXISTS customer_email_metrics_customer_id_fkey;
ALTER TABLE public.customer_email_metrics ADD CONSTRAINT customer_email_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_sms_metrics DROP CONSTRAINT IF EXISTS customer_sms_metrics_customer_id_fkey;
ALTER TABLE public.customer_sms_metrics ADD CONSTRAINT customer_sms_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_engagement_summary DROP CONSTRAINT IF EXISTS customer_engagement_summary_customer_id_fkey;
ALTER TABLE public.customer_engagement_summary ADD CONSTRAINT customer_engagement_summary_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_post_purchase_metrics DROP CONSTRAINT IF EXISTS customer_post_purchase_metrics_customer_id_fkey;
ALTER TABLE public.customer_post_purchase_metrics ADD CONSTRAINT customer_post_purchase_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.incentive_tracking DROP CONSTRAINT IF EXISTS incentive_tracking_customer_id_fkey;
ALTER TABLE public.incentive_tracking ADD CONSTRAINT incentive_tracking_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_lifecycle_metrics DROP CONSTRAINT IF EXISTS customer_lifecycle_metrics_customer_id_fkey;
ALTER TABLE public.customer_lifecycle_metrics ADD CONSTRAINT customer_lifecycle_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_lifecycle_events DROP CONSTRAINT IF EXISTS customer_lifecycle_events_customer_id_fkey;
ALTER TABLE public.customer_lifecycle_events ADD CONSTRAINT customer_lifecycle_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customer_content_intent_metrics DROP CONSTRAINT IF EXISTS customer_content_intent_metrics_customer_id_fkey;
ALTER TABLE public.customer_content_intent_metrics ADD CONSTRAINT customer_content_intent_metrics_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.content_interaction_events DROP CONSTRAINT IF EXISTS content_interaction_events_customer_id_fkey;
ALTER TABLE public.content_interaction_events ADD CONSTRAINT content_interaction_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.customer_risk_signals DROP CONSTRAINT IF EXISTS customer_risk_signals_customer_id_fkey;
ALTER TABLE public.customer_risk_signals ADD CONSTRAINT customer_risk_signals_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.negative_behavior_events DROP CONSTRAINT IF EXISTS negative_behavior_events_customer_id_fkey;
ALTER TABLE public.negative_behavior_events ADD CONSTRAINT negative_behavior_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.suppression_list DROP CONSTRAINT IF EXISTS suppression_list_customer_id_fkey;
ALTER TABLE public.suppression_list ADD CONSTRAINT suppression_list_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.customer_ai_insights DROP CONSTRAINT IF EXISTS customer_ai_insights_customer_id_fkey;
ALTER TABLE public.customer_ai_insights ADD CONSTRAINT customer_ai_insights_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.crm_activity_events DROP CONSTRAINT IF EXISTS crm_activity_events_customer_id_fkey;
ALTER TABLE public.crm_activity_events ADD CONSTRAINT crm_activity_events_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.email_test_sends DROP CONSTRAINT IF EXISTS email_test_sends_customer_id_fkey;
ALTER TABLE public.email_test_sends ADD CONSTRAINT email_test_sends_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (customer_id) NOT VALID;
ALTER TABLE public.customer_sources DROP CONSTRAINT IF EXISTS customer_sources_customer_id_fkey;
ALTER TABLE public.customer_sources ADD CONSTRAINT customer_sources_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_customer_id_fkey;
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE CASCADE NOT VALID;
-- crm-r2-F191 direct path: an order's CRM customer must belong to the order's tenant (pos_orders.tenant_id is set
-- from the connection by the existing trigger; a NULL tenant is not checked, as before).
ALTER TABLE public.pos_orders DROP CONSTRAINT IF EXISTS pos_orders_crm_customer_id_fkey;
ALTER TABLE public.pos_orders ADD CONSTRAINT pos_orders_crm_customer_id_fkey
  FOREIGN KEY (tenant_id, crm_customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE SET NULL (crm_customer_id) NOT VALID;
-- crm-r2-F182: merge and referral pointers stay inside the customer's tenant. The delete actions are kept as they
-- are (RESTRICT for merged_into, the default NO ACTION for the referrer).
ALTER TABLE public.crm_customers DROP CONSTRAINT IF EXISTS crm_customers_merged_into_customer_id_fkey;
ALTER TABLE public.crm_customers ADD CONSTRAINT crm_customers_merged_into_customer_id_fkey
  FOREIGN KEY (tenant_id, merged_into_customer_id) REFERENCES public.crm_customers (tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.crm_customers DROP CONSTRAINT IF EXISTS crm_customers_signup_referrer_id_fkey;
ALTER TABLE public.crm_customers ADD CONSTRAINT crm_customers_signup_referrer_id_fkey
  FOREIGN KEY (tenant_id, signup_referrer_id) REFERENCES public.crm_customers (tenant_id, id) NOT VALID;

-- Restrictive parent-tenant guards (the customer_tags_matching_tenant_guard shape) for the tables that name a
-- customer but take their tenant from another parent, or whose customer column has no key.
-- sms_messages: members no longer write it at all (crm-r2-F102 / F124 block below); the guard keeps the binding if
-- a write grant is ever restored.
DROP POLICY IF EXISTS sms_messages_parent_tenant_guard_insert ON public.sms_messages;
CREATE POLICY sms_messages_parent_tenant_guard_insert ON public.sms_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    sms_messages.tenant_id IS NOT NULL
    AND (sms_messages.campaign_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_sms_campaigns AS campaign
      WHERE campaign.id = sms_messages.campaign_id AND campaign.tenant_id = sms_messages.tenant_id))
    AND (sms_messages.customer_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_customers AS customer
      WHERE customer.id = sms_messages.customer_id AND customer.tenant_id = sms_messages.tenant_id))
  );
DROP POLICY IF EXISTS sms_messages_parent_tenant_guard_update ON public.sms_messages;
CREATE POLICY sms_messages_parent_tenant_guard_update ON public.sms_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (
    sms_messages.tenant_id IS NOT NULL
    AND (sms_messages.campaign_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_sms_campaigns AS campaign
      WHERE campaign.id = sms_messages.campaign_id AND campaign.tenant_id = sms_messages.tenant_id))
    AND (sms_messages.customer_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_customers AS customer
      WHERE customer.id = sms_messages.customer_id AND customer.tenant_id = sms_messages.tenant_id))
  );
-- automation_events has no tenant_id: the customer must belong to the automation's tenant.
DROP POLICY IF EXISTS automation_events_customer_tenant_guard_insert ON public.automation_events;
CREATE POLICY automation_events_customer_tenant_guard_insert ON public.automation_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    automation_events.customer_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.crm_automations AS automation
      JOIN public.crm_customers AS customer ON customer.tenant_id = automation.tenant_id
      WHERE automation.id = automation_events.automation_id
        AND customer.id = automation_events.customer_id)
  );
DROP POLICY IF EXISTS automation_events_customer_tenant_guard_update ON public.automation_events;
CREATE POLICY automation_events_customer_tenant_guard_update ON public.automation_events AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (
    automation_events.customer_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.crm_automations AS automation
      JOIN public.crm_customers AS customer ON customer.tenant_id = automation.tenant_id
      WHERE automation.id = automation_events.automation_id
        AND customer.id = automation_events.customer_id)
  );
-- crm-r2-F183 planting half: analytics_events.contact_id has no key (legacy merge target); a member write must name a
-- customer of the row's own tenant. campaign_attribution has no member writer (analytics-tracker writes it with the
-- service role), so the S2 block above leaves it with a SELECT policy only.
DROP POLICY IF EXISTS analytics_events_contact_tenant_guard_insert ON public.analytics_events;
CREATE POLICY analytics_events_contact_tenant_guard_insert ON public.analytics_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    analytics_events.contact_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_customers AS customer
      WHERE customer.id = analytics_events.contact_id AND customer.tenant_id = analytics_events.tenant_id)
  );
DROP POLICY IF EXISTS analytics_events_contact_tenant_guard_update ON public.analytics_events;
CREATE POLICY analytics_events_contact_tenant_guard_update ON public.analytics_events AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (
    analytics_events.contact_id IS NULL OR EXISTS (
      SELECT 1 FROM public.crm_customers AS customer
      WHERE customer.id = analytics_events.contact_id AND customer.tenant_id = analytics_events.tenant_id)
  );

-- ---------------------------------------------------------------------------------------------------------
-- S4 crm-r2-F137: customer_consents is written only through set_customer_marketing_consent_authorized and other
-- SECURITY DEFINER / service-role writers (STOP/START webhooks, imports, POS sidecar, newsletter bridge). No browser
-- code writes it. Members keep the existing read policy.
-- ---------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert consents for their tenant customers" ON public.customer_consents;
DROP POLICY IF EXISTS "Users can update consents for their tenant customers" ON public.customer_consents;
DROP POLICY IF EXISTS "Users can delete consents for their tenant" ON public.customer_consents;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.customer_consents FROM anon, authenticated;

-- S4 crm-r2-F149: suppression_list. Browser writers kept: the campaign-report bounce actions (useCampaignBounces.ts:
-- insert 'bounced', lift a 'bounced' row by setting lifted_at) and the recipient detail page (insert 'manual',
-- CRMCampaignRecipientDetailPage.tsx:1343). Complaint / unsubscribe rows stay webhook (service role) territory.
DROP POLICY IF EXISTS "Users can insert to suppression list for their tenant" ON public.suppression_list;
DROP POLICY IF EXISTS "Users can update suppression list for their tenant" ON public.suppression_list;
DROP POLICY IF EXISTS "Users can delete from suppression list for their tenant" ON public.suppression_list;
DROP POLICY IF EXISTS suppression_list_insert_by_reporting ON public.suppression_list;
CREATE POLICY suppression_list_insert_by_reporting ON public.suppression_list FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'reporting.read', NULL)
    AND suppression_type IN ('manual', 'bounced')
  );
DROP POLICY IF EXISTS suppression_list_lift_bounced_by_reporting ON public.suppression_list;
CREATE POLICY suppression_list_lift_bounced_by_reporting ON public.suppression_list FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'reporting.read', NULL) AND suppression_type = 'bounced')
  WITH CHECK (public.has_tenant_permission(tenant_id, 'reporting.read', NULL) AND suppression_type = 'bounced');
REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.suppression_list FROM anon, authenticated;
GRANT UPDATE (lifted_at, lifted_by) ON public.suppression_list TO authenticated;

-- S4 crm-r2-F187: the store-to-row link tables decide store scope for customers, campaigns and segments, so only a
-- company-wide holder of the write permission may change them (a store manager never holds the company-wide form).
-- Writers are the SECURITY DEFINER save / recompute functions; no browser or user-token Edge Function writes them.
DROP POLICY IF EXISTS customer_location_activity_manage ON public.customer_location_activity;
CREATE POLICY customer_location_activity_manage ON public.customer_location_activity FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'customer.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'customer.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'customer.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'customer.write', location_id));
DROP POLICY IF EXISTS campaign_location_targets_manage ON public.campaign_location_targets;
CREATE POLICY campaign_location_targets_manage ON public.campaign_location_targets FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'campaign.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'campaign.write', location_id));
DROP POLICY IF EXISTS segment_location_targets_manage ON public.segment_location_targets;
CREATE POLICY segment_location_targets_manage ON public.segment_location_targets FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'segment.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'segment.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'segment.write', NULL)
    AND public.has_tenant_permission(tenant_id, 'segment.write', location_id));

-- S4 crm-r2-F188: an order's customer link feeds the store-activity recompute, so order writes need company-wide
-- customer.write. No browser code writes pos_orders; the user-token writers are square-sync-sales and
-- clover-sync-sales (owner/admin integration actions); imports and webhooks use the service role.
DROP POLICY IF EXISTS pos_orders_location_insert ON public.pos_orders;
CREATE POLICY pos_orders_location_insert ON public.pos_orders FOR INSERT TO authenticated
  WITH CHECK ((tenant_id IS NOT NULL) AND public.has_tenant_permission(tenant_id, 'customer.write', NULL));
DROP POLICY IF EXISTS pos_orders_location_update ON public.pos_orders;
CREATE POLICY pos_orders_location_update ON public.pos_orders FOR UPDATE TO authenticated
  USING ((tenant_id IS NOT NULL) AND public.has_tenant_permission(tenant_id, 'customer.write', NULL))
  WITH CHECK ((tenant_id IS NOT NULL) AND public.has_tenant_permission(tenant_id, 'customer.write', NULL));

-- crm-r2-F138: customer_sources is written only by the service-role importers (mailchimp-import,
-- constant-contact-import); reads follow the S2 policy above.
DROP POLICY IF EXISTS "Users can insert sources for their tenant customers" ON public.customer_sources;
DROP POLICY IF EXISTS "Users can update sources for their tenant customers" ON public.customer_sources;
DROP POLICY IF EXISTS customer_sources_select_by_customer ON public.customer_sources;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.customer_sources FROM anon, authenticated;
REVOKE SELECT ON public.customer_sources FROM anon;

-- ---------------------------------------------------------------------------------------------------------
-- Campaign tables
-- crm-r2-F123 / F185: only a holder of campaign.send (owner/admin, marketing, sender) may put an email or SMS campaign
-- into a state the service-role scheduler acts on; campaign.write still governs drafts. Same helper and shape as
-- crm_campaigns_manage_by_scope (20260903154000) and the designer draft-only guards (20261107171733:516-545).
-- Browser writers kept: SMSCampaignWizard, SegmentSMSDialog, SMSCampaignComposer (insert), SmsCampaignActions
-- (update / delete), all used by campaign authors; designers keep drafts.
-- ---------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage SMS campaigns for their tenant" ON public.crm_sms_campaigns;
DROP POLICY IF EXISTS crm_sms_campaigns_insert_by_permission ON public.crm_sms_campaigns;
CREATE POLICY crm_sms_campaigns_insert_by_permission ON public.crm_sms_campaigns FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NOT NULL
    AND public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL)));
DROP POLICY IF EXISTS crm_sms_campaigns_update_by_permission ON public.crm_sms_campaigns;
CREATE POLICY crm_sms_campaigns_update_by_permission ON public.crm_sms_campaigns FOR UPDATE TO authenticated
  USING (tenant_id IS NOT NULL
    AND public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL)))
  WITH CHECK (tenant_id IS NOT NULL
    AND public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL)));
DROP POLICY IF EXISTS crm_sms_campaigns_delete_by_permission ON public.crm_sms_campaigns;
CREATE POLICY crm_sms_campaigns_delete_by_permission ON public.crm_sms_campaigns FOR DELETE TO authenticated
  USING (tenant_id IS NOT NULL
    AND public.has_tenant_permission(tenant_id, 'campaign.write', NULL)
    AND (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL)));
DROP POLICY IF EXISTS crm_campaigns_send_state_requires_send_insert ON public.crm_campaigns;
CREATE POLICY crm_campaigns_send_state_requires_send_insert ON public.crm_campaigns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL));
DROP POLICY IF EXISTS crm_campaigns_send_state_requires_send_update ON public.crm_campaigns;
CREATE POLICY crm_campaigns_send_state_requires_send_update ON public.crm_campaigns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL))
  WITH CHECK (status = 'draft' OR public.has_tenant_permission(tenant_id, 'campaign.send', NULL));

-- crm-r2-F129: crm_automations follows automation.read / automation.write (owner/admin and marketing), as
-- crm_customers / crm_campaigns / crm_segments do. The service-role executor, outbox worker and the definer
-- begin_automation_run bypass RLS. Browser authors (CRMAutomations, CRMAutomationBuilder, AutomationBuilder,
-- CRMAutomationGuidePage, AIAutomationDesigner, CommandPalette, Square/Clover setup wizards) are marketing or
-- owner/admin actions.
DROP POLICY IF EXISTS "Users can access automations in their tenant" ON public.crm_automations;
DROP POLICY IF EXISTS "Users can view automations for their tenant" ON public.crm_automations;
DROP POLICY IF EXISTS "Users can create automations for their tenant" ON public.crm_automations;
DROP POLICY IF EXISTS "Users can update automations for their tenant" ON public.crm_automations;
DROP POLICY IF EXISTS "Users can delete automations for their tenant" ON public.crm_automations;
DROP POLICY IF EXISTS crm_automations_select_by_permission ON public.crm_automations;
CREATE POLICY crm_automations_select_by_permission ON public.crm_automations FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.has_tenant_permission(tenant_id, 'automation.read', NULL));
DROP POLICY IF EXISTS crm_automations_manage_by_permission ON public.crm_automations;
CREATE POLICY crm_automations_manage_by_permission ON public.crm_automations FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.has_tenant_permission(tenant_id, 'automation.write', NULL))
  WITH CHECK (tenant_id IS NOT NULL AND public.has_tenant_permission(tenant_id, 'automation.write', NULL));
-- create_automation_from_draft: membership-only definer with no browser or Edge Function caller.
REVOKE EXECUTE ON FUNCTION public.create_automation_from_draft(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_automation_from_draft(uuid, text) TO service_role;

-- crm-r2-F150 / F151: automation_runs. No member inserts (begin_automation_run and the workers insert); members with
-- automation.write may change only status (usePauseAutomationRun, useScheduledAutomationTasks.ts:213-229), so
-- automation_id / customer_id / tenant_id / total_steps / trigger_data stay server-owned. Reads follow S2.
DROP POLICY IF EXISTS "Users can insert automation runs for their tenant" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can update their tenant automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS automation_runs_update_by_permission ON public.automation_runs;
CREATE POLICY automation_runs_update_by_permission ON public.automation_runs FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'automation.write', NULL))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'automation.write', NULL));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.automation_runs FROM anon, authenticated;
GRANT UPDATE (status) ON public.automation_runs TO authenticated;

-- crm-r2-F124 + crm-r2-F102 (sms_messages changed once): service-written child table; members read only (S2 SELECT
-- policy above). Writers: send-sms, sms-queue-worker, sms-campaign-enqueue-worker, sms-automation-worker,
-- sms-retry-failed, twilio-status-callback (service role) and definers. No browser code writes it.
DROP POLICY IF EXISTS sms_messages_select_by_campaign_read ON public.sms_messages;
DROP POLICY IF EXISTS "Users can view SMS messages for their tenant campaigns" ON public.sms_messages;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.sms_messages FROM anon, authenticated;
REVOKE SELECT ON public.sms_messages FROM anon;
-- crm-r2-F124: tracked_links (written by send-email-campaign, process-email-send-queue and render-email-preview with
-- the service role; read by TopLinksTable) keeps its campaign-tenant read predicate, SELECT only.
DROP POLICY IF EXISTS "Users can manage tracked links for their tenant" ON public.tracked_links;
DROP POLICY IF EXISTS "Users can view tracked links for their tenant" ON public.tracked_links;
CREATE POLICY "Users can view tracked links for their tenant" ON public.tracked_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.crm_campaigns cc JOIN public.users u ON u.tenant_id = cc.tenant_id
    WHERE cc.id = tracked_links.campaign_id AND u.id = (SELECT auth.uid())));
-- crm-r2-F176: the throttle state is written only by the service role and definers; members read their own tenant's.
DROP POLICY IF EXISTS "Tenant isolation" ON public.email_governance_campaign_throttle_states;
CREATE POLICY "Tenant isolation" ON public.email_governance_campaign_throttle_states FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = email_governance_campaign_throttle_states.tenant_id));

-- crm-r2-F80: crm_outbox. Reads follow S2; the one browser write is useCancelScheduledTask
-- (useScheduledAutomationTasks.ts:192-194, status -> 'cancelled'); every other writer is a service-role worker.
DROP POLICY IF EXISTS crm_outbox_select_by_tenant ON public.crm_outbox;
REVOKE ALL ON public.crm_outbox FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.crm_outbox FROM authenticated;
GRANT UPDATE (status) ON public.crm_outbox TO authenticated;
DROP POLICY IF EXISTS crm_outbox_cancel_by_automation_write ON public.crm_outbox;
CREATE POLICY crm_outbox_cancel_by_automation_write ON public.crm_outbox FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'automation.write', NULL))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'automation.write', NULL) AND status = 'cancelled');

-- crm-r2-F89 (database half): linking a segment to a campaign needs the segment to be visible to the caller (the
-- EXISTS runs under crm_segments_select_by_scope, so a store manager links only its stores' segments) and to belong
-- to the campaign's tenant. Browser writers kept: crmCampaignService.ts, campaignEditor.ts, SegmentSMSDialog.tsx,
-- useCampaignCloning.ts (they link segments the author can already see).
DROP POLICY IF EXISTS campaign_segments_authorized_insert ON public.campaign_segments;
CREATE POLICY campaign_segments_authorized_insert ON public.campaign_segments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crm_campaigns campaign
    WHERE campaign.id = campaign_segments.campaign_id
      AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write'::text, campaign.primary_location_id)
      AND EXISTS (
        SELECT 1 FROM public.crm_segments AS segment
        WHERE segment.id = campaign_segments.segment_id AND segment.tenant_id = campaign.tenant_id)));
DROP POLICY IF EXISTS campaign_segments_authorized_update ON public.campaign_segments;
CREATE POLICY campaign_segments_authorized_update ON public.campaign_segments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.crm_campaigns campaign
    WHERE campaign.id = campaign_segments.campaign_id
      AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write'::text, campaign.primary_location_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crm_campaigns campaign
    WHERE campaign.id = campaign_segments.campaign_id
      AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write'::text, campaign.primary_location_id)
      AND EXISTS (
        SELECT 1 FROM public.crm_segments AS segment
        WHERE segment.id = campaign_segments.segment_id AND segment.tenant_id = campaign.tenant_id)));

-- ---------------------------------------------------------------------------------------------------------
-- crm-r2-F119: calendar campaigns and content tasks. The author must be the caller and a non-null tenant_id must be
-- the caller's own users.tenant_id (the read predicate of 20260418120000). A null tenant stays allowed for the
-- caller's own row, as today: such a row is visible only to its tenantless author, and several insert paths
-- (CsvUploadDialog, CampaignDialog, AutoCampaignCreator, SmartCampaignSelector, useThemeGeneration ...) omit
-- tenant_id. commit_calendar_import_v1 (SECURITY INVOKER) inserts with tenant = the asserted actor's tenant and
-- user = the caller, which passes. The legacy campaign-ownership INSERT policy on content_tasks is dropped (it let a
-- caller insert a task with any user_id / tenant_id under an own campaign).
-- ---------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
CREATE POLICY "Users can insert their own campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = campaigns.tenant_id))
  );
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = campaigns.tenant_id))
  );
DROP POLICY IF EXISTS "Users can create content tasks for their own campaigns" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can create their own content tasks" ON public.content_tasks;
CREATE POLICY "Users can create their own content tasks" ON public.content_tasks FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = content_tasks.tenant_id))
  );
DROP POLICY IF EXISTS "Users can update their own content tasks" ON public.content_tasks;
CREATE POLICY "Users can update their own content tasks" ON public.content_tasks FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = content_tasks.tenant_id))
  );

-- ---------------------------------------------------------------------------------------------------------
-- Validate the composite keys added above (fails, and rolls the whole migration back, on any mismatched row).
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public.lightspeed_customers VALIDATE CONSTRAINT lightspeed_customers_contact_id_fkey;
ALTER TABLE public.lightspeed_sales VALIDATE CONSTRAINT lightspeed_sales_contact_id_fkey;
ALTER TABLE public.crm_email_consent_events VALIDATE CONSTRAINT crm_email_consent_events_customer_id_fkey;
ALTER TABLE public.crm_email_preference_tokens VALIDATE CONSTRAINT crm_email_preference_tokens_customer_id_fkey;
ALTER TABLE public.crm_sms_consent_events VALIDATE CONSTRAINT crm_sms_consent_events_customer_id_fkey;
ALTER TABLE public.customer_identity_metrics VALIDATE CONSTRAINT customer_identity_metrics_customer_id_fkey;
ALTER TABLE public.customer_identity_metrics VALIDATE CONSTRAINT customer_identity_metrics_signup_referrer_id_fkey;
ALTER TABLE public.customer_email_metrics VALIDATE CONSTRAINT customer_email_metrics_customer_id_fkey;
ALTER TABLE public.customer_sms_metrics VALIDATE CONSTRAINT customer_sms_metrics_customer_id_fkey;
ALTER TABLE public.customer_engagement_summary VALIDATE CONSTRAINT customer_engagement_summary_customer_id_fkey;
ALTER TABLE public.customer_post_purchase_metrics VALIDATE CONSTRAINT customer_post_purchase_metrics_customer_id_fkey;
ALTER TABLE public.incentive_tracking VALIDATE CONSTRAINT incentive_tracking_customer_id_fkey;
ALTER TABLE public.customer_lifecycle_metrics VALIDATE CONSTRAINT customer_lifecycle_metrics_customer_id_fkey;
ALTER TABLE public.customer_lifecycle_events VALIDATE CONSTRAINT customer_lifecycle_events_customer_id_fkey;
ALTER TABLE public.customer_content_intent_metrics VALIDATE CONSTRAINT customer_content_intent_metrics_customer_id_fkey;
ALTER TABLE public.content_interaction_events VALIDATE CONSTRAINT content_interaction_events_customer_id_fkey;
ALTER TABLE public.customer_risk_signals VALIDATE CONSTRAINT customer_risk_signals_customer_id_fkey;
ALTER TABLE public.negative_behavior_events VALIDATE CONSTRAINT negative_behavior_events_customer_id_fkey;
ALTER TABLE public.suppression_list VALIDATE CONSTRAINT suppression_list_customer_id_fkey;
ALTER TABLE public.customer_ai_insights VALIDATE CONSTRAINT customer_ai_insights_customer_id_fkey;
ALTER TABLE public.crm_activity_events VALIDATE CONSTRAINT crm_activity_events_customer_id_fkey;
ALTER TABLE public.email_test_sends VALIDATE CONSTRAINT email_test_sends_customer_id_fkey;
ALTER TABLE public.customer_sources VALIDATE CONSTRAINT customer_sources_customer_id_fkey;
ALTER TABLE public.automation_runs VALIDATE CONSTRAINT automation_runs_customer_id_fkey;
ALTER TABLE public.pos_orders VALIDATE CONSTRAINT pos_orders_crm_customer_id_fkey;
ALTER TABLE public.crm_customers VALIDATE CONSTRAINT crm_customers_merged_into_customer_id_fkey;
ALTER TABLE public.crm_customers VALIDATE CONSTRAINT crm_customers_signup_referrer_id_fkey;
