-- Bloom Support: the public tracking page (/support/track/:token).
--
-- The page is reached from the "Track this request" link in every support
-- email. A token proves only that the holder received an email about ONE
-- ticket, so everything here is scoped to that ticket and projected for the
-- client:
--
-- * Status is the client-facing four-state status (received, in_progress,
--   waiting_on_you, resolved). Internal routing states such as needs_owner
--   ("Needs Jon/Jeff") and the internal stage are never returned.
-- * Only public, non-withdrawn, non-internal messages and public attachments.
-- * Staff are always "Bloom Support"; no staff names, owners or notes.
-- * The requester's own first name and the client company name are shown,
--   because the person holding the link is that requester. The company's
--   website and logo come from our own records only (never the ticket).
--
-- Writes (reply, confirm resolved, still not fixed) run as the ticket's
-- requester through the same add_message / client_action functions the email
-- and portal paths use, so every existing rule (merge, spam, reopen, triage,
-- staff notification) applies unchanged. Only a client requester can write
-- from the page; tickets raised by staff are read-only here.
--
-- Everything is reached through one service-role-only entry point that the
-- bloom-support-api Edge Function calls; anon/authenticated have no access.

-- ---------------------------------------------------------------------------
-- Client projection of one ticket
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.track_payload(p_ticket uuid, p_link_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets;
  req bloom_support.principals;
  v_status text;
  v_group text;
  v_step integer;
  v_can_write boolean;
  v_hours jsonb := bloom_support.setting('business_hours');
BEGIN
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO req FROM bloom_support.principals WHERE id = t.requester_id;

  v_status := CASE
    WHEN t.status = 'resolved' THEN 'resolved'
    WHEN t.status = 'new' THEN 'received'
    WHEN t.status = 'waiting' AND t.waiting_reason = 'customer' THEN 'waiting_on_you'
    ELSE 'in_progress' END;
  v_group := CASE WHEN t.kind = 'feature' THEN 'idea' WHEN t.kind IN ('bug','incident') THEN 'fix' ELSE 'help' END;
  v_step := CASE
    WHEN t.status = 'resolved' THEN 4
    WHEN t.status = 'new' THEN 1
    WHEN v_group <> 'idea' AND (t.stage IN ('operating','investigating','fixing','releasing','verifying')
      OR t.waiting_reason IN ('deployment','scheduled')) THEN 3
    ELSE 2 END;
  v_can_write := req.id IS NOT NULL AND req.role = 'client' AND req.active
    AND t.merged_into IS NULL AND NOT t.spam AND t.redacted_at IS NULL;

  RETURN jsonb_build_object(
    'state', 'ok',
    'number', t.number,
    'subject', t.subject,
    'product', t.product,
    'kind', v_group,
    'status', v_status,
    'step', v_step,
    'progress', bloom_support.client_progress(t),
    'created_at', t.created_at,
    'last_activity_at', greatest(t.created_at, t.resolved_at,
      (SELECT max(m.created_at) FROM bloom_support.messages m
        WHERE m.ticket_id = t.id AND m.visibility = 'public' AND m.direction <> 'internal' AND m.withdrawn_at IS NULL)),
    'resolved_at', CASE WHEN t.status = 'resolved' THEN t.resolved_at END,
    'resolution_summary', CASE WHEN t.status = 'resolved' THEN t.resolution_summary END,
    'confirmed', t.status = 'resolved' AND coalesce(t.resolution_evidence ? 'client_confirmed_at', false),
    'merged_into_number', (SELECT o.number FROM bloom_support.tickets o WHERE o.id = t.merged_into),
    'requester_name', nullif(split_part(btrim(coalesce(req.display_name, '')), ' ', 1), ''),
    -- The client company's name. Its website and logo are added by the Edge Function from our
    -- own stored records (client-brand-loader.ts, the same source as support emails); `_account`
    -- tells it which account, and is removed before the response leaves the server.
    'company', (SELECT jsonb_build_object('name', a.name) FROM bloom_support.accounts a WHERE a.id = t.account_id),
    '_account', (SELECT jsonb_build_object('id', a.id, 'name', a.name) FROM bloom_support.accounts a WHERE a.id = t.account_id),
    'can_reply', v_can_write AND t.status <> 'resolved',
    'can_confirm', v_can_write AND t.status = 'resolved' AND NOT coalesce(t.resolution_evidence ? 'client_confirmed_at', false),
    'can_reopen', v_can_write AND t.status = 'resolved',
    -- Our own first-response target, shown as "we aim to reply by" only while it is still ahead.
    'reply_expected_by', CASE WHEN t.first_response_at IS NULL AND t.status IN ('new','working') AND t.due_at > now() THEN t.due_at END,
    'support_hours', CASE WHEN coalesce((v_hours->>'enabled')::boolean, false) THEN jsonb_build_object(
      'days', v_hours->'days', 'start', v_hours->>'start', 'end', v_hours->>'end', 'timezone', v_hours->>'timezone') END,
    'link_expires_at', p_link_expires_at,
    -- Files sent with the original request (not tied to a message).
    'attachments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type,
        'size_bytes', a.size_bytes) ORDER BY a.created_at), '[]')
      FROM bloom_support.attachments a WHERE a.ticket_id = t.id AND a.visibility = 'public' AND a.message_id IS NULL),
    'messages', (SELECT coalesce(jsonb_agg(x.msg ORDER BY x.created_at), '[]') FROM (
      SELECT m.created_at, jsonb_build_object(
        'id', m.id,
        'author', w.author,
        'name', CASE w.author
          WHEN 'customer' THEN coalesce(nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 1), ''), 'You')
          WHEN 'system' THEN 'Bloom'
          ELSE 'Bloom Support' END,
        'automatic', w.author <> 'customer' AND m.author_kind IN ('bloom','system'),
        'purpose', CASE WHEN w.author = 'customer' THEN NULL ELSE m.purpose END,
        'body', m.body,
        'created_at', m.created_at,
        'attachments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type,
            'size_bytes', a.size_bytes) ORDER BY a.created_at), '[]')
          FROM bloom_support.attachments a WHERE a.message_id = m.id AND a.ticket_id = t.id AND a.visibility = 'public')
      ) AS msg
      FROM bloom_support.messages m
      LEFT JOIN bloom_support.principals p ON p.id = m.author_id
      CROSS JOIN LATERAL (SELECT CASE
        WHEN m.author_kind = 'client' THEN 'customer'
        -- A request a staff member raised for a client: their own words are the request, not a Bloom reply.
        WHEN m.author_id = t.requester_id AND m.direction = 'inbound' THEN 'customer'
        WHEN m.author_kind = 'system' THEN 'system'
        ELSE 'team' END AS author) w
      WHERE m.ticket_id = t.id AND m.visibility = 'public' AND m.direction <> 'internal' AND m.withdrawn_at IS NULL
    ) x)
  );
END $$;
REVOKE ALL ON FUNCTION bloom_support.track_payload(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- The gateway route keeps working and returns the same client projection.
CREATE OR REPLACE FUNCTION bloom_support.ticket_by_tracking_token(p_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tok bloom_support.tracking_tokens;
BEGIN
  SELECT * INTO tok FROM bloom_support.tracking_tokens WHERE token_hash = p_hash AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN bloom_support.track_payload(tok.ticket_id, tok.expires_at);
END $$;

-- ---------------------------------------------------------------------------
-- Single service-role entry point for the public page
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloom_support_track(p_op text, p_hash text, p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tok bloom_support.tracking_tokens;
  t bloom_support.tickets;
  req bloom_support.principals;
  v_hour text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24');
  v_ip text := left(coalesce(p->>'ip', 'unknown'), 64);
  v_body text;
  v_key text;
  v_action text;
  v_result jsonb;
  a bloom_support.attachments;
BEGIN
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'not_found: link' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO tok FROM bloom_support.tracking_tokens WHERE token_hash = p_hash;

  IF p_op = 'view' THEN
    IF tok.token_hash IS NULL OR tok.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
    IF tok.expires_at <= now() THEN RETURN jsonb_build_object('state', 'expired'); END IF;
    RETURN bloom_support.track_payload(tok.ticket_id, tok.expires_at);
  END IF;

  IF p_op = 'renew' THEN
    -- Only an expired (never a revoked or unknown) link, at most twice a day per ticket.
    -- The Edge Function mails the fresh link to the requester's own address only.
    IF tok.token_hash IS NULL OR tok.revoked_at IS NOT NULL OR tok.expires_at > now() THEN RETURN NULL; END IF;
    SELECT * INTO t FROM bloom_support.tickets WHERE id = tok.ticket_id;
    SELECT * INTO req FROM bloom_support.principals WHERE id = t.requester_id;
    IF req.id IS NULL OR NOT req.active OR coalesce(btrim(req.email), '') = '' OR t.spam OR t.redacted_at IS NOT NULL THEN RETURN NULL; END IF;
    IF NOT bloom_support.consume_usage('track-renew:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), t.id::text, 2)
      OR NOT bloom_support.consume_usage('track-renew-ip:' || v_hour, v_ip, 10) THEN
      RAISE EXCEPTION 'rate_limited: a new link was already sent recently' USING ERRCODE = '54000';
    END IF;
    PERFORM bloom_support.log(t.id, t.account_id, req.id, 'client.track_link_renewed', '{}');
    RETURN jsonb_build_object('ticket_id', t.id, 'number', t.number, 'subject', t.subject, 'email', lower(btrim(req.email)));
  END IF;

  IF tok.token_hash IS NULL OR tok.revoked_at IS NOT NULL OR tok.expires_at <= now() THEN
    RAISE EXCEPTION 'not_found: this link has expired or does not exist' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO t FROM bloom_support.tickets WHERE id = tok.ticket_id;

  IF p_op = 'attachment' THEN
    IF NOT bloom_support.consume_usage('track-file:' || v_hour, p_hash, 120) THEN
      RAISE EXCEPTION 'rate_limited: too many downloads, try again shortly' USING ERRCODE = '54000';
    END IF;
    BEGIN
      SELECT * INTO a FROM bloom_support.attachments x
       WHERE x.id = (p->>'attachment_id')::uuid AND x.ticket_id = t.id AND x.visibility = 'public'
         AND (x.message_id IS NULL OR EXISTS (SELECT 1 FROM bloom_support.messages m WHERE m.id = x.message_id
              AND m.visibility = 'public' AND m.direction <> 'internal' AND m.withdrawn_at IS NULL));
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'not_found: file' USING ERRCODE = 'P0002';
    END;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found: file' USING ERRCODE = 'P0002'; END IF;
    RETURN jsonb_build_object('bucket', a.storage_bucket, 'path', a.storage_path, 'file_name', a.file_name);
  END IF;

  IF p_op NOT IN ('reply','action') THEN
    RAISE EXCEPTION 'invalid: unknown operation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO req FROM bloom_support.principals WHERE id = t.requester_id;
  IF req.id IS NULL OR req.role <> 'client' OR NOT req.active OR t.spam OR t.redacted_at IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden: replies to this request go through email' USING ERRCODE = '42501';
  END IF;
  IF t.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'invalid: this request continues in another request' USING ERRCODE = '22023';
  END IF;
  IF NOT bloom_support.consume_usage('track-write:' || v_hour, p_hash, 10)
    OR NOT bloom_support.consume_usage('track-write-ip:' || v_hour, v_ip, 30) THEN
    RAISE EXCEPTION 'rate_limited: too many messages, please wait a little or reply by email' USING ERRCODE = '54000';
  END IF;

  IF p_op = 'reply' THEN
    v_body := btrim(coalesce(p->>'body', ''));
    v_key := coalesce(p->>'idempotency_key', '');
    IF length(v_body) < 2 OR length(v_body) > 5000 THEN
      RAISE EXCEPTION 'invalid: a message must be 2 to 5000 characters' USING ERRCODE = '22023';
    END IF;
    IF v_key !~ '^[A-Za-z0-9_-]{8,80}$' THEN
      RAISE EXCEPTION 'invalid: idempotency key' USING ERRCODE = '22023';
    END IF;
    IF t.status = 'resolved' THEN
      RAISE EXCEPTION 'invalid: this request is resolved; use "still not fixed" to reopen it' USING ERRCODE = '22023';
    END IF;
    v_result := bloom_support.add_message(req.id, t.id, jsonb_build_object(
      'body', v_body, 'visibility', 'public', 'idempotency_key', 'track:' || left(p_hash, 32) || ':' || v_key));
    IF NOT coalesce((v_result->>'duplicate')::boolean, false) THEN
      PERFORM bloom_support.log(t.id, t.account_id, req.id, 'client.track_reply', jsonb_build_object('message_id', v_result->>'message_id'));
    END IF;
    RETURN v_result || jsonb_build_object('ticket_id', t.id, 'actor', req.id);
  END IF;

  v_action := p->>'action';
  IF v_action NOT IN ('confirm_resolved','still_broken') THEN
    RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023';
  END IF;
  IF t.status <> 'resolved' THEN
    RAISE EXCEPTION 'invalid: this request is not resolved yet' USING ERRCODE = '22023';
  END IF;
  v_body := left(btrim(coalesce(p->>'message', '')), 5000);
  RETURN bloom_support.client_action(req.id, t.id, v_action, v_body);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_track(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_track(text, text, jsonb) TO service_role;
