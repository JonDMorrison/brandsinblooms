-- Repair migration: make is_master_admin align with app_admin_emails allowlist
-- Many admin RPCs (including tenant email management) gate on public.is_master_admin(auth.uid()).
-- Some environments use app_admin_emails as the canonical admin allowlist.
-- This function now returns true if the user's auth.email is in app_admin_emails,
-- and falls back to the legacy user_roles table if it exists.

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_has_role boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_admin_emails a
    WHERE lower(a.email) = v_email
  ) THEN
    RETURN true;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = $1 AND ur.role::text = ''master_admin'')'
      INTO v_has_role
      USING _user_id;

    RETURN COALESCE(v_has_role, false);
  END IF;

  RETURN false;
END;
$$;

NOTIFY pgrst, 'reload schema';
