-- Business profile for the active tenant.
--
-- company_profiles is keyed by user_id. current_profile_user_id() resolves a
-- master admin to themselves, so when an admin works in a client's account
-- through the tenant switcher, Studio, the campaign editor and the sender
-- name all showed the admin's own company (for example "Jon Morrison Inc."
-- on Northfield Garden Center) instead of the client's.
--
-- 1. public.tenant_profile_user_id(uuid): the user whose company profile
--    represents that tenant's business, using the same ordering as
--    public.profile_user_id_for (owner/admin profile first, then oldest).
--    Returns NULL when the caller may not see that tenant or the tenant has
--    no profile. Callable by members of the tenant and by master admins.
-- 2. Master admins may read company_profiles (read only), so the admin
--    tenant switcher can load the active tenant's profile. Writes are
--    unchanged.

CREATE OR REPLACE FUNCTION public.tenant_profile_user_id(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_user_id uuid;
BEGIN
  IF v_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT (
    coalesce(public.is_master_admin(v_user_id), false)
    OR EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = v_user_id
        AND app_user.tenant_id = p_tenant_id
    )
  ) THEN
    RETURN NULL;
  END IF;

  SELECT profile.user_id
  INTO v_profile_user_id
  FROM public.company_profiles AS profile
  JOIN public.users AS member
    ON member.id = profile.user_id
  WHERE member.tenant_id = p_tenant_id
  ORDER BY (member.role IN ('owner', 'admin')) DESC,
           profile.created_at ASC,
           profile.user_id ASC
  LIMIT 1;

  RETURN v_profile_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tenant_profile_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_profile_user_id(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Master admins can view company profiles" ON public.company_profiles;
CREATE POLICY "Master admins can view company profiles"
  ON public.company_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_master_admin(auth.uid())));
