-- BloomSuite central login: a safe first sign-in for every new account (fixes W1 R-15).
--
-- Before: handle_new_user_signup upserted public.users ON CONFLICT (email), replacing the row's id with the
-- new auth user's id and keeping its tenant_id. A new account (a CRM sign-up, or a first BloomSuite sign-in)
-- whose email matched a leftover public.users row (for example a deleted user's) therefore took over that
-- row and its tenant.
--
-- Now: a new auth user whose email already belongs to a public.users row with a different id is refused
-- (the auth user isn't created) and the refusal is written to the server log with ids only. A brand-new
-- person still gets their own tenant and public.users row, exactly as a CRM sign-up does today.
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
  v_existing_id uuid;
BEGIN
  -- An email that already belongs to another CRM user is never taken over (R-15).
  IF NEW.email IS NOT NULL THEN
    SELECT u.id INTO v_existing_id
    FROM public.users u
    WHERE lower(u.email) = lower(NEW.email) AND u.id <> NEW.id
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RAISE LOG 'handle_new_user_signup: refused new auth user %: its email belongs to CRM user %', NEW.id, v_existing_id;
      RAISE EXCEPTION 'This email already belongs to a CRM account'
        USING ERRCODE = '23505', HINT = 'crm_email_already_registered';
    END IF;
  END IF;

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

  -- The row is always this auth user's own: no email upsert, so no existing row or tenant is touched.
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
    'admin',
    v_tenant_id,
    NEW.id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
