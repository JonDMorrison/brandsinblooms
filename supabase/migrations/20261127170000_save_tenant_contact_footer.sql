-- Contact & Footer settings edit the active tenant's business profile.
--
-- /profile/contact-footer wrote company_profiles directly. A master admin
-- working in a client's tenant through the tenant switcher saved the address
-- onto their own profile: current_profile_user_id() resolves a master admin
-- to themselves, and the only write policies are own-row and "Teammates can
-- update their business profile" (also keyed on current_profile_user_id()).
-- The client's campaigns stayed blocked on physical_address_missing.
--
-- public.save_tenant_contact_footer(...) saves the contact/footer fields onto
-- exactly the row the campaign editor's readiness check and footer read for
-- that tenant (src/lib/profile/businessProfileUserId.ts):
--
--   * p_tenant_id NULL (user with no tenant): the caller's own row, which the
--     own-row RLS policies already allow.
--   * caller is a member of p_tenant_id: public.current_profile_user_id(),
--     which is what getBusinessProfileUserId reads. Their own row is always
--     writable (own-row policy); the tenant owner's row needs
--     public.current_user_can_edit_business_profile() (content.design), the
--     same check as the "Teammates can update their business profile" policy.
--   * master admin who is not a member: public.has_tenant_permission(
--     p_tenant_id, 'content.design'), which for master admins is true only when
--     p_tenant_id is the admin's active tenant (admin_active_tenant_id(): the
--     tab's x-bloom-admin-tenant header, else admin_session_context). The row
--     is the one public.tenant_profile_user_id(p_tenant_id) returns (same
--     ordering). If the tenant has no profile yet, one is created for the
--     tenant owner (owner/admin first, then oldest member), which
--     tenant_profile_user_id then returns. Onboarding updates an existing row
--     rather than inserting (CompanyProfileCreator), so this does not break a
--     later onboarding. A tenant with no members cannot have a profile and is
--     refused.
--   * anyone else: refused (42501).
--
-- Only the fifteen contact/footer columns the page edits are written. Blank
-- values are stored as NULL. RLS is unchanged.

CREATE OR REPLACE FUNCTION public.save_tenant_contact_footer(
  p_company_phone text,
  p_company_email text,
  p_website_url text,
  p_street_address text,
  p_city text,
  p_state_province text,
  p_postal_code text,
  p_country text,
  p_facebook_url text,
  p_instagram_url text,
  p_tiktok_url text,
  p_pinterest_url text,
  p_youtube_url text,
  p_linkedin_url text,
  p_footer_legal_text text,
  p_tenant_id uuid DEFAULT NULL
)
 RETURNS TABLE(profile_id uuid, profile_user_id uuid)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_user_id uuid := auth.uid();
  v_is_member boolean := false;
  v_target_user_id uuid;
  v_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to edit the business profile.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = v_user_id
        AND app_user.tenant_id = p_tenant_id
    )
    INTO v_is_member;
  END IF;

  IF p_tenant_id IS NULL THEN
    v_target_user_id := v_user_id;
  ELSIF v_is_member THEN
    v_target_user_id := coalesce(public.current_profile_user_id(), v_user_id);

    IF v_target_user_id IS DISTINCT FROM v_user_id
       AND NOT coalesce(public.current_user_can_edit_business_profile(), false) THEN
      RAISE EXCEPTION 'You do not have permission to edit this business profile.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF coalesce(public.is_master_admin(v_user_id), false)
        AND coalesce(public.has_tenant_permission(p_tenant_id, 'content.design'), false) THEN
    SELECT profile.user_id
    INTO v_target_user_id
    FROM public.company_profiles AS profile
    JOIN public.users AS member
      ON member.id = profile.user_id
    WHERE member.tenant_id = p_tenant_id
    ORDER BY (member.role IN ('owner', 'admin')) DESC,
             profile.created_at ASC,
             profile.user_id ASC
    LIMIT 1;

    IF v_target_user_id IS NULL THEN
      SELECT member.id
      INTO v_target_user_id
      FROM public.users AS member
      WHERE member.tenant_id = p_tenant_id
      ORDER BY (member.role IN ('owner', 'admin')) DESC,
               member.created_at ASC,
               member.id ASC
      LIMIT 1;
    END IF;

    IF v_target_user_id IS NULL THEN
      RAISE EXCEPTION 'This business has no users yet, so it has no business profile to edit.'
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    RAISE EXCEPTION 'You do not have permission to edit this business profile.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.company_profiles AS profile (
    user_id,
    company_phone,
    company_email,
    website_url,
    street_address,
    city,
    state_province,
    postal_code,
    country,
    facebook_url,
    instagram_url,
    tiktok_url,
    pinterest_url,
    youtube_url,
    linkedin_url,
    footer_legal_text
  )
  VALUES (
    v_target_user_id,
    nullif(btrim(p_company_phone), ''),
    nullif(btrim(p_company_email), ''),
    nullif(btrim(p_website_url), ''),
    nullif(btrim(p_street_address), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_state_province), ''),
    nullif(btrim(p_postal_code), ''),
    nullif(btrim(p_country), ''),
    nullif(btrim(p_facebook_url), ''),
    nullif(btrim(p_instagram_url), ''),
    nullif(btrim(p_tiktok_url), ''),
    nullif(btrim(p_pinterest_url), ''),
    nullif(btrim(p_youtube_url), ''),
    nullif(btrim(p_linkedin_url), ''),
    nullif(btrim(p_footer_legal_text), '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET company_phone = EXCLUDED.company_phone,
      company_email = EXCLUDED.company_email,
      website_url = EXCLUDED.website_url,
      street_address = EXCLUDED.street_address,
      city = EXCLUDED.city,
      state_province = EXCLUDED.state_province,
      postal_code = EXCLUDED.postal_code,
      country = EXCLUDED.country,
      facebook_url = EXCLUDED.facebook_url,
      instagram_url = EXCLUDED.instagram_url,
      tiktok_url = EXCLUDED.tiktok_url,
      pinterest_url = EXCLUDED.pinterest_url,
      youtube_url = EXCLUDED.youtube_url,
      linkedin_url = EXCLUDED.linkedin_url,
      footer_legal_text = EXCLUDED.footer_legal_text,
      updated_at = now()
  RETURNING profile.id, profile.user_id
  INTO v_profile_id, v_target_user_id;

  RETURN QUERY SELECT v_profile_id, v_target_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.save_tenant_contact_footer(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tenant_contact_footer(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid) TO authenticated, service_role;
