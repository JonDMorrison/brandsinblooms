
-- Ensure RLS is enabled
ALTER TABLE public.crm_automations ENABLE ROW LEVEL SECURITY;

-- Drop the existing broad policy that lacks WITH CHECK for inserts/updates
DROP POLICY IF EXISTS "Users can manage automations for their tenant" ON public.crm_automations;

-- 1) SELECT: users can view automations for their tenant
CREATE POLICY "Users can view automations for their tenant"
  ON public.crm_automations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_automations.tenant_id
    )
  );

-- 2) INSERT: users can create automations for their tenant; must set own user_id
CREATE POLICY "Users can create automations for their tenant"
  ON public.crm_automations
  FOR INSERT
  WITH CHECK (
    crm_automations.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_automations.tenant_id
    )
  );

-- 3) UPDATE: users can update automations in their tenant; row must remain owned by the same user and tenant
CREATE POLICY "Users can update automations for their tenant"
  ON public.crm_automations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_automations.tenant_id
    )
  )
  WITH CHECK (
    crm_automations.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_automations.tenant_id
    )
  );

-- 4) DELETE: users can delete automations for their tenant
CREATE POLICY "Users can delete automations for their tenant"
  ON public.crm_automations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_automations.tenant_id
    )
  );

-- Keep updated_at fresh on updates
DROP TRIGGER IF EXISTS set_crm_automations_updated_at ON public.crm_automations;

CREATE TRIGGER set_crm_automations_updated_at
  BEFORE UPDATE ON public.crm_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_automations_updated_at();
