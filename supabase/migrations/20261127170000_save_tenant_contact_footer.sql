-- Contact & footer settings for the active tenant.
--
-- /profile/contact-footer edited the signed-in user's own company_profiles
-- row. A master admin working in a client's account through the tenant
-- switcher therefore saved the client's postal address on the admin's own
-- profile, and the client's campaign sends stayed blocked
-- (send_blocked_reason = 'physical_address_missing').
--
-- Master admins may read every company profile but write only their own
-- (RLS). Rather than widening the write policies, this adds one narrow write
-- path: public.save_tenant_contact_footer(tenant, contact).
--
--   * Caller must be signed in and either
--       - a master admin whose active tenant (public.admin_active_tenant_id,
--         the tenant switcher) is p_tenant_id, or
--       - a member of p_tenant_id with the content.design permission (the
--         same rule as the "Teammates can update their business profile"
--         policy).
--   * Only the contact/footer columns below can be written. Any other key in
--     p_contact is rejected, so the RPC cannot be used to change onboarding,
--     branding, subscription or ownership fields.
--   * The row written is the tenant's business profile, resolved exactly as
--     public.tenant_profile_user_id does (owner/admin profile first, then the
--     oldest), so the page saves the same row it loaded. A tenant without a
--     profile gets one for its owner (owner/admin first, then oldest member).
--
-- Returns the company_profiles id that was written.

CREATE OR REPLACE FUNCTION public.save_tenant_contact_footer(
  p_tenant_id uuid,
  p_contact jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_allowed text[] := ARRAY[
    'company_phone', 'company_email', 'website_url',
    'street_address', 'city', 'state_province', 'postal_code', 'country',
    'facebook_url', 'instagram_url', 'tiktok_url', 'pinterest_url',
    'youtube_url', 'linkedin_url', 'footer_legal_text'
  ];
  v_key text;
  v_value jsonb;
  v_is_admin boolean;
  v_authorized boolean := false;
  v_profile_user_id uuid;
  v_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'save_tenant_contact_footer: not signed in'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.tenants AS tenant WHERE tenant.id = p_tenant_id) THEN
    RAISE EXCEPTION 'save_tenant_contact_footer: unknown tenant'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := coalesce(public.is_master_admin(v_user_id), false);

  IF v_is_admin THEN
    v_authorized := coalesce(public.admin_active_tenant_id() = p_tenant_id, false);
  ELSE
    v_authorized := EXISTS (
        SELECT 1
        FROM public.users AS app_user
        WHERE app_user.id = v_user_id
          AND app_user.tenant_id = p_tenant_id
      )
      AND coalesce(public.has_tenant_permission(p_tenant_id, 'content.design'), false);
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'save_tenant_contact_footer: not allowed to edit this business profile'
      USING ERRCODE = '42501';
  END IF;

  IF p_contact IS NULL OR jsonb_typeof(p_contact) <> 'object' THEN
    RAISE EXCEPTION 'save_tenant_contact_footer: contact must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  FOR v_key, v_value IN SELECT entry.key, entry.value FROM jsonb_each(p_contact) AS entry LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'save_tenant_contact_footer: field % cannot be changed here', v_key
        USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_value) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'save_tenant_contact_footer: field % must be text', v_key
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Same resolution as public.tenant_profile_user_id.
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

  IF v_profile_user_id IS NULL THEN
    SELECT member.id
    INTO v_profile_user_id
    FROM public.users AS member
    WHERE member.tenant_id = p_tenant_id
    ORDER BY (member.role IN ('owner', 'admin')) DESC,
             member.created_at ASC,
             member.id ASC
    LIMIT 1;

    IF v_profile_user_id IS NULL THEN
      RAISE EXCEPTION 'save_tenant_contact_footer: tenant has no members to hold a business profile'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.company_profiles (user_id)
    VALUES (v_profile_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  UPDATE public.company_profiles AS profile
  SET
    company_phone = CASE WHEN p_contact ? 'company_phone' THEN nullif(btrim(p_contact->>'company_phone'), '') ELSE profile.company_phone END,
    company_email = CASE WHEN p_contact ? 'company_email' THEN nullif(btrim(p_contact->>'company_email'), '') ELSE profile.company_email END,
    website_url = CASE WHEN p_contact ? 'website_url' THEN nullif(btrim(p_contact->>'website_url'), '') ELSE profile.website_url END,
    street_address = CASE WHEN p_contact ? 'street_address' THEN nullif(btrim(p_contact->>'street_address'), '') ELSE profile.street_address END,
    city = CASE WHEN p_contact ? 'city' THEN nullif(btrim(p_contact->>'city'), '') ELSE profile.city END,
    state_province = CASE WHEN p_contact ? 'state_province' THEN nullif(btrim(p_contact->>'state_province'), '') ELSE profile.state_province END,
    postal_code = CASE WHEN p_contact ? 'postal_code' THEN nullif(btrim(p_contact->>'postal_code'), '') ELSE profile.postal_code END,
    country = CASE WHEN p_contact ? 'country' THEN nullif(btrim(p_contact->>'country'), '') ELSE profile.country END,
    facebook_url = CASE WHEN p_contact ? 'facebook_url' THEN nullif(btrim(p_contact->>'facebook_url'), '') ELSE profile.facebook_url END,
    instagram_url = CASE WHEN p_contact ? 'instagram_url' THEN nullif(btrim(p_contact->>'instagram_url'), '') ELSE profile.instagram_url END,
    tiktok_url = CASE WHEN p_contact ? 'tiktok_url' THEN nullif(btrim(p_contact->>'tiktok_url'), '') ELSE profile.tiktok_url END,
    pinterest_url = CASE WHEN p_contact ? 'pinterest_url' THEN nullif(btrim(p_contact->>'pinterest_url'), '') ELSE profile.pinterest_url END,
    youtube_url = CASE WHEN p_contact ? 'youtube_url' THEN nullif(btrim(p_contact->>'youtube_url'), '') ELSE profile.youtube_url END,
    linkedin_url = CASE WHEN p_contact ? 'linkedin_url' THEN nullif(btrim(p_contact->>'linkedin_url'), '') ELSE profile.linkedin_url END,
    footer_legal_text = CASE WHEN p_contact ? 'footer_legal_text' THEN nullif(btrim(p_contact->>'footer_legal_text'), '') ELSE profile.footer_legal_text END,
    updated_at = now()
  WHERE profile.user_id = v_profile_user_id
  RETURNING profile.id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'save_tenant_contact_footer: business profile could not be written'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_profile_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.save_tenant_contact_footer(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tenant_contact_footer(uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_tenant_contact_footer(uuid, jsonb) IS
  'Writes the contact/footer columns of a tenant''s business profile. Master admins: active tenant only. Members: own tenant with content.design. Column allowlist enforced.';
