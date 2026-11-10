-- The CRM UI uses plural permissions. has_tenant_permission is a separate,
-- legacy authority that accepts customer.read, reporting.read and segment.write.
-- Unknown plural keys silently denied marketing users while owner shortcuts hid
-- the mismatch. Retain its company-wide NULL-location boundary for raw data.
-- No customer data, membership, consent, points, balances or grants are changed.

ALTER POLICY bloom_customer_sets_read ON public.bloom_customer_sets
USING (
  user_id = (SELECT auth.uid())
  AND public.has_tenant_permission(tenant_id, 'customer.read', NULL)
  AND public.has_tenant_permission(tenant_id, 'reporting.read', NULL)
);

ALTER POLICY customer_purchase_line_items_select ON public.customer_purchase_line_items
USING (public.has_tenant_permission(tenant_id, 'customer.read', NULL));

ALTER POLICY customer_intelligence_source_events_select ON public.customer_intelligence_source_events
USING (public.has_tenant_permission(tenant_id, 'customer.read', NULL));

ALTER POLICY customer_intelligence_imports_select ON public.customer_intelligence_imports
USING (
  public.has_tenant_permission(tenant_id, 'customer.read', NULL)
  AND public.has_tenant_permission(tenant_id, 'reporting.read', NULL)
);

-- Integration configuration is an owner/admin CRM capability, not a recognized
-- legacy permission. Read-only analysis still requires full-company data access.
ALTER POLICY customer_intelligence_sources_select ON public.customer_intelligence_sources
USING (
  public.crm_has_permission('integrations.manage', tenant_id, NULL)
  OR (
    public.has_tenant_permission(tenant_id, 'customer.read', NULL)
    AND public.has_tenant_permission(tenant_id, 'reporting.read', NULL)
  )
);

ALTER POLICY customer_intelligence_sources_insert ON public.customer_intelligence_sources
WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));

ALTER POLICY customer_intelligence_sources_update ON public.customer_intelligence_sources
USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
