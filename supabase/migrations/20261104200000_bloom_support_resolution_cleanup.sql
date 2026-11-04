-- Bloom Support: a resolved request is no longer actionable. Keep its resolution and audit
-- history, but remove queue-driving state and close ticket-level escalations
-- that the resolution made obsolete.
-- Preserve any historical larger attachment, but reject every new row over the
-- current 8 MB product contract at the database boundary as well as in storage.
ALTER TABLE bloom_support.attachments
  ADD CONSTRAINT bloom_support_attachments_max_8mb
  CHECK (size_bytes BETWEEN 1 AND 8388608) NOT VALID;

-- Bind every external idempotency key to the exact canonical report/attachment
-- manifest on the ticket row itself. The create function locks each key for
-- the transaction, so concurrent exact retries return one ticket while a
-- changed payload conflicts. Failed validation cannot poison a future key.
ALTER TABLE bloom_support.tickets
  ADD COLUMN intake_fingerprint text
  CHECK (
    intake_fingerprint IS NULL
    OR intake_fingerprint ~ '^[0-9a-f]{64}$'
  );

-- Persist the normalized notification decision alongside purpose. Historical
-- public staff/Bloom messages can be reconstructed from their durable email
-- job; other message kinds never used this flag and normalize to true.
ALTER TABLE bloom_support.messages
  ADD COLUMN notify_client boolean;
UPDATE bloom_support.messages AS message
SET notify_client = CASE
  WHEN message.visibility = 'public' AND message.author_kind <> 'client' THEN EXISTS (
    SELECT 1
    FROM bloom_support.jobs AS job
    WHERE job.kind = 'send_email'
      AND job.payload->>'message_id' = message.id::text
  )
  ELSE true
END;
ALTER TABLE bloom_support.messages
  ALTER COLUMN notify_client SET DEFAULT true,
  ALTER COLUMN notify_client SET NOT NULL;

-- RFC Message-IDs are normally globally unique but are sender-controlled.
-- Scope duplicate enforcement to the resolved requester so one sender cannot
-- claim or block another sender's message by deliberately reusing an ID.
ALTER TABLE bloom_support.messages
  DROP CONSTRAINT IF EXISTS messages_email_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS messages_author_email_message_id_unique
  ON bloom_support.messages(author_id, email_message_id)
  WHERE email_message_id IS NOT NULL;

-- A provider retries the same event after transient download/storage failure.
-- Remember the first successful quota charge on that event so a retry at the
-- hourly boundary can finish the original intake without bypassing the limit
-- for genuinely new mail.
ALTER TABLE bloom_support.email_events
  ADD COLUMN rate_charged_at timestamptz;

CREATE OR REPLACE FUNCTION public.bloom_support_consume_email_usage(
  p_provider text,
  p_event text,
  p_bucket text,
  p_subject text,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row bloom_support.email_events;
BEGIN
  SELECT * INTO event_row
  FROM bloom_support.email_events
  WHERE provider = p_provider AND provider_event_id = p_event
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: email event' USING ERRCODE = 'P0002';
  END IF;
  IF event_row.rate_charged_at IS NOT NULL THEN
    RETURN true;
  END IF;
  IF NOT bloom_support.consume_usage(p_bucket, p_subject, p_limit) THEN
    RETURN false;
  END IF;
  UPDATE bloom_support.email_events
  SET rate_charged_at = now()
  WHERE provider = p_provider AND provider_event_id = p_event;
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION public.bloom_support_consume_email_usage(text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_consume_email_usage(text, text, text, text, integer) TO service_role;

-- Verified live production targets and secret-free checks. Merge only these
-- release-owned maps so existing approved paths, required checks, size limits
-- and any stricter sensitive-path policy remain untouched.
INSERT INTO bloom_support.settings(key, value)
VALUES (
  'release_policy',
  jsonb_build_object(
    'vercel', jsonb_build_object(
      'JonDMorrison/brandsinblooms', jsonb_build_object(
        'projectId', 'prj_g6qTETEEZ2S84sjd35Yrlso8TxDL',
        'teamId', 'team_oTUXVKnd3HL3NfkZrMP0it4p'
      ),
      'Brands-In-Blooms/cms-brandsinblooms', jsonb_build_object(
        'projectId', 'prj_69WV966yxwhNc1xrV5zdALI7B9yt',
        'teamId', 'team_oTUXVKnd3HL3NfkZrMP0it4p'
      ),
      'Brands-In-Blooms/bloomtill', jsonb_build_object(
        'projectId', 'prj_Vatw4bi41DzWpje3rpCM6uDofNUR',
        'teamId', 'team_oTUXVKnd3HL3NfkZrMP0it4p'
      )
    ),
    'verificationOrigins', jsonb_build_object(
      'JonDMorrison/brandsinblooms', jsonb_build_array('https://bloomsuite.app'),
      'Brands-In-Blooms/cms-brandsinblooms', jsonb_build_array('https://winderberry.bloomsites.app'),
      'Brands-In-Blooms/bloomtill', jsonb_build_array('https://bloomsuite-pos-production.vercel.app')
    ),
    'verificationChecks', jsonb_build_object(
      'JonDMorrison/brandsinblooms', jsonb_build_array(jsonb_build_object(
        'url', 'https://bloomsuite.app/support/contact',
        'expect_status', 200,
        'contains', 'BloomSuite — CRM, POS & Websites for Garden Centres'
      )),
      'Brands-In-Blooms/cms-brandsinblooms', jsonb_build_array(jsonb_build_object(
        'url', 'https://winderberry.bloomsites.app/api/health',
        'expect_status', 200,
        'contains', '"status":"ok"'
      )),
      'Brands-In-Blooms/bloomtill', jsonb_build_array(jsonb_build_object(
        'url', 'https://bloomsuite-pos-production.vercel.app/build-info.json',
        'expect_status', 200,
        'contains', '"app":"bloomsuite-pos-till"'
      ))
    )
  )
)
ON CONFLICT (key) DO UPDATE
SET value = bloom_support.settings.value || jsonb_build_object(
      'vercel', coalesce(bloom_support.settings.value->'vercel', '{}'::jsonb)
        || excluded.value->'vercel',
      'verificationOrigins', coalesce(bloom_support.settings.value->'verificationOrigins', '{}'::jsonb)
        || excluded.value->'verificationOrigins',
      'verificationChecks', coalesce(bloom_support.settings.value->'verificationChecks', '{}'::jsonb)
        || excluded.value->'verificationChecks'
    ),
    updated_at = now();

-- The legacy gateway's idempotent attachment INSERT returns NULL on conflict.
-- Let server code count a retry as stored only after proving the existing row
-- belongs to this ticket and has byte-for-byte-equivalent metadata.
CREATE OR REPLACE FUNCTION public.bloom_support_confirm_attachment(
  p_actor uuid,
  p_ticket uuid,
  p_message_id uuid,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_sha256 text,
  p_visibility text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing bloom_support.attachments;
BEGIN
  IF NOT bloom_support.has_permission(p_actor, 'intake.attach') THEN
    PERFORM bloom_support.require_ticket(p_actor, p_ticket);
  END IF;

  SELECT * INTO existing
  FROM bloom_support.attachments
  WHERE storage_path = p_storage_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: attachment retry record' USING ERRCODE = 'P0002';
  END IF;
  IF existing.ticket_id IS DISTINCT FROM p_ticket
    OR existing.message_id IS DISTINCT FROM p_message_id
    OR existing.file_name IS DISTINCT FROM p_file_name
    OR existing.content_type IS DISTINCT FROM p_content_type
    OR existing.size_bytes IS DISTINCT FROM p_size_bytes
    OR existing.sha256 IS DISTINCT FROM p_sha256
    OR existing.visibility IS DISTINCT FROM p_visibility
  THEN
    RAISE EXCEPTION 'conflict: attachment path has different metadata' USING ERRCODE = '23505';
  END IF;
  RETURN to_jsonb(existing);
END
$$;
REVOKE ALL ON FUNCTION public.bloom_support_confirm_attachment(uuid, uuid, uuid, text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_confirm_attachment(uuid, uuid, uuid, text, text, text, bigint, text, text) TO service_role;

-- Explicit provenance lets dependency reconciliation reopen only problems that
-- the system closed automatically. A person's deliberate resolution remains
-- authoritative until a person changes it.
ALTER TABLE bloom_support.problems
  ADD COLUMN auto_resolved_at timestamptz;

CREATE OR REPLACE FUNCTION bloom_support.update_problem(p_actor uuid, p_problem uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pb bloom_support.problems;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  UPDATE bloom_support.problems
  SET title = coalesce(p->>'title', title),
      status = coalesce(p->>'status', status),
      kind = coalesce(p->>'kind', kind),
      summary = coalesce(p->>'summary', summary),
      auto_resolved_at = CASE WHEN p ? 'status' THEN NULL ELSE auto_resolved_at END,
      updated_at = now()
  WHERE id = p_problem
  RETURNING * INTO pb;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: problem' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'problem.updated', jsonb_build_object('problem_id', pb.id, 'status', pb.status));
  RETURN to_jsonb(pb);
END
$$;

CREATE OR REPLACE FUNCTION bloom_support.create_ticket(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing bloom_support.tickets;
  conv bloom_support.conversations;
  t bloom_support.tickets;
  acct uuid;
  v_product text := coalesce(p->>'product', 'unknown');
  v_channel text := coalesce(p->>'channel', 'staff');
  v_subject text := left(btrim(coalesce(p->>'subject','')), 300);
  v_body text := btrim(coalesce(p->>'body',''));
  lim jsonb := coalesce(bloom_support.setting('limits'), '{}');
  staff boolean;
  v_requester uuid;
  v_kind text := coalesce(p->>'kind_hint','unknown');
  v_priority text := coalesce(p->>'priority_hint','normal');
  msg_id uuid;
  v_automation text := CASE
    WHEN p->>'automation' IN ('paused', 'human') THEN p->>'automation'
  END;
  v_dedupe text := CASE
    WHEN nullif(p->>'dedupe_key','') IS NOT NULL
    THEN p_actor::text || ':' || (p->>'dedupe_key')
  END;
  v_fingerprint text := nullif(p->>'intake_fingerprint', '');
  public_rate jsonb := p->'public_rate';
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.create');
  staff := bloom_support.has_permission(p_actor, 'tickets.read_all');
  IF length(v_body) < 3 THEN RAISE EXCEPTION 'invalid: describe the request' USING ERRCODE = '22023'; END IF;
  IF v_subject = '' THEN v_subject := left(regexp_replace(v_body, '\s+', ' ', 'g'), 120); END IF;
  IF v_kind NOT IN ('unknown','question','bug','change','incident','feature','other') THEN v_kind := 'unknown'; END IF;
  IF v_priority NOT IN ('low','normal','high','urgent') THEN v_priority := 'normal'; END IF;
  IF NOT staff AND v_priority = 'urgent' THEN v_priority := 'high'; END IF;
  IF v_fingerprint IS NOT NULL AND v_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid: intake fingerprint' USING ERRCODE = '22023';
  END IF;

  -- Serialize this caller/key through lookup and insert. Exact concurrent
  -- retries return the first ticket; a changed canonical request conflicts.
  IF v_dedupe IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_dedupe, 0));
    SELECT * INTO existing
    FROM bloom_support.tickets
    WHERE dedupe_key = v_dedupe;
    IF FOUND THEN
      IF (v_fingerprint IS NOT NULL OR existing.intake_fingerprint IS NOT NULL)
        AND existing.intake_fingerprint IS DISTINCT FROM v_fingerprint
      THEN
        RAISE EXCEPTION 'conflict: idempotency key reused with different request' USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object(
        'ticket_id', existing.id,
        'number', existing.number,
        'duplicate_delivery', true,
        'conversation_id', existing.conversation_id
      );
    END IF;
  END IF;

  -- Public quota is consumed in the same transaction as the ticket and only
  -- for the first accepted idempotency key. Any rejection rolls usage back.
  IF public_rate IS NOT NULL THEN
    IF v_channel <> 'public'
      OR bloom_support.principal_role(p_actor) <> 'service'
      OR NOT bloom_support.has_permission(p_actor, 'intake.email')
    THEN
      RAISE EXCEPTION 'forbidden: public intake rate claim' USING ERRCODE = '42501';
    END IF;
    IF NOT bloom_support.consume_usage(
      public_rate->>'email_bucket',
      public_rate->>'email_subject',
      (public_rate->>'email_limit')::int
    ) OR NOT bloom_support.consume_usage(
      public_rate->>'ip_bucket',
      public_rate->>'ip_subject',
      (public_rate->>'ip_limit')::int
    ) THEN
      RAISE EXCEPTION 'rate_limited: too many public requests' USING ERRCODE = '54000';
    END IF;
  END IF;

  IF p ? 'account_id' AND p->>'account_id' IS NOT NULL THEN
    acct := (p->>'account_id')::uuid;
    IF NOT bloom_support.can_access_account(p_actor, acct)
      AND NOT bloom_support.has_permission(p_actor, 'intake.email')
    THEN
      RAISE EXCEPTION 'forbidden: account' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_requester := p_actor;
  IF (p->>'requester_id') IS NOT NULL AND staff THEN v_requester := (p->>'requester_id')::uuid; END IF;
  IF (p->>'requester_id') IS NOT NULL AND bloom_support.principal_role(p_actor) = 'service' THEN v_requester := (p->>'requester_id')::uuid; END IF;

  IF acct IS NOT NULL AND NOT bloom_support.consume_usage(
    'tickets:' || to_char(now(),'YYYY-MM-DD'),
    acct::text,
    coalesce((lim->>'tickets_per_account_per_day')::int, 100)
  ) THEN
    RAISE EXCEPTION 'rate_limited: daily ticket limit reached for this account' USING ERRCODE = '54000';
  END IF;

  IF p->>'conversation_id' IS NOT NULL THEN
    SELECT * INTO conv FROM bloom_support.conversations WHERE id = (p->>'conversation_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found: conversation' USING ERRCODE = 'P0002'; END IF;
    IF NOT staff AND bloom_support.principal_role(p_actor) <> 'service'
      AND conv.requester_id IS DISTINCT FROM v_requester
      AND NOT (
        conv.account_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM bloom_support.account_members m
          WHERE m.account_id = conv.account_id
            AND m.principal_id = p_actor
            AND m.verified
        )
      )
    THEN
      RAISE EXCEPTION 'forbidden: conversation' USING ERRCODE = '42501';
    END IF;
    acct := coalesce(acct, conv.account_id);
  ELSE
    INSERT INTO bloom_support.conversations(account_id, requester_id, channel, subject, email_thread_root, reply_to_email)
    VALUES (acct, v_requester, v_channel, v_subject, p->'email'->>'thread_root', p->'email'->>'reply_to')
    RETURNING * INTO conv;
  END IF;

  INSERT INTO bloom_support.tickets(
    conversation_id, account_id, requester_id, product, channel, kind,
    priority, subject, summary, context, dedupe_key, intake_fingerprint,
    stage, status, automation
  )
  VALUES (
    conv.id, acct, v_requester,
    CASE WHEN v_product IN ('cms','crm','pos','platform') THEN v_product ELSE 'unknown' END,
    v_channel, v_kind, v_priority, v_subject, v_body,
    coalesce(p->'context','{}'::jsonb), v_dedupe, v_fingerprint,
    'intake', 'new', coalesce(v_automation, 'auto')
  )
  RETURNING * INTO t;

  INSERT INTO bloom_support.messages(
    conversation_id, ticket_id, author_id, author_kind, visibility,
    direction, body, email_message_id, in_reply_to, idempotency_key
  )
  VALUES (
    conv.id, t.id, v_requester,
    CASE WHEN bloom_support.is_staff(v_requester) THEN 'staff' ELSE 'client' END,
    'public', 'inbound', v_body, p->'email'->>'message_id',
    p->'email'->>'in_reply_to',
    CASE WHEN v_dedupe IS NOT NULL THEN 'ticket:' || v_dedupe END
  )
  RETURNING id INTO msg_id;

  INSERT INTO bloom_support.ticket_links(from_ticket, to_ticket, kind, created_by)
  SELECT t.id, other.id, 'same_conversation', p_actor
  FROM bloom_support.tickets other
  WHERE other.conversation_id = conv.id AND other.id <> t.id
  ON CONFLICT DO NOTHING;

  PERFORM bloom_support.log(t.id, acct, p_actor, 'ticket.created', jsonb_build_object('channel', v_channel, 'product', t.product, 'number', t.number));
  IF v_automation IS NULL THEN
    PERFORM bloom_support.enqueue_job(
      'triage', t.id, NULL,
      'account:' || coalesce(acct::text, 'none:' || t.id::text),
      jsonb_build_object('reason','new_ticket'),
      'triage:' || t.id::text
    );
  END IF;
  PERFORM bloom_support.notify_staff(t.id, 'ticket.created', 'New request #' || t.number || ': ' || left(v_subject, 80), 'both');
  RETURN jsonb_build_object(
    'ticket_id', t.id,
    'number', t.number,
    'conversation_id', conv.id,
    'message_id', msg_id,
    'account_id', acct,
    'duplicate_delivery', false
  );
END
$$;

-- A reply key is a receipt for one exact actor/ticket/body/visibility tuple.
-- Serialize lookup and insert so concurrent retries cannot race, return the
-- original receipt only for an exact retry, and reject every changed use.
CREATE OR REPLACE FUNCTION bloom_support.add_message(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets; svc boolean; v_vis text := coalesce(p->>'visibility','public'); v_body text := btrim(coalesce(p->>'body',''));
  m bloom_support.messages; v_kind text; prior bloom_support.messages; v_purpose text := coalesce(p->>'purpose', 'reply');
  v_notify_client boolean := coalesce((p->>'notify_client')::boolean, true);
BEGIN
  t := bloom_support.require_ticket(p_actor, p_ticket);
  IF t.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'invalid: this ticket was merged into another ticket (%)', t.merged_into USING ERRCODE = '22023';
  END IF;
  svc := bloom_support.principal_role(p_actor) = 'service';
  IF length(v_body) = 0 THEN RAISE EXCEPTION 'invalid: empty message' USING ERRCODE = '22023'; END IF;
  IF v_vis NOT IN ('public','internal') THEN RAISE EXCEPTION 'invalid visibility' USING ERRCODE = '22023'; END IF;
  IF v_purpose NOT IN ('reply','clarification','resolution','acknowledgement','progress','notification') THEN v_purpose := 'reply'; END IF;
  IF v_vis = 'internal' THEN PERFORM bloom_support.require_permission(p_actor, 'tickets.internal'); END IF;
  v_kind := CASE WHEN svc THEN 'bloom' WHEN bloom_support.is_staff(p_actor) THEN 'staff' ELSE 'client' END;

  IF p->>'idempotency_key' IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('message:' || (p->>'idempotency_key'), 0)
    );
    SELECT * INTO prior
    FROM bloom_support.messages
    WHERE idempotency_key = p->>'idempotency_key';
    IF FOUND THEN
      IF prior.author_id IS DISTINCT FROM p_actor
        OR prior.ticket_id IS DISTINCT FROM t.id
        OR prior.body IS DISTINCT FROM v_body
        OR prior.visibility IS DISTINCT FROM v_vis
        OR prior.purpose IS DISTINCT FROM (
          CASE WHEN v_kind = 'client' THEN NULL ELSE v_purpose END
        )
        OR prior.notify_client IS DISTINCT FROM v_notify_client
      THEN
        RAISE EXCEPTION 'conflict: idempotency key reused with different message' USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object('message_id', prior.id, 'duplicate', true);
    END IF;
  END IF;

  IF v_kind = 'bloom' AND v_vis = 'public' AND (t.automation <> 'auto' OR t.executor = 'person') THEN
    RAISE EXCEPTION 'blocked: ticket is under human control' USING ERRCODE = '42501';
  END IF;
  IF bloom_support.has_permission(p_actor, 'tickets.read_all') = false AND v_kind = 'client' AND t.spam THEN
    RAISE EXCEPTION 'invalid: ticket closed' USING ERRCODE = '22023';
  END IF;

  INSERT INTO bloom_support.messages(conversation_id, ticket_id, author_id, author_kind, visibility, direction, body, idempotency_key, delivery, purpose, meaningful, notify_client)
  VALUES (t.conversation_id, t.id, p_actor, v_kind, v_vis, CASE WHEN v_vis = 'internal' THEN 'internal' WHEN v_kind = 'client' THEN 'inbound' ELSE 'outbound' END,
          v_body, p->>'idempotency_key', CASE WHEN v_vis = 'public' AND v_kind <> 'client' THEN 'queued' ELSE 'none' END,
          CASE WHEN v_kind = 'client' THEN NULL ELSE v_purpose END,
          v_vis = 'public' AND v_kind IN ('staff','bloom') AND v_purpose IN ('reply','clarification','resolution'),
          v_notify_client)
  RETURNING * INTO m;

  IF v_kind = 'staff' AND v_vis = 'public' THEN
    IF t.automation = 'auto' OR t.executor = 'bloom' THEN
      UPDATE bloom_support.tickets SET automation = 'human', executor = 'person', executor_id = p_actor, taken_over_by = p_actor, taken_over_at = now(),
        owner_id = coalesce(owner_id, p_actor), version = version + 1, updated_at = now() WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'automation.taken_over', '{"via":"public_reply"}');
    END IF;
    PERFORM bloom_support.invalidate_planned(t.id, 'human reply');
  END IF;

  IF v_kind = 'client' THEN
    PERFORM bloom_support.invalidate_planned(t.id, 'new customer message');
    IF t.status = 'resolved' THEN
      UPDATE bloom_support.tickets SET pending_review = 'reply_after_resolution', updated_at = now() WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.reply_after_resolution', jsonb_build_object('message_id', m.id));
      PERFORM bloom_support.enqueue_job('post_resolution_reply', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('message_id', m.id), 'post_reply:' || m.id::text);
      PERFORM bloom_support.notify_staff(t.id, 'ticket.reply_after_resolution', 'Reply on resolved #' || t.number || ': ' || left(t.subject, 70), 'both');
    ELSE
      IF t.status = 'waiting' AND t.waiting_reason = 'customer' THEN
        UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', version = version + 1, updated_at = now() WHERE id = t.id;
      ELSE
        UPDATE bloom_support.tickets SET updated_at = now() WHERE id = t.id;
      END IF;
      IF t.automation = 'auto' AND t.executor = 'bloom' THEN
        PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
          jsonb_build_object('reason','client_reply','message_id', m.id), 'triage:' || m.id::text);
      END IF;
    END IF;
  ELSE
    UPDATE bloom_support.tickets SET updated_at = now(),
      status = CASE WHEN v_vis = 'public' AND status = 'new' THEN 'working' ELSE status END,
      stage = CASE WHEN v_vis = 'public' AND stage IN ('intake','triage') THEN 'answering' ELSE stage END
    WHERE id = t.id;
  END IF;

  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'message.' || v_vis, jsonb_build_object('message_id', m.id, 'author_kind', v_kind, 'purpose', m.purpose));
  IF v_vis = 'public' AND v_kind <> 'client' AND v_notify_client THEN
    PERFORM bloom_support.enqueue_job('send_email', t.id, NULL, 'email:' || t.id::text,
      jsonb_build_object('purpose', v_purpose, 'message_id', m.id), 'email:message:' || m.id::text);
  END IF;
  RETURN jsonb_build_object('message_id', m.id, 'duplicate', false);
END $$;

-- A Message-ID is an idempotency key, not proof that a delivery belongs to
-- the ticket it names. Authorize the sender before looking up a duplicate and
-- return the old receipt only when the complete normalized reply is identical.
-- This also serializes concurrent deliveries through the same advisory key as
-- add_message, preventing two different payloads from racing the unique index.
CREATE OR REPLACE FUNCTION bloom_support.append_inbound_email(
  p_actor uuid,
  p_ticket uuid,
  p_body text,
  p_message_id text,
  p_in_reply_to text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ticket bloom_support.tickets;
  prior bloom_support.messages;
  result jsonb;
  normalized_body text := btrim(coalesce(p_body, ''));
  normalized_message_id text := btrim(coalesce(p_message_id, ''));
  normalized_in_reply_to text := nullif(btrim(coalesce(p_in_reply_to, '')), '');
BEGIN
  -- require_ticket applies the same account/ticket authorization as the
  -- normal reply path. It deliberately runs before duplicate discovery.
  ticket := bloom_support.require_ticket(p_actor, p_ticket);
  IF ticket.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'invalid: this ticket was merged into another ticket (%)', ticket.merged_into
      USING ERRCODE = '22023';
  END IF;
  IF normalized_message_id = '' THEN
    RAISE EXCEPTION 'invalid: email message id' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'message:email:' || p_actor::text || ':' || normalized_message_id,
      0
    )
  );
  SELECT * INTO prior
  FROM bloom_support.messages
  WHERE author_id = p_actor
    AND email_message_id = normalized_message_id;
  IF FOUND THEN
    IF prior.author_id IS DISTINCT FROM p_actor
      OR prior.ticket_id IS DISTINCT FROM ticket.id
      OR prior.body IS DISTINCT FROM normalized_body
      OR prior.in_reply_to IS DISTINCT FROM normalized_in_reply_to
    THEN
      RAISE EXCEPTION 'conflict: email message id reused with different reply'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('message_id', prior.id, 'duplicate', true);
  END IF;

  result := bloom_support.add_message(
    p_actor,
    ticket.id,
    jsonb_build_object(
      'body', normalized_body,
      'visibility', 'public',
      'idempotency_key', 'email:' || p_actor::text || ':' || normalized_message_id
    )
  );
  UPDATE bloom_support.messages
  SET email_message_id = normalized_message_id,
      in_reply_to = normalized_in_reply_to
  WHERE id = (result->>'message_id')::uuid;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION bloom_support.clean_resolved_ticket_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'resolved' THEN
    -- Release-level smoke tests are deployment evidence, never proof that an
    -- individual customer's workflow is fixed. A linked bug/incident may be
    -- closed autonomously only with trusted flow evidence explicitly bound to
    -- this ticket.
    IF NEW.kind IN ('bug', 'incident')
      AND NEW.engineering_issue_id IS NOT NULL
      AND NEW.resolution_evidence->>'resolved_by' = 'bloom'
      AND (
        NEW.resolution_evidence->'verification'->>'scope' IS DISTINCT FROM 'ticket_flow'
        OR NOT coalesce(
          NEW.resolution_evidence->'verification'->'ticket_ids' @> jsonb_build_array(NEW.id::text),
          false
        )
      )
    THEN
      RAISE EXCEPTION 'invalid: affected-flow verification must be explicitly bound to this ticket'
        USING ERRCODE = '22023';
    END IF;

    NEW.stage := 'resolved';
    NEW.waiting_reason := NULL;
    NEW.waiting_since := NULL;
    NEW.next_action := NULL;
    NEW.next_action_due_at := NULL;
    NEW.due_at := NULL;

    -- pending_review is cleared when a request first resolves, but a later
    -- customer reply deliberately sets reply_after_resolution while the
    -- ticket remains resolved so the post-reply decision worker can route it.
    IF TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'resolved') THEN
      NEW.pending_review := NULL;
    ELSIF NEW.pending_review IS DISTINCT FROM 'reply_after_resolution' THEN
      NEW.pending_review := NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'resolved' THEN
      UPDATE bloom_support.escalations
      SET status = 'resolved',
          decision = coalesce(decision, 'Ticket resolved'),
          resolved_at = coalesce(resolved_at, now())
      WHERE ticket_id = NEW.id
        AND status <> 'resolved'
        AND engineering_issue_id IS NULL
        AND feature_request_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- A repair-report credential receives untrusted agent output. Keep only the
-- normalized report schema produced by bloom-repair.yml; release-owned fields
-- such as verification URLs can never enter through this credential.
CREATE OR REPLACE FUNCTION bloom_support.normalize_repair_reproduction(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'reproduced', coalesce(p, '{}'::jsonb)->'reproduced' = 'true'::jsonb,
    'failing_test', CASE WHEN jsonb_typeof(p->'failing_test') = 'string' THEN left(p->>'failing_test', 300) END,
    'intended_behaviour_established', coalesce(p, '{}'::jsonb)->'intended_behaviour_established' = 'true'::jsonb,
    'intended_behaviour_source', CASE WHEN jsonb_typeof(p->'intended_behaviour_source') = 'string' THEN left(p->>'intended_behaviour_source', 40) END,
    'root_cause', CASE WHEN jsonb_typeof(p->'root_cause') = 'string' THEN left(p->>'root_cause', 2000) END,
    'needs_human', coalesce(p, '{}'::jsonb)->'needs_human' = 'true'::jsonb,
    'reason', CASE WHEN jsonb_typeof(p->'reason') = 'string' THEN left(p->>'reason', 1000) END
  ))
$$;

CREATE OR REPLACE FUNCTION bloom_support.update_engineering_issue(p_actor uuid, p_issue uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e bloom_support.engineering_issues; n bloom_support.engineering_issues; perm text; tk record; x jsonb := coalesce(p->'patch','{}'::jsonb);
  v_report_only boolean; v_start boolean := coalesce((p->>'start_repair')::boolean, false);
  v_report_outcome text; v_force_human_review boolean := false;
BEGIN
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = p_issue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: engineering issue' USING ERRCODE = 'P0002'; END IF;
  IF p ? 'version' AND (p->>'version')::int <> e.version THEN RAISE EXCEPTION 'conflict: issue changed' USING ERRCODE = '40001'; END IF;
  v_report_only := NOT bloom_support.has_permission(p_actor, 'engineering.investigate')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.release')
    AND NOT bloom_support.has_permission(p_actor, 'engineering.approve')
    AND bloom_support.has_permission(p_actor, 'engineering.report');
  IF v_report_only THEN
    IF v_start OR NOT (p ? 'status') OR p->>'status' NOT IN ('reproduced','not_reproduced','escalated','failed')
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(x) k WHERE k <> 'reproduction') THEN
      RAISE EXCEPTION 'forbidden: a repair report may only record the outcome and reproduction' USING ERRCODE = '42501';
    END IF;
    v_report_outcome := p->>'status';
    x := jsonb_set(
      x,
      '{reproduction}',
      coalesce(e.reproduction, '{}'::jsonb)
        || bloom_support.normalize_repair_reproduction(x->'reproduction'),
      true
    );
    v_force_human_review := (
      e.status = 'approved'
      AND x->'reproduction' IS DISTINCT FROM e.reproduction
    ) OR (
      e.status IN ('in_review','awaiting_approval')
      AND (
        v_report_outcome IN ('failed','escalated')
        OR coalesce((x->'reproduction'->>'needs_human')::boolean, false)
      )
    );
    IF e.status NOT IN ('investigating','fixing','reproduced') THEN
      p := p - 'status';
    END IF;
  END IF;
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
    IF p->>'status' = 'merging' AND e.status <> 'approved' AND NOT coalesce((coalesce(x->'eligibility', e.eligibility)->>'eligible')::boolean, false) THEN
      RAISE EXCEPTION 'blocked: not eligible for automatic release and not approved' USING ERRCODE = '42501';
    END IF;
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
  IF x ? 'eligibility' AND NOT bloom_support.has_permission(p_actor, 'engineering.release') AND NOT bloom_support.has_permission(p_actor, 'engineering.approve') THEN
    RAISE EXCEPTION 'forbidden: eligibility is evaluated by the release identity' USING ERRCODE = '42501';
  END IF;

  UPDATE bloom_support.engineering_issues SET
    status = CASE WHEN v_force_human_review THEN 'awaiting_approval' ELSE coalesce(p->>'status', status) END,
    repository = coalesce(x->>'repository', repository),
    reproduction = coalesce(x->'reproduction', reproduction), risk = coalesce(x->'risk', risk), eligibility = coalesce(x->'eligibility', eligibility),
    branch = coalesce(x->>'branch', branch), pr_number = coalesce((x->>'pr_number')::int, pr_number), pr_url = coalesce(x->>'pr_url', pr_url),
    head_sha = coalesce(x->>'head_sha', head_sha), merge_sha = coalesce(x->>'merge_sha', merge_sha), deployment = coalesce(x->'deployment', deployment),
    verification = coalesce(x->'verification', verification), rollback = coalesce(x->'rollback', rollback),
    evidence = CASE WHEN x ? 'evidence' THEN evidence || (x->'evidence') ELSE evidence END,
    approved_by = CASE WHEN p->>'status' = 'approved' THEN p_actor ELSE approved_by END,
    approved_at = CASE WHEN p->>'status' = 'approved' THEN now() ELSE approved_at END,
    approved_head_sha = CASE WHEN p->>'status' = 'approved' THEN coalesce(x->>'head_sha', head_sha)
                             WHEN p->>'status' = 'awaiting_approval' OR v_force_human_review THEN NULL ELSE approved_head_sha END,
    attempts = attempts + CASE WHEN p->>'status' = 'fixing' THEN 1 ELSE 0 END,
    version = version + 1, updated_at = now()
  WHERE id = p_issue RETURNING * INTO n;

  -- AFTER triggers may conservatively close no-deploy work. Re-read before
  -- emitting side effects so a stale failed/escalated RETURNING row cannot
  -- reopen an escalation or misreport the persisted status.
  SELECT * INTO n FROM bloom_support.engineering_issues WHERE id = p_issue;

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
  IF v_report_only
    AND n.status IN ('in_review', 'approved', 'awaiting_approval')
    AND n.reproduction IS DISTINCT FROM e.reproduction
  THEN
    PERFORM bloom_support.enqueue_job(
      'engineering_step',
      (SELECT id FROM bloom_support.tickets WHERE engineering_issue_id = p_issue ORDER BY created_at LIMIT 1),
      p_issue,
      'engineering:' || p_issue::text,
      jsonb_build_object('step', 'evaluate', 'reason', 'late_repair_report'),
      'eng:' || p_issue::text || ':evaluate:repair-report:' || n.version,
      now(),
      3,
      300
    );
  END IF;
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

-- A shared problem is complete only when every client request is complete and
-- no linked engineering issue is still moving through investigation or release.
CREATE OR REPLACE FUNCTION bloom_support.reconcile_resolved_problem(p_problem uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  resolved_problem uuid;
  reopened_problem uuid;
BEGIN
  UPDATE bloom_support.problems AS problem
  SET status = 'open',
      auto_resolved_at = NULL,
      updated_at = now()
  WHERE problem.id = p_problem
    AND problem.status = 'resolved'
    AND problem.auto_resolved_at IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM bloom_support.tickets AS ticket
        WHERE ticket.problem_id = problem.id
          AND ticket.status <> 'resolved'
      )
      OR EXISTS (
        SELECT 1
        FROM bloom_support.engineering_issues AS issue
        WHERE (
          issue.problem_id = problem.id
          OR EXISTS (
            SELECT 1
            FROM bloom_support.tickets AS ticket
            WHERE ticket.problem_id = problem.id
              AND ticket.engineering_issue_id = issue.id
          )
        )
          AND issue.status NOT IN ('closed', 'verified', 'not_reproduced', 'rolled_back')
      )
    )
  RETURNING problem.id INTO reopened_problem;

  IF reopened_problem IS NOT NULL THEN
    INSERT INTO bloom_support.activity(action, detail)
    VALUES (
      'problem.auto_reopened',
      jsonb_build_object(
        'problem_id', reopened_problem,
        'reason', 'linked_ticket_or_engineering_became_active'
      )
    );
  END IF;

  UPDATE bloom_support.problems AS problem
  SET status = 'resolved',
      auto_resolved_at = now(),
      updated_at = now()
  WHERE problem.id = p_problem
    AND problem.status <> 'resolved'
    AND EXISTS (
      SELECT 1
      FROM bloom_support.tickets AS ticket
      WHERE ticket.problem_id = problem.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM bloom_support.tickets AS ticket
      WHERE ticket.problem_id = problem.id
        AND ticket.status <> 'resolved'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM bloom_support.engineering_issues AS issue
      WHERE (
        issue.problem_id = problem.id
        OR EXISTS (
          SELECT 1
          FROM bloom_support.tickets AS ticket
          WHERE ticket.problem_id = problem.id
            AND ticket.engineering_issue_id = issue.id
        )
      )
        AND issue.status NOT IN ('closed', 'verified', 'not_reproduced', 'rolled_back')
    )
  RETURNING problem.id INTO resolved_problem;

  IF resolved_problem IS NOT NULL THEN
    INSERT INTO bloom_support.activity(action, detail)
    VALUES (
      'problem.auto_resolved',
      jsonb_build_object(
        'problem_id', resolved_problem,
        'reason', 'all_tickets_resolved_and_no_active_engineering'
      )
    );
  END IF;
END
$$;

-- Close only terminal pre-PR records whose linked tickets all explicitly say
-- why no deployment was needed. Active investigations and every issue with PR,
-- merge or deployment evidence remain untouched.
CREATE OR REPLACE FUNCTION bloom_support.reconcile_terminal_no_deploy_issue(p_issue uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  closed_issue_id uuid;
  closed_problem_id uuid;
  previous_status text;
  problem record;
BEGIN
  UPDATE bloom_support.engineering_issues AS issue
  SET status = 'closed',
      evidence = issue.evidence || jsonb_build_object(
        'no_deploy_closed_at', now(),
        'no_deploy_previous_status', issue.status
      ),
      version = issue.version + 1,
      updated_at = now()
  WHERE issue.id = p_issue
    AND issue.status IN ('not_reproduced', 'failed', 'escalated')
    AND issue.pr_number IS NULL
    AND issue.pr_url IS NULL
    AND issue.merge_sha IS NULL
    AND issue.deployment IS NULL
    AND EXISTS (
      SELECT 1
      FROM bloom_support.tickets AS ticket
      WHERE ticket.engineering_issue_id = issue.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM bloom_support.tickets AS ticket
      WHERE ticket.engineering_issue_id = issue.id
        AND (
          ticket.status <> 'resolved'
          OR coalesce(btrim(ticket.resolution_evidence->>'no_deploy_reason'), '') = ''
        )
    )
  RETURNING issue.id, issue.problem_id,
    issue.evidence->>'no_deploy_previous_status' AS previous_status
  INTO closed_issue_id, closed_problem_id, previous_status;

  IF closed_issue_id IS NOT NULL THEN
    UPDATE bloom_support.escalations
    SET status = 'resolved',
        decision = coalesce(
          decision,
          'Closed without deployment: all linked tickets resolved'
        ),
        resolved_at = coalesce(resolved_at, now())
    WHERE engineering_issue_id = closed_issue_id
      AND status <> 'resolved';

    INSERT INTO bloom_support.activity(ticket_id, account_id, action, detail)
    SELECT
      ticket.id,
      ticket.account_id,
      'engineering.closed_no_deploy',
      jsonb_build_object(
        'engineering_issue_id', closed_issue_id,
        'previous_status', previous_status
      )
    FROM bloom_support.tickets AS ticket
    WHERE ticket.engineering_issue_id = closed_issue_id;
  END IF;

  FOR problem IN
    SELECT DISTINCT linked.problem_id AS id
    FROM (
      SELECT closed_problem_id AS problem_id
      WHERE closed_problem_id IS NOT NULL
      UNION ALL
      SELECT ticket.problem_id
      FROM bloom_support.tickets AS ticket
      WHERE ticket.engineering_issue_id = p_issue
        AND ticket.problem_id IS NOT NULL
    ) AS linked
  LOOP
    PERFORM bloom_support.reconcile_resolved_problem(problem.id);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION bloom_support.reconcile_resolution_dependencies()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'tickets' THEN
    IF NEW.engineering_issue_id IS NOT NULL THEN
      PERFORM bloom_support.reconcile_terminal_no_deploy_issue(NEW.engineering_issue_id);
    END IF;
    IF NEW.problem_id IS NOT NULL THEN
      PERFORM bloom_support.reconcile_resolved_problem(NEW.problem_id);
    END IF;
  ELSE
    PERFORM bloom_support.reconcile_terminal_no_deploy_issue(NEW.id);
    IF NEW.problem_id IS NOT NULL THEN
      PERFORM bloom_support.reconcile_resolved_problem(NEW.problem_id);
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tickets_reconcile_resolution_dependencies ON bloom_support.tickets;
CREATE TRIGGER tickets_reconcile_resolution_dependencies
AFTER INSERT OR UPDATE OF status, resolution_evidence, engineering_issue_id, problem_id
ON bloom_support.tickets
FOR EACH ROW
EXECUTE FUNCTION bloom_support.reconcile_resolution_dependencies();

DROP TRIGGER IF EXISTS engineering_reconcile_resolution_dependencies ON bloom_support.engineering_issues;
CREATE TRIGGER engineering_reconcile_resolution_dependencies
AFTER INSERT OR UPDATE OF status, pr_number, pr_url, merge_sha, deployment, problem_id
ON bloom_support.engineering_issues
FOR EACH ROW
EXECUTE FUNCTION bloom_support.reconcile_resolution_dependencies();

-- Reconcile records that reached the conservative terminal state before these
-- invariants existed, including the live no-deploy case that exposed the gap.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT id
    FROM bloom_support.engineering_issues
    WHERE status IN ('not_reproduced', 'failed', 'escalated')
  LOOP
    PERFORM bloom_support.reconcile_terminal_no_deploy_issue(item.id);
  END LOOP;

  FOR item IN SELECT id FROM bloom_support.problems WHERE status <> 'resolved' LOOP
    PERFORM bloom_support.reconcile_resolved_problem(item.id);
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS tickets_clean_resolved_state ON bloom_support.tickets;
CREATE TRIGGER tickets_clean_resolved_state
BEFORE INSERT OR UPDATE ON bloom_support.tickets
FOR EACH ROW
EXECUTE FUNCTION bloom_support.clean_resolved_ticket_state();

-- A later job must not reopen a ticket-level escalation after the request has
-- already been resolved. Engineering and feature escalations remain independent
-- because they can still need a release or product decision after the client
-- request closes.
CREATE OR REPLACE FUNCTION bloom_support.clean_resolved_ticket_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL
    AND NEW.engineering_issue_id IS NULL
    AND NEW.feature_request_id IS NULL
    AND NEW.status <> 'resolved'
    AND EXISTS (
      SELECT 1
      FROM bloom_support.tickets AS ticket
      WHERE ticket.id = NEW.ticket_id
        AND ticket.status = 'resolved'
    )
  THEN
    NEW.status := 'resolved';
    NEW.decision := coalesce(NEW.decision, 'Ticket resolved');
    NEW.resolved_at := coalesce(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS escalations_clean_resolved_ticket ON bloom_support.escalations;
CREATE TRIGGER escalations_clean_resolved_ticket
BEFORE INSERT OR UPDATE ON bloom_support.escalations
FOR EACH ROW
EXECUTE FUNCTION bloom_support.clean_resolved_ticket_escalation();

-- Repair rows resolved before this invariant existed (including the stale
-- queue state that exposed this bug). These updates retain history, messages,
-- resolution evidence, ownership and escalation audit timestamps.
UPDATE bloom_support.tickets
SET stage = 'resolved',
    waiting_reason = NULL,
    waiting_since = NULL,
    next_action = NULL,
    next_action_due_at = NULL,
    pending_review = CASE
      WHEN pending_review = 'reply_after_resolution' THEN pending_review
      ELSE NULL
    END,
    due_at = NULL
WHERE status = 'resolved'
  AND (
    stage IS DISTINCT FROM 'resolved'
    OR waiting_reason IS NOT NULL
    OR waiting_since IS NOT NULL
    OR next_action IS NOT NULL
    OR next_action_due_at IS NOT NULL
    OR (
      pending_review IS NOT NULL
      AND pending_review <> 'reply_after_resolution'
    )
    OR due_at IS NOT NULL
  );

UPDATE bloom_support.escalations AS escalation
SET status = 'resolved',
    decision = coalesce(escalation.decision, 'Ticket resolved'),
    resolved_at = coalesce(escalation.resolved_at, ticket.resolved_at, now())
FROM bloom_support.tickets AS ticket
WHERE escalation.ticket_id = ticket.id
  AND ticket.status = 'resolved'
  AND escalation.status <> 'resolved'
  AND escalation.engineering_issue_id IS NULL
  AND escalation.feature_request_id IS NULL;

-- A repair report may have arrived after a person approved the then-known
-- facts. Explicit human-review evidence invalidates that older approval; the
-- current head can still be approved again after the report is reviewed.
UPDATE bloom_support.engineering_issues
SET status = 'awaiting_approval',
    approved_head_sha = NULL,
    eligibility = jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('repair report requires human review')
    ),
    evidence = evidence || jsonb_build_object(
      'approval_invalidated_by_repair_report_at', now()
    ),
    version = version + 1,
    updated_at = now()
WHERE status = 'approved'
  AND coalesce((reproduction->>'needs_human')::boolean, false);

-- Older releases could notice a merged PR without persisting its merge commit,
-- leaving the issue approved/in-review with no scheduled work. Re-enter those
-- safe evaluation states once; evaluation still enforces every release rule.
INSERT INTO bloom_support.jobs(
  kind,
  ticket_id,
  engineering_issue_id,
  lane,
  payload,
  idempotency_key,
  run_after,
  max_attempts,
  timeout_seconds
)
SELECT
  'engineering_step',
  (SELECT ticket.id FROM bloom_support.tickets AS ticket WHERE ticket.engineering_issue_id = issue.id ORDER BY ticket.created_at LIMIT 1),
  issue.id,
  'engineering:' || issue.id::text,
  jsonb_build_object('step', 'evaluate', 'reason', 'release_state_recovery'),
  'engineering-release-recovery:' || issue.id::text,
  now(),
  5,
  300
FROM bloom_support.engineering_issues AS issue
WHERE issue.status IN ('in_review', 'approved', 'awaiting_approval')
  AND issue.repository IS NOT NULL
  AND issue.pr_number IS NOT NULL
  AND issue.merge_sha IS NULL
ON CONFLICT (idempotency_key) DO NOTHING;

-- These helpers use only arguments, trigger variables or fully qualified
-- objects. Pin their lookup path so callers cannot redirect an unqualified
-- name through a mutable schema.
ALTER FUNCTION bloom_support.status_for_stage(text) SET search_path = '';
ALTER FUNCTION bloom_support.reject_mutation() SET search_path = '';
ALTER FUNCTION bloom_support.engineering_transition_permission(text, text) SET search_path = '';
ALTER FUNCTION bloom_support.valid_transition(text, text) SET search_path = '';
ALTER FUNCTION bloom_support.client_progress(bloom_support.tickets) SET search_path = '';

-- A configured product adapter is not proof that it has worked. Derive a
-- separate last-success timestamp for BloomSites and POS from the immutable
-- read audit. BloomSites also has person-confirmed writes, so successful CMS
-- operations count as evidence; failed, previewed and campaign operations do
-- not. These product-specific facts prevent one adapter from making the other
-- appear live.
CREATE OR REPLACE FUNCTION bloom_support.readiness_facts(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cron_worker boolean := false;
  cron_watchdog boolean := false;
  vault_token boolean := false;
  vault_alert boolean := false;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-worker'' AND active), EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-watchdog'' AND active)'
      INTO cron_worker, cron_watchdog;
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_worker_token''), EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_alert_resend_key'')'
      INTO vault_token, vault_alert;
  END IF;

  RETURN jsonb_build_object(
    'settings', (
      SELECT jsonb_object_agg(key, value)
      FROM bloom_support.settings
      WHERE key IN (
        'automation_enabled', 'client_email_enabled', 'auto_release_enabled',
        'ai', 'owners', 'limits', 'automation_scopes', 'notifications', 'sla',
        'business_hours', 'digest', 'closure', 'retention', 'release_policy'
      )
    ),
    'queue', (
      SELECT jsonb_build_object(
        'queued', count(*) FILTER (WHERE status = 'queued'),
        'running', count(*) FILTER (WHERE status = 'running'),
        'oldest_ready_queued_at', min(run_after) FILTER (WHERE status = 'queued' AND run_after <= now()),
        'dead_24h', count(*) FILTER (WHERE status = 'dead' AND updated_at > now() - interval '1 day'),
        'failed_retrying', count(*) FILTER (WHERE status = 'queued' AND attempts > 0)
      )
      FROM bloom_support.jobs
    ),
    'release_policy_set', (
      SELECT value <> '{}'::jsonb
      FROM bloom_support.settings
      WHERE key = 'release_policy'
    ),
    'cron', jsonb_build_object('worker', cron_worker, 'watchdog', cron_watchdog),
    'vault', jsonb_build_object('worker_token', vault_token, 'alert_resend_key', vault_alert),
    'worker', (
      SELECT jsonb_build_object(
        'last_started_at', max(started_at),
        'last_finished_at', max(finished_at),
        'runs_24h', count(*) FILTER (WHERE started_at > now() - interval '1 day'),
        'processed_24h', coalesce(sum(processed) FILTER (WHERE started_at > now() - interval '1 day'), 0)
      )
      FROM bloom_support.worker_runs
    ),
    'last_seen', jsonb_build_object(
      'intake_crm', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'crm'),
      'intake_cms', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'cms'),
      'intake_pos', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'pos'),
      'intake_public', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'public'),
      'intake_email', (
        SELECT max(received_at)
        FROM bloom_support.email_events
        WHERE outcome LIKE 'created%' OR outcome LIKE 'reply%'
      ),
      'email_sent', (
        SELECT max(sent_at)
        FROM bloom_support.outbound_emails
        WHERE status IN ('sent', 'delivered')
      ),
      'model_call', (
        SELECT max(created_at)
        FROM bloom_support.activity
        WHERE action = 'ai.call'
      ),
      'operation_succeeded', (
        SELECT max(updated_at)
        FROM bloom_support.operations
        WHERE status = 'succeeded'
      ),
      'operation_cms', (
        SELECT max(evidence.seen_at)
        FROM (
          SELECT activity.created_at AS seen_at
          FROM bloom_support.activity AS activity
          WHERE activity.action = 'operation.read'
            AND (
              activity.detail->>'kind' LIKE 'site.%'
              OR activity.detail->>'kind' LIKE 'event.%'
            )
          UNION ALL
          SELECT operation.updated_at AS seen_at
          FROM bloom_support.operations AS operation
          WHERE operation.status = 'succeeded'
            AND (
              operation.kind LIKE 'site.%'
              OR operation.kind LIKE 'event.%'
            )
        ) AS evidence
      ),
      'operation_pos', (
        SELECT max(activity.created_at)
        FROM bloom_support.activity AS activity
        WHERE activity.action = 'operation.read'
          AND activity.detail->>'kind' LIKE 'pos.%'
      ),
      'fix_verified', (
        SELECT max(updated_at)
        FROM bloom_support.engineering_issues
        WHERE status = 'verified'
      ),
      'rollback_succeeded', (
        SELECT max(updated_at)
        FROM bloom_support.engineering_issues
        WHERE status = 'rolled_back'
      ),
      'mcp_or_api_key_used', (
        SELECT max(last_used_at)
        FROM bloom_support.api_keys
      )
    ),
    'staff', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('name', display_name, 'email', email, 'role', role)),
        '[]'
      )
      FROM bloom_support.principals
      WHERE kind = 'user' AND role <> 'client' AND active
    ),
    'open_alerts', (
      SELECT coalesce(jsonb_agg(to_jsonb(alert) ORDER BY alert.created_at DESC), '[]')
      FROM (
        SELECT *
        FROM bloom_support.alerts
        WHERE created_at > now() - interval '24 hours'
        ORDER BY created_at DESC
        LIMIT 20
      ) AS alert
    ),
    'knowledge', jsonb_build_object(
      'approved_client', (
        SELECT count(*)
        FROM bloom_support.knowledge
        WHERE approved AND audience = 'client'
      ),
      'internal', (
        SELECT count(*)
        FROM bloom_support.knowledge
        WHERE audience = 'internal'
      )
    )
  );
END
$$;
