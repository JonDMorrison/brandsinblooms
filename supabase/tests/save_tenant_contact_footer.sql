-- public.save_tenant_contact_footer: a master admin working in Northfield
-- saves to Northfield's business profile (not their own), and a member of
-- another tenant cannot write Northfield's profile. Rolls back.
BEGIN;

CREATE TEMP TABLE fixture ON COMMIT DROP AS
SELECT
  (SELECT u.id
     FROM auth.users AS u
     JOIN public.app_admin_emails AS a ON lower(a.email) = lower(u.email)
    ORDER BY u.created_at
    LIMIT 1) AS admin_id,
  (SELECT m.id
     FROM public.users AS m
    WHERE m.tenant_id IS NOT NULL
      AND m.tenant_id <> '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4'
      AND m.role IN ('owner', 'admin')
      AND NOT coalesce(public.is_master_admin(m.id), false)
    ORDER BY m.created_at
    LIMIT 1) AS member_id,
  '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4'::uuid AS tenant_id;

GRANT SELECT ON fixture TO authenticated;

DO $$
BEGIN
  IF (SELECT admin_id FROM fixture) IS NULL OR (SELECT member_id FROM fixture) IS NULL THEN
    RAISE EXCEPTION 'SKIP: fixture needs a master admin and a member of another tenant';
  END IF;
END $$;

CREATE TEMP TABLE before_admin ON COMMIT DROP AS
  SELECT street_address FROM public.company_profiles
   WHERE user_id = (SELECT admin_id FROM fixture);

-- 1. Master admin with Northfield active (tab header) saves Northfield's address.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT admin_id FROM fixture), 'role', 'authenticated')::text, true);
SELECT set_config('request.headers',
  json_build_object('x-bloom-admin-tenant', (SELECT tenant_id FROM fixture))::text, true);
SET LOCAL ROLE authenticated;

SELECT public.save_tenant_contact_footer(
  (SELECT tenant_id FROM fixture),
  '{"street_address": "QA 1 Test Way"}'::jsonb
);

RESET ROLE;

DO $$
DECLARE
  v_profile_user uuid;
BEGIN
  SELECT profile.user_id INTO v_profile_user
    FROM public.company_profiles AS profile
    JOIN public.users AS member ON member.id = profile.user_id
   WHERE member.tenant_id = (SELECT tenant_id FROM fixture)
   ORDER BY (member.role IN ('owner', 'admin')) DESC, profile.created_at, profile.user_id
   LIMIT 1;

  IF (SELECT street_address FROM public.company_profiles WHERE user_id = v_profile_user)
     IS DISTINCT FROM 'QA 1 Test Way' THEN
    RAISE EXCEPTION 'FAIL: admin save did not reach the tenant business profile';
  END IF;
  IF v_profile_user = (SELECT admin_id FROM fixture) THEN
    RAISE EXCEPTION 'FAIL: tenant profile resolved to the admin';
  END IF;
  IF (SELECT street_address FROM public.company_profiles WHERE user_id = (SELECT admin_id FROM fixture))
     IS DISTINCT FROM (SELECT street_address FROM before_admin) THEN
    RAISE EXCEPTION 'FAIL: admin save changed the admin''s own profile';
  END IF;
END $$;

-- 2. Master admin with a different active tenant is refused.
SELECT set_config('request.headers',
  json_build_object('x-bloom-admin-tenant', 'none')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.save_tenant_contact_footer((SELECT tenant_id FROM fixture), '{"city": "X"}'::jsonb);
  RAISE EXCEPTION 'FAIL: admin without the tenant active could write it';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- 3. Disallowed columns are rejected.
SELECT set_config('request.headers',
  json_build_object('x-bloom-admin-tenant', (SELECT tenant_id FROM fixture))::text, true);
DO $$
BEGIN
  PERFORM public.save_tenant_contact_footer((SELECT tenant_id FROM fixture), '{"user_id": "00000000-0000-0000-0000-000000000000"}'::jsonb);
  RAISE EXCEPTION 'FAIL: non-allowlisted column accepted';
EXCEPTION WHEN invalid_parameter_value THEN
  NULL;
END $$;
RESET ROLE;

-- 4. A member of another tenant cannot write Northfield's profile.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT member_id FROM fixture), 'role', 'authenticated')::text, true);
SELECT set_config('request.headers', '{}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.save_tenant_contact_footer((SELECT tenant_id FROM fixture), '{"street_address": "hijack"}'::jsonb);
  RAISE EXCEPTION 'FAIL: member wrote another tenant''s profile';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
RESET ROLE;

ROLLBACK;
