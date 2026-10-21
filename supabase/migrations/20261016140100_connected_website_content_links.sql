-- Tenant-owned BloomSites connections. No CRM browser-side writes:
-- the connecting Edge Function enforces integrations.manage and consumes
-- the owner's one-time BloomSites pairing code server-to-server.
CREATE TABLE IF NOT EXISTS public.crm_connected_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cms_site_id uuid NOT NULL,
  site_name text NOT NULL CHECK (length(site_name) BETWEEN 1 AND 200),
  site_origin text NOT NULL CHECK (
    site_origin ~ '^https://[a-z0-9][a-z0-9.-]+(:443)?$'
  ),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disconnected')),
  linked_by uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  UNIQUE (tenant_id,cms_site_id)
);
-- A BloomSites website cannot feed an unrelated CRM business concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS crm_connected_websites_active_site_idx
  ON public.crm_connected_websites (cms_site_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS crm_connected_websites_tenant_idx
  ON public.crm_connected_websites (tenant_id,status);

ALTER TABLE public.crm_connected_websites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_connected_websites FROM PUBLIC,anon;
GRANT SELECT ON public.crm_connected_websites TO authenticated;
-- Explicit tenant and permission gates on read. No INSERT, UPDATE or DELETE
-- authenticated RLS policies are granted; the trusted Edge Function writes.
CREATE POLICY crm_connected_websites_read ON public.crm_connected_websites
  FOR SELECT TO authenticated
  USING (
    tenant_id = NULLIF(public.get_current_crm_access()->>'tenantId','')::uuid
    AND (
      public.get_current_crm_access()->'permissions' ? 'campaigns.write'
      OR public.get_current_crm_access()->'permissions' ? 'integrations.manage'
      OR public.get_current_crm_access()->'permissions' ? 'reports.read'
    )
  );

COMMENT ON TABLE public.crm_connected_websites IS
'Owner-authorized CMS site to CRM tenant bindings; contents are read from the public published CMS catalog. No customer data crosses this read-only link.';
