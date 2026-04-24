-- Root cause fix: new signups were missing a tenants row (and therefore
-- public.users.tenant_id) because none of the three on-signup trigger functions
-- (handle_new_user_signup / handle_new_user_team / handle_new_user_subscription)
-- ever created a tenants row. A one-time DO-block backfill in migration
-- 20251003141736 created tenants for users that existed at that time, but any
-- signup AFTER that migration fell through the crack and landed with
-- public.users.tenant_id = NULL.
--
-- This migration extends handle_new_user_signup to also:
--   1. create a public.tenants row for the new user
--   2. populate public.users.tenant_id with that new tenant id
--
-- The tenant-creation step is wrapped in its own BEGIN/EXCEPTION block so a
-- failure there can never block auth signup itself -- if tenant creation fails
-- for any reason, we still create the public.users row (matching today's
-- behavior) and a backfill can fix it later.

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text;
  v_user_name text;
  v_slug text;
BEGIN
  -- Extract display name and tenant name from auth metadata with sensible fallbacks
  v_user_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  v_tenant_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'company_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'business_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Organization'
  );

  -- Create a tenant for this user. Wrapped so a failure here cannot abort the
  -- auth.users insert -- public.users will still be created below.
  BEGIN
    v_slug := lower(regexp_replace(
      COALESCE(NEW.email, NEW.id::text),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(NEW.id::text, 1, 8);

    INSERT INTO public.tenants (name, slug, is_active)
    VALUES (v_tenant_name, v_slug, true)
    RETURNING id INTO v_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user_signup: tenant creation failed for % (%): %',
      NEW.email, NEW.id, SQLERRM;
    v_tenant_id := NULL;
  END;

  -- Upsert the mirrored public.users row. Matches the prior behavior of this
  -- function (ON CONFLICT on email so repeated signups with the same email
  -- update the existing row in place), but now also populates tenant_id.
  -- COALESCE on tenant_id ensures we never overwrite a non-null existing value.
  INSERT INTO public.users (
    id,
    name,
    email,
    role,
    tenant_id,
    created_by_user_id
  ) VALUES (
    NEW.id,
    v_user_name,
    NEW.email,
    'admin', -- new signups are admins of their own workspace
    v_tenant_id,
    NEW.id   -- self-created
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(EXCLUDED.name, public.users.name),
    tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id);

  RETURN NEW;
END;
$function$;

-- No trigger re-attachment needed: on_auth_user_created_user_record (created in
-- 20250702163830-c9f2a787) already points at this function, and CREATE OR REPLACE
-- FUNCTION updates the body in place.

NOTIFY pgrst, 'reload schema';
