-- SECURITY: [R1] - Remove overly permissive USING(true) on crm_subscriptions
DROP POLICY IF EXISTS "Public can update opt_out status" ON crm_subscriptions;
CREATE POLICY "Users can update subscriptions for their tenant" ON crm_subscriptions
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- SECURITY: [R2] - Remove overly permissive USING(true) on crm_email_preference_tokens
DROP POLICY IF EXISTS "Public can read tokens by token value" ON crm_email_preference_tokens;
CREATE POLICY "Users can read preference tokens for their tenant" ON crm_email_preference_tokens
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- SECURITY: [R3] - Remove overly permissive USING(true) on oauth_states
DROP POLICY IF EXISTS "Edge functions can manage oauth states" ON oauth_states;
CREATE POLICY "Users can manage their own oauth states" ON oauth_states
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SECURITY: [R4-R11] - Enable RLS on email governance tables missing it
ALTER TABLE email_governance_campaign_throttle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_campaign_throttle_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_contact_import_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_domain_crisis_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_domain_crisis_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_tenant_enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_governance_tenant_hard_stop_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_email_daily_usage ENABLE ROW LEVEL SECURITY;

-- Add tenant-scoped policies for each
CREATE POLICY "Tenant isolation" ON email_governance_campaign_throttle_events
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_campaign_throttle_states
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_contact_import_events
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_domain_crisis_actions
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_domain_crisis_notifications
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_tenant_enforcement_actions
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON email_governance_tenant_hard_stop_notifications
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON tenant_email_daily_usage
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Service role policies for edge functions
CREATE POLICY "Service role full access" ON email_governance_campaign_throttle_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_campaign_throttle_states FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_contact_import_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_domain_crisis_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_domain_crisis_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_tenant_enforcement_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_governance_tenant_hard_stop_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tenant_email_daily_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
