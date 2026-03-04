-- Tenant-level default sending domain (used to disambiguate sending when multiple domains exist)

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS default_from_email_domain_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_default_from_email_domain_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_default_from_email_domain_id_fkey
    FOREIGN KEY (default_from_email_domain_id)
    REFERENCES public.email_domains(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_default_from_email_domain_id
  ON public.tenants (default_from_email_domain_id);

CREATE OR REPLACE FUNCTION public.set_tenant_default_from_email_domain(
  p_domain_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant_id UUID;
  v_domain_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.tenant_id
  INTO v_user_tenant_id
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_user_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to a tenant' USING ERRCODE = '23514';
  END IF;

  -- Allow clearing the default
  IF p_domain_id IS NULL THEN
    UPDATE public.tenants
    SET default_from_email_domain_id = NULL
    WHERE id = v_user_tenant_id;
    RETURN;
  END IF;

  SELECT d.tenant_id
  INTO v_domain_tenant_id
  FROM public.email_domains d
  WHERE d.id = p_domain_id;

  IF v_domain_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Email domain not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_domain_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Email domain does not belong to your tenant' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tenants
  SET default_from_email_domain_id = p_domain_id
  WHERE id = v_user_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_default_from_email_domain(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tenant_default_from_email_domain(UUID) TO authenticated;

-- Ensure PostgREST sees the new column and function.
NOTIFY pgrst, 'reload schema';
