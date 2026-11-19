-- BloomSuite central login, CRM side of two follow-ups (decision 55; gateway contracts 39-D7 and 39-D8).
--
-- 36/R-01: when BloomSuite ID deletes a person, the CRM collects the notice (Edge Function bloomsuite-deletion-
--   notices, every 10 minutes) and, for the CRM account linked to that BloomSuite ID user: ends its sessions, removes
--   its custom:bloomsuite identity and records it as "previously linked (account deleted)". The CRM account and its
--   data stay. A recorded account is never linked to a new BloomSuite ID account automatically: Auth's link step
--   (a new custom:bloomsuite identity for that account) is refused until an owner removes the record.
-- 37/R-01: a revoke that names only the BloomSuite ID user ends the sessions of the CRM account linked to it.
-- Everything lives in bloomsuite_private (not exposed by the Data API); the public entry points are service-role only.

CREATE TABLE IF NOT EXISTS bloomsuite_private.previous_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway_user_id uuid NOT NULL,
  notice_id text,
  reason text NOT NULL DEFAULT 'account_deleted',
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE bloomsuite_private.previous_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloomsuite_private.previous_links FROM PUBLIC, anon, authenticated;

-- The CRM account linked to a BloomSuite ID user, through its stored custom:bloomsuite identity.
CREATE OR REPLACE FUNCTION bloomsuite_private.linked_user(p_gateway_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT i.user_id FROM auth.identities i
  WHERE i.provider = 'custom:bloomsuite' AND i.provider_id = p_gateway_user_id::text
  ORDER BY i.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION bloomsuite_private.linked_user(uuid) FROM PUBLIC, anon, authenticated;

-- 37/R-01: ends every session of the CRM account linked to that BloomSuite ID user (0 when none is linked).
CREATE OR REPLACE FUNCTION public.bloomsuite_end_sessions_for_gateway_user(p_gateway_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := bloomsuite_private.linked_user(p_gateway_user_id);
BEGIN
  IF p_gateway_user_id IS NULL THEN
    RAISE EXCEPTION 'A BloomSuite ID user is required' USING ERRCODE = '22023';
  END IF;
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;
  RETURN bloomsuite_private.end_sessions(NULL, v_user);
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_end_sessions_for_gateway_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_end_sessions_for_gateway_user(uuid) TO service_role;

-- 36/R-01: applies one deletion notice. Returns what it did; safe to run again for the same notice.
CREATE OR REPLACE FUNCTION public.bloomsuite_apply_deletion_notice(p_gateway_user_id uuid, p_notice_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := bloomsuite_private.linked_user(p_gateway_user_id);
  v_sessions integer := 0;
  v_identities integer := 0;
BEGIN
  IF p_gateway_user_id IS NULL THEN
    RAISE EXCEPTION 'A BloomSuite ID user is required' USING ERRCODE = '22023';
  END IF;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'sessions_ended', 0, 'identities_removed', 0);
  END IF;
  -- The record goes in first, so a sign-in racing with this notice can't re-link the account.
  INSERT INTO bloomsuite_private.previous_links (user_id, gateway_user_id, notice_id)
  VALUES (v_user, p_gateway_user_id, p_notice_id)
  ON CONFLICT (user_id) DO UPDATE
    SET gateway_user_id = EXCLUDED.gateway_user_id, notice_id = EXCLUDED.notice_id, recorded_at = clock_timestamp();
  v_sessions := bloomsuite_private.end_sessions(NULL, v_user);
  -- Auth owns this table. Fail closed if its schema is unavailable.
  EXECUTE 'DELETE FROM auth.identities WHERE user_id = $1 AND provider = ''custom:bloomsuite''' USING v_user;
  GET DIAGNOSTICS v_identities = ROW_COUNT;
  RETURN jsonb_build_object('linked', true, 'sessions_ended', v_sessions, 'identities_removed', v_identities);
END $$;
REVOKE ALL ON FUNCTION public.bloomsuite_apply_deletion_notice(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_apply_deletion_notice(uuid, text) TO service_role;

-- The link step for a recorded account is refused: no new custom:bloomsuite identity is added to it.
CREATE OR REPLACE FUNCTION bloomsuite_private.refuse_previously_linked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.provider = 'custom:bloomsuite'
     AND EXISTS (SELECT 1 FROM bloomsuite_private.previous_links p WHERE p.user_id = NEW.user_id) THEN
    RAISE LOG 'bloomsuite: refused a new BloomSuite ID link for previously linked CRM user %', NEW.user_id;
    RAISE EXCEPTION 'This CRM account was linked to a deleted BloomSuite ID account'
      USING ERRCODE = '42501', HINT = 'bloomsuite_previously_linked';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bloomsuite_private.refuse_previously_linked() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bloomsuite_refuse_previously_linked ON auth.identities;
CREATE TRIGGER bloomsuite_refuse_previously_linked
  BEFORE INSERT ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION bloomsuite_private.refuse_previously_linked();

-- The scheduler: every 10 minutes, call the bloomsuite-deletion-notices Edge Function with its worker token. The URL
-- and token come from Vault (names below); until both are set the job does nothing.
CREATE OR REPLACE FUNCTION bloomsuite_private.invoke_deletion_notice_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_url text;
  v_token text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'bloomsuite_notice_worker_url';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'bloomsuite_notice_worker_token';
  IF coalesce(v_url, '') = '' OR coalesce(length(v_token), 0) < 32 THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-BloomSuite-Notice-Worker', v_token),
    body := '{}'::jsonb
  );
END $$;
REVOKE ALL ON FUNCTION bloomsuite_private.invoke_deletion_notice_worker() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bloomsuite-deletion-notices';
    PERFORM cron.schedule('bloomsuite-deletion-notices', '*/10 * * * *', 'SELECT bloomsuite_private.invoke_deletion_notice_worker();');
  END IF;
END $$;
