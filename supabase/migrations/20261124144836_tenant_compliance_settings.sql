-- workspace-qa3 #1: persist Settings > Compliance per tenant (additive).
CREATE TABLE IF NOT EXISTS public.tenant_compliance_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tenant_compliance_settings_is_object CHECK (jsonb_typeof(settings) = 'object')
);

COMMENT ON TABLE public.tenant_compliance_settings IS
  'Per-tenant compliance preferences saved from Settings > Compliance. Only keys with an enforcing code path may be switched on in the UI.';

ALTER TABLE public.tenant_compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_compliance_settings_select ON public.tenant_compliance_settings
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'location.read'::text, NULL::uuid));

CREATE POLICY tenant_compliance_settings_insert ON public.tenant_compliance_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_permission(tenant_id, 'user.manage'::text, NULL::uuid));

CREATE POLICY tenant_compliance_settings_update ON public.tenant_compliance_settings
  FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'user.manage'::text, NULL::uuid))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'user.manage'::text, NULL::uuid));

GRANT SELECT, INSERT, UPDATE ON public.tenant_compliance_settings TO authenticated;
GRANT ALL ON public.tenant_compliance_settings TO service_role;

CREATE OR REPLACE FUNCTION public.tenant_compliance_settings_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_compliance_settings_touch
  BEFORE INSERT OR UPDATE ON public.tenant_compliance_settings
  FOR EACH ROW EXECUTE FUNCTION public.tenant_compliance_settings_touch();
