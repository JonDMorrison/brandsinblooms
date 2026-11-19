-- BloomSuite central login: the CRM's two session steps, as the POS has them.
--   1. End CRM sessions when BloomSuite ID asks (the bloomsuite-revoke Edge Function): one session, or every
--      session of one CRM user. Refresh tokens first, then the auth.sessions rows, so the session ends at once.
--   2. First link (decision 25): when an account that already had a CRM password first signs in through
--      BloomSuite ID, its password becomes a random value nobody knows and its other sessions end, once per
--      account, keeping the session that made the BloomSuite sign-in (bloomsuite-session-report).
-- Everything lives in a schema the Data API doesn't expose; the public entry points are service-role only.
CREATE SCHEMA IF NOT EXISTS bloomsuite_private;
REVOKE ALL ON SCHEMA bloomsuite_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA bloomsuite_private TO service_role;

CREATE TABLE IF NOT EXISTS bloomsuite_private.first_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kept_session_id uuid NOT NULL,
  other_sessions_ended integer NOT NULL DEFAULT 0,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE bloomsuite_private.first_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloomsuite_private.first_links FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bloomsuite_private.end_sessions(p_session_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  targets uuid[];
  removed integer;
BEGIN
  IF (p_session_id IS NULL) = (p_user_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one of session id or user id is required' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(s.id) INTO targets
  FROM auth.sessions s
  WHERE s.id = p_session_id OR s.user_id = p_user_id;
  IF targets IS NULL THEN
    RETURN 0;
  END IF;
  -- Auth owns these tables. Fail closed if its schema is unavailable.
  EXECUTE 'DELETE FROM auth.refresh_tokens WHERE session_id = ANY($1)' USING targets;
  EXECUTE 'DELETE FROM auth.sessions WHERE id = ANY($1)' USING targets;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION bloomsuite_private.end_sessions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloomsuite_private.end_sessions(uuid, uuid) TO service_role;

-- Returns null when this account's first link was already recorded, else the number of sessions ended.
CREATE OR REPLACE FUNCTION bloomsuite_private.complete_first_link(p_user_id uuid, p_keep_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  targets uuid[];
  removed integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_keep_session_id IS NULL THEN
    RAISE EXCEPTION 'A user id and the session to keep are required' USING ERRCODE = '22023';
  END IF;
  -- The marker goes in first, so two reports racing for the same account run the step only once.
  INSERT INTO bloomsuite_private.first_links (user_id, kept_session_id)
  VALUES (p_user_id, p_keep_session_id)
  ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- Auth owns these tables. Fail closed if its schema is unavailable. Only an account with a password gets a
  -- new one (Auth's admin password update would end the BloomSuite session too, so it isn't used).
  EXECUTE 'UPDATE auth.users SET encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), ''hex''), extensions.gen_salt(''bf''))
    WHERE id = $1 AND coalesce(encrypted_password, '''') <> ''''' USING p_user_id;
  SELECT array_agg(s.id) INTO targets
  FROM auth.sessions s
  WHERE s.user_id = p_user_id AND s.id <> p_keep_session_id;
  IF targets IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE session_id = ANY($1)' USING targets;
    EXECUTE 'DELETE FROM auth.sessions WHERE id = ANY($1)' USING targets;
    GET DIAGNOSTICS removed = ROW_COUNT;
  END IF;
  UPDATE bloomsuite_private.first_links SET other_sessions_ended = removed WHERE user_id = p_user_id;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION bloomsuite_private.complete_first_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloomsuite_private.complete_first_link(uuid, uuid) TO service_role;

-- Service-role-only Data API entry points for the two Edge Functions.
CREATE OR REPLACE FUNCTION public.bloomsuite_end_sessions(p_session_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$ SELECT bloomsuite_private.end_sessions(p_session_id, p_user_id); $$;
REVOKE ALL ON FUNCTION public.bloomsuite_end_sessions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_end_sessions(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bloomsuite_complete_first_link(p_user_id uuid, p_keep_session_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$ SELECT bloomsuite_private.complete_first_link(p_user_id, p_keep_session_id); $$;
REVOKE ALL ON FUNCTION public.bloomsuite_complete_first_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsuite_complete_first_link(uuid, uuid) TO service_role;
