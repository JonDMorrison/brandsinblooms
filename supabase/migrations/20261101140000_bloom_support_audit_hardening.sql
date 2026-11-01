-- Bloom Support hardening (audit 2026-11-01): identity, intake, operations,
-- OAuth and automated-repair controls. Every function below replaces its latest
-- definition; behaviour not named here is unchanged.

-- ---------------------------------------------------------------------------
-- 1. Platform administrator bootstrap: only when Bloom has no administrator.
--    CRM master-admin status alone no longer makes someone a Bloom
--    administrator once one exists; further roles go through set_principal_role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloom_support_bootstrap_admin(p_principal uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_auth uuid; ok boolean := false;
BEGIN
  SELECT auth_user_id INTO v_auth FROM bloom_support.principals WHERE id = p_principal AND kind = 'user' AND role = 'client';
  IF v_auth IS NULL OR to_regprocedure('public.is_master_admin(uuid)') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT coalesce(public.is_master_admin($1), false)' INTO ok USING v_auth;
  IF NOT ok THEN RETURN false; END IF;
  -- First administrator only. Later staff are assigned deliberately by an administrator.
  PERFORM pg_advisory_xact_lock(hashtextextended('bloom-bootstrap-admin', 0));
  IF EXISTS (SELECT 1 FROM bloom_support.principals WHERE role = 'platform_admin' AND active) THEN RETURN false; END IF;
  UPDATE bloom_support.principals SET role = 'platform_admin', updated_at = now() WHERE id = p_principal;
  PERFORM bloom_support.log(NULL, NULL, p_principal, 'principal.bootstrapped_admin', jsonb_build_object('auth_user_id', v_auth));
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Email and public senders are self-reported. Never pick an account from an
--    ambiguous domain or from more than one verified membership. (A sender still
--    resolves to the client principal with that address so replies thread; every
--    reply goes only to that address, so a forged From learns nothing.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.resolve_email_sender(p_email text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; acct uuid; e text := lower(btrim(p_email)); dom text; matched text := 'none'; existing bloom_support.principals;
BEGIN
  IF e IS NULL OR e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid sender' USING ERRCODE = '22023'; END IF;
  dom := split_part(e, '@', 2);
  -- Prefer an existing client principal with this exact email. A staff
  -- principal is never resolved from an email address alone.
  SELECT * INTO existing FROM bloom_support.principals
   WHERE lower(email) = e AND active AND role = 'client' ORDER BY (kind = 'user') DESC, created_at LIMIT 1;
  IF FOUND THEN pid := existing.id; matched := 'principal'; END IF;
  IF pid IS NULL THEN
    INSERT INTO bloom_support.principals(kind, product, external_id, email, display_name, role)
    VALUES ('external_user', 'email', e, e, p_name, 'client')
    ON CONFLICT (product, external_id) DO UPDATE SET updated_at = now() RETURNING id INTO pid;
  END IF;
  -- A single staff-verified membership only; more than one is ambiguous.
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(m.account_id))[1] END INTO acct
    FROM bloom_support.account_members m WHERE m.principal_id = pid AND m.verified;
  IF acct IS NOT NULL THEN matched := 'membership';
  ELSE
    -- Exactly one active account must own the domain; ambiguity binds nothing.
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(a.id))[1] END INTO acct FROM bloom_support.accounts a
     WHERE dom = ANY(a.email_domains) AND a.merged_into IS NULL
       AND dom NOT IN ('gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','live.com','aol.com','shaw.ca','telus.net','rogers.com','sympatico.ca');
    IF acct IS NOT NULL THEN
      matched := 'domain';
      -- Domain match links the ticket to the account but the person stays
      -- unverified: they can track their own tickets, not the account's.
      INSERT INTO bloom_support.account_members(account_id, principal_id, relationship, verified) VALUES (acct, pid, 'email_contact', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN jsonb_build_object('principal_id', pid, 'account_id', acct, 'match', matched);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Every operation is executed by a person. Service identities may prepare
--    previews but never confirm, execute or retry a change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.claim_operation(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations; retrying boolean := false;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.is_staff(p_actor) THEN
    RAISE EXCEPTION 'forbidden: a person must confirm this change' USING ERRCODE = '42501';
  END IF;
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN
    RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
  END IF;
  IF o.kind = 'site.create_draft' THEN
    IF NOT bloom_support.is_staff(p_actor) THEN
      RAISE EXCEPTION 'forbidden: site creation needs a person' USING ERRCODE = '42501';
    END IF;
    IF o.inputs->>'expected_account_id' IS DISTINCT FROM o.account_id::text
       OR coalesce(o.inputs->>'expected_creator_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR coalesce(o.inputs->>'expected_creator_email','') = ''
       OR NOT (o.inputs ? 'expected_tenant_id' AND o.inputs ? 'expected_anchor_site_id') THEN
      RAISE EXCEPTION 'invalid: site creation needs a fresh client and owner preview' USING ERRCODE = '22023';
    END IF;
    retrying := o.confirmed_by IS NOT NULL AND (o.status = 'failed'
      OR (o.status = 'executing' AND o.updated_at < now() - interval '5 minutes'));
  END IF;
  IF o.status <> 'previewed' AND NOT retrying THEN RETURN to_jsonb(o) || '{"already":true}'; END IF;
  IF NOT retrying AND o.expires_at < now() THEN
    UPDATE bloom_support.operations SET status = 'expired', updated_at = now() WHERE id = o.id RETURNING * INTO o;
    RETURN to_jsonb(o);
  END IF;
  UPDATE bloom_support.operations SET status = 'executing', confirmed_by = p_actor, updated_at = now()
    WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor,
    CASE WHEN retrying THEN 'operation.retried' ELSE 'operation.confirmed' END,
    jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'resume_only', retrying AND o.expires_at < now()));
  RETURN to_jsonb(o);
END $$;

-- ---------------------------------------------------------------------------
-- 4. Withdrawn Bloom replies never appear to clients; bounced or complaining
--    addresses are not emailed again.
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.messages ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
UPDATE bloom_support.messages m SET withdrawn_at = coalesce(withdrawn_at, now())
 WHERE m.author_kind = 'bloom' AND m.visibility = 'public' AND m.delivery = 'suppressed'
   AND EXISTS (SELECT 1 FROM bloom_support.outbound_emails o WHERE o.message_id = m.id AND o.error = 'ticket under human control');

CREATE OR REPLACE FUNCTION bloom_support.invalidate_planned(p_ticket uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  UPDATE bloom_support.messages SET delivery = 'suppressed', withdrawn_at = now()
  WHERE ticket_id = p_ticket AND author_kind = 'bloom' AND visibility = 'public' AND delivery = 'queued';
  UPDATE bloom_support.jobs j SET status = 'cancelled', last_error = 'invalidated: ' || p_reason, updated_at = now()
  WHERE j.ticket_id = p_ticket AND j.status = 'queued'
    AND (j.kind IN ('answer','operate')
         OR (j.kind = 'send_email' AND EXISTS (SELECT 1 FROM bloom_support.messages m WHERE m.id = (j.payload->>'message_id')::uuid AND m.author_kind = 'bloom')));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM bloom_support.log(p_ticket, NULL, NULL, 'automation.invalidated', jsonb_build_object('jobs', n, 'reason', p_reason)); END IF;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION bloom_support.queue_outbound_email(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.outbound_emails; t bloom_support.tickets; v_blocked boolean;
BEGIN
  -- Addresses that bounced (30 days) or complained (ever) are not emailed again.
  v_blocked := EXISTS (SELECT 1 FROM bloom_support.outbound_emails b WHERE lower(b.to_email) = lower(p->>'to')
                         AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days')));
  IF p->>'ticket_id' IS NOT NULL THEN SELECT * INTO t FROM bloom_support.tickets WHERE id = (p->>'ticket_id')::uuid; END IF;
  INSERT INTO bloom_support.outbound_emails(ticket_id, message_id, purpose, to_email, subject, body, rfc_message_id, in_reply_to, idempotency_key, cc, status)
  VALUES ((p->>'ticket_id')::uuid, (p->>'message_id')::uuid, p->>'purpose', lower(p->>'to'), p->>'subject', p->>'body', p->>'rfc_message_id', p->>'in_reply_to', p->>'idempotency_key',
    coalesce(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'cc') = 'array' THEN p->'cc' ELSE '[]'::jsonb END) x), '{}'),
    CASE WHEN v_blocked THEN 'suppressed'
         WHEN coalesce((p->>'bloom_initiated')::boolean, false) AND t.automation <> 'auto' THEN 'suppressed' ELSE 'queued' END)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING * INTO o;
  IF o.id IS NOT NULL AND o.status = 'suppressed' THEN
    UPDATE bloom_support.outbound_emails SET error = CASE WHEN v_blocked THEN 'recipient bounced or complained' ELSE 'ticket under human control' END
    WHERE id = o.id RETURNING * INTO o;
    IF NOT v_blocked AND o.message_id IS NOT NULL THEN
      UPDATE bloom_support.messages SET withdrawn_at = coalesce(withdrawn_at, now()) WHERE id = o.message_id AND author_kind = 'bloom';
    END IF;
  END IF;
  IF o.id IS NULL THEN
    SELECT * INTO o FROM bloom_support.outbound_emails WHERE idempotency_key = p->>'idempotency_key';
    -- A retry of any send the provider never accepted is re-checked against bounces and
    -- complaints recorded since the first attempt.
    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND EXISTS (SELECT 1 FROM bloom_support.outbound_emails b WHERE lower(b.to_email) = lower(o.to_email) AND b.id <> o.id
                     AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days'))) THEN
      UPDATE bloom_support.outbound_emails SET status = 'suppressed', error = 'recipient bounced or complained' WHERE id = o.id RETURNING * INTO o;
      RETURN to_jsonb(o) || '{"duplicate":true}';
    END IF;
    -- A retry of a Bloom-initiated send that the provider never accepted is re-checked against
    -- human takeover, so a retry can never send after a person took the ticket over.
    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND coalesce((p->>'bloom_initiated')::boolean, false) AND t.id IS NOT NULL AND t.automation <> 'auto' THEN
      UPDATE bloom_support.outbound_emails SET status = 'suppressed', error = 'ticket under human control' WHERE id = o.id RETURNING * INTO o;
      UPDATE bloom_support.messages SET withdrawn_at = coalesce(withdrawn_at, now()) WHERE id = o.message_id AND author_kind = 'bloom';
    END IF;
    RETURN to_jsonb(o) || '{"duplicate":true}';
  END IF;
  RETURN to_jsonb(o) || '{"duplicate":false}';
END $$;
CREATE OR REPLACE FUNCTION bloom_support.ticket_by_tracking_token(p_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tok bloom_support.tracking_tokens; t bloom_support.tickets;
BEGIN
  SELECT * INTO tok FROM bloom_support.tracking_tokens WHERE token_hash = p_hash AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO t FROM bloom_support.tickets WHERE id = tok.ticket_id;
  RETURN jsonb_build_object('number', t.number, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'resolution_summary', t.resolution_summary,
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('from', CASE m.author_kind WHEN 'client' THEN 'you' ELSE 'Bloom Support' END, 'body', m.body, 'created_at', m.created_at) ORDER BY m.created_at), '[]')
                 FROM bloom_support.messages m WHERE m.ticket_id = t.id AND m.visibility = 'public' AND m.withdrawn_at IS NULL));
END $$;
CREATE OR REPLACE FUNCTION bloom_support.ticket_json(p_actor uuid, t bloom_support.tickets, p_full boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff boolean := bloom_support.has_permission(p_actor, 'tickets.read_all'); base jsonb; merged uuid[];
BEGIN
  base := jsonb_build_object(
    'id', t.id, 'number', t.number, 'subject', t.subject, 'status', t.status, 'product', t.product, 'kind', t.kind,
    'priority', t.priority, 'created_at', t.created_at, 'updated_at', t.updated_at, 'resolved_at', t.resolved_at,
    'waiting_reason', t.waiting_reason, 'merged_into', t.merged_into,
    'merged_into_number', (SELECT o.number FROM bloom_support.tickets o WHERE o.id = t.merged_into),
    'conversation_id', t.conversation_id, 'account', (SELECT jsonb_build_object('id', a.id, 'name', a.name) FROM bloom_support.accounts a WHERE a.id = t.account_id),
    'requester', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name, 'email', pr.email) FROM bloom_support.principals pr WHERE pr.id = t.requester_id),
    'resolution_summary', t.resolution_summary,
    'progress', bloom_support.client_progress(t));
  IF staff THEN
    base := base || jsonb_build_object('stage', t.stage, 'category', t.category, 'impact', t.impact, 'automation', t.automation,
      'next_action', t.next_action, 'next_action_due_at', t.next_action_due_at, 'version', t.version, 'channel', t.channel, 'source_ref', t.source_ref,
      'environment', t.environment, 'team', t.team, 'tags', to_jsonb(t.tags), 'spam', t.spam, 'pending_review', t.pending_review,
      'executor', t.executor, 'executor_person', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name) FROM bloom_support.principals pr WHERE pr.id = t.executor_id),
      'duplicate_of', t.duplicate_of, 'problem_id', t.problem_id, 'engineering_issue_id', t.engineering_issue_id, 'feature_request_id', t.feature_request_id,
      'reopen_count', t.reopen_count, 'resolution_verified', t.resolution_verified, 'due_at', t.due_at, 'waiting_since', t.waiting_since,
      'first_response_at', t.first_response_at, 'last_customer_message_at', t.last_customer_message_at, 'last_team_message_at', t.last_team_message_at,
      'first_resolved_at', t.first_resolved_at, 'closed_at', t.closed_at, 'flags', bloom_support.ticket_flags(t),
      'owner', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name, 'role', pr.role) FROM bloom_support.principals pr WHERE pr.id = t.owner_id),
      'taken_over_by', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name) FROM bloom_support.principals pr WHERE pr.id = t.taken_over_by));
  END IF;
  IF NOT p_full THEN RETURN base; END IF;
  merged := ARRAY(SELECT id FROM bloom_support.tickets WHERE merged_into = t.id);
  base := base || jsonb_build_object(
    'summary', t.summary,
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ticket_id', m.ticket_id, 'author_kind', m.author_kind, 'visibility', m.visibility,
                   'direction', m.direction, 'body', m.body, 'created_at', m.created_at, 'delivery', CASE WHEN staff THEN m.delivery END,
                   'purpose', CASE WHEN staff THEN m.purpose END, 'meaningful', CASE WHEN staff THEN m.meaningful END,
                   'author', (SELECT jsonb_build_object('name', CASE WHEN m.author_kind = 'bloom' THEN 'Bloom' ELSE pr.display_name END, 'role', CASE WHEN staff THEN pr.role END) FROM bloom_support.principals pr WHERE pr.id = m.author_id))
                   ORDER BY m.created_at), '[]')
                 FROM (SELECT * FROM bloom_support.messages m
                       WHERE (m.conversation_id = t.conversation_id OR m.ticket_id = ANY(merged))
                         AND (m.ticket_id IS NULL OR m.ticket_id = t.id OR m.ticket_id = ANY(merged) OR staff)
                         AND (staff OR (m.visibility = 'public' AND m.withdrawn_at IS NULL))
                       ORDER BY m.created_at DESC LIMIT 300) m),
    'attachments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'file_name', x.file_name, 'content_type', x.content_type, 'size_bytes', x.size_bytes, 'visibility', x.visibility, 'created_at', x.created_at)), '[]')
                    FROM bloom_support.attachments x WHERE x.ticket_id = t.id AND (staff OR x.visibility = 'public')),
    'conversation_tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject, 'status', o.status) ORDER BY o.number), '[]')
                    FROM bloom_support.tickets o WHERE o.conversation_id = t.conversation_id AND o.id <> t.id AND o.merged_into IS NULL AND (staff OR bloom_support.can_read_ticket(p_actor, o.id))));
  IF staff THEN
    base := base || jsonb_build_object(
      'context', t.context, 'resolution_evidence', t.resolution_evidence, 'timers', bloom_support.ticket_timers(t.id),
      'merged_tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject)), '[]') FROM bloom_support.tickets o WHERE o.merged_into = t.id),
      'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'from', e.from_value, 'to', e.to_value, 'at', e.at,
                    'actor', (SELECT pr.display_name FROM bloom_support.principals pr WHERE pr.id = e.actor_id)) ORDER BY e.id), '[]')
                  FROM (SELECT * FROM bloom_support.ticket_events WHERE ticket_id = t.id ORDER BY id DESC LIMIT 200) e),
      'problem', (SELECT jsonb_build_object('id', pb.id, 'title', pb.title, 'kind', pb.kind, 'status', pb.status,
                    'tickets', (SELECT count(*) FROM bloom_support.tickets x WHERE x.problem_id = pb.id), 'accounts', (SELECT count(DISTINCT account_id) FROM bloom_support.tickets x WHERE x.problem_id = pb.id))
                  FROM bloom_support.problems pb WHERE pb.id = t.problem_id),
      'links', (SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_id', CASE WHEN l.from_ticket = t.id THEN l.to_ticket ELSE l.from_ticket END, 'kind', l.kind,
                 'number', o.number, 'subject', o.subject, 'status', o.status)), '[]')
                FROM bloom_support.ticket_links l JOIN bloom_support.tickets o ON o.id = CASE WHEN l.from_ticket = t.id THEN l.to_ticket ELSE l.from_ticket END
                WHERE l.from_ticket = t.id OR l.to_ticket = t.id),
      'activity', (SELECT coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'detail', a.detail, 'created_at', a.created_at,
                    'actor', (SELECT pr.display_name FROM bloom_support.principals pr WHERE pr.id = a.actor_id)) ORDER BY a.id), '[]')
                   FROM (SELECT * FROM bloom_support.activity WHERE ticket_id = t.id ORDER BY id DESC LIMIT 200) a),
      'jobs', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'kind', j.kind, 'status', j.status, 'attempts', j.attempts, 'last_error', j.last_error, 'run_after', j.run_after, 'updated_at', j.updated_at) ORDER BY j.created_at DESC), '[]')
               FROM (SELECT * FROM bloom_support.jobs WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 20) j),
      'operations', (SELECT coalesce(jsonb_agg(to_jsonb(o) - 'undo' ORDER BY o.created_at DESC), '[]') FROM bloom_support.operations o WHERE o.ticket_id = t.id),
      'engineering', (SELECT to_jsonb(e) FROM bloom_support.engineering_issues e WHERE e.id = t.engineering_issue_id),
      'feature_request', (SELECT to_jsonb(f) FROM bloom_support.feature_requests f WHERE f.id = t.feature_request_id),
      'escalations', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]') FROM bloom_support.escalations x WHERE x.ticket_id = t.id),
      'emails', (SELECT coalesce(jsonb_agg(jsonb_build_object('purpose', o.purpose, 'to', o.to_email, 'cc', o.cc, 'status', o.status, 'created_at', o.created_at, 'error', o.error) ORDER BY o.created_at DESC), '[]')
                 FROM bloom_support.outbound_emails o WHERE o.ticket_id = t.id),
      'account_history', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject, 'status', o.status, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]')
                 FROM (SELECT * FROM bloom_support.tickets WHERE account_id = t.account_id AND id <> t.id ORDER BY created_at DESC LIMIT 15) o));
  END IF;
  RETURN base;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Email fallback de-duplication: a product's fallback email carries the
--    request's idempotency key; find the ticket the product already created.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.find_ticket_by_client_key(p_actor uuid, p_key text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'intake.email');
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9:_-]{8,200}$' THEN RETURN NULL; END IF;
  SELECT t.id INTO v FROM bloom_support.tickets t
   JOIN bloom_support.principals pr ON pr.id::text = split_part(t.dedupe_key, ':', 1)
   WHERE t.dedupe_key = pr.id::text || ':' || p_key AND pr.kind = 'external_user' AND pr.product IN ('cms','pos')
     AND t.created_at > now() - interval '3 days'
   ORDER BY t.created_at DESC LIMIT 1;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION bloom_support.find_ticket_by_client_key(uuid, text) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. OAuth refresh-token reuse detection. Rotated tokens keep their family; a
--    rotated token presented again revokes the family and the client's access.
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.oauth_refresh_tokens ADD COLUMN IF NOT EXISTS family_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE bloom_support.oauth_refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by text;
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_family ON bloom_support.oauth_refresh_tokens(family_id);

CREATE OR REPLACE FUNCTION bloom_support.oauth_issue_tokens(p_principal uuid, p_client text, p_scope text, p_access_hash text, p_access_prefix text, p_refresh_hash text, p_old_refresh_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_family uuid := gen_random_uuid();
BEGIN
  IF NOT bloom_support.is_staff(p_principal) THEN RAISE EXCEPTION 'forbidden: connection owner is no longer staff' USING ERRCODE = '42501'; END IF;
  IF p_old_refresh_hash IS NOT NULL THEN
    UPDATE bloom_support.oauth_refresh_tokens SET revoked_at = now(), replaced_by = p_refresh_hash
     WHERE token_hash = p_old_refresh_hash AND revoked_at IS NULL AND expires_at > now() AND principal_id = p_principal AND client_id = p_client
     RETURNING family_id INTO v_family;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid refresh token' USING ERRCODE = '28000'; END IF;
  END IF;
  INSERT INTO bloom_support.api_keys(principal_id, label, prefix, key_hash, scopes, created_by, expires_at)
  VALUES (p_principal, 'OAuth: ' || (SELECT client_name FROM bloom_support.oauth_clients WHERE client_id = p_client), p_access_prefix, p_access_hash,
          CASE WHEN p_scope = 'read' THEN ARRAY['read'] ELSE ARRAY['*'] END, p_principal, now() + interval '1 hour');
  INSERT INTO bloom_support.oauth_refresh_tokens(token_hash, client_id, principal_id, scope, family_id) VALUES (p_refresh_hash, p_client, p_principal, p_scope, v_family);
  RETURN jsonb_build_object('expires_in', 3600, 'scope', p_scope);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.oauth_refresh_lookup(p_refresh_hash text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r bloom_support.oauth_refresh_tokens;
BEGIN
  SELECT * INTO r FROM bloom_support.oauth_refresh_tokens WHERE token_hash = p_refresh_hash;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.revoked_at IS NULL AND r.expires_at > now() THEN RETURN to_jsonb(r); END IF;
  IF r.replaced_by IS NOT NULL THEN
    -- A token that was already rotated is being replayed: treat the family as compromised.
    UPDATE bloom_support.oauth_refresh_tokens SET revoked_at = coalesce(revoked_at, now()) WHERE family_id = r.family_id;
    UPDATE bloom_support.api_keys SET revoked_at = now()
     WHERE principal_id = r.principal_id AND revoked_at IS NULL
       AND label = 'OAuth: ' || (SELECT client_name FROM bloom_support.oauth_clients WHERE client_id = r.client_id);
    PERFORM bloom_support.log(NULL, NULL, r.principal_id, 'oauth.refresh_reuse_detected', jsonb_build_object('client_id', r.client_id));
  END IF;
  RETURN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- 7. Automated repair: a person starts it; a repair report key can only record
--    the outcome; an approval covers exactly one commit.
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.engineering_issues ADD COLUMN IF NOT EXISTS approved_head_sha text;
ALTER TABLE bloom_support.engineering_issues ADD COLUMN IF NOT EXISTS repair_started_by uuid REFERENCES bloom_support.principals(id);
ALTER TABLE bloom_support.engineering_issues ADD COLUMN IF NOT EXISTS repair_started_at timestamptz;
INSERT INTO bloom_support.role_permissions(role, permission) VALUES
  ('platform_admin','engineering.dispatch'),('platform_operator','engineering.dispatch')
ON CONFLICT DO NOTHING;
INSERT INTO bloom_support.grant_permissions(grant_name, permission) VALUES
  ('repair_report','engineering.report'),('repair_report','engineering.view')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION bloom_support.open_engineering_issue(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; e uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.start');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  IF p->>'existing_issue_id' IS NOT NULL THEN
    e := (p->>'existing_issue_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM bloom_support.engineering_issues WHERE id = e) THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  ELSIF t.engineering_issue_id IS NOT NULL THEN
    e := t.engineering_issue_id;
  ELSIF t.problem_id IS NOT NULL AND (SELECT engineering_issue_id FROM bloom_support.problems WHERE id = t.problem_id) IS NOT NULL THEN
    -- One investigation per underlying bug: join the shared problem's engineering issue.
    e := (SELECT engineering_issue_id FROM bloom_support.problems WHERE id = t.problem_id);
  ELSE
    INSERT INTO bloom_support.engineering_issues(title, product, repository, evidence, created_by)
    VALUES (coalesce(p->>'title', t.subject), t.product, p->>'repository', coalesce(p->'evidence','{}'::jsonb), p_actor) RETURNING id INTO e;
    IF bloom_support.has_permission(p_actor, 'engineering.dispatch') AND bloom_support.principal_role(p_actor) <> 'service' THEN
      -- A person opened it: that is the decision to start an automated repair.
      UPDATE bloom_support.engineering_issues SET repair_started_by = p_actor, repair_started_at = now() WHERE id = e;
      PERFORM bloom_support.enqueue_job('investigate', t.id, e, 'engineering:' || e::text, jsonb_build_object('step','investigate'), 'investigate:' || e::text, now(), 3, 900);
    ELSE
      -- Bloom or Support detected a bug. Ticket text is untrusted, so a coding agent runs only
      -- after Jon or Jeff reviews the evidence and starts the repair.
      INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, recommendation, dedupe_key)
      VALUES (t.id, e, 'both', 'engineering_start_requested', coalesce(p->>'title', t.subject),
              'Review the evidence. Start an automated repair only for a contained bug with clear intended behaviour; otherwise take it yourself.',
              'eng-start:' || e::text)
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    IF t.problem_id IS NULL THEN
      INSERT INTO bloom_support.problems(title, kind, product, engineering_issue_id, created_by) VALUES (t.subject, CASE WHEN t.kind = 'incident' THEN 'incident' ELSE 'problem' END, t.product, e, p_actor)
      RETURNING id INTO t.problem_id;
    ELSE
      UPDATE bloom_support.problems SET engineering_issue_id = e, updated_at = now() WHERE id = t.problem_id;
    END IF;
    UPDATE bloom_support.engineering_issues SET problem_id = t.problem_id WHERE id = e;
  END IF;
  UPDATE bloom_support.tickets SET engineering_issue_id = e, problem_id = coalesce(t.problem_id, (SELECT problem_id FROM bloom_support.engineering_issues WHERE id = e)),
    kind = CASE WHEN kind IN ('unknown','other','question') THEN 'bug' ELSE kind END,
    stage = CASE WHEN status = 'resolved' THEN stage ELSE 'investigating' END,
    status = CASE WHEN status = 'resolved' THEN status ELSE 'working' END, version = version + 1, updated_at = now()
  WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'engineering.linked', jsonb_build_object('engineering_issue_id', e));
  RETURN jsonb_build_object('engineering_issue_id', e);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.engineering_transition_permission(p_from text, p_to text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_to IN ('failed','escalated') AND p_from NOT IN ('verified','closed') THEN 'engineering.investigate|engineering.release|engineering.report'
    WHEN p_to IN ('reproduced','not_reproduced') AND p_from NOT IN ('verified','closed') THEN 'engineering.investigate|engineering.report'
    WHEN p_to IN ('investigating','fixing','in_review')
         AND p_from NOT IN ('verified','closed') THEN 'engineering.investigate'
    WHEN p_to = 'awaiting_approval' AND p_from IN ('in_review','failed','approved') THEN 'engineering.investigate|engineering.release'
    WHEN p_to = 'approved' AND p_from IN ('awaiting_approval','in_review','escalated') THEN 'engineering.approve'
    WHEN p_to IN ('merging','merged','deploying','deployed','verifying','verified','rolled_back') THEN 'engineering.release'
    WHEN p_to = 'closed' THEN 'engineering.approve'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION bloom_support.update_engineering_issue(p_actor uuid, p_issue uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; n bloom_support.engineering_issues; perm text; tk record; x jsonb := coalesce(p->'patch','{}'::jsonb);
  v_report_only boolean; v_start boolean := coalesce((p->>'start_repair')::boolean, false);
BEGIN
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p ? 'version' AND (p->>'version')::int <> e.version THEN RAISE EXCEPTION 'conflict: issue changed' USING ERRCODE = '40001'; END IF;
  -- A repair report key (repair_report scope) may only record the agent's outcome: it can
  -- move the issue to reproduced/not_reproduced/escalated/failed and write reproduction notes.
  -- PR, commit, deployment, verification and rollback facts come only from Bloom's own identities.
  v_report_only := NOT bloom_support.has_permission(p_actor, 'engineering.investigate')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.release')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.approve')
    AND bloom_support.has_permission(p_actor, 'engineering.report');
  IF v_report_only THEN
    IF v_start OR NOT (p ? 'status') OR p->>'status' NOT IN ('reproduced','not_reproduced','escalated','failed')
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(x) k WHERE k <> 'reproduction') THEN
      RAISE EXCEPTION 'forbidden: a repair report may only record the outcome and reproduction' USING ERRCODE = '42501';
    END IF;
    -- A late report never moves an issue that Bloom has already taken further (PR in review,
    -- approval, release); it only adds its notes.
    IF e.status NOT IN ('investigating','fixing','reproduced') THEN
      p := p - 'status';
    END IF;
  END IF;
  -- Starting an automated repair runs a coding agent against the repository. Only a person
  -- with engineering.dispatch may start one; Bloom's own identities and Support cannot.
  IF v_start THEN
    IF NOT bloom_support.has_permission(p_actor, 'engineering.dispatch') OR bloom_support.principal_role(p_actor) = 'service' THEN
      RAISE EXCEPTION 'forbidden: only Jon or Jeff can start an automated repair' USING ERRCODE = '42501';
    END IF;
    IF e.status NOT IN ('open','failed','not_reproduced','escalated') THEN
      RAISE EXCEPTION 'invalid: a repair can start only from open, failed, not_reproduced or escalated (now %)', e.status USING ERRCODE = '22023';
    END IF;
    IF p ? 'status' OR x <> '{}'::jsonb THEN
      RAISE EXCEPTION 'invalid: start_repair cannot be combined with other changes' USING ERRCODE = '22023';
    END IF;
    -- An escalated issue goes back to open so the investigation step picks it up.
    UPDATE bloom_support.engineering_issues SET repair_started_by = p_actor, repair_started_at = now(), version = version + 1, updated_at = now(),
      status = CASE WHEN status = 'escalated' THEN 'open' ELSE status END
    WHERE id = p_issue RETURNING * INTO n;
    PERFORM bloom_support.enqueue_job('investigate', (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue, 'engineering:' || p_issue::text, jsonb_build_object('step','investigate'), 'investigate:' || p_issue::text || ':' || n.version, now(), 3, 900);
    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'engineering.repair_started', jsonb_build_object('engineering_issue_id', p_issue));
    END LOOP;
    UPDATE bloom_support.escalations SET status = 'resolved', resolved_at = now(), decided_by = p_actor
    WHERE engineering_issue_id = p_issue AND reason = 'engineering_start_requested' AND status <> 'resolved';
    RETURN to_jsonb(n);
  END IF;
  IF p ? 'status' AND p->>'status' <> e.status THEN
    perm := bloom_support.engineering_transition_permission(e.status, p->>'status');
    IF perm IS NULL THEN RAISE EXCEPTION 'invalid transition % -> %', e.status, p->>'status' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(string_to_array(perm, '|')) AS needed(name) WHERE bloom_support.has_permission(p_actor, needed.name)) THEN
      RAISE EXCEPTION 'forbidden: % required', perm USING ERRCODE = '42501';
    END IF;
    -- Merge requires a recorded approval or a policy-eligible evaluation produced by the release identity.
    IF p->>'status' = 'merging' AND e.status <> 'approved' AND NOT coalesce((coalesce(x->'eligibility', e.eligibility)->>'eligible')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: not eligible for automatic release and not approved' USING ERRCODE = '42501';
    END IF;
    -- An approval covers exactly the commit that was reviewed.
    IF p->>'status' = 'merging' AND e.status = 'approved'
       AND (e.approved_head_sha IS NULL OR coalesce(x->>'head_sha', e.head_sha) IS DISTINCT FROM e.approved_head_sha) THEN
      RAISE EXCEPTION 'blocked: the pull request changed after approval' USING ERRCODE = '42501';
    END IF;
    IF p->>'status' = 'approved' AND (coalesce(x->>'head_sha', e.head_sha) IS NULL OR e.pr_number IS NULL) THEN
      RAISE EXCEPTION 'invalid: approve a fix only once its pull request and head commit are recorded' USING ERRCODE = '22023';
    END IF;
    IF p->>'status' = 'verified' AND coalesce((coalesce(x->'verification', e.verification)->>'passed')::boolean, false) = false THEN
      RAISE EXCEPTION 'blocked: verification evidence required' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT (v_report_only OR bloom_support.has_permission(p_actor, 'engineering.investigate') OR bloom_support.has_permission(p_actor, 'engineering.release')
            OR bloom_support.has_permission(p_actor, 'engineering.approve')) THEN
      RAISE EXCEPTION 'forbidden: engineering update' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- The repair (investigation) identity may not write eligibility: only the release identity evaluates policy.
  IF x ? 'eligibility' AND NOT bloom_support.has_permission(p_actor, 'engineering.release') AND NOT bloom_support.has_permission(p_actor, 'engineering.approve') THEN
    RAISE EXCEPTION 'forbidden: eligibility is evaluated by the release identity' USING ERRCODE = '42501';
  END IF;

  UPDATE bloom_support.engineering_issues SET
    status = coalesce(p->>'status', status), repository = coalesce(x->>'repository', repository),
    reproduction = coalesce(x->'reproduction', reproduction), risk = coalesce(x->'risk', risk), eligibility = coalesce(x->'eligibility', eligibility),
    branch = coalesce(x->>'branch', branch), pr_number = coalesce((x->>'pr_number')::int, pr_number), pr_url = coalesce(x->>'pr_url', pr_url),
    head_sha = coalesce(x->>'head_sha', head_sha), merge_sha = coalesce(x->>'merge_sha', merge_sha), deployment = coalesce(x->'deployment', deployment),
    verification = coalesce(x->'verification', verification), rollback = coalesce(x->'rollback', rollback),
    evidence = CASE WHEN x ? 'evidence' THEN evidence || (x->'evidence') ELSE evidence END,
    approved_by = CASE WHEN p->>'status' = 'approved' THEN p_actor ELSE approved_by END,
    approved_at = CASE WHEN p->>'status' = 'approved' THEN now() ELSE approved_at END,
    approved_head_sha = CASE WHEN p->>'status' = 'approved' THEN coalesce(x->>'head_sha', head_sha)
                             WHEN p->>'status' = 'awaiting_approval' THEN NULL ELSE approved_head_sha END,
    attempts = attempts + CASE WHEN p->>'status' = 'fixing' THEN 1 ELSE 0 END,
    version = version + 1, updated_at = now()
  WHERE id = p_issue RETURNING * INTO n;

  FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue LOOP
    PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'engineering.' || n.status, jsonb_strip_nulls(jsonb_build_object('from', e.status, 'note', p->>'note', 'pr_url', n.pr_url)));
    UPDATE bloom_support.tickets SET updated_at = now(),
      stage = CASE WHEN status = 'resolved' THEN stage
                   WHEN n.status IN ('fixing','in_review') THEN 'fixing'
                   WHEN n.status IN ('approved','merging','merged','deploying','deployed') THEN 'releasing'
                   WHEN n.status IN ('verifying','verified') THEN 'verifying'
                   WHEN n.status IN ('awaiting_approval','escalated','failed','rolled_back') THEN 'escalated'
                   ELSE stage END,
      status = CASE WHEN status = 'resolved' THEN status
                    WHEN n.status IN ('awaiting_approval','escalated','failed','rolled_back') THEN 'needs_owner' ELSE 'working' END
    WHERE id = tk.id;
    IF n.status = 'verified' AND e.status <> 'verified' THEN
      PERFORM bloom_support.enqueue_job('verify_resolution', tk.id, p_issue, 'account:' || coalesce(tk.account_id::text, 'none:' || tk.id::text),
        jsonb_build_object('engineering_issue_id', p_issue), 'verify_resolution:' || tk.id::text || ':' || p_issue::text);
    END IF;
  END LOOP;
  -- A person's approval resumes the release pipeline: the evaluate step re-checks CI and threads, then merges.
  IF n.status = 'approved' AND e.status <> 'approved' THEN
    PERFORM bloom_support.enqueue_job('engineering_step', (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue, 'engineering:' || p_issue::text, jsonb_build_object('step','evaluate','reason','approved'),
      'eng:' || p_issue::text || ':evaluate:approved:' || n.version, now(), 3, 300);
  END IF;
  IF n.status IN ('awaiting_approval','escalated','failed','rolled_back') AND n.status <> e.status THEN
    INSERT INTO bloom_support.escalations(engineering_issue_id, ticket_id, audience, reason, detail, dedupe_key)
    VALUES (p_issue, (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
            CASE WHEN n.status = 'awaiting_approval' THEN 'jon' ELSE 'both' END,
            'engineering_' || n.status, p->>'note', 'eng:' || p_issue::text || ':' || n.status || ':' || n.version)
    ON CONFLICT (dedupe_key) DO NOTHING;
    PERFORM bloom_support.notify_staff(NULL, 'engineering.' || n.status, 'Fix ' || n.status || ': ' || left(n.title, 80), CASE WHEN n.status = 'awaiting_approval' THEN 'jon' ELSE 'both' END);
  END IF;
  RETURN to_jsonb(n);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.create_service_principal(p_actor uuid, p_name text, p_grants text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.roles');
  IF EXISTS (SELECT 1 FROM unnest(p_grants) g WHERE g NOT IN ('intake','operations','automation','investigation','release','repair_report')) THEN
    RAISE EXCEPTION 'invalid service scope' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_grants) <> 1 THEN RAISE EXCEPTION 'invalid: one scope per service identity' USING ERRCODE = '22023'; END IF;
  INSERT INTO bloom_support.principals(kind, product, external_id, display_name, role, grants)
  VALUES ('service', NULL, NULL, p_name, 'service', p_grants) RETURNING id INTO v;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'service.created', jsonb_build_object('principal_id', v, 'grants', p_grants));
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Gateway: unchanged except the new find_ticket_by_client_key route.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloom_support_rpc(p_fn text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid := nullif(p->>'actor','')::uuid; r jsonb;
BEGIN
  -- Attribution for event-history triggers.
  PERFORM set_config('bloom.actor', coalesce(a::text, ''), true);
  CASE p_fn
    WHEN 'resolve_crm_user' THEN r := to_jsonb(bloom_support.resolve_crm_user((p->>'auth_user_id')::uuid, p->>'email', p->>'name', (p->>'tenant_id')::uuid, p->>'tenant_name'));
    WHEN 'resolve_product_user' THEN r := bloom_support.resolve_product_user(p->>'product', p->>'external_user_id', p->>'email', p->>'name', p->>'external_account_id', p->>'account_name');
    WHEN 'resolve_email_sender' THEN r := bloom_support.resolve_email_sender(p->>'email', p->>'name');
    WHEN 'authenticate_api_key' THEN r := bloom_support.authenticate_api_key(p->>'hash');
    WHEN 'whoami' THEN r := bloom_support.whoami(a);
    WHEN 'has_permission' THEN r := to_jsonb(bloom_support.has_permission(a, p->>'permission'));
    WHEN 'create_ticket' THEN r := bloom_support.create_ticket(a, p->'ticket');
    WHEN 'get_ticket' THEN r := bloom_support.get_ticket(a, (p->>'ticket_id')::uuid);
    WHEN 'list_tickets' THEN r := bloom_support.list_tickets(a, coalesce(p->'filters','{}'::jsonb));
    WHEN 'queue_summary' THEN r := bloom_support.queue_summary(a);
    WHEN 'list_accounts' THEN r := bloom_support.list_accounts(a, p->>'q', coalesce((p->>'limit')::int, 50));
    WHEN 'get_account' THEN r := bloom_support.get_account(a, (p->>'account_id')::uuid);
    WHEN 'update_account' THEN r := bloom_support.update_account(a, (p->>'account_id')::uuid, p->'patch');
    WHEN 'add_message' THEN r := bloom_support.add_message(a, (p->>'ticket_id')::uuid, p->'message');
    WHEN 'update_ticket' THEN r := bloom_support.update_ticket(a, (p->>'ticket_id')::uuid, p->'patch');
    WHEN 'set_automation' THEN r := bloom_support.set_automation(a, (p->>'ticket_id')::uuid, p->>'mode', p->>'reason');
    WHEN 'link_tickets' THEN PERFORM bloom_support.link_tickets(a, (p->>'from')::uuid, (p->>'to')::uuid, p->>'kind'); r := '{"ok":true}';
    WHEN 'related_tickets' THEN r := bloom_support.related_tickets(a, (p->>'ticket_id')::uuid);
    WHEN 'open_engineering_issue' THEN r := bloom_support.open_engineering_issue(a, (p->>'ticket_id')::uuid, coalesce(p->'issue','{}'::jsonb));
    WHEN 'update_engineering_issue' THEN r := bloom_support.update_engineering_issue(a, (p->>'issue_id')::uuid, p->'update');
    WHEN 'list_engineering' THEN r := bloom_support.list_engineering(a, p->>'status');
    WHEN 'route_feature_request' THEN r := bloom_support.route_feature_request(a, (p->>'ticket_id')::uuid, coalesce(p->'feature','{}'::jsonb));
    WHEN 'decide_feature_request' THEN r := bloom_support.decide_feature_request(a, (p->>'feature_request_id')::uuid, p->>'decision', p->>'note');
    WHEN 'list_features' THEN r := bloom_support.list_features(a, p->>'status');
    WHEN 'escalate' THEN r := bloom_support.escalate(a, (p->>'ticket_id')::uuid, p->>'audience', p->>'reason', p->>'detail', p->>'dedupe_key');
    WHEN 'resolve_escalation' THEN r := bloom_support.resolve_escalation(a, (p->>'escalation_id')::uuid, p->>'decision');
    WHEN 'list_escalations' THEN r := bloom_support.list_escalations(a, coalesce((p->>'open_only')::boolean, true));
    WHEN 'record_operation_preview' THEN r := bloom_support.record_operation_preview(a, p->'operation');
    WHEN 'claim_operation' THEN r := bloom_support.claim_operation(a, (p->>'operation_id')::uuid);
    WHEN 'finish_operation' THEN r := bloom_support.finish_operation(a, (p->>'operation_id')::uuid, p->'outcome');
    WHEN 'get_operation' THEN r := bloom_support.get_operation(a, (p->>'operation_id')::uuid);
    WHEN 'claim_jobs' THEN r := (SELECT coalesce(jsonb_agg(to_jsonb(j)), '[]') FROM bloom_support.claim_jobs(p->>'worker', coalesce((p->>'limit')::int, 5)) j);
    WHEN 'complete_job' THEN PERFORM bloom_support.complete_job((p->>'job_id')::uuid, p->>'worker', p->'result'); r := '{"ok":true}';
    WHEN 'fail_job' THEN r := to_jsonb(bloom_support.fail_job((p->>'job_id')::uuid, p->>'worker', p->>'error', coalesce((p->>'permanent')::boolean, false), (p->>'retry_in')::int));
    WHEN 'enqueue_job' THEN
      -- Only automation/staff principals may enqueue directly.
      IF NOT (bloom_support.has_permission(a, 'tickets.write') OR bloom_support.has_permission(a, 'engineering.investigate') OR bloom_support.has_permission(a, 'engineering.release')) THEN
        RAISE EXCEPTION 'forbidden: enqueue' USING ERRCODE = '42501';
      END IF;
      r := to_jsonb(bloom_support.enqueue_job(p->>'kind', (p->>'ticket_id')::uuid, (p->>'engineering_issue_id')::uuid, p->>'lane', coalesce(p->'payload','{}'::jsonb),
        p->>'idempotency_key', coalesce((p->>'run_after')::timestamptz, now()), coalesce((p->>'max_attempts')::int, 5), coalesce((p->>'timeout')::int, 120)));
    WHEN 'control_job' THEN r := bloom_support.control_job(a, (p->>'job_id')::uuid, p->>'action');
    WHEN 'list_jobs' THEN r := bloom_support.list_jobs(a, p->>'status');
    WHEN 'set_setting' THEN r := bloom_support.set_setting(a, p->>'key', p->'value');
    WHEN 'get_settings' THEN r := bloom_support.get_settings(a);
    WHEN 'setting' THEN r := bloom_support.setting(p->>'key');
    WHEN 'set_principal_role' THEN r := bloom_support.set_principal_role(a, p->'principal');
    WHEN 'list_staff' THEN r := bloom_support.list_staff(a);
    WHEN 'create_service_principal' THEN r := to_jsonb(bloom_support.create_service_principal(a, p->>'name', ARRAY(SELECT jsonb_array_elements_text(p->'grants'))));
    WHEN 'create_api_key' THEN r := to_jsonb(bloom_support.create_api_key(a, (p->>'principal_id')::uuid, p->>'label', p->>'prefix', p->>'hash',
        ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'scopes','[]'::jsonb))), (p->>'expires_at')::timestamptz));
    WHEN 'revoke_api_key' THEN PERFORM bloom_support.revoke_api_key(a, (p->>'key_id')::uuid); r := '{"ok":true}';
    WHEN 'list_api_keys' THEN r := bloom_support.list_api_keys(a);
    WHEN 'list_notifications' THEN r := bloom_support.list_notifications(a, coalesce((p->>'mark_read')::boolean, false));
    WHEN 'issue_tracking_token' THEN PERFORM bloom_support.issue_tracking_token((p->>'ticket_id')::uuid, p->>'hash'); r := '{"ok":true}';
    WHEN 'ticket_by_tracking_token' THEN r := bloom_support.ticket_by_tracking_token(p->>'hash');
    WHEN 'record_email_event' THEN r := to_jsonb(bloom_support.record_email_event(p->>'provider', p->>'event_id', p->>'message_id', p->>'outcome', (p->>'ticket_id')::uuid));
    WHEN 'finish_email_event' THEN PERFORM bloom_support.finish_email_event(p->>'provider', p->>'event_id', p->>'outcome', (p->>'ticket_id')::uuid); r := '{"ok":true}';
    WHEN 'match_email_thread' THEN r := to_jsonb(bloom_support.match_email_thread(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'refs','[]'::jsonb))), (p->>'number')::bigint));
    WHEN 'append_inbound_email' THEN r := bloom_support.append_inbound_email(a, (p->>'ticket_id')::uuid, p->>'body', p->>'message_id', p->>'in_reply_to');
    WHEN 'queue_outbound_email' THEN r := bloom_support.queue_outbound_email(p->'email');
    WHEN 'mark_outbound_email' THEN PERFORM bloom_support.mark_outbound_email((p->>'id')::uuid, p->>'status', p->>'provider_id', p->>'error'); r := '{"ok":true}';
    WHEN 'search_knowledge' THEN r := bloom_support.search_knowledge(p->>'product', p->>'q', coalesce((p->>'limit')::int, 5));
    WHEN 'upsert_knowledge' THEN r := bloom_support.upsert_knowledge(a, p->'article');
    WHEN 'list_knowledge' THEN r := bloom_support.list_knowledge(a);
    WHEN 'consume_usage' THEN r := to_jsonb(bloom_support.consume_usage(p->>'bucket', p->>'subject', (p->>'limit')::int));
    WHEN 'can_attach' THEN
      r := to_jsonb(bloom_support.has_permission(a, 'intake.attach') OR bloom_support.can_read_ticket(a, (p->>'ticket_id')::uuid));
    WHEN 'add_attachment' THEN
      IF NOT bloom_support.has_permission(a, 'intake.attach') THEN PERFORM bloom_support.require_ticket(a, (p->>'ticket_id')::uuid); END IF;
      INSERT INTO bloom_support.attachments(ticket_id, message_id, account_id, storage_path, file_name, content_type, size_bytes, sha256, visibility)
      SELECT t.id, (p->>'message_id')::uuid, t.account_id, p->>'storage_path', p->>'file_name', p->>'content_type', (p->>'size_bytes')::bigint, p->>'sha256',
             CASE WHEN bloom_support.is_staff(a) THEN coalesce(p->>'visibility','public') ELSE 'public' END
      FROM bloom_support.tickets t WHERE t.id = (p->>'ticket_id')::uuid
      ON CONFLICT (storage_path) DO NOTHING
      RETURNING to_jsonb(bloom_support.attachments.*) INTO r;
    WHEN 'get_attachment' THEN
      SELECT to_jsonb(x) INTO r FROM bloom_support.attachments x WHERE x.id = (p->>'attachment_id')::uuid;
      IF r IS NULL THEN RAISE EXCEPTION 'not_found: attachment' USING ERRCODE = 'P0002'; END IF;
      PERFORM bloom_support.require_ticket(a, (r->>'ticket_id')::uuid);
      IF r->>'visibility' = 'internal' AND NOT bloom_support.has_permission(a, 'tickets.internal') THEN RAISE EXCEPTION 'forbidden: attachment' USING ERRCODE = '42501'; END IF;
    WHEN 'log' THEN
      PERFORM bloom_support.require_permission(a, 'tickets.internal');
      PERFORM bloom_support.log((p->>'ticket_id')::uuid, (p->>'account_id')::uuid, a, p->>'action', coalesce(p->'detail','{}'::jsonb)); r := '{"ok":true}';
    WHEN 'log_usage' THEN
      -- Model usage record (server code only; the gateway is service_role-only).
      PERFORM bloom_support.log(NULL, NULL, NULL, 'ai.call', coalesce(p->'detail','{}'::jsonb)); r := '{"ok":true}';
    WHEN 'job_context' THEN
      -- Worker-only bundle: the ticket (full), related candidates, and account links.
      PERFORM bloom_support.require_permission(a, 'tickets.read_all');
      r := jsonb_build_object('ticket', bloom_support.get_ticket(a, (p->>'ticket_id')::uuid),
             'related', bloom_support.related_tickets(a, (p->>'ticket_id')::uuid),
             'links', (SELECT coalesce(jsonb_agg(jsonb_build_object('product', l.product, 'external_id', l.external_id)), '[]')
                       FROM bloom_support.account_links l JOIN bloom_support.tickets t ON t.account_id = l.account_id WHERE t.id = (p->>'ticket_id')::uuid),
             'cc', (SELECT to_jsonb(c.cc_emails) FROM bloom_support.tickets t JOIN bloom_support.conversations c ON c.id = t.conversation_id WHERE t.id = (p->>'ticket_id')::uuid),
             'requester_email', (SELECT coalesce(c.reply_to_email, pr.email) FROM bloom_support.tickets t JOIN bloom_support.conversations c ON c.id = t.conversation_id
                       LEFT JOIN bloom_support.principals pr ON pr.id = t.requester_id WHERE t.id = (p->>'ticket_id')::uuid),
             'thread', (SELECT jsonb_build_object('root', c.email_thread_root,
                         'last_inbound', (SELECT m.email_message_id FROM bloom_support.messages m WHERE m.conversation_id = c.id AND m.email_message_id IS NOT NULL ORDER BY m.created_at DESC LIMIT 1),
                         'last_outbound', (SELECT o.rfc_message_id FROM bloom_support.outbound_emails o JOIN bloom_support.tickets t2 ON t2.id = o.ticket_id
                                           WHERE t2.conversation_id = c.id AND o.status = 'sent' ORDER BY o.created_at DESC LIMIT 1))
                       FROM bloom_support.tickets t JOIN bloom_support.conversations c ON c.id = t.conversation_id WHERE t.id = (p->>'ticket_id')::uuid));
    WHEN 'ensure_service_principal' THEN r := to_jsonb(bloom_support.ensure_service_principal(p->>'scope'));
    WHEN 'verify_worker_token' THEN r := to_jsonb(bloom_support.verify_worker_token(p->>'token'));
    WHEN 'worker_run_start' THEN r := to_jsonb(bloom_support.worker_run_start(p->>'worker'));
    WHEN 'worker_run_finish' THEN PERFORM bloom_support.worker_run_finish((p->>'run_id')::bigint, (p->>'processed')::int, (p->>'failed')::int, p->>'note'); r := '{"ok":true}';
    WHEN 'sweep_deadlines' THEN r := bloom_support.sweep_deadlines();
    WHEN 'acknowledge_escalation' THEN r := bloom_support.acknowledge_escalation(a, (p->>'escalation_id')::uuid, p->>'note');
    WHEN 'repair_capacity' THEN r := bloom_support.repair_capacity((p->>'issue_id')::uuid);
    WHEN 'readiness_facts' THEN r := bloom_support.readiness_facts(a);
    WHEN 'oauth_register_client' THEN r := to_jsonb(bloom_support.oauth_register_client(p->>'client_name', ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'redirect_uris','[]'::jsonb)))));
    WHEN 'oauth_client' THEN r := bloom_support.oauth_client(p->>'client_id');
    WHEN 'oauth_issue_code' THEN PERFORM bloom_support.oauth_issue_code(a, p->>'client_id', p->>'redirect_uri', p->>'code_challenge', p->>'scope', p->>'code_hash'); r := '{"ok":true}';
    WHEN 'oauth_consume_code' THEN r := bloom_support.oauth_consume_code(p->>'code_hash', p->>'client_id', p->>'redirect_uri');
    WHEN 'oauth_issue_tokens' THEN r := bloom_support.oauth_issue_tokens((p->>'principal_id')::uuid, p->>'client_id', p->>'scope', p->>'access_hash', p->>'access_prefix', p->>'refresh_hash', p->>'old_refresh_hash');
    WHEN 'oauth_refresh_lookup' THEN r := bloom_support.oauth_refresh_lookup(p->>'refresh_hash');
    WHEN 'sweep_operational' THEN r := bloom_support.sweep_operational();
    WHEN 'is_staff_email' THEN
      r := to_jsonb(EXISTS (SELECT 1 FROM bloom_support.principals pr WHERE pr.kind = 'user' AND pr.active AND pr.role IN ('platform_admin','platform_operator','support') AND lower(pr.email) = lower(p->>'email')));
    WHEN 'merge_tickets' THEN r := bloom_support.merge_tickets(a, (p->>'source_id')::uuid, (p->>'target_id')::uuid, p->>'reason');
    WHEN 'set_spam' THEN r := bloom_support.set_spam(a, (p->>'ticket_id')::uuid, coalesce((p->>'spam')::boolean, true));
    WHEN 'bulk_update' THEN r := bloom_support.bulk_update(a, ARRAY(SELECT (jsonb_array_elements_text(coalesce(p->'ticket_ids','[]'::jsonb)))::uuid), p->'bulk');
    WHEN 'client_action' THEN r := bloom_support.client_action(a, (p->>'ticket_id')::uuid, p->>'action', p->>'message');
    WHEN 'resolve_post_reply' THEN r := bloom_support.resolve_post_reply(a, (p->>'ticket_id')::uuid, p->>'decision', (p->>'message_id')::uuid, p->>'note');
    WHEN 'create_problem' THEN r := bloom_support.create_problem(a, coalesce(p->'problem','{}'::jsonb));
    WHEN 'link_problem' THEN r := bloom_support.link_problem(a, (p->>'ticket_id')::uuid, (p->>'problem_id')::uuid);
    WHEN 'list_problems' THEN r := bloom_support.list_problems(a, p->>'status');
    WHEN 'update_problem' THEN r := bloom_support.update_problem(a, (p->>'problem_id')::uuid, coalesce(p->'patch','{}'::jsonb));
    WHEN 'save_view' THEN r := bloom_support.save_view(a, p->>'name', p->'filters', coalesce((p->>'shared')::boolean, false));
    WHEN 'list_views' THEN r := bloom_support.list_views(a);
    WHEN 'delete_view' THEN PERFORM bloom_support.delete_view(a, (p->>'view_id')::uuid); r := '{"ok":true}';
    WHEN 'summary_report' THEN
      IF a IS NOT NULL THEN PERFORM bloom_support.require_permission(a, 'tickets.read_all'); END IF;
      r := bloom_support.summary_report(coalesce(p->>'period', 'daily'));
    WHEN 'report_metrics' THEN r := bloom_support.report_metrics(a, (p->>'from')::timestamptz, (p->>'to')::timestamptz);
    WHEN 'record_delivery_event' THEN r := bloom_support.record_delivery_event(p->>'provider_id', p->>'type', coalesce(p->'detail','{}'::jsonb));
    WHEN 'redact_ticket' THEN r := bloom_support.redact_ticket(a, (p->>'ticket_id')::uuid, p->>'reason');
    WHEN 'ticket_timers' THEN PERFORM bloom_support.require_ticket(a, (p->>'ticket_id')::uuid); r := bloom_support.ticket_timers((p->>'ticket_id')::uuid);
    WHEN 'set_account_automation' THEN r := bloom_support.set_account_automation(a, (p->>'account_id')::uuid, coalesce((p->>'paused')::boolean, true));
    WHEN 'conversation_cc' THEN
      -- Record CC'd addresses that are verified contacts of the ticket's account (server code only).
      UPDATE bloom_support.conversations c SET cc_emails = ARRAY(SELECT DISTINCT x FROM unnest(c.cc_emails || ARRAY(
          SELECT lower(e) FROM jsonb_array_elements_text(coalesce(p->'emails','[]'::jsonb)) e
          WHERE EXISTS (SELECT 1 FROM bloom_support.account_members m JOIN bloom_support.principals pr ON pr.id = m.principal_id
                        WHERE m.account_id = c.account_id AND m.verified AND lower(pr.email) = lower(e)))) x)
      WHERE c.id = (SELECT conversation_id FROM bloom_support.tickets WHERE id = (p->>'ticket_id')::uuid)
      RETURNING to_jsonb(c.cc_emails) INTO r;
    WHEN 'find_ticket_by_client_key' THEN r := to_jsonb(bloom_support.find_ticket_by_client_key(a, p->>'key'));
    ELSE RAISE EXCEPTION 'unknown bloom_support function %', p_fn USING ERRCODE = '42883';
  END CASE;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_rpc(text, jsonb) TO service_role;

