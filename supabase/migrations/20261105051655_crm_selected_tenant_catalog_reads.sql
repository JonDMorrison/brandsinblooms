-- Permit read-only catalog access to the CRM tenant selected in an
-- authenticated workspace. The canonical has_tenant_permission function
-- performs the platform-master-admin + active-tenant checks, and retains
-- normal owner/marketing/location-role permission semantics.
--
-- Existing policies stay in place. No INSERT, UPDATE or DELETE access is
-- added. Never grant cross-tenant reads based on a client-provided tenant
-- ID alone.

CREATE POLICY crm_sms_campaigns_select_by_active_crm_access
  ON public.crm_sms_campaigns
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.has_tenant_permission(
      tenant_id, 'campaign.read', NULL::uuid
    )
  );

CREATE POLICY crm_tags_select_by_active_crm_access
  ON public.crm_tags
  FOR SELECT
  TO authenticated
  USING (
    public.has_tenant_permission(
      tenant_id, 'customer.read', NULL::uuid
    )
  );

CREATE POLICY customer_tags_select_by_active_crm_access
  ON public.customer_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_customers AS contact
      JOIN public.crm_tags AS tag
        ON tag.id = customer_tags.tag_id
       AND tag.tenant_id = contact.tenant_id
      WHERE contact.id = customer_tags.contact_id
        AND public.has_tenant_permission(
          contact.tenant_id, 'customer.read', NULL::uuid
        )
    )
  );
