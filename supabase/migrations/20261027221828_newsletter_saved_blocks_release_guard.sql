-- This follow-up is deliberately safe when the earlier account-library migration
-- was committed but never deployed. It does not import browser data.
CREATE TABLE IF NOT EXISTS public.crm_saved_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  block_data jsonb NOT NULL CHECK (jsonb_typeof(block_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_saved_blocks_tenant_created_idx ON public.crm_saved_blocks (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_saved_blocks_tenant_updated_idx ON public.crm_saved_blocks (tenant_id, updated_at DESC);
ALTER TABLE public.crm_saved_blocks ADD COLUMN IF NOT EXISTS save_schema_version integer NOT NULL DEFAULT 2;
-- Old clients attempted to import unlabelled browser data automatically. Requiring
-- an explicit version blocks those writes, including tabs open during rollout.
ALTER TABLE public.crm_saved_blocks ALTER COLUMN save_schema_version DROP DEFAULT;
ALTER TABLE public.crm_saved_blocks DROP CONSTRAINT IF EXISTS crm_saved_blocks_version_check;
ALTER TABLE public.crm_saved_blocks ADD CONSTRAINT crm_saved_blocks_version_check CHECK (save_schema_version = 2);
ALTER TABLE public.crm_saved_blocks DROP CONSTRAINT IF EXISTS crm_saved_blocks_payload_limit;
ALTER TABLE public.crm_saved_blocks ADD CONSTRAINT crm_saved_blocks_payload_limit CHECK (octet_length(block_data::text) <= 262144 AND block_data ? 'type' AND jsonb_typeof(block_data->'type') = 'string' AND block_data->>'type' <> 'footer');
ALTER TABLE public.crm_saved_blocks DROP CONSTRAINT IF EXISTS crm_saved_blocks_nonempty_name;
ALTER TABLE public.crm_saved_blocks ADD CONSTRAINT crm_saved_blocks_nonempty_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 160);
ALTER TABLE public.crm_saved_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_saved_blocks FROM anon;
REVOKE ALL ON public.crm_saved_blocks FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.crm_saved_blocks TO authenticated;
GRANT UPDATE(name, block_data, updated_at) ON public.crm_saved_blocks TO authenticated;
GRANT ALL ON public.crm_saved_blocks TO service_role;
DROP POLICY IF EXISTS crm_saved_blocks_tenant_select ON public.crm_saved_blocks;
DROP POLICY IF EXISTS crm_saved_blocks_tenant_insert ON public.crm_saved_blocks;
DROP POLICY IF EXISTS crm_saved_blocks_tenant_update ON public.crm_saved_blocks;
DROP POLICY IF EXISTS crm_saved_blocks_tenant_delete ON public.crm_saved_blocks;
CREATE POLICY crm_saved_blocks_tenant_select ON public.crm_saved_blocks FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.read', NULL));
CREATE POLICY crm_saved_blocks_tenant_insert ON public.crm_saved_blocks FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND public.has_tenant_permission(tenant_id, 'campaign.write', NULL));
CREATE POLICY crm_saved_blocks_tenant_update ON public.crm_saved_blocks FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.write', NULL))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'campaign.write', NULL));
CREATE POLICY crm_saved_blocks_tenant_delete ON public.crm_saved_blocks FOR DELETE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.write', NULL));
COMMENT ON TABLE public.crm_saved_blocks IS 'Named account newsletter blocks. Access follows campaign permissions; browser imports require explicit user confirmation.';
