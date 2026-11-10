-- Persist Customer Intelligence source configuration without creating a second
-- integration framework. provider_connection_id points at the existing provider
-- connection when one exists; import-based sources use the existing intelligence
-- import ledger.

CREATE TABLE public.customer_intelligence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN (
    'bloomsuite_pos','connected_pos','ideal_api','ideal_import'
  )),
  provider text NOT NULL,
  provider_connection_id uuid,
  status text NOT NULL DEFAULT 'configuring' CHECK (status IN (
    'configuring','validating','active','attention_required','disconnected'
  )),
  sync_mode text NOT NULL CHECK (sync_mode IN ('real_time','scheduled','manual_import')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_validated_at timestamptz,
  last_data_at timestamptz,
  activated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX customer_intelligence_sources_tenant_status_idx
  ON public.customer_intelligence_sources (tenant_id, status);

ALTER TABLE public.customer_intelligence_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_intelligence_sources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.customer_intelligence_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_intelligence_sources TO service_role;

CREATE POLICY customer_intelligence_sources_select
ON public.customer_intelligence_sources FOR SELECT TO authenticated
USING (public.has_tenant_permission(tenant_id,'integrations.read',NULL)
    OR public.has_tenant_permission(tenant_id,'reports.read',NULL));

CREATE POLICY customer_intelligence_sources_insert
ON public.customer_intelligence_sources FOR INSERT TO authenticated
WITH CHECK (public.has_tenant_permission(tenant_id,'integrations.manage',NULL));

CREATE POLICY customer_intelligence_sources_update
ON public.customer_intelligence_sources FOR UPDATE TO authenticated
USING (public.has_tenant_permission(tenant_id,'integrations.manage',NULL))
WITH CHECK (public.has_tenant_permission(tenant_id,'integrations.manage',NULL));

CREATE OR REPLACE VIEW public.customer_intelligence_source_health
WITH (security_invoker = true)
AS
SELECT
  source.tenant_id, source.id, source.source_type, source.provider, source.status,
  source.sync_mode, source.capabilities, source.validation_summary,
  source.last_validated_at, source.last_data_at, source.activated_at,
  coalesce(imports.completed_imports,0) AS completed_imports,
  coalesce(imports.accepted_rows,0) AS accepted_rows,
  coalesce(imports.duplicate_rows,0) AS duplicate_rows,
  coalesce(imports.rejected_rows,0) AS rejected_rows
FROM public.customer_intelligence_sources source
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE status IN ('completed','completed_with_errors')) AS completed_imports,
    sum(accepted_row_count) AS accepted_rows,
    sum(duplicate_row_count) AS duplicate_rows,
    sum(rejected_row_count) AS rejected_rows
  FROM public.customer_intelligence_imports i
  WHERE i.tenant_id=source.tenant_id AND i.source=source.provider
) imports ON true;

GRANT SELECT ON public.customer_intelligence_source_health TO authenticated, service_role;
