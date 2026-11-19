-- Central login milestone 59 (CRM delta fixes), pack db3b: integration credentials, POS/email-platform connections,
-- Lightspeed and Shopify connection integrity, and sending domains. All objects are live on the hosted CRM today.
-- Forward-only and re-runnable; no earlier migration is edited. Applies after 20261116080000, 080100 and 080200.
--
-- Records closed (database part):
--   crm-r2-F125, F127  user_integrations and domain_provider_integrations hold provider credentials, yet every tenant
--                      role could read and replace them: owner/admin only now (integrations.manage, as in 20261014193543).
--   crm-r2-F142, F143, F147  Square, Lightspeed, Clover and provider (Mailchimp/Klaviyo/Constant Contact) connection
--                      rows: writes need integrations.manage in the row's tenant (Clover INSERT also keeps user_id =
--                      auth.uid()); members keep SELECT for the status dashboards; public.guard_connection_credentials()
--                      lets browser roles only start a connection and never write tokens, provider identities or the
--                      connected state (the service-role OAuth callbacks, definer functions and migrations still do).
--   crm-r2-F59, F134   lightspeed_connections.domain_prefix becomes the API host: CHECK '^[A-Za-z0-9-]{3,50}$' (the
--                      _shared/cookies.ts isValidPrefix rule) for every new or changed row; NOT VALID, the owner
--                      validates it after the go-live pre-check.
--   crm-r2-F99         one tenant at a time per Shopify shop: unique index on lower(shop_domain) for connected rows.
--   crm-r2-F128, F190  email_domains: members read, owner/admin write; public.guard_email_domain_writes() keeps
--                      verification, activation, operator holds, warm-up, limits and reputation counters server-only
--                      for browser roles, and binds default_from_email to the row's own domain for every role.
-- The Edge Function halves of these records (isValidPrefix in the Lightspeed callback/worker/sync, the Shopify start
-- and callback refusal, the sender resolver) and check_send_quota's legacy fallback are other packs' changes.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. F125, F127: integration settings tables (credentials in provider_config / credentials) are owner/admin only.
--    Server readers (sms-dispatcher, cloudflare-dns, cloudflare-oauth, one-click-setup) use the service role.
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage integrations for their tenant" ON public.user_integrations;
DROP POLICY IF EXISTS "Integration managers manage tenant integrations" ON public.user_integrations;
CREATE POLICY "Integration managers manage tenant integrations"
  ON public.user_integrations
  FOR ALL
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));

DROP POLICY IF EXISTS "Tenant users can manage provider integrations" ON public.domain_provider_integrations;
DROP POLICY IF EXISTS "Integration managers manage provider integrations" ON public.domain_provider_integrations;
CREATE POLICY "Integration managers manage provider integrations"
  ON public.domain_provider_integrations
  FOR ALL
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- ---------------------------------------------------------------------------------------------------------------
-- 2. F142, F143, F147: connection tables. (pos_connections is changed by 20261116080000.)
-- ---------------------------------------------------------------------------------------------------------------
-- square_connections (its separate SELECT policy keeps member reads)
ALTER POLICY "Users can insert their tenant's Square connections" ON public.square_connections
  TO authenticated
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
ALTER POLICY "Users can update their tenant's Square connections" ON public.square_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
ALTER POLICY "Users can delete their tenant's Square connections" ON public.square_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- lightspeed_connections (its separate SELECT policy keeps member reads)
ALTER POLICY "Users can manage their tenant's lightspeed connections" ON public.lightspeed_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- clover_connections (the INSERT policy also gains the tenant binding it lacked: F147)
ALTER POLICY "Users can insert own tenant clover connections" ON public.clover_connections
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.crm_has_permission('integrations.manage', tenant_id, NULL));
ALTER POLICY "Users can update own tenant clover connections" ON public.clover_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
ALTER POLICY "Users can delete own tenant clover connections" ON public.clover_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- provider_connections: its one FOR ALL policy also served reads, so member SELECT becomes its own policy
DROP POLICY IF EXISTS provider_connections_member_select ON public.provider_connections;
CREATE POLICY provider_connections_member_select
  ON public.provider_connections
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.tenant_id = provider_connections.tenant_id AND u.id = auth.uid()
  ));
ALTER POLICY tenant_users_manage_connections ON public.provider_connections
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));

-- Browser roles never supply provider credentials, provider identities or the connected state. A ciphertext copied
-- from one tenant can therefore never be planted as a live connection in another (F142). Server code (service role,
-- definer functions, migrations) is not limited here.
CREATE OR REPLACE FUNCTION public.guard_connection_credentials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_col text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A browser may only start a connection: tokens 'pending' or empty, no provider identity, never connected.
    FOREACH v_col IN ARRAY ARRAY['encrypted_access_token', 'encrypted_refresh_token'] LOOP
      IF coalesce(v_new->>v_col, 'pending') <> 'pending' THEN
        RAISE EXCEPTION 'Provider credentials are written by the server only' USING ERRCODE = '42501';
      END IF;
    END LOOP;
    FOREACH v_col IN ARRAY ARRAY['merchant_id', 'domain_prefix', 'retailer_id', 'provider_account_id'] LOOP
      IF v_new ? v_col AND v_new->>v_col IS NOT NULL THEN
        RAISE EXCEPTION 'Provider identities are written by the server only' USING ERRCODE = '42501';
      END IF;
    END LOOP;
    IF coalesce(v_new->>'status', '') = 'connected' THEN
      RAISE EXCEPTION 'Only the server marks a connection connected' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: credentials and identities never change from a browser; status may not become connected.
  FOREACH v_col IN ARRAY ARRAY['encrypted_access_token', 'encrypted_refresh_token', 'merchant_id', 'domain_prefix',
                               'retailer_id', 'provider_account_id', 'tenant_id', 'user_id'] LOOP
    IF (v_new->v_col) IS DISTINCT FROM (v_old->v_col) THEN
      RAISE EXCEPTION 'Provider credentials and identities are written by the server only' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF coalesce(v_new->>'status', '') = 'connected' AND coalesce(v_old->>'status', '') <> 'connected' THEN
    RAISE EXCEPTION 'Only the server marks a connection connected' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER guard_connection_credentials BEFORE INSERT OR UPDATE ON public.square_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_credentials();
CREATE OR REPLACE TRIGGER guard_connection_credentials BEFORE INSERT OR UPDATE ON public.lightspeed_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_credentials();
CREATE OR REPLACE TRIGGER guard_connection_credentials BEFORE INSERT OR UPDATE ON public.clover_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_credentials();
CREATE OR REPLACE TRIGGER guard_connection_credentials BEFORE INSERT OR UPDATE ON public.provider_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_credentials();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. F59, F134 (database part): the Lightspeed domain prefix is a host label, never a URL fragment.
--    NOT VALID: existing rows are not scanned here, but every new row and every later update of a row is checked.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lightspeed_connections'::regclass
      AND conname = 'lightspeed_connections_domain_prefix_format'
  ) THEN
    ALTER TABLE public.lightspeed_connections
      ADD CONSTRAINT lightspeed_connections_domain_prefix_format
      CHECK (domain_prefix ~ '^[A-Za-z0-9-]{3,50}$') NOT VALID;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. F99 (database part): a Shopify shop is connected to at most one tenant. The OAuth callback's update to
--    'connected' fails (23505) while another tenant holds the shop; revoked and pending rows are not limited.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_shared integer;
BEGIN
  SELECT count(*) INTO v_shared
  FROM (
    SELECT lower(shop_domain)
    FROM public.shopify_connections
    WHERE status = 'connected'
    GROUP BY lower(shop_domain)
    HAVING count(*) > 1
  ) AS shared_shops;
  IF v_shared > 0 THEN
    RAISE EXCEPTION '% Shopify shop(s) are connected to more than one tenant; resolve them before this migration (go-live pre-check)', v_shared;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS shopify_connections_one_connected_tenant_per_shop
  ON public.shopify_connections (lower(shop_domain))
  WHERE status = 'connected';

-- ---------------------------------------------------------------------------------------------------------------
-- 5. F128, F190: sending domains. Members read (sender pickers, setup progress, campaign checks); owner/admin add,
--    edit and remove; the server (service role, definer functions) verifies, activates, pauses and warms up.
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant users can manage email domains" ON public.email_domains;
DROP POLICY IF EXISTS "Tenant members can view email domains" ON public.email_domains;
DROP POLICY IF EXISTS "Integration managers can add email domains" ON public.email_domains;
DROP POLICY IF EXISTS "Integration managers can update email domains" ON public.email_domains;
DROP POLICY IF EXISTS "Integration managers can remove email domains" ON public.email_domains;

CREATE POLICY "Tenant members can view email domains"
  ON public.email_domains
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.tenant_id = email_domains.tenant_id AND u.id = auth.uid()
  ));
CREATE POLICY "Integration managers can add email domains"
  ON public.email_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
CREATE POLICY "Integration managers can update email domains"
  ON public.email_domains
  FOR UPDATE
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL))
  WITH CHECK (public.crm_has_permission('integrations.manage', tenant_id, NULL));
CREATE POLICY "Integration managers can remove email domains"
  ON public.email_domains
  FOR DELETE
  TO authenticated
  USING (public.crm_has_permission('integrations.manage', tenant_id, NULL));

CREATE OR REPLACE FUNCTION public.guard_email_domain_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_browser constant boolean := current_user IN ('authenticated', 'anon');
  -- Server-owned columns and the value a newly started domain carries (the column defaults): verification,
  -- operator holds and notes, warm-up, sending limits and reputation counters.
  v_start constant jsonb := jsonb_build_object(
    'verified_at', NULL, 'resend_status', NULL, 'resend_domain_id', NULL,
    'manual_pause', false, 'investigation_mode', false, 'notes', NULL,
    'warmup_stage', 0, 'warmup_started_at', NULL, 'last_stage_updated_at', now(), 'healthy_days_counter', 0,
    'daily_limit', 50, 'hourly_limit', 25, 'daily_sent_count', 0, 'last_daily_reset_at', now(),
    'total_sent_30d', 0, 'total_bounces_30d', 0, 'total_complaints_30d', 0,
    'bounce_rate_30d', 0, 'complaint_rate_30d', 0);
  v_start_statuses constant text[] := ARRAY['pending', 'pending_dns', 'verifying'];
  v_new jsonb;
  v_old jsonb;
  v_col text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Removing and re-adding a held domain would drop the hold: only the server removes a held or paused row.
    IF v_browser AND (coalesce(OLD.manual_pause, false) OR OLD.investigation_mode OR OLD.status IN ('paused', 'blocked')) THEN
      RAISE EXCEPTION 'A sending domain under an operator hold is removed by BloomSuite support only' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- F190, every role: the default From address is one address on the row's own domain. Checked when the address
  -- or the domain is written, so legacy rows keep taking the server's counter and verification updates.
  IF NEW.default_from_email IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.default_from_email IS DISTINCT FROM OLD.default_from_email
          OR NEW.domain IS DISTINCT FROM OLD.domain)
     AND NOT (NEW.default_from_email ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+$'
              AND lower(split_part(NEW.default_from_email, '@', 2)) = lower(NEW.domain)) THEN
    RAISE EXCEPTION 'The default From address must be on the domain %', NEW.domain USING ERRCODE = '23514';
  END IF;

  IF NOT v_browser THEN
    RETURN NEW;
  END IF;

  v_new := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    -- F128: a browser only starts a domain; the server verifies and activates it.
    IF NEW.status IS NULL OR NOT (NEW.status = ANY (v_start_statuses)) THEN
      RAISE EXCEPTION 'Sending domains are activated by the server only' USING ERRCODE = '42501';
    END IF;
    FOR v_col IN SELECT jsonb_object_keys(v_start) LOOP
      IF (v_new -> v_col) IS DISTINCT FROM (v_start -> v_col) THEN
        RAISE EXCEPTION 'Column % of a sending domain is written by the server only', v_col USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- UPDATE (F128): sender fields, report address and Entri details stay editable; the rest is server-owned.
  v_old := to_jsonb(OLD);
  FOR v_col IN SELECT jsonb_object_keys(v_start) UNION ALL SELECT unnest(ARRAY['tenant_id', 'domain']) LOOP
    IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
      RAISE EXCEPTION 'Column % of a sending domain is written by the server only', v_col USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (NOT (coalesce(NEW.status, '') = ANY (v_start_statuses))
          OR OLD.status IN ('paused', 'blocked')
          OR coalesce(OLD.manual_pause, false)
          OR OLD.investigation_mode) THEN
    RAISE EXCEPTION 'Sending domain status is set by the server only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER guard_email_domain_writes BEFORE INSERT OR UPDATE OR DELETE ON public.email_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_email_domain_writes();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Post-condition: no browser-role write policy on these tables is left without integrations.manage (catches a
--    hosted policy under another name, which DROP POLICY IF EXISTS would otherwise leave in force).
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_left text;
BEGIN
  SELECT string_agg(format('%s: %s', p.tablename, p.policyname), '; ') INTO v_left
  FROM pg_policies AS p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('user_integrations', 'domain_provider_integrations', 'square_connections',
                        'lightspeed_connections', 'clover_connections', 'provider_connections', 'email_domains')
    AND p.cmd <> 'SELECT'
    AND p.permissive = 'PERMISSIVE'
    AND NOT (p.roles <@ ARRAY['service_role']::name[])
    AND NOT (
      (p.qual IS NOT NULL OR p.with_check IS NOT NULL)
      AND coalesce(p.qual, p.with_check) LIKE '%crm_has_permission(''integrations.manage''%'
      AND coalesce(p.with_check, p.qual) LIKE '%crm_has_permission(''integrations.manage''%'
    );
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'Write policies without integrations.manage remain: %', v_left;
  END IF;
END;
$$;
