-- Tenant-shared saved newsletter blocks. Never expose one tenant's saved designs to another.
CREATE TABLE IF NOT EXISTS public.crm_saved_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  block_data jsonb NOT NULL CHECK (jsonb_typeof(block_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_saved_blocks_tenant_created_idx ON public.crm_saved_blocks (tenant_id, created_at DESC);
ALTER TABLE public.crm_saved_blocks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE, UPDATE ON public.crm_saved_blocks TO authenticated;
-- Use existing user-to-tenant assignment; do not rely on mutable JWT user_metadata.
CREATE POLICY crm_saved_blocks_tenant_select ON public.crm_saved_blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = crm_saved_blocks.tenant_id));
CREATE POLICY crm_saved_blocks_tenant_insert ON public.crm_saved_blocks FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = crm_saved_blocks.tenant_id));
CREATE POLICY crm_saved_blocks_tenant_update ON public.crm_saved_blocks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = crm_saved_blocks.tenant_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = crm_saved_blocks.tenant_id));
CREATE POLICY crm_saved_blocks_tenant_delete ON public.crm_saved_blocks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.tenant_id = crm_saved_blocks.tenant_id));
