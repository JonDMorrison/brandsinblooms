-- Shared business profile for teammates.
--
-- company_profiles holds one row per user (company_profiles_user_id_key), but
-- the profile describes the business: name, address, brand colours, fonts,
-- footer, design system. A teammate who joins an existing tenant has no row of
-- their own, so every surface keyed on auth.uid() showed them an empty brand
-- kit, and campaigns they created were sent with the creator's (missing)
-- profile.
--
-- 1. public.profile_user_id_for(uuid): the user whose company profile
--    represents that user's business. The tenant's owner/admin profile first
--    (oldest), then any member's profile (oldest). Users with no tenant, or
--    whose tenant has no profile, resolve to themselves. On production every
--    tenant has exactly one member, so every existing user resolves to
--    themselves: no behaviour change until a second member joins.
--    service_role only: it reveals another user's id.
-- 2. public.current_profile_user_id(): the signed-in user's resolution.
--    Master admins resolve to themselves (unchanged admin behaviour).
-- 3. company_profiles RLS: teammates may read their business profile; members
--    with content.design (owner/admin, marketing, designer) may update it.
--    The existing own-row policies are unchanged.

CREATE OR REPLACE FUNCTION public.profile_user_id_for(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_profile_user_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT app_user.tenant_id
  INTO v_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = p_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN p_user_id;
  END IF;

  SELECT profile.user_id
  INTO v_profile_user_id
  FROM public.company_profiles AS profile
  JOIN public.users AS member
    ON member.id = profile.user_id
  WHERE member.tenant_id = v_tenant_id
  ORDER BY (member.role IN ('owner', 'admin')) DESC,
           profile.created_at ASC,
           profile.user_id ASC
  LIMIT 1;

  RETURN coalesce(v_profile_user_id, p_user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.profile_user_id_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_user_id_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.current_profile_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF coalesce(public.is_master_admin(v_user_id), false) THEN
    RETURN v_user_id;
  END IF;

  RETURN public.profile_user_id_for(v_user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_profile_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_user_id() TO authenticated, service_role;

-- True when the signed-in user may edit their business profile.
CREATE OR REPLACE FUNCTION public.current_user_can_edit_business_profile()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT app_user.tenant_id
  INTO v_tenant_id
  FROM public.users AS app_user
  WHERE app_user.id = auth.uid();

  RETURN v_tenant_id IS NOT NULL
    AND coalesce(public.has_tenant_permission(v_tenant_id, 'content.design'), false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_business_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_business_profile() TO authenticated, service_role;

DROP POLICY IF EXISTS "Teammates can view their business profile" ON public.company_profiles;
CREATE POLICY "Teammates can view their business profile"
  ON public.company_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT public.current_profile_user_id()));

DROP POLICY IF EXISTS "Teammates can update their business profile" ON public.company_profiles;
CREATE POLICY "Teammates can update their business profile"
  ON public.company_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT public.current_profile_user_id())
    AND (SELECT public.current_user_can_edit_business_profile())
  )
  WITH CHECK (
    user_id = (SELECT public.current_profile_user_id())
    AND (SELECT public.current_user_can_edit_business_profile())
  );

-- 4. Teammates use their business's subscription: they may read the
--    subscription of their business profile owner (the account that signed
--    up and pays). Writes are unchanged.
DROP POLICY IF EXISTS "Teammates can view their business subscription" ON public.subscriptions;
CREATE POLICY "Teammates can view their business subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT public.current_profile_user_id()));
