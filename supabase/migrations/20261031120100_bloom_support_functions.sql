-- Bloom Support — authorization-checked entry points.
-- Every function takes the authenticated principal resolved by an Edge
-- Function and re-checks its authority here. EXECUTE is service_role only.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.log(p_ticket uuid, p_account uuid, p_actor uuid, p_action text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO bloom_support.activity(ticket_id, account_id, actor_id, action, detail)
  VALUES (p_ticket, p_account, p_actor, p_action, coalesce(p_detail, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION bloom_support.setting(p_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT value FROM bloom_support.settings WHERE key = p_key
$$;

-- Counts one unit against a bucket; false when the limit is already reached.
CREATE OR REPLACE FUNCTION bloom_support.consume_usage(p_bucket text, p_subject text, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v integer;
BEGIN
  INSERT INTO bloom_support.usage_counters(bucket, subject, count) VALUES (p_bucket, p_subject, 1)
  ON CONFLICT (bucket, subject) DO UPDATE SET count = bloom_support.usage_counters.count + 1
  RETURNING count INTO v;
  IF v > p_limit THEN
    UPDATE bloom_support.usage_counters SET count = count - 1 WHERE bucket = p_bucket AND subject = p_subject;
    RETURN false;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.principal_role(p_principal uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM bloom_support.principals WHERE id = p_principal AND active
$$;

CREATE OR REPLACE FUNCTION bloom_support.is_staff(p_principal uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(bloom_support.principal_role(p_principal) IN ('platform_admin','platform_operator','support'), false)
$$;

-- Ticket visibility: staff/automation with tickets.read_all, or a client who
-- is a verified member of the ticket's account, or the requester themself.
CREATE OR REPLACE FUNCTION bloom_support.can_read_ticket(p_principal uuid, p_ticket uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT bloom_support.has_permission(p_principal, 'tickets.read_all')
      OR EXISTS (
        SELECT 1 FROM bloom_support.tickets t
        WHERE t.id = p_ticket AND bloom_support.has_permission(p_principal, 'tickets.read_own')
          AND (t.requester_id = p_principal
               OR (t.account_id IS NOT NULL AND EXISTS (
                     SELECT 1 FROM bloom_support.account_members m
                     WHERE m.account_id = t.account_id AND m.principal_id = p_principal AND m.verified)))
      )
$$;

CREATE OR REPLACE FUNCTION bloom_support.require_ticket(p_principal uuid, p_ticket uuid)
RETURNS bloom_support.tickets LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: ticket' USING ERRCODE = 'P0002'; END IF;
  -- Ownership failures are 403, not 404.
  IF NOT bloom_support.can_read_ticket(p_principal, p_ticket) THEN
    RAISE EXCEPTION 'forbidden: ticket' USING ERRCODE = '42501';
  END IF;
  RETURN t;
END $$;

-- Client-facing status derived from the internal stage.
CREATE OR REPLACE FUNCTION bloom_support.status_for_stage(p_stage text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_stage IN ('intake','triage') THEN 'new'
    WHEN p_stage IN ('needs_info','awaiting_client') THEN 'waiting'
    WHEN p_stage IN ('awaiting_decision','escalated') THEN 'needs_owner'
    WHEN p_stage IN ('resolved','closed') THEN 'resolved'
    ELSE 'working' END
$$;

CREATE OR REPLACE FUNCTION bloom_support.enqueue_job(
  p_kind text, p_ticket uuid, p_engineering uuid, p_lane text, p_payload jsonb,
  p_idempotency text DEFAULT NULL, p_run_after timestamptz DEFAULT now(), p_max_attempts integer DEFAULT 5, p_timeout integer DEFAULT 120)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO bloom_support.jobs(kind, ticket_id, engineering_issue_id, lane, payload, idempotency_key, run_after, max_attempts, timeout_seconds)
  VALUES (p_kind, p_ticket, p_engineering, p_lane, coalesce(p_payload,'{}'::jsonb), p_idempotency, p_run_after, p_max_attempts, p_timeout)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v;
  IF v IS NULL THEN SELECT id INTO v FROM bloom_support.jobs WHERE idempotency_key = p_idempotency; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.notify_staff(p_ticket uuid, p_kind text, p_title text, p_audience text DEFAULT 'both')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owners jsonb := coalesce(bloom_support.setting('owners'), '{}'::jsonb); emails text[];
BEGIN
  emails := ARRAY(
    SELECT lower(e) FROM jsonb_array_elements_text(
      CASE p_audience WHEN 'jon' THEN coalesce(owners->'jon','[]') WHEN 'jeff' THEN coalesce(owners->'jeff','[]')
      ELSE coalesce(owners->'jon','[]') || coalesce(owners->'jeff','[]') END) e);
  INSERT INTO bloom_support.notifications(principal_id, ticket_id, kind, title)
  SELECT p.id, p_ticket, p_kind, p_title FROM bloom_support.principals p
  WHERE p.active AND (
    lower(p.email) = ANY(emails)
    OR (cardinality(emails) = 0 AND p.role = 'platform_admin')
    OR (p_audience IN ('jeff','both') AND cardinality(emails) = 0 AND p.role = 'platform_operator'));
END $$;

-- ---------------------------------------------------------------------------
-- Identity and accounts
-- ---------------------------------------------------------------------------
-- CRM users: role from the CRM admin allowlist or an explicit Bloom role.
-- Clients are linked to their CRM tenant's account.
CREATE OR REPLACE FUNCTION bloom_support.resolve_crm_user(p_auth_user uuid, p_email text, p_name text, p_tenant uuid, p_tenant_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; acct uuid;
BEGIN
  IF p_auth_user IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000'; END IF;
  SELECT id INTO pid FROM bloom_support.principals WHERE auth_user_id = p_auth_user;
  IF pid IS NULL THEN
    INSERT INTO bloom_support.principals(kind, auth_user_id, product, email, display_name, role)
    VALUES ('user', p_auth_user, 'crm', lower(p_email), p_name, 'client')
    RETURNING id INTO pid;
  ELSE
    UPDATE bloom_support.principals SET email = coalesce(lower(p_email), email), display_name = coalesce(p_name, display_name), updated_at = now()
    WHERE id = pid;
  END IF;
  IF p_tenant IS NOT NULL THEN
    SELECT id INTO acct FROM bloom_support.accounts WHERE crm_tenant_id = p_tenant;
    IF acct IS NULL THEN
      INSERT INTO bloom_support.accounts(name, crm_tenant_id) VALUES (coalesce(nullif(btrim(p_tenant_name),''), 'CRM tenant ' || left(p_tenant::text, 8)), p_tenant)
      ON CONFLICT (crm_tenant_id) DO NOTHING RETURNING id INTO acct;
      IF acct IS NULL THEN SELECT id INTO acct FROM bloom_support.accounts WHERE crm_tenant_id = p_tenant; END IF;
      INSERT INTO bloom_support.account_links(account_id, product, external_id, label) VALUES (acct, 'crm', p_tenant::text, p_tenant_name)
      ON CONFLICT DO NOTHING;
    END IF;
    -- The CRM verified the tenant membership server-side before calling.
    INSERT INTO bloom_support.account_members(account_id, principal_id, relationship, verified) VALUES (acct, pid, 'member', true)
    ON CONFLICT (account_id, principal_id) DO UPDATE SET verified = true;
  END IF;
  RETURN pid;
END $$;

-- Product-authenticated users (BloomSites, POS). The product server has
-- already authenticated the person and derived their site/tenant.
CREATE OR REPLACE FUNCTION bloom_support.resolve_product_user(
  p_product text, p_external_user text, p_email text, p_name text, p_external_account text, p_account_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; acct uuid;
BEGIN
  IF p_product NOT IN ('cms','pos') OR coalesce(p_external_user,'') = '' THEN RAISE EXCEPTION 'invalid product identity' USING ERRCODE = '22023'; END IF;
  INSERT INTO bloom_support.principals(kind, product, external_id, email, display_name, role)
  VALUES ('external_user', p_product, p_external_user, lower(p_email), p_name, 'client')
  ON CONFLICT (product, external_id) DO UPDATE SET email = coalesce(lower(EXCLUDED.email), bloom_support.principals.email),
    display_name = coalesce(EXCLUDED.display_name, bloom_support.principals.display_name), updated_at = now()
  RETURNING id INTO pid;
  IF coalesce(p_external_account,'') <> '' THEN
    SELECT account_id INTO acct FROM bloom_support.account_links WHERE product = p_product AND external_id = p_external_account;
    IF acct IS NULL THEN
      INSERT INTO bloom_support.accounts(name, needs_review) VALUES (coalesce(nullif(btrim(p_account_name),''), upper(p_product) || ' ' || left(p_external_account, 12)), true)
      RETURNING id INTO acct;
      INSERT INTO bloom_support.account_links(account_id, product, external_id, label) VALUES (acct, p_product, p_external_account, p_account_name)
      ON CONFLICT (product, external_id) DO NOTHING;
      SELECT account_id INTO acct FROM bloom_support.account_links WHERE product = p_product AND external_id = p_external_account;
    END IF;
    INSERT INTO bloom_support.account_members(account_id, principal_id, relationship, verified) VALUES (acct, pid, 'member', true)
    ON CONFLICT (account_id, principal_id) DO UPDATE SET verified = true;
  END IF;
  RETURN jsonb_build_object('principal_id', pid, 'account_id', acct);
END $$;

-- Email senders: matched to an account only through a verified membership or
-- an account's registered email domain. Never grants staff authority.
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
  SELECT m.account_id INTO acct FROM bloom_support.account_members m WHERE m.principal_id = pid AND m.verified ORDER BY m.created_at LIMIT 1;
  IF acct IS NOT NULL THEN matched := 'membership';
  ELSE
    SELECT a.id INTO acct FROM bloom_support.accounts a
     WHERE dom = ANY(a.email_domains) AND a.merged_into IS NULL
       AND dom NOT IN ('gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','live.com','aol.com','shaw.ca','telus.net','rogers.com','sympatico.ca')
     LIMIT 1;
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
-- Intake
-- ---------------------------------------------------------------------------
-- p jsonb: {product, channel, subject, body, kind_hint, priority_hint, context,
--           account_id, conversation_id, dedupe_key, email:{message_id,in_reply_to,thread_root,reply_to}}
CREATE OR REPLACE FUNCTION bloom_support.create_ticket(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing bloom_support.tickets; conv bloom_support.conversations; t bloom_support.tickets; acct uuid;
  v_product text := coalesce(p->>'product', 'unknown'); v_channel text := coalesce(p->>'channel', 'staff');
  v_subject text := left(btrim(coalesce(p->>'subject','')), 300); v_body text := btrim(coalesce(p->>'body',''));
  lim jsonb := coalesce(bloom_support.setting('limits'), '{}'); staff boolean; v_requester uuid;
  v_kind text := coalesce(p->>'kind_hint','unknown'); v_priority text := coalesce(p->>'priority_hint','normal');
  msg_id uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.create');
  staff := bloom_support.has_permission(p_actor, 'tickets.read_all');
  IF length(v_body) < 3 THEN RAISE EXCEPTION 'invalid: describe the request' USING ERRCODE = '22023'; END IF;
  IF v_subject = '' THEN v_subject := left(regexp_replace(v_body, '\s+', ' ', 'g'), 120); END IF;
  IF v_kind NOT IN ('unknown','bug','question','request','feature','operation','account') THEN v_kind := 'unknown'; END IF;
  IF v_priority NOT IN ('low','normal','high','urgent') THEN v_priority := 'normal'; END IF;
  -- Clients cannot self-assign urgency beyond high; urgency affects priority only.
  IF NOT staff AND v_priority = 'urgent' THEN v_priority := 'high'; END IF;

  -- Idempotent delivery.
  IF p->>'dedupe_key' IS NOT NULL THEN
    SELECT * INTO existing FROM bloom_support.tickets WHERE dedupe_key = p->>'dedupe_key';
    IF FOUND THEN
      RETURN jsonb_build_object('ticket_id', existing.id, 'number', existing.number, 'duplicate_delivery', true, 'conversation_id', existing.conversation_id);
    END IF;
  END IF;

  -- Account: staff may name any account; others get the account they are a verified member of.
  IF p ? 'account_id' AND p->>'account_id' IS NOT NULL THEN
    acct := (p->>'account_id')::uuid;
    IF NOT bloom_support.can_access_account(p_actor, acct) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  END IF;

  -- Requester: staff/automation may file on behalf of a principal.
  v_requester := p_actor;
  IF (p->>'requester_id') IS NOT NULL AND staff THEN v_requester := (p->>'requester_id')::uuid; END IF;
  IF (p->>'requester_id') IS NOT NULL AND bloom_support.principal_role(p_actor) = 'service' THEN v_requester := (p->>'requester_id')::uuid; END IF;

  -- Per-account daily ticket limit (abuse guard).
  IF acct IS NOT NULL AND NOT bloom_support.consume_usage('tickets:' || to_char(now(),'YYYY-MM-DD'), acct::text,
       coalesce((lim->>'tickets_per_account_per_day')::int, 100)) THEN
    RAISE EXCEPTION 'rate_limited: daily ticket limit reached for this account' USING ERRCODE = '54000';
  END IF;

  -- Join an existing conversation the actor may read; otherwise start one.
  IF p->>'conversation_id' IS NOT NULL THEN
    SELECT * INTO conv FROM bloom_support.conversations WHERE id = (p->>'conversation_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found: conversation' USING ERRCODE = 'P0002'; END IF;
    IF NOT staff AND bloom_support.principal_role(p_actor) <> 'service'
       AND conv.requester_id IS DISTINCT FROM v_requester
       AND NOT (conv.account_id IS NOT NULL AND EXISTS (SELECT 1 FROM bloom_support.account_members m WHERE m.account_id = conv.account_id AND m.principal_id = p_actor AND m.verified)) THEN
      RAISE EXCEPTION 'forbidden: conversation' USING ERRCODE = '42501';
    END IF;
    acct := coalesce(acct, conv.account_id);
  ELSE
    INSERT INTO bloom_support.conversations(account_id, requester_id, channel, subject, email_thread_root, reply_to_email)
    VALUES (acct, v_requester, v_channel, v_subject, p->'email'->>'thread_root', p->'email'->>'reply_to')
    RETURNING * INTO conv;
  END IF;

  INSERT INTO bloom_support.tickets(conversation_id, account_id, requester_id, product, channel, kind, priority, subject, summary, context, dedupe_key, stage, status)
  VALUES (conv.id, acct, v_requester, CASE WHEN v_product IN ('cms','crm','pos','platform') THEN v_product ELSE 'unknown' END,
          v_channel, v_kind, v_priority, v_subject, v_body, coalesce(p->'context','{}'::jsonb), p->>'dedupe_key', 'intake', 'new')
  RETURNING * INTO t;

  INSERT INTO bloom_support.messages(conversation_id, ticket_id, author_id, author_kind, visibility, direction, body, email_message_id, in_reply_to, idempotency_key)
  VALUES (conv.id, t.id, v_requester, CASE WHEN bloom_support.is_staff(v_requester) THEN 'staff' ELSE 'client' END, 'public', 'inbound', v_body,
          p->'email'->>'message_id', p->'email'->>'in_reply_to', CASE WHEN p->>'dedupe_key' IS NOT NULL THEN 'ticket:' || (p->>'dedupe_key') END)
  RETURNING id INTO msg_id;

  -- Two or more tickets in one conversation are linked automatically.
  INSERT INTO bloom_support.ticket_links(from_ticket, to_ticket, kind, created_by)
  SELECT t.id, o.id, 'same_conversation', p_actor FROM bloom_support.tickets o WHERE o.conversation_id = conv.id AND o.id <> t.id
  ON CONFLICT DO NOTHING;

  PERFORM bloom_support.log(t.id, acct, p_actor, 'ticket.created', jsonb_build_object('channel', v_channel, 'product', t.product, 'number', t.number));
  PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(acct::text, 'none:' || t.id::text),
    jsonb_build_object('reason','new_ticket'), 'triage:' || t.id::text);
  PERFORM bloom_support.notify_staff(t.id, 'ticket.created', 'New request #' || t.number || ': ' || left(v_subject, 80), 'both');
  RETURN jsonb_build_object('ticket_id', t.id, 'number', t.number, 'conversation_id', conv.id, 'message_id', msg_id, 'account_id', acct, 'duplicate_delivery', false);
END $$;

-- ---------------------------------------------------------------------------
-- Read paths
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.ticket_json(p_actor uuid, t bloom_support.tickets, p_full boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff boolean := bloom_support.has_permission(p_actor, 'tickets.read_all'); base jsonb;
BEGIN
  base := jsonb_build_object(
    'id', t.id, 'number', t.number, 'subject', t.subject, 'status', t.status, 'product', t.product, 'kind', t.kind,
    'priority', t.priority, 'created_at', t.created_at, 'updated_at', t.updated_at, 'resolved_at', t.resolved_at,
    'conversation_id', t.conversation_id, 'account', (SELECT jsonb_build_object('id', a.id, 'name', a.name) FROM bloom_support.accounts a WHERE a.id = t.account_id),
    'requester', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name, 'email', pr.email) FROM bloom_support.principals pr WHERE pr.id = t.requester_id),
    'resolution_summary', t.resolution_summary);
  IF staff THEN
    base := base || jsonb_build_object('stage', t.stage, 'category', t.category, 'impact', t.impact, 'automation', t.automation,
      'next_action', t.next_action, 'version', t.version, 'channel', t.channel, 'duplicate_of', t.duplicate_of,
      'engineering_issue_id', t.engineering_issue_id, 'feature_request_id', t.feature_request_id, 'reopen_count', t.reopen_count,
      'resolution_verified', t.resolution_verified,
      'owner', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name, 'role', pr.role) FROM bloom_support.principals pr WHERE pr.id = t.owner_id),
      'taken_over_by', (SELECT jsonb_build_object('id', pr.id, 'name', pr.display_name) FROM bloom_support.principals pr WHERE pr.id = t.taken_over_by));
  END IF;
  IF NOT p_full THEN RETURN base; END IF;
  base := base || jsonb_build_object(
    'summary', t.summary,
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'ticket_id', m.ticket_id, 'author_kind', m.author_kind, 'visibility', m.visibility,
                   'direction', m.direction, 'body', m.body, 'created_at', m.created_at, 'delivery', CASE WHEN staff THEN m.delivery END,
                   'author', (SELECT jsonb_build_object('name', pr.display_name, 'role', CASE WHEN staff THEN pr.role END) FROM bloom_support.principals pr WHERE pr.id = m.author_id))
                   ORDER BY m.created_at), '[]')
                 FROM bloom_support.messages m
                 WHERE m.conversation_id = t.conversation_id AND (m.ticket_id IS NULL OR m.ticket_id = t.id OR staff)
                   AND (staff OR m.visibility = 'public')),
    'attachments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'file_name', x.file_name, 'content_type', x.content_type, 'size_bytes', x.size_bytes, 'visibility', x.visibility, 'created_at', x.created_at)), '[]')
                    FROM bloom_support.attachments x WHERE x.ticket_id = t.id AND (staff OR x.visibility = 'public')),
    'conversation_tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject, 'status', o.status) ORDER BY o.number), '[]')
                    FROM bloom_support.tickets o WHERE o.conversation_id = t.conversation_id AND o.id <> t.id AND (staff OR bloom_support.can_read_ticket(p_actor, o.id))));
  IF staff THEN
    base := base || jsonb_build_object(
      'context', t.context,
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
      'emails', (SELECT coalesce(jsonb_agg(jsonb_build_object('purpose', o.purpose, 'to', o.to_email, 'status', o.status, 'created_at', o.created_at, 'error', o.error) ORDER BY o.created_at DESC), '[]')
                 FROM bloom_support.outbound_emails o WHERE o.ticket_id = t.id),
      'account_history', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject, 'status', o.status, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]')
                 FROM (SELECT * FROM bloom_support.tickets WHERE account_id = t.account_id AND id <> t.id ORDER BY created_at DESC LIMIT 15) o));
  END IF;
  RETURN base;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.get_ticket(p_actor uuid, p_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  t := bloom_support.require_ticket(p_actor, p_ticket);
  RETURN bloom_support.ticket_json(p_actor, t, true);
END $$;

-- f: {status, product, account_id, owner ('me'|'none'|uuid), q, kind, automation, needs_owner, limit, before}
CREATE OR REPLACE FUNCTION bloom_support.list_tickets(p_actor uuid, f jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff boolean := bloom_support.has_permission(p_actor, 'tickets.read_all'); lim int := least(coalesce((f->>'limit')::int, 50), 200);
BEGIN
  IF NOT staff AND NOT bloom_support.has_permission(p_actor, 'tickets.read_own') THEN RAISE EXCEPTION 'forbidden: tickets' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(bloom_support.ticket_json(p_actor, t, false) ORDER BY
            CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.updated_at DESC), '[]')
    FROM (
      SELECT * FROM bloom_support.tickets t
      WHERE (staff OR bloom_support.can_read_ticket(p_actor, t.id))
        AND (f->>'status' IS NULL OR t.status = ANY(string_to_array(f->>'status', ',')))
        AND (f->>'product' IS NULL OR t.product = f->>'product')
        AND (f->>'kind' IS NULL OR t.kind = f->>'kind')
        AND (f->>'account_id' IS NULL OR t.account_id = (f->>'account_id')::uuid)
        AND (f->>'automation' IS NULL OR t.automation = f->>'automation')
        AND (f->>'owner' IS NULL OR (f->>'owner' = 'me' AND t.owner_id = p_actor) OR (f->>'owner' = 'none' AND t.owner_id IS NULL)
             OR (f->>'owner' NOT IN ('me','none') AND t.owner_id::text = f->>'owner'))
        AND (f->>'q' IS NULL OR t.search @@ plainto_tsquery('simple', f->>'q') OR t.number::text = ltrim(f->>'q', '#')
             OR EXISTS (SELECT 1 FROM bloom_support.accounts a WHERE a.id = t.account_id AND a.name ILIKE '%' || (f->>'q') || '%'))
        AND (f->>'before' IS NULL OR t.updated_at < (f->>'before')::timestamptz)
      ORDER BY t.updated_at DESC LIMIT lim) t);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.queue_summary(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  RETURN jsonb_build_object(
    'by_status', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM bloom_support.tickets GROUP BY status) s),
    'mine', (SELECT count(*) FROM bloom_support.tickets WHERE owner_id = p_actor AND status <> 'resolved'),
    'human', (SELECT count(*) FROM bloom_support.tickets WHERE automation = 'human' AND status <> 'resolved'),
    'open_escalations', (SELECT count(*) FROM bloom_support.escalations WHERE status <> 'resolved'),
    'features_awaiting', (SELECT count(*) FROM bloom_support.feature_requests WHERE status = 'awaiting_decision'),
    'jobs', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM bloom_support.jobs WHERE updated_at > now() - interval '7 days' GROUP BY status) s),
    'dead_jobs', (SELECT count(*) FROM bloom_support.jobs WHERE status = 'dead' AND updated_at > now() - interval '7 days'),
    'automation_enabled', bloom_support.setting('automation_enabled'),
    'client_email_enabled', bloom_support.setting('client_email_enabled'),
    'auto_release_enabled', bloom_support.setting('auto_release_enabled'),
    'unread', (SELECT count(*) FROM bloom_support.notifications WHERE principal_id = p_actor AND read_at IS NULL));
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_accounts(p_actor uuid, p_q text, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'crm_tenant_id', a.crm_tenant_id, 'needs_review', a.needs_review,
            'links', (SELECT coalesce(jsonb_agg(jsonb_build_object('product', l.product, 'external_id', l.external_id, 'label', l.label)), '[]') FROM bloom_support.account_links l WHERE l.account_id = a.id),
            'open_tickets', (SELECT count(*) FROM bloom_support.tickets t WHERE t.account_id = a.id AND t.status <> 'resolved')) ORDER BY a.name), '[]')
    FROM (SELECT * FROM bloom_support.accounts a
          WHERE a.merged_into IS NULL AND bloom_support.can_access_account(p_actor, a.id)
            AND (p_q IS NULL OR a.name ILIKE '%' || p_q || '%' OR EXISTS (SELECT 1 FROM bloom_support.account_links l WHERE l.account_id = a.id AND (l.external_id = p_q OR l.label ILIKE '%' || p_q || '%')))
          ORDER BY a.name LIMIT least(p_limit, 200)) a);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.get_account(p_actor uuid, p_account uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff boolean := bloom_support.has_permission(p_actor, 'accounts.read_all');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bloom_support.accounts WHERE id = p_account) THEN RAISE EXCEPTION 'not_found: account' USING ERRCODE = 'P0002'; END IF;
  IF NOT bloom_support.can_access_account(p_actor, p_account) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('id', a.id, 'name', a.name, 'crm_tenant_id', a.crm_tenant_id, 'primary_email', a.primary_email,
     'email_domains', CASE WHEN staff THEN to_jsonb(a.email_domains) END, 'notes', CASE WHEN staff THEN a.notes END, 'needs_review', a.needs_review,
     'links', (SELECT coalesce(jsonb_agg(jsonb_build_object('product', l.product, 'external_id', l.external_id, 'label', l.label)), '[]') FROM bloom_support.account_links l WHERE l.account_id = a.id),
     'members', CASE WHEN staff THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email, 'product', p.product, 'relationship', m.relationship, 'verified', m.verified)), '[]')
                  FROM bloom_support.account_members m JOIN bloom_support.principals p ON p.id = m.principal_id WHERE m.account_id = a.id) END,
     'tickets', bloom_support.list_tickets(p_actor, jsonb_build_object('account_id', a.id, 'limit', 100)),
     'operations', CASE WHEN staff THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]')
                  FROM (SELECT * FROM bloom_support.operations WHERE account_id = a.id ORDER BY created_at DESC LIMIT 30) o) END)
    FROM bloom_support.accounts a WHERE a.id = p_account);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.update_account(p_actor uuid, p_account uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'accounts.write');
  UPDATE bloom_support.accounts SET
    name = coalesce(p->>'name', name), primary_email = coalesce(lower(p->>'primary_email'), primary_email),
    email_domains = CASE WHEN p ? 'email_domains' THEN ARRAY(SELECT lower(jsonb_array_elements_text(p->'email_domains'))) ELSE email_domains END,
    notes = coalesce(p->>'notes', notes), needs_review = coalesce((p->>'needs_review')::boolean, needs_review), updated_at = now()
  WHERE id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: account' USING ERRCODE = 'P0002'; END IF;
  IF p ? 'link' THEN
    INSERT INTO bloom_support.account_links(account_id, product, external_id, label)
    VALUES (p_account, p->'link'->>'product', p->'link'->>'external_id', p->'link'->>'label');
  END IF;
  IF p ? 'crm_tenant_id' THEN UPDATE bloom_support.accounts SET crm_tenant_id = (p->>'crm_tenant_id')::uuid WHERE id = p_account; END IF;
  PERFORM bloom_support.log(NULL, p_account, p_actor, 'account.updated', p);
  RETURN bloom_support.get_account(p_actor, p_account);
END $$;

-- ---------------------------------------------------------------------------
-- Messages, updates, takeover, reopen
-- ---------------------------------------------------------------------------
-- p: {body, visibility, idempotency_key, as_bloom (bool), notify_client (bool)}
CREATE OR REPLACE FUNCTION bloom_support.add_message(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets; staff boolean; svc boolean; v_vis text := coalesce(p->>'visibility','public'); v_body text := btrim(coalesce(p->>'body',''));
  m bloom_support.messages; v_kind text; prior bloom_support.messages;
BEGIN
  t := bloom_support.require_ticket(p_actor, p_ticket);
  staff := bloom_support.has_permission(p_actor, 'tickets.write');
  svc := bloom_support.principal_role(p_actor) = 'service';
  IF length(v_body) = 0 THEN RAISE EXCEPTION 'invalid: empty message' USING ERRCODE = '22023'; END IF;
  IF v_vis NOT IN ('public','internal') THEN RAISE EXCEPTION 'invalid visibility' USING ERRCODE = '22023'; END IF;
  IF v_vis = 'internal' THEN PERFORM bloom_support.require_permission(p_actor, 'tickets.internal'); END IF;

  IF p->>'idempotency_key' IS NOT NULL THEN
    SELECT * INTO prior FROM bloom_support.messages WHERE idempotency_key = p->>'idempotency_key';
    IF FOUND THEN
      IF prior.ticket_id IS DISTINCT FROM t.id OR prior.body <> v_body THEN RAISE EXCEPTION 'conflict: idempotency key reused' USING ERRCODE = '23505'; END IF;
      RETURN jsonb_build_object('message_id', prior.id, 'duplicate', true);
    END IF;
  END IF;

  v_kind := CASE WHEN svc THEN 'bloom' WHEN bloom_support.is_staff(p_actor) THEN 'staff' ELSE 'client' END;
  -- Bloom never speaks to the client once a human has taken over or automation is paused.
  IF v_kind = 'bloom' AND v_vis = 'public' AND t.automation <> 'auto' THEN
    RAISE EXCEPTION 'blocked: ticket is under human control' USING ERRCODE = '42501';
  END IF;

  INSERT INTO bloom_support.messages(conversation_id, ticket_id, author_id, author_kind, visibility, direction, body, idempotency_key, delivery)
  VALUES (t.conversation_id, t.id, p_actor, v_kind, v_vis, CASE WHEN v_vis = 'internal' THEN 'internal' WHEN v_kind = 'client' THEN 'inbound' ELSE 'outbound' END,
          v_body, p->>'idempotency_key', CASE WHEN v_vis = 'public' AND v_kind <> 'client' THEN 'queued' ELSE 'none' END)
  RETURNING * INTO m;

  IF v_kind = 'staff' AND v_vis = 'public' AND t.automation = 'auto' THEN
    -- A person replying publicly takes the conversation over from Bloom.
    UPDATE bloom_support.tickets SET automation = 'human', taken_over_by = p_actor, taken_over_at = now(), version = version + 1, updated_at = now() WHERE id = t.id;
    PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'automation.taken_over', '{"via":"public_reply"}');
  END IF;

  IF v_kind = 'client' THEN
    -- A client reply on a waiting or resolved ticket wakes it up.
    IF t.status = 'resolved' THEN
      UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', reopen_count = reopen_count + 1, resolution_verified = false,
        resolved_at = NULL, version = version + 1, updated_at = now() WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.reopened', '{"via":"client_reply"}');
      PERFORM bloom_support.notify_staff(t.id, 'ticket.reopened', 'Reopened #' || t.number || ': ' || left(t.subject, 80), 'both');
    ELSIF t.status = 'waiting' THEN
      UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', version = version + 1, updated_at = now() WHERE id = t.id;
    ELSE
      UPDATE bloom_support.tickets SET updated_at = now() WHERE id = t.id;
    END IF;
    IF t.automation = 'auto' THEN
      PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('reason','client_reply','message_id', m.id), 'triage:' || m.id::text);
    END IF;
  ELSE
    UPDATE bloom_support.tickets SET updated_at = now(),
      status = CASE WHEN v_vis = 'public' AND status = 'new' THEN 'working' ELSE status END,
      stage = CASE WHEN v_vis = 'public' AND stage IN ('intake','triage') THEN 'answering' ELSE stage END
    WHERE id = t.id;
  END IF;

  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'message.' || v_vis, jsonb_build_object('message_id', m.id, 'author_kind', v_kind));
  IF v_vis = 'public' AND v_kind <> 'client' AND coalesce((p->>'notify_client')::boolean, true) THEN
    PERFORM bloom_support.enqueue_job('send_email', t.id, NULL, 'email:' || t.id::text,
      jsonb_build_object('purpose', CASE WHEN p->>'purpose' IS NOT NULL THEN p->>'purpose' ELSE 'reply' END, 'message_id', m.id), 'email:message:' || m.id::text);
  END IF;
  RETURN jsonb_build_object('message_id', m.id, 'duplicate', false);
END $$;

-- p: {version, status, stage, priority, kind, category, impact, owner_id, next_action, resolution_summary, resolution_verified, reason}
CREATE OR REPLACE FUNCTION bloom_support.update_ticket(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; n bloom_support.tickets; svc boolean; v_stage text; v_status text;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  svc := bloom_support.principal_role(p_actor) = 'service';
  IF p ? 'version' AND (p->>'version')::int <> t.version THEN
    RAISE EXCEPTION 'conflict: ticket changed (version %)', t.version USING ERRCODE = '40001';
  END IF;
  IF svc AND t.automation <> 'auto' AND NOT coalesce((p->>'internal_only')::boolean, false) THEN
    RAISE EXCEPTION 'blocked: ticket is under human control' USING ERRCODE = '42501';
  END IF;

  v_stage := coalesce(p->>'stage', t.stage);
  v_status := coalesce(p->>'status', CASE WHEN p ? 'stage' THEN bloom_support.status_for_stage(v_stage) ELSE t.status END);
  IF v_status = 'resolved' AND p ? 'status' AND NOT p ? 'stage' THEN v_stage := 'resolved'; END IF;
  IF v_status <> 'resolved' AND v_stage IN ('resolved','closed') THEN v_stage := 'triage'; END IF;

  -- Resolution rule: automation may only resolve with verified evidence.
  IF v_status = 'resolved' AND t.status <> 'resolved' THEN
    IF svc AND NOT coalesce((p->>'resolution_verified')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: Bloom may only resolve after verifying the outcome' USING ERRCODE = '42501';
    END IF;
    IF t.engineering_issue_id IS NOT NULL AND svc AND NOT EXISTS (
      SELECT 1 FROM bloom_support.engineering_issues e WHERE e.id = t.engineering_issue_id AND e.status IN ('verified','closed')) THEN
      RAISE EXCEPTION 'blocked: linked fix is not verified in production' USING ERRCODE = '42501';
    END IF;
    IF coalesce(btrim(coalesce(p->>'resolution_summary', t.resolution_summary)), '') = '' THEN
      RAISE EXCEPTION 'invalid: resolution summary required' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE bloom_support.tickets SET
    status = v_status, stage = v_stage,
    priority = coalesce(p->>'priority', priority), kind = coalesce(p->>'kind', kind), category = coalesce(p->>'category', category),
    impact = coalesce(p->>'impact', impact),
    owner_id = CASE WHEN p ? 'owner_id' THEN (p->>'owner_id')::uuid ELSE owner_id END,
    next_action = CASE WHEN p ? 'next_action' THEN p->>'next_action' ELSE next_action END,
    resolution_summary = coalesce(p->>'resolution_summary', resolution_summary),
    resolution_verified = CASE WHEN v_status = 'resolved' THEN coalesce((p->>'resolution_verified')::boolean, resolution_verified) ELSE false END,
    resolved_at = CASE WHEN v_status = 'resolved' THEN coalesce(resolved_at, now()) ELSE NULL END,
    reopen_count = reopen_count + CASE WHEN t.status = 'resolved' AND v_status <> 'resolved' THEN 1 ELSE 0 END,
    version = version + 1, updated_at = now()
  WHERE id = p_ticket RETURNING * INTO n;

  PERFORM bloom_support.log(n.id, n.account_id, p_actor, 'ticket.updated', jsonb_strip_nulls(jsonb_build_object(
    'status', CASE WHEN n.status <> t.status THEN jsonb_build_array(t.status, n.status) END,
    'stage', CASE WHEN n.stage <> t.stage THEN jsonb_build_array(t.stage, n.stage) END,
    'priority', CASE WHEN n.priority <> t.priority THEN jsonb_build_array(t.priority, n.priority) END,
    'owner', CASE WHEN n.owner_id IS DISTINCT FROM t.owner_id THEN n.owner_id END,
    'next_action', CASE WHEN n.next_action IS DISTINCT FROM t.next_action THEN n.next_action END,
    'reason', p->>'reason')));
  IF n.status = 'resolved' AND t.status <> 'resolved' THEN
    PERFORM bloom_support.enqueue_job('send_email', n.id, NULL, 'email:' || n.id::text,
      jsonb_build_object('purpose','resolution'), 'email:resolution:' || n.id::text || ':' || n.reopen_count);
  END IF;
  IF n.status = 'needs_owner' AND t.status <> 'needs_owner' THEN
    PERFORM bloom_support.notify_staff(n.id, 'ticket.needs_owner', 'Needs Jon/Jeff #' || n.number || ': ' || left(n.subject, 80), 'both');
  END IF;
  RETURN bloom_support.ticket_json(p_actor, n, false);
END $$;

-- mode: 'human' (take over), 'auto' (hand back to Bloom), 'paused'
CREATE OR REPLACE FUNCTION bloom_support.set_automation(p_actor uuid, p_ticket uuid, p_mode text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF bloom_support.principal_role(p_actor) = 'service' AND p_mode = 'auto' THEN RAISE EXCEPTION 'forbidden: Bloom cannot reclaim a ticket' USING ERRCODE = '42501'; END IF;
  IF p_mode NOT IN ('human','auto','paused') THEN RAISE EXCEPTION 'invalid mode' USING ERRCODE = '22023'; END IF;
  t := bloom_support.require_ticket(p_actor, p_ticket);
  UPDATE bloom_support.tickets SET automation = p_mode,
    taken_over_by = CASE WHEN p_mode = 'human' THEN p_actor ELSE NULL END,
    taken_over_at = CASE WHEN p_mode = 'human' THEN now() ELSE NULL END,
    owner_id = CASE WHEN p_mode = 'human' THEN coalesce(owner_id, p_actor) ELSE owner_id END,
    version = version + 1, updated_at = now()
  WHERE id = p_ticket RETURNING * INTO t;
  IF p_mode <> 'auto' THEN
    -- Stop queued client-facing work immediately.
    UPDATE bloom_support.jobs SET status = 'cancelled', last_error = 'cancelled: automation ' || p_mode, updated_at = now()
    WHERE ticket_id = p_ticket AND status = 'queued' AND kind IN ('triage','answer','operate','send_email','verify_resolution');
  ELSE
    PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
      jsonb_build_object('reason','handed_back'), 'triage:handback:' || t.id::text || ':' || t.version);
  END IF;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'automation.' || p_mode, jsonb_build_object('reason', p_reason));
  RETURN bloom_support.ticket_json(p_actor, t, false);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.link_tickets(p_actor uuid, p_from uuid, p_to uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a bloom_support.tickets; b bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  a := bloom_support.require_ticket(p_actor, p_from);
  b := bloom_support.require_ticket(p_actor, p_to);
  INSERT INTO bloom_support.ticket_links(from_ticket, to_ticket, kind, created_by) VALUES (p_from, p_to, p_kind, p_actor) ON CONFLICT DO NOTHING;
  IF p_kind = 'duplicate' THEN
    UPDATE bloom_support.tickets SET duplicate_of = p_to,
      engineering_issue_id = coalesce(engineering_issue_id, b.engineering_issue_id),
      feature_request_id = coalesce(feature_request_id, b.feature_request_id),
      next_action = 'Follows #' || b.number, version = version + 1, updated_at = now()
    WHERE id = p_from;
  END IF;
  PERFORM bloom_support.log(p_from, a.account_id, p_actor, 'ticket.linked', jsonb_build_object('to', p_to, 'kind', p_kind, 'number', b.number));
END $$;

-- Candidate related tickets (same account recent, or text similarity anywhere for staff).
CREATE OR REPLACE FUNCTION bloom_support.related_tickets(p_actor uuid, p_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  RETURN (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'score')::float DESC), '[]') FROM (
    SELECT jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject, 'status', o.status, 'account_id', o.account_id,
      'engineering_issue_id', o.engineering_issue_id, 'feature_request_id', o.feature_request_id,
      'score', ts_rank(o.search, plainto_tsquery('simple', t.subject)) + CASE WHEN o.account_id = t.account_id THEN 0.2 ELSE 0 END) r
    FROM bloom_support.tickets o
    WHERE o.id <> t.id AND o.created_at > now() - interval '90 days'
      AND (o.search @@ plainto_tsquery('simple', t.subject) OR (o.account_id = t.account_id AND o.created_at > now() - interval '7 days'))
    LIMIT 10) x);
END $$;

-- ---------------------------------------------------------------------------
-- Engineering issues
-- ---------------------------------------------------------------------------
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
  ELSE
    INSERT INTO bloom_support.engineering_issues(title, product, repository, evidence, created_by)
    VALUES (coalesce(p->>'title', t.subject), t.product, p->>'repository', coalesce(p->'evidence','{}'::jsonb), p_actor) RETURNING id INTO e;
    PERFORM bloom_support.enqueue_job('investigate', t.id, e, 'engineering:' || e::text, jsonb_build_object('step','investigate'), 'investigate:' || e::text, now(), 3, 900);
  END IF;
  UPDATE bloom_support.tickets SET engineering_issue_id = e, kind = CASE WHEN kind = 'unknown' THEN 'bug' ELSE kind END,
    stage = CASE WHEN status = 'resolved' THEN stage ELSE 'investigating' END,
    status = CASE WHEN status = 'resolved' THEN status ELSE 'working' END, version = version + 1, updated_at = now()
  WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'engineering.linked', jsonb_build_object('engineering_issue_id', e));
  RETURN jsonb_build_object('engineering_issue_id', e);
END $$;

-- Allowed engineering transitions and who may make them.
CREATE OR REPLACE FUNCTION bloom_support.engineering_transition_permission(p_from text, p_to text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_to IN ('investigating','reproduced','not_reproduced','fixing','in_review','failed','escalated')
         AND p_from NOT IN ('verified','closed') THEN 'engineering.investigate'
    WHEN p_to = 'awaiting_approval' AND p_from IN ('in_review','failed') THEN 'engineering.investigate'
    WHEN p_to = 'approved' AND p_from IN ('awaiting_approval','in_review','escalated') THEN 'engineering.approve'
    WHEN p_to IN ('merging','merged','deploying','deployed','verifying','verified','rolled_back') THEN 'engineering.release'
    WHEN p_to = 'closed' THEN 'engineering.approve'
    ELSE NULL END
$$;

-- p: {version, status, patch:{reproduction,risk,eligibility,branch,pr_number,pr_url,head_sha,merge_sha,deployment,verification,rollback,repository}, note}
CREATE OR REPLACE FUNCTION bloom_support.update_engineering_issue(p_actor uuid, p_issue uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; n bloom_support.engineering_issues; perm text; tk record; x jsonb := coalesce(p->'patch','{}'::jsonb);
BEGIN
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p ? 'version' AND (p->>'version')::int <> e.version THEN RAISE EXCEPTION 'conflict: issue changed' USING ERRCODE = '40001'; END IF;
  IF p ? 'status' AND p->>'status' <> e.status THEN
    perm := bloom_support.engineering_transition_permission(e.status, p->>'status');
    IF perm IS NULL THEN RAISE EXCEPTION 'invalid transition % -> %', e.status, p->>'status' USING ERRCODE = '22023'; END IF;
    PERFORM bloom_support.require_permission(p_actor, perm);
    -- Merge requires a recorded approval or a policy-eligible evaluation produced by the release identity.
    IF p->>'status' = 'merging' AND e.status <> 'approved' AND NOT coalesce((coalesce(x->'eligibility', e.eligibility)->>'eligible')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: not eligible for automatic release and not approved' USING ERRCODE = '42501';
    END IF;
    IF p->>'status' = 'verified' AND coalesce((coalesce(x->'verification', e.verification)->>'passed')::boolean, false) = false THEN
      RAISE EXCEPTION 'blocked: verification evidence required' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT (bloom_support.has_permission(p_actor, 'engineering.investigate') OR bloom_support.has_permission(p_actor, 'engineering.release')
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

CREATE OR REPLACE FUNCTION bloom_support.list_engineering(p_actor uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.view');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('tickets',
            (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'account_id', t.account_id, 'status', t.status)), '[]')
             FROM bloom_support.tickets t WHERE t.engineering_issue_id = e.id)) ORDER BY e.updated_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.engineering_issues WHERE p_status IS NULL OR status = ANY(string_to_array(p_status, ',')) ORDER BY updated_at DESC LIMIT 100) e);
END $$;

-- ---------------------------------------------------------------------------
-- Feature requests and escalations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.route_feature_request(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; f uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  f := coalesce((p->>'feature_request_id')::uuid, t.feature_request_id);
  IF f IS NULL THEN
    INSERT INTO bloom_support.feature_requests(title, description, product)
    VALUES (coalesce(p->>'title', t.subject), coalesce(p->>'description', t.summary), t.product) RETURNING id INTO f;
    INSERT INTO bloom_support.escalations(ticket_id, feature_request_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, f, 'jon', 'feature_decision', coalesce(p->>'title', t.subject), 'feature:' || f::text);
    PERFORM bloom_support.notify_staff(t.id, 'feature.awaiting_decision', 'Feature decision: ' || left(coalesce(p->>'title', t.subject), 80), 'jon');
  END IF;
  INSERT INTO bloom_support.feature_evidence(feature_request_id, ticket_id, account_id, excerpt)
  VALUES (f, t.id, t.account_id, left(coalesce(p->>'excerpt', t.summary), 1000)) ON CONFLICT DO NOTHING;
  UPDATE bloom_support.tickets SET feature_request_id = f, kind = 'feature', stage = 'awaiting_decision', status = 'needs_owner',
    next_action = 'Jon decides on the feature request', version = version + 1, updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.routed', jsonb_build_object('feature_request_id', f));
  RETURN jsonb_build_object('feature_request_id', f);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.decide_feature_request(p_actor uuid, p_feature uuid, p_decision text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tk record;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'features.decide');
  IF p_decision NOT IN ('accepted','declined','planned','shipped') THEN RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023'; END IF;
  UPDATE bloom_support.feature_requests SET status = p_decision, decision_note = p_note, decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_feature;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;
  UPDATE bloom_support.escalations SET status = 'resolved', decision = p_decision || coalesce(': ' || p_note, ''), decided_by = p_actor, resolved_at = now()
  WHERE feature_request_id = p_feature AND status <> 'resolved';
  FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE feature_request_id = p_feature AND status <> 'resolved' LOOP
    UPDATE bloom_support.tickets SET stage = 'answering', status = 'working', next_action = 'Tell the client the decision: ' || p_decision, version = version + 1, updated_at = now() WHERE id = tk.id;
    PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.decided', jsonb_build_object('decision', p_decision, 'note', p_note));
  END LOOP;
  RETURN (SELECT to_jsonb(f) FROM bloom_support.feature_requests f WHERE id = p_feature);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_features(p_actor uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'features.view');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(f) || jsonb_build_object('evidence',
           (SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_id', x.ticket_id, 'number', t.number, 'account', a.name, 'excerpt', x.excerpt)), '[]')
            FROM bloom_support.feature_evidence x JOIN bloom_support.tickets t ON t.id = x.ticket_id LEFT JOIN bloom_support.accounts a ON a.id = x.account_id
            WHERE x.feature_request_id = f.id)) ORDER BY f.created_at DESC), '[]')
    FROM bloom_support.feature_requests f WHERE p_status IS NULL OR f.status = p_status);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.escalate(p_actor uuid, p_ticket uuid, p_audience text, p_reason text, p_detail text, p_dedupe text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, dedupe_key)
  VALUES (t.id, t.engineering_issue_id, coalesce(p_audience,'both'), p_reason, p_detail, p_dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v;
  IF v IS NULL THEN SELECT id INTO v FROM bloom_support.escalations WHERE dedupe_key = p_dedupe; RETURN jsonb_build_object('escalation_id', v, 'duplicate', true); END IF;
  UPDATE bloom_support.tickets SET status = 'needs_owner', stage = 'escalated', next_action = 'Jon/Jeff: ' || left(p_reason, 200), version = version + 1, updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.escalated', jsonb_build_object('audience', p_audience, 'reason', p_reason));
  PERFORM bloom_support.notify_staff(t.id, 'escalation', 'Escalated #' || t.number || ': ' || left(p_reason, 80), coalesce(p_audience,'both'));
  PERFORM bloom_support.enqueue_job('escalate', t.id, NULL, 'email:escalation', jsonb_build_object('escalation_id', v), 'escalate:' || v::text);
  RETURN jsonb_build_object('escalation_id', v, 'duplicate', false);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.resolve_escalation(p_actor uuid, p_escalation uuid, p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x bloom_support.escalations;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.resolve');
  UPDATE bloom_support.escalations SET status = 'resolved', decision = p_decision, decided_by = p_actor, resolved_at = now()
  WHERE id = p_escalation AND status <> 'resolved' RETURNING * INTO x;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: open escalation' USING ERRCODE = 'P0002'; END IF;
  IF x.ticket_id IS NOT NULL THEN
    UPDATE bloom_support.tickets SET status = CASE WHEN status = 'needs_owner' THEN 'working' ELSE status END,
      stage = CASE WHEN stage = 'escalated' THEN 'triage' ELSE stage END,
      next_action = 'Decision recorded: ' || left(p_decision, 200), version = version + 1, updated_at = now() WHERE id = x.ticket_id;
    PERFORM bloom_support.log(x.ticket_id, NULL, p_actor, 'escalation.resolved', jsonb_build_object('decision', p_decision));
  END IF;
  RETURN to_jsonb(x);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_escalations(p_actor uuid, p_open_only boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('ticket', (SELECT jsonb_build_object('number', t.number, 'subject', t.subject, 'account_id', t.account_id) FROM bloom_support.tickets t WHERE t.id = x.ticket_id)) ORDER BY x.created_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.escalations WHERE NOT p_open_only OR status <> 'resolved' ORDER BY created_at DESC LIMIT 200) x);
END $$;

-- ---------------------------------------------------------------------------
-- Operations ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.record_operation_preview(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations; acct uuid := (p->>'account_id')::uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, p->>'permission');
  IF NOT bloom_support.can_access_account(p_actor, acct) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  IF p->>'ticket_id' IS NOT NULL THEN PERFORM bloom_support.require_ticket(p_actor, (p->>'ticket_id')::uuid); END IF;
  INSERT INTO bloom_support.operations(ticket_id, account_id, actor_id, kind, permission, inputs, preview, idempotency_key)
  VALUES ((p->>'ticket_id')::uuid, acct, p_actor, p->>'kind', p->>'permission', p->'inputs', p->'preview', p->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING * INTO o;
  IF o.id IS NULL THEN SELECT * INTO o FROM bloom_support.operations WHERE idempotency_key = p->>'idempotency_key'; END IF;
  PERFORM bloom_support.log((p->>'ticket_id')::uuid, acct, p_actor, 'operation.previewed', jsonb_build_object('operation_id', o.id, 'kind', o.kind));
  RETURN to_jsonb(o);
END $$;

-- Claims a previewed operation for execution exactly once.
CREATE OR REPLACE FUNCTION bloom_support.claim_operation(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) THEN RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501'; END IF;
  IF o.status <> 'previewed' THEN RETURN to_jsonb(o) || '{"already":true}'; END IF;
  IF o.expires_at < now() THEN
    UPDATE bloom_support.operations SET status = 'expired', updated_at = now() WHERE id = o.id RETURNING * INTO o;
    RETURN to_jsonb(o);
  END IF;
  UPDATE bloom_support.operations SET status = 'executing', confirmed_by = p_actor, updated_at = now() WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.confirmed', jsonb_build_object('operation_id', o.id, 'kind', o.kind));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.finish_operation(p_actor uuid, p_operation uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.require_permission(p_actor, o.permission);
  IF p->>'status' NOT IN ('succeeded','failed','undone') THEN RAISE EXCEPTION 'invalid operation status' USING ERRCODE = '22023'; END IF;
  IF p->>'status' = 'undone' AND o.status <> 'succeeded' THEN RAISE EXCEPTION 'invalid: only succeeded operations can be undone' USING ERRCODE = '22023'; END IF;
  IF p->>'status' IN ('succeeded','failed') AND o.status <> 'executing' THEN RAISE EXCEPTION 'invalid: operation not executing' USING ERRCODE = '22023'; END IF;
  UPDATE bloom_support.operations SET status = p->>'status', result = coalesce(p->'result', result), verification = coalesce(p->'verification', verification),
    undo = coalesce(p->'undo', undo), error = p->>'error', updated_at = now() WHERE id = o.id RETURNING * INTO o;
  PERFORM bloom_support.log(o.ticket_id, o.account_id, p_actor, 'operation.' || o.status, jsonb_build_object('operation_id', o.id, 'kind', o.kind, 'verified', o.verification IS NOT NULL, 'error', o.error));
  RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.get_operation(p_actor uuid, p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.operations;
BEGIN
  SELECT * INTO o FROM bloom_support.operations WHERE id = p_operation;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: operation' USING ERRCODE = 'P0002'; END IF;
  IF NOT bloom_support.can_access_account(p_actor, o.account_id) OR NOT bloom_support.is_staff(p_actor) AND bloom_support.principal_role(p_actor) <> 'service' THEN
    RAISE EXCEPTION 'forbidden: operation' USING ERRCODE = '42501';
  END IF;
  RETURN to_jsonb(o);
END $$;

-- ---------------------------------------------------------------------------
-- Jobs: claim with leases, bounded retries, lane isolation, kill switch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.claim_jobs(p_worker text, p_limit integer DEFAULT 5)
RETURNS SETOF bloom_support.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs; n int := 0;
BEGIN
  -- Recover jobs whose lease expired (worker crashed or timed out).
  UPDATE bloom_support.jobs SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
    last_error = coalesce(last_error || ' | ', '') || 'lease expired', lease_until = NULL, locked_by = NULL,
    run_after = now() + make_interval(secs => least(600, 15 * power(2, attempts)::int)), updated_at = now()
  WHERE status = 'running' AND lease_until < now();

  IF NOT coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false) THEN RETURN; END IF;

  FOR j IN
    SELECT * FROM bloom_support.jobs q
    WHERE q.status = 'queued' AND q.run_after <= now()
      AND NOT EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = q.lane AND r.status = 'running')
    ORDER BY q.run_after, q.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN n >= p_limit;
    -- One job per lane per claim batch.
    CONTINUE WHEN EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = j.lane AND r.status = 'running');
    UPDATE bloom_support.jobs SET status = 'running', attempts = attempts + 1, locked_by = p_worker,
      lease_until = now() + make_interval(secs => timeout_seconds), updated_at = now()
    WHERE id = j.id RETURNING * INTO j;
    n := n + 1;
    RETURN NEXT j;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.complete_job(p_job uuid, p_worker text, p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE bloom_support.jobs SET status = 'succeeded', result = p_result, lease_until = NULL, updated_at = now()
  WHERE id = p_job AND status = 'running' AND locked_by = p_worker;
  IF NOT FOUND THEN RAISE EXCEPTION 'conflict: job lease lost' USING ERRCODE = '40001'; END IF;
END $$;

-- p_retry_in: seconds; NULL = exponential backoff. p_permanent: no retry.
CREATE OR REPLACE FUNCTION bloom_support.fail_job(p_job uuid, p_worker text, p_error text, p_permanent boolean DEFAULT false, p_retry_in integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs; v_status text;
BEGIN
  SELECT * INTO j FROM bloom_support.jobs WHERE id = p_job AND status = 'running' AND locked_by = p_worker FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conflict: job lease lost' USING ERRCODE = '40001'; END IF;
  v_status := CASE WHEN p_permanent OR j.attempts >= j.max_attempts THEN 'dead' ELSE 'queued' END;
  UPDATE bloom_support.jobs SET status = v_status, last_error = left(p_error, 2000), lease_until = NULL, locked_by = NULL,
    run_after = now() + make_interval(secs => coalesce(p_retry_in, least(1800, 15 * power(2, j.attempts)::int))), updated_at = now()
  WHERE id = p_job;
  IF v_status = 'dead' AND j.ticket_id IS NOT NULL THEN
    INSERT INTO bloom_support.escalations(ticket_id, engineering_issue_id, audience, reason, detail, dedupe_key)
    VALUES (j.ticket_id, j.engineering_issue_id, 'both', 'automation_failed', j.kind || ': ' || left(p_error, 500), 'job-dead:' || j.id::text)
    ON CONFLICT (dedupe_key) DO NOTHING;
    UPDATE bloom_support.tickets SET status = CASE WHEN status = 'resolved' THEN status ELSE 'needs_owner' END,
      stage = CASE WHEN status = 'resolved' THEN stage ELSE 'escalated' END,
      next_action = 'Bloom could not finish ' || j.kind || ' — review the error', updated_at = now()
    WHERE id = j.ticket_id;
    PERFORM bloom_support.log(j.ticket_id, NULL, NULL, 'job.dead', jsonb_build_object('job_id', j.id, 'kind', j.kind, 'error', left(p_error, 500)));
    PERFORM bloom_support.notify_staff(j.ticket_id, 'job.dead', 'Bloom failed: ' || j.kind, 'both');
  END IF;
  RETURN v_status;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.control_job(p_actor uuid, p_job uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'automation.control');
  IF p_action = 'cancel' THEN
    UPDATE bloom_support.jobs SET status = 'cancelled', last_error = 'cancelled by staff', lease_until = NULL, updated_at = now()
    WHERE id = p_job AND status IN ('queued','running','failed','dead') RETURNING * INTO j;
  ELSIF p_action = 'retry' THEN
    UPDATE bloom_support.jobs SET status = 'queued', attempts = 0, run_after = now(), lease_until = NULL, locked_by = NULL, updated_at = now()
    WHERE id = p_job AND status IN ('failed','dead','cancelled') RETURNING * INTO j;
  ELSE RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023'; END IF;
  IF j.id IS NULL THEN RAISE EXCEPTION 'not_found: job in a state for %', p_action USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.log(j.ticket_id, NULL, p_actor, 'job.' || p_action, jsonb_build_object('job_id', j.id, 'kind', j.kind));
  RETURN to_jsonb(j);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_jobs(p_actor uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'automation.control');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(j) - 'payload' ORDER BY j.updated_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.jobs WHERE p_status IS NULL OR status = ANY(string_to_array(p_status, ',')) ORDER BY updated_at DESC LIMIT 200) j);
END $$;

-- ---------------------------------------------------------------------------
-- Settings, roles, API keys, notifications, tracking links
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.set_setting(p_actor uuid, p_key text, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Kill switches: operators may turn automation off/on; everything else (including release policy) is admin-only.
  IF p_key IN ('automation_enabled') THEN PERFORM bloom_support.require_permission(p_actor, 'automation.control');
  ELSE PERFORM bloom_support.require_permission(p_actor, 'admin.policy'); END IF;
  IF bloom_support.principal_role(p_actor) = 'service' THEN RAISE EXCEPTION 'forbidden: service identities cannot change policy' USING ERRCODE = '42501'; END IF;
  INSERT INTO bloom_support.settings(key, value, updated_by, updated_at) VALUES (p_key, p_value, p_actor, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = p_actor, updated_at = now();
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'setting.changed', jsonb_build_object('key', p_key, 'value', p_value));
  RETURN p_value;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.get_settings(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  RETURN (SELECT jsonb_object_agg(key, value) FROM bloom_support.settings);
END $$;

-- p: {principal_id | email, role, grants, active}
CREATE OR REPLACE FUNCTION bloom_support.set_principal_role(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr bloom_support.principals; v_role text := p->>'role';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.roles');
  IF v_role IS NOT NULL AND v_role NOT IN ('platform_admin','platform_operator','support','client') THEN RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023'; END IF;
  IF p->>'principal_id' IS NOT NULL THEN SELECT * INTO pr FROM bloom_support.principals WHERE id = (p->>'principal_id')::uuid;
  ELSE SELECT * INTO pr FROM bloom_support.principals WHERE lower(email) = lower(p->>'email') AND kind = 'user' LIMIT 1; END IF;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'not_found: principal (they must sign in to BloomSuite once first)' USING ERRCODE = 'P0002'; END IF;
  IF pr.kind <> 'user' AND v_role IN ('platform_admin','platform_operator','support') THEN
    RAISE EXCEPTION 'invalid: staff roles require a BloomSuite sign-in identity' USING ERRCODE = '22023';
  END IF;
  IF pr.id = p_actor AND v_role IS DISTINCT FROM 'platform_admin' AND v_role IS NOT NULL THEN
    RAISE EXCEPTION 'invalid: you cannot remove your own administrator role' USING ERRCODE = '22023';
  END IF;
  UPDATE bloom_support.principals SET role = coalesce(v_role, role),
    grants = CASE WHEN p ? 'grants' THEN ARRAY(SELECT jsonb_array_elements_text(p->'grants')) ELSE grants END,
    active = coalesce((p->>'active')::boolean, active), updated_at = now()
  WHERE id = pr.id RETURNING * INTO pr;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'principal.role_changed', jsonb_build_object('principal_id', pr.id, 'role', pr.role, 'grants', pr.grants, 'active', pr.active));
  RETURN jsonb_build_object('id', pr.id, 'email', pr.email, 'role', pr.role, 'grants', pr.grants, 'active', pr.active);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_staff(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'email', email, 'role', role, 'grants', grants, 'kind', kind, 'active', active) ORDER BY role, display_name), '[]')
    FROM bloom_support.principals WHERE role <> 'client');
END $$;

CREATE OR REPLACE FUNCTION bloom_support.create_service_principal(p_actor uuid, p_name text, p_grants text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'admin.roles');
  IF EXISTS (SELECT 1 FROM unnest(p_grants) g WHERE g NOT IN ('intake','operations','automation','investigation','release')) THEN
    RAISE EXCEPTION 'invalid service scope' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_grants) <> 1 THEN RAISE EXCEPTION 'invalid: one scope per service identity' USING ERRCODE = '22023'; END IF;
  INSERT INTO bloom_support.principals(kind, product, external_id, display_name, role, grants)
  VALUES ('service', NULL, NULL, p_name, 'service', p_grants) RETURNING id INTO v;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'service.created', jsonb_build_object('principal_id', v, 'grants', p_grants));
  RETURN v;
END $$;

-- Key material is generated and hashed in the Edge Function; only the hash is stored.
CREATE OR REPLACE FUNCTION bloom_support.create_api_key(p_actor uuid, p_principal uuid, p_label text, p_prefix text, p_hash text, p_scopes text[], p_expires timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  -- People mint keys for themselves; administrators mint keys for service identities.
  IF p_principal <> p_actor THEN PERFORM bloom_support.require_permission(p_actor, 'admin.roles');
  ELSIF NOT bloom_support.is_staff(p_actor) THEN RAISE EXCEPTION 'forbidden: only staff use API keys' USING ERRCODE = '42501'; END IF;
  INSERT INTO bloom_support.api_keys(principal_id, label, prefix, key_hash, scopes, created_by, expires_at)
  VALUES (p_principal, p_label, p_prefix, p_hash, coalesce(p_scopes, '{}'), p_actor, p_expires) RETURNING id INTO v;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'api_key.created', jsonb_build_object('key_id', v, 'principal_id', p_principal, 'label', p_label));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.revoke_api_key(p_actor uuid, p_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k bloom_support.api_keys;
BEGIN
  SELECT * INTO k FROM bloom_support.api_keys WHERE id = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: key' USING ERRCODE = 'P0002'; END IF;
  IF k.principal_id <> p_actor THEN PERFORM bloom_support.require_permission(p_actor, 'admin.roles'); END IF;
  UPDATE bloom_support.api_keys SET revoked_at = now() WHERE id = p_key;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'api_key.revoked', jsonb_build_object('key_id', p_key));
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_api_keys(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE admin boolean := bloom_support.has_permission(p_actor, 'admin.roles');
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'label', k.label, 'prefix', k.prefix, 'principal', p.display_name, 'principal_role', p.role,
      'scopes', k.scopes, 'created_at', k.created_at, 'last_used_at', k.last_used_at, 'expires_at', k.expires_at, 'revoked_at', k.revoked_at) ORDER BY k.created_at DESC), '[]')
    FROM bloom_support.api_keys k JOIN bloom_support.principals p ON p.id = k.principal_id
    WHERE k.principal_id = p_actor OR admin);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.authenticate_api_key(p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k bloom_support.api_keys; pr bloom_support.principals;
BEGIN
  SELECT * INTO k FROM bloom_support.api_keys WHERE key_hash = p_hash AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO pr FROM bloom_support.principals WHERE id = k.principal_id AND active;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE bloom_support.api_keys SET last_used_at = now() WHERE id = k.id AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute');
  RETURN jsonb_build_object('principal_id', pr.id, 'role', pr.role, 'grants', pr.grants, 'scopes', k.scopes, 'key_id', k.id, 'name', pr.display_name);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.whoami(p_actor uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email, 'role', p.role, 'grants', p.grants, 'kind', p.kind,
    'permissions', (SELECT coalesce(jsonb_agg(DISTINCT x.permission), '[]') FROM (
       SELECT rp.permission FROM bloom_support.role_permissions rp WHERE rp.role = p.role
       UNION SELECT gp.permission FROM bloom_support.grant_permissions gp WHERE gp.grant_name = ANY(p.grants) AND p.role IN ('support','service')) x),
    'accounts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name)), '[]') FROM bloom_support.account_members m JOIN bloom_support.accounts a ON a.id = m.account_id WHERE m.principal_id = p.id AND m.verified))
  FROM bloom_support.principals p WHERE p.id = p_actor
$$;

CREATE OR REPLACE FUNCTION bloom_support.list_notifications(p_actor uuid, p_mark_read boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC), '[]') INTO r
  FROM (SELECT * FROM bloom_support.notifications WHERE principal_id = p_actor ORDER BY created_at DESC LIMIT 50) n;
  IF p_mark_read THEN UPDATE bloom_support.notifications SET read_at = now() WHERE principal_id = p_actor AND read_at IS NULL; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.issue_tracking_token(p_ticket uuid, p_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO bloom_support.tracking_tokens(token_hash, ticket_id) VALUES (p_hash, p_ticket) ON CONFLICT DO NOTHING;
$$;

-- Public, read-only view of a single ticket through its tracking link.
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
                 FROM bloom_support.messages m WHERE m.ticket_id = t.id AND m.visibility = 'public'));
END $$;

-- ---------------------------------------------------------------------------
-- Email ledger
-- ---------------------------------------------------------------------------
-- Returns true when this provider event is new (first delivery).
CREATE OR REPLACE FUNCTION bloom_support.record_email_event(p_provider text, p_event text, p_message_id text, p_outcome text, p_ticket uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO bloom_support.email_events(provider, provider_event_id, message_id, outcome, ticket_id) VALUES (p_provider, p_event, p_message_id, p_outcome, p_ticket);
  RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.finish_email_event(p_provider text, p_event text, p_outcome text, p_ticket uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE bloom_support.email_events SET outcome = p_outcome, ticket_id = coalesce(p_ticket, ticket_id) WHERE provider = p_provider AND provider_event_id = p_event;
$$;

-- Find the ticket a reply belongs to: by any referenced Message-ID we sent or received, or by [#number] token.
CREATE OR REPLACE FUNCTION bloom_support.match_email_thread(p_refs text[], p_number bigint)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT o.ticket_id FROM bloom_support.outbound_emails o WHERE o.rfc_message_id = ANY(p_refs) AND o.ticket_id IS NOT NULL ORDER BY o.created_at DESC LIMIT 1),
    (SELECT m.ticket_id FROM bloom_support.messages m WHERE m.email_message_id = ANY(p_refs) AND m.ticket_id IS NOT NULL ORDER BY m.created_at DESC LIMIT 1),
    (SELECT t.id FROM bloom_support.conversations c JOIN bloom_support.tickets t ON t.conversation_id = c.id WHERE c.email_thread_root = ANY(p_refs) ORDER BY t.created_at DESC LIMIT 1),
    (SELECT t.id FROM bloom_support.tickets t WHERE t.number = p_number))
$$;

-- Records an inbound email as a message on an existing ticket (reply path).
CREATE OR REPLACE FUNCTION bloom_support.append_inbound_email(p_actor uuid, p_ticket uuid, p_body text, p_message_id text, p_in_reply_to text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; r jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM bloom_support.messages WHERE email_message_id = p_message_id) THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;
  -- The sender must be allowed to read this ticket; otherwise the caller starts a new ticket instead.
  IF NOT bloom_support.can_read_ticket(p_actor, p_ticket) THEN RAISE EXCEPTION 'forbidden: ticket' USING ERRCODE = '42501'; END IF;
  r := bloom_support.add_message(p_actor, p_ticket, jsonb_build_object('body', p_body, 'visibility', 'public', 'idempotency_key', 'email:' || p_message_id));
  UPDATE bloom_support.messages SET email_message_id = p_message_id, in_reply_to = p_in_reply_to WHERE id = (r->>'message_id')::uuid;
  RETURN r;
END $$;

-- Queue an outbound email. Blocks Bloom-initiated client mail after human takeover.
CREATE OR REPLACE FUNCTION bloom_support.queue_outbound_email(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.outbound_emails; t bloom_support.tickets;
BEGIN
  IF p->>'ticket_id' IS NOT NULL THEN SELECT * INTO t FROM bloom_support.tickets WHERE id = (p->>'ticket_id')::uuid; END IF;
  INSERT INTO bloom_support.outbound_emails(ticket_id, message_id, purpose, to_email, subject, body, rfc_message_id, in_reply_to, idempotency_key, status)
  VALUES ((p->>'ticket_id')::uuid, (p->>'message_id')::uuid, p->>'purpose', lower(p->>'to'), p->>'subject', p->>'body', p->>'rfc_message_id', p->>'in_reply_to', p->>'idempotency_key',
    CASE WHEN coalesce((p->>'bloom_initiated')::boolean, false) AND t.automation <> 'auto' THEN 'suppressed' ELSE 'queued' END)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING * INTO o;
  IF o.id IS NULL THEN SELECT * INTO o FROM bloom_support.outbound_emails WHERE idempotency_key = p->>'idempotency_key'; RETURN to_jsonb(o) || '{"duplicate":true}'; END IF;
  RETURN to_jsonb(o) || '{"duplicate":false}';
END $$;

CREATE OR REPLACE FUNCTION bloom_support.mark_outbound_email(p_id uuid, p_status text, p_provider_id text, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE bloom_support.outbound_emails SET status = p_status, provider_id = p_provider_id, error = p_error, sent_at = CASE WHEN p_status = 'sent' THEN now() END WHERE id = p_id;
  UPDATE bloom_support.messages SET delivery = CASE p_status WHEN 'sent' THEN 'sent' WHEN 'suppressed' THEN 'suppressed' WHEN 'not_configured' THEN 'failed' ELSE p_status END
  WHERE id = (SELECT message_id FROM bloom_support.outbound_emails WHERE id = p_id);
$$;

-- Knowledge search for approved answers.
CREATE OR REPLACE FUNCTION bloom_support.search_knowledge(p_product text, p_q text, p_limit int DEFAULT 5)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'body', k.body, 'product', k.product, 'rank', k.r) ORDER BY k.r DESC), '[]')
  FROM (SELECT *, ts_rank(search, websearch_to_tsquery('english', p_q)) r FROM bloom_support.knowledge
        WHERE approved AND (p_product IS NULL OR product IN (p_product, 'platform')) AND search @@ websearch_to_tsquery('english', p_q)
        ORDER BY r DESC LIMIT p_limit) k
$$;

CREATE OR REPLACE FUNCTION bloom_support.upsert_knowledge(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k bloom_support.knowledge; can_approve boolean := bloom_support.has_permission(p_actor, 'admin.policy') OR bloom_support.principal_role(p_actor) = 'platform_operator';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF bloom_support.principal_role(p_actor) = 'service' THEN RAISE EXCEPTION 'forbidden: Bloom cannot author approved knowledge' USING ERRCODE = '42501'; END IF;
  IF p->>'id' IS NULL THEN
    INSERT INTO bloom_support.knowledge(product, title, body, approved, approved_by)
    VALUES (p->>'product', p->>'title', p->>'body', can_approve AND coalesce((p->>'approved')::boolean, false), CASE WHEN can_approve AND coalesce((p->>'approved')::boolean,false) THEN p_actor END)
    RETURNING * INTO k;
  ELSE
    UPDATE bloom_support.knowledge SET title = coalesce(p->>'title', title), body = coalesce(p->>'body', body), product = coalesce(p->>'product', product),
      approved = CASE WHEN can_approve AND p ? 'approved' THEN (p->>'approved')::boolean ELSE false END,
      approved_by = CASE WHEN can_approve AND coalesce((p->>'approved')::boolean,false) THEN p_actor END, updated_at = now()
    WHERE id = (p->>'id')::uuid RETURNING * INTO k;
  END IF;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'knowledge.saved', jsonb_build_object('id', k.id, 'approved', k.approved));
  RETURN to_jsonb(k) - 'search';
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_knowledge(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(k) - 'search' ORDER BY k.updated_at DESC), '[]') FROM bloom_support.knowledge k);
END $$;

-- ---------------------------------------------------------------------------
-- Grants: service_role only.
-- ---------------------------------------------------------------------------
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'bloom_support' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
GRANT USAGE ON SEQUENCE bloom_support.ticket_number_seq TO service_role;
