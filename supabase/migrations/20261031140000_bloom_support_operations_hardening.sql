-- Bloom Support — operational hardening.
--  * service identities resolved server-side (no shared admin credential, no key handling)
--  * worker heartbeat + vault-held worker token + independent watchdog alerts
--  * escalation owners, deadlines and fallback routing; ticket response deadlines
--  * evidence-based resolution; knowledge audience; usage and repair limits
--  * OAuth 2.1 (authorization code + PKCE) for per-person ChatGPT connections
--  * readiness facts

-- ---------------------------------------------------------------------------
-- Columns and tables
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.tickets ADD COLUMN due_at timestamptz;
ALTER TABLE bloom_support.escalations
  ADD COLUMN owner_id uuid REFERENCES bloom_support.principals(id),
  ADD COLUMN due_at timestamptz,
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN acknowledged_by uuid REFERENCES bloom_support.principals(id),
  ADD COLUMN fallback_level integer NOT NULL DEFAULT 0;
CREATE INDEX escalations_due ON bloom_support.escalations(due_at) WHERE status = 'open';
CREATE INDEX tickets_due ON bloom_support.tickets(due_at) WHERE status <> 'resolved';

CREATE TABLE bloom_support.worker_runs (
  id bigserial PRIMARY KEY,
  worker text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed integer,
  failed integer,
  note text
);
CREATE INDEX worker_runs_recent ON bloom_support.worker_runs(started_at DESC);

CREATE TABLE bloom_support.alerts (
  id bigserial PRIMARY KEY,
  condition text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  delivered text NOT NULL DEFAULT 'recorded' CHECK (delivered IN ('recorded','email_requested','no_channel')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bloom_support.oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bloom_support.oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES bloom_support.oauth_clients(client_id),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  used_at timestamptz
);
CREATE TABLE bloom_support.oauth_refresh_tokens (
  token_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES bloom_support.oauth_clients(client_id),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  scope text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['worker_runs','alerts','oauth_clients','oauth_codes','oauth_refresh_tokens'] LOOP
    EXECUTE format('ALTER TABLE bloom_support.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON bloom_support.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

UPDATE bloom_support.settings SET value = value || '{"max_concurrent_repairs":2,"max_repair_attempts":2,"ai_calls_per_day_total":1000,"worker_stale_minutes":10,"queue_stale_minutes":15}'::jsonb WHERE key = 'limits';
UPDATE bloom_support.settings SET value = '{"provider":"openai","model":"gpt-4o-mini","max_calls_per_account_per_day":200}' WHERE key = 'ai';
INSERT INTO bloom_support.settings(key, value) VALUES
  ('sla', '{"ticket_hours":{"urgent":4,"high":24,"normal":48,"low":120},"escalation_hours":{"default":24,"urgent":2,"automation_failed":4,"engineering_awaiting_approval":24,"feature_decision":168,"engineering_failed":4,"engineering_rolled_back":2},"fallback_hours":4}'),
  ('alerts', '{"email_enabled":true}')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Service identities (resolved by server code only; EXECUTE is service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.ensure_service_principal(p_scope text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  IF p_scope NOT IN ('intake','operations','automation','investigation','release') THEN RAISE EXCEPTION 'invalid service scope' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('bloom-service:' || p_scope, 0));
  SELECT id INTO v FROM bloom_support.principals WHERE kind = 'service' AND active AND grants = ARRAY[p_scope] ORDER BY created_at LIMIT 1;
  IF v IS NULL THEN
    INSERT INTO bloom_support.principals(kind, display_name, role, grants) VALUES ('service', 'Bloom ' || p_scope, 'service', ARRAY[p_scope]) RETURNING id INTO v;
    PERFORM bloom_support.log(NULL, NULL, NULL, 'service.provisioned', jsonb_build_object('principal_id', v, 'scope', p_scope));
  END IF;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- Worker heartbeat and token (token lives only in Vault; nothing to copy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.verify_worker_token(p_token text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE expected text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR to_regclass('vault.decrypted_secrets') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''bloom_support_worker_token'' LIMIT 1' INTO expected;
  RETURN expected IS NOT NULL AND expected = p_token;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.worker_run_start(p_worker text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO bloom_support.worker_runs(worker) VALUES (left(p_worker, 80)) RETURNING id;
$$;
CREATE OR REPLACE FUNCTION bloom_support.worker_run_finish(p_run bigint, p_processed integer, p_failed integer, p_note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE bloom_support.worker_runs SET finished_at = now(), processed = p_processed, failed = p_failed, note = left(p_note, 500) WHERE id = p_run;
  DELETE FROM bloom_support.worker_runs WHERE started_at < now() - interval '14 days';
$$;

-- ---------------------------------------------------------------------------
-- Deadlines, owners and fallback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.owner_principal(p_who text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM bloom_support.principals p
  WHERE p.active AND p.kind = 'user'
    AND lower(p.email) IN (SELECT lower(e) FROM jsonb_array_elements_text(coalesce(bloom_support.setting('owners')->p_who, '[]')) e)
  ORDER BY p.created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION bloom_support.ticket_due() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE hours numeric;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.priority IS DISTINCT FROM OLD.priority THEN
    hours := coalesce((bloom_support.setting('sla')->'ticket_hours'->>NEW.priority)::numeric, 48);
    NEW.due_at := coalesce(CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE now() END, now()) + make_interval(secs => (hours * 3600)::int);
  END IF;
  IF NEW.status = 'resolved' THEN NEW.due_at := NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
    NEW.due_at := now() + make_interval(secs => (coalesce((bloom_support.setting('sla')->'ticket_hours'->>NEW.priority)::numeric, 48) * 3600)::int);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_due BEFORE INSERT OR UPDATE OF priority, status ON bloom_support.tickets FOR EACH ROW EXECUTE FUNCTION bloom_support.ticket_due();

CREATE OR REPLACE FUNCTION bloom_support.escalation_defaults() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE sla jsonb := coalesce(bloom_support.setting('sla'), '{}'); hours numeric; urgent boolean;
BEGIN
  urgent := EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.id = NEW.ticket_id AND t.priority = 'urgent');
  hours := coalesce((sla->'escalation_hours'->>NEW.reason)::numeric, CASE WHEN urgent THEN (sla->'escalation_hours'->>'urgent')::numeric END, (sla->'escalation_hours'->>'default')::numeric, 24);
  NEW.due_at := coalesce(NEW.due_at, now() + make_interval(secs => (hours * 3600)::int));
  NEW.owner_id := coalesce(NEW.owner_id, bloom_support.owner_principal(CASE NEW.audience WHEN 'jeff' THEN 'jeff' ELSE 'jon' END),
                           (SELECT id FROM bloom_support.principals WHERE active AND role = 'platform_admin' ORDER BY created_at LIMIT 1));
  RETURN NEW;
END $$;
CREATE TRIGGER escalations_defaults BEFORE INSERT ON bloom_support.escalations FOR EACH ROW EXECUTE FUNCTION bloom_support.escalation_defaults();

CREATE OR REPLACE FUNCTION bloom_support.acknowledge_escalation(p_actor uuid, p_escalation uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x bloom_support.escalations;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.resolve');
  UPDATE bloom_support.escalations SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = p_actor, owner_id = p_actor,
    detail = coalesce(detail, '') || CASE WHEN p_note IS NOT NULL THEN E'\nAcknowledged: ' || p_note ELSE '' END
  WHERE id = p_escalation AND status = 'open' RETURNING * INTO x;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: open escalation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.log(x.ticket_id, NULL, p_actor, 'escalation.acknowledged', jsonb_build_object('escalation_id', x.id));
  RETURN to_jsonb(x);
END $$;

-- Fallback routing: an unacknowledged escalation past its deadline moves to the
-- other owner (Jon → Jeff, Jeff → Jon), widens to both, and gets a new deadline.
-- A second miss raises an independent alert. Overdue tickets escalate once.
CREATE OR REPLACE FUNCTION bloom_support.sweep_deadlines()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x record; t record; moved int := 0; overdue int := 0; fb numeric := coalesce((bloom_support.setting('sla')->>'fallback_hours')::numeric, 4);
  jon uuid := bloom_support.owner_principal('jon'); jeff uuid := bloom_support.owner_principal('jeff'); next_owner uuid;
BEGIN
  FOR x IN SELECT * FROM bloom_support.escalations WHERE status = 'open' AND due_at < now() ORDER BY due_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    next_owner := CASE WHEN x.owner_id = jon THEN coalesce(jeff, jon) WHEN x.owner_id = jeff THEN coalesce(jon, jeff) ELSE coalesce(jon, jeff) END;
    UPDATE bloom_support.escalations SET fallback_level = fallback_level + 1, audience = 'both', owner_id = next_owner,
      due_at = now() + make_interval(secs => (fb * 3600)::int) WHERE id = x.id;
    PERFORM bloom_support.notify_staff(x.ticket_id, 'escalation.overdue', 'Overdue (' || (x.fallback_level + 1) || '): ' || left(x.reason, 80), 'both');
    PERFORM bloom_support.enqueue_job('escalate', x.ticket_id, NULL, 'email:escalation', jsonb_build_object('escalation_id', x.id), 'escalate:' || x.id::text || ':fallback:' || (x.fallback_level + 1));
    IF x.fallback_level + 1 >= 2 THEN
      INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES ('escalation_unanswered', jsonb_build_object('escalation_id', x.id, 'reason', x.reason), 'esc:' || x.id::text || ':' || (x.fallback_level + 1))
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    PERFORM bloom_support.log(x.ticket_id, NULL, NULL, 'escalation.fallback', jsonb_build_object('escalation_id', x.id, 'level', x.fallback_level + 1, 'owner', next_owner));
    moved := moved + 1;
  END LOOP;
  FOR t IN SELECT id, number, subject FROM bloom_support.tickets WHERE status <> 'resolved' AND due_at < now()
             AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e WHERE e.dedupe_key = 'overdue:' || tickets.id::text) LIMIT 100 LOOP
    INSERT INTO bloom_support.escalations(ticket_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, 'both', 'ticket_overdue', '#' || t.number || ' ' || t.subject, 'overdue:' || t.id::text) ON CONFLICT (dedupe_key) DO NOTHING;
    PERFORM bloom_support.notify_staff(t.id, 'ticket.overdue', 'Overdue #' || t.number || ': ' || left(t.subject, 80), 'both');
    overdue := overdue + 1;
  END LOOP;
  RETURN jsonb_build_object('escalations_moved', moved, 'tickets_overdue', overdue);
END $$;

-- ---------------------------------------------------------------------------
-- Independent watchdog (pg_cron + SQL only: runs even if every Edge Function is down)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.watchdog()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lim jsonb := coalesce(bloom_support.setting('limits'), '{}'); enabled boolean := coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false);
  last_ok timestamptz; stale_queue int; dead int; findings jsonb := '[]'; f jsonb; hour text := to_char(now(), 'YYYY-MM-DD"T"HH24'); key text; resend_key text; recipients jsonb; inserted boolean;
BEGIN
  PERFORM bloom_support.sweep_deadlines();
  SELECT max(finished_at) INTO last_ok FROM bloom_support.worker_runs;
  IF enabled AND (last_ok IS NULL OR last_ok < now() - make_interval(mins => coalesce((lim->>'worker_stale_minutes')::int, 10))) THEN
    findings := findings || jsonb_build_object('condition', 'worker_not_running', 'last_finished_at', last_ok);
  END IF;
  SELECT count(*) INTO stale_queue FROM bloom_support.jobs WHERE status = 'queued' AND run_after < now() - make_interval(mins => coalesce((lim->>'queue_stale_minutes')::int, 15));
  IF enabled AND stale_queue > 0 THEN findings := findings || jsonb_build_object('condition', 'queue_backlog', 'jobs', stale_queue); END IF;
  SELECT count(*) INTO dead FROM bloom_support.jobs WHERE status = 'dead' AND updated_at > now() - interval '1 hour';
  IF dead > 0 THEN findings := findings || jsonb_build_object('condition', 'dead_jobs', 'jobs', dead); END IF;
  IF EXISTS (SELECT 1 FROM bloom_support.outbound_emails WHERE status = 'failed' AND created_at > now() - interval '1 hour') THEN
    findings := findings || jsonb_build_object('condition', 'email_failures');
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''bloom_support_alert_resend_key'' LIMIT 1' INTO resend_key;
  END IF;
  recipients := coalesce(bloom_support.setting('owners')->'jon', '[]') || coalesce(bloom_support.setting('owners')->'jeff', '[]');
  FOR f IN SELECT * FROM jsonb_array_elements(findings) LOOP
    key := (f->>'condition') || ':' || hour;
    INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES (f->>'condition', f, key) ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING true INTO inserted;
    IF coalesce(inserted, false) THEN
      PERFORM bloom_support.notify_staff(NULL, 'alert.' || (f->>'condition'), 'Bloom alert: ' || replace(f->>'condition', '_', ' '), 'both');
      IF resend_key IS NOT NULL AND jsonb_array_length(recipients) > 0 AND to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
        EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3)' USING
          'https://api.resend.com/emails',
          jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
          jsonb_build_object('from', coalesce(bloom_support.setting('support_inbox')->>'alert_from', 'Bloom Alerts <alerts@bloomsuite.app>'),
            'to', recipients, 'subject', '[Bloom alert] ' || replace(f->>'condition', '_', ' '), 'text', 'Bloom Support watchdog: ' || f::text || E'\n\nOpen Bloom Support → Settings → Readiness.');
        UPDATE bloom_support.alerts SET delivered = 'email_requested' WHERE dedupe_key = key;
      ELSE
        UPDATE bloom_support.alerts SET delivered = 'no_channel' WHERE dedupe_key = key;
      END IF;
    END IF;
    inserted := NULL;
  END LOOP;
  RETURN jsonb_build_object('findings', findings, 'checked_at', now());
END $$;

-- ---------------------------------------------------------------------------
-- Repair capacity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.repair_capacity(p_issue uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'active', (SELECT count(*) FROM bloom_support.engineering_issues WHERE id <> p_issue AND status IN ('investigating','reproduced','fixing','in_review','merging','deploying','verifying')),
    'max_active', coalesce((bloom_support.setting('limits')->>'max_concurrent_repairs')::int, 2),
    'attempts', (SELECT coalesce((evidence->>'dispatches')::int, 0) FROM bloom_support.engineering_issues WHERE id = p_issue),
    'max_attempts', coalesce((bloom_support.setting('limits')->>'max_repair_attempts')::int, 2))
$$;

-- ---------------------------------------------------------------------------
-- OAuth 2.1 for MCP clients (each person authorizes their own connection)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.oauth_register_client(p_name text, p_redirects text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid text := 'bloom_' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF p_redirects IS NULL OR cardinality(p_redirects) = 0 OR cardinality(p_redirects) > 10
     OR EXISTS (SELECT 1 FROM unnest(p_redirects) r WHERE r !~ '^https://[^\s]+$' AND r !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/') THEN
    RAISE EXCEPTION 'invalid redirect_uris' USING ERRCODE = '22023';
  END IF;
  INSERT INTO bloom_support.oauth_clients(client_id, client_name, redirect_uris) VALUES (cid, left(coalesce(p_name, 'MCP client'), 120), p_redirects);
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.oauth_client(p_client text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(c) FROM bloom_support.oauth_clients c WHERE client_id = p_client
$$;

-- Called after the person signed in to BloomSuite and approved the connection.
CREATE OR REPLACE FUNCTION bloom_support.oauth_issue_code(p_actor uuid, p_client text, p_redirect text, p_challenge text, p_scope text, p_code_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT bloom_support.is_staff(p_actor) THEN RAISE EXCEPTION 'forbidden: only Brands in Blooms staff can connect an assistant' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bloom_support.oauth_clients WHERE client_id = p_client AND p_redirect = ANY(redirect_uris)) THEN
    RAISE EXCEPTION 'invalid client or redirect_uri' USING ERRCODE = '22023';
  END IF;
  IF p_challenge IS NULL OR length(p_challenge) < 43 OR p_scope NOT IN ('read','write') THEN RAISE EXCEPTION 'invalid PKCE challenge or scope' USING ERRCODE = '22023'; END IF;
  INSERT INTO bloom_support.oauth_codes(code_hash, client_id, principal_id, redirect_uri, code_challenge, scope) VALUES (p_code_hash, p_client, p_actor, p_redirect, p_challenge, p_scope);
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'oauth.approved', jsonb_build_object('client_id', p_client, 'scope', p_scope));
END $$;

-- Single use; returns the code row for PKCE verification by the caller.
CREATE OR REPLACE FUNCTION bloom_support.oauth_consume_code(p_code_hash text, p_client text, p_redirect text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c bloom_support.oauth_codes;
BEGIN
  UPDATE bloom_support.oauth_codes SET used_at = now()
  WHERE code_hash = p_code_hash AND client_id = p_client AND redirect_uri = p_redirect AND used_at IS NULL AND expires_at > now()
  RETURNING * INTO c;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(c);
END $$;

-- Issues a short-lived access token (an expiring API key) + rotating refresh token.
CREATE OR REPLACE FUNCTION bloom_support.oauth_issue_tokens(p_principal uuid, p_client text, p_scope text, p_access_hash text, p_access_prefix text, p_refresh_hash text, p_old_refresh_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT bloom_support.is_staff(p_principal) THEN RAISE EXCEPTION 'forbidden: connection owner is no longer staff' USING ERRCODE = '42501'; END IF;
  IF p_old_refresh_hash IS NOT NULL THEN
    UPDATE bloom_support.oauth_refresh_tokens SET revoked_at = now() WHERE token_hash = p_old_refresh_hash AND revoked_at IS NULL AND expires_at > now() AND principal_id = p_principal AND client_id = p_client;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid refresh token' USING ERRCODE = '28000'; END IF;
  END IF;
  INSERT INTO bloom_support.api_keys(principal_id, label, prefix, key_hash, scopes, created_by, expires_at)
  VALUES (p_principal, 'OAuth: ' || (SELECT client_name FROM bloom_support.oauth_clients WHERE client_id = p_client), p_access_prefix, p_access_hash,
          CASE WHEN p_scope = 'read' THEN ARRAY['read'] ELSE ARRAY['*'] END, p_principal, now() + interval '1 hour');
  INSERT INTO bloom_support.oauth_refresh_tokens(token_hash, client_id, principal_id, scope) VALUES (p_refresh_hash, p_client, p_principal, p_scope);
  RETURN jsonb_build_object('expires_in', 3600, 'scope', p_scope);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.oauth_refresh_lookup(p_refresh_hash text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(r) FROM bloom_support.oauth_refresh_tokens r WHERE token_hash = p_refresh_hash AND revoked_at IS NULL AND expires_at > now()
$$;

-- ---------------------------------------------------------------------------
-- Readiness facts (what the database can prove; the Edge Function adds config facts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.readiness_facts(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cron_worker boolean := false; cron_watchdog boolean := false; vault_token boolean := false; vault_alert boolean := false;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-worker'' AND active), EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-watchdog'' AND active)' INTO cron_worker, cron_watchdog;
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_worker_token''), EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_alert_resend_key'')' INTO vault_token, vault_alert;
  END IF;
  RETURN jsonb_build_object(
    'settings', (SELECT jsonb_object_agg(key, value) FROM bloom_support.settings WHERE key IN ('automation_enabled','client_email_enabled','auto_release_enabled','ai','owners','limits')),
    'release_policy_set', (SELECT value <> '{}'::jsonb FROM bloom_support.settings WHERE key = 'release_policy'),
    'cron', jsonb_build_object('worker', cron_worker, 'watchdog', cron_watchdog),
    'vault', jsonb_build_object('worker_token', vault_token, 'alert_resend_key', vault_alert),
    'worker', (SELECT jsonb_build_object('last_started_at', max(started_at), 'last_finished_at', max(finished_at),
                 'runs_24h', count(*) FILTER (WHERE started_at > now() - interval '1 day'),
                 'processed_24h', coalesce(sum(processed) FILTER (WHERE started_at > now() - interval '1 day'), 0)) FROM bloom_support.worker_runs),
    'last_seen', jsonb_build_object(
      'intake_crm', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'crm'),
      'intake_cms', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'cms'),
      'intake_pos', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'pos'),
      'intake_public', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'public'),
      'intake_email', (SELECT max(received_at) FROM bloom_support.email_events WHERE outcome LIKE 'created%' OR outcome LIKE 'reply%'),
      'email_sent', (SELECT max(sent_at) FROM bloom_support.outbound_emails WHERE status = 'sent'),
      'model_call', (SELECT max(created_at) FROM bloom_support.activity WHERE action = 'ai.call'),
      'operation_succeeded', (SELECT max(updated_at) FROM bloom_support.operations WHERE status = 'succeeded'),
      'fix_verified', (SELECT max(updated_at) FROM bloom_support.engineering_issues WHERE status = 'verified'),
      'mcp_or_api_key_used', (SELECT max(last_used_at) FROM bloom_support.api_keys)),
    'staff', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', display_name, 'email', email, 'role', role)), '[]') FROM bloom_support.principals WHERE kind = 'user' AND role <> 'client' AND active),
    'open_alerts', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]') FROM (SELECT * FROM bloom_support.alerts WHERE created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 20) a),
    'knowledge', jsonb_build_object('approved_client', (SELECT count(*) FROM bloom_support.knowledge WHERE approved AND audience = 'client'), 'internal', (SELECT count(*) FROM bloom_support.knowledge WHERE audience = 'internal')));
END $$;

-- ---------------------------------------------------------------------------
-- Grants and schedules
-- ---------------------------------------------------------------------------
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'bloom_support' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Worker token is generated inside the database and never leaves Vault/cron.
-- The worker every minute and the watchdog every five minutes run from pg_cron.
DO $$ DECLARE has_vault boolean := to_regclass('vault.secrets') IS NOT NULL; has_cron boolean := to_regclass('cron.job') IS NOT NULL; exists_token boolean := false;
BEGIN
  IF has_vault THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = ''bloom_support_worker_token'')' INTO exists_token;
    IF NOT exists_token THEN
      EXECUTE 'SELECT vault.create_secret($1, ''bloom_support_worker_token'', ''Bloom Support worker trigger token'')'
        USING replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    END IF;
  END IF;
  IF has_cron AND has_vault THEN
    EXECUTE $s$SELECT cron.schedule('bloom-support-worker', '* * * * *', $c$
      SELECT net.http_post(
        url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/bloom-support-worker',
        headers := jsonb_build_object('Content-Type','application/json','x-bloom-worker-token',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bloom_support_worker_token')),
        body := '{"source":"cron"}'::jsonb, timeout_milliseconds := 55000)
    $c$)$s$;
    EXECUTE $s$SELECT cron.schedule('bloom-support-watchdog', '*/5 * * * *', 'SELECT bloom_support.watchdog()')$s$;
  END IF;
END $$;
