-- Team invitations.
--
-- Until now a tenant could have only the user who created it: the CRM role
-- model (users.role, user_location_access, has_tenant_permission,
-- set_tenant_user_crm_access) was in place, but nothing added a second user
-- to an existing tenant. This adds invitations an owner/admin sends by email.
--
-- 1. public.tenant_invitations: one row per invitation. The invite link
--    carries a random token; only its SHA-256 hash is stored. At most one
--    pending invitation per tenant and email. Owners/admins (user.manage) can
--    read their tenant's invitations; every write goes through the
--    tenant-team-invitations edge function (service_role), which checks the
--    caller's access.manage permission, sends the email, and accepts.
-- 2. crm_access_audit gains member_joined, member_removed, invitation_sent
--    and invitation_revoked events.

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND position('@' IN email) > 1),
  role text NOT NULL CHECK (role IN (
    'owner_admin', 'marketing', 'store_manager', 'staff',
    'designer', 'list_manager', 'sender'
  )),
  location_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1 CHECK (send_count >= 1),
  accepted_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_one_pending_per_email
  ON public.tenant_invitations (tenant_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_created_idx
  ON public.tenant_invitations (tenant_id, created_at DESC);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tenant_invitations TO authenticated;
GRANT ALL ON TABLE public.tenant_invitations TO service_role;

DROP POLICY IF EXISTS tenant_invitations_manager_select ON public.tenant_invitations;
CREATE POLICY tenant_invitations_manager_select
  ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'user.manage', NULL));

ALTER TABLE public.crm_access_audit
  DROP CONSTRAINT IF EXISTS crm_access_audit_event_type_check,
  ADD CONSTRAINT crm_access_audit_event_type_check CHECK (event_type IN (
    'role_change',
    'location_assignment',
    'location_created',
    'location_updated',
    'member_joined',
    'member_removed',
    'invitation_sent',
    'invitation_revoked'
  ));

-- 3. Logins created from an invitation join an existing business, so the
--    signup trigger must not create a new tenant for them. The marker is
--    app_metadata.bloom_invitation, which only the service role can set
--    (auth.admin.createUser in tenant-team-invitations); a public signup
--    cannot. Body otherwise taken unchanged from pg_get_functiondef on
--    production.
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
  v_invited boolean := coalesce(NEW.raw_app_meta_data ? 'bloom_invitation', false);
BEGIN
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

  IF NOT v_invited THEN
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
  END IF;

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
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(EXCLUDED.name, public.users.name),
    tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id);

  RETURN NEW;
END;
$function$;
