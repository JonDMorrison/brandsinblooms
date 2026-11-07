-- The analytical audience worker is the only caller of these primitives. They need
-- to inspect auth.users to reject banned owners, which service_role cannot SELECT
-- directly. Run the complete authorization checks as the function owner instead of
-- granting broad read access to Auth. Execution remains service-role only.
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SECURITY DEFINER;
ALTER FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 SET search_path = '';
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SECURITY DEFINER;
ALTER FUNCTION public.claim_bloom_audience_refresh(uuid)
 SET search_path = '';
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SECURITY DEFINER;
ALTER FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 SET search_path = '';

REVOKE ALL ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])
 TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_bloom_audience_refresh(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)
 TO service_role;

COMMENT ON FUNCTION public.claim_bloom_audience_refresh(uuid) IS
 'Service-only worker claim. SECURITY DEFINER is required solely for the banned-owner check in auth.users.';

-- Resend can emit terminal failed/suppressed events after accepting an email.
-- Preserve the strongest outcome when events arrive out of order, mirror the
-- status to every coalesced message, and raise one durable staff notification.
CREATE OR REPLACE FUNCTION bloom_support.record_delivery_event(
  p_provider_id text,
  p_type text,
  p_detail jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o bloom_support.outbound_emails;
  event_status text := CASE p_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.bounced' THEN 'bounced'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.suppressed' THEN 'suppressed'
    WHEN 'email.failed' THEN 'failed'
    WHEN 'email.sent' THEN 'sent'
    ELSE NULL
  END;
  next_status text;
  message_delivery text;
  previous_status text;
BEGIN
  SELECT *
    INTO o
    FROM bloom_support.outbound_emails
   WHERE provider_id = p_provider_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  previous_status := o.status;
  -- Complaint/bounce can follow delivery. Delivery must not be undone by a
  -- late failure, and terminal provider failure must not be undone by sent.
  next_status := CASE
    WHEN o.status = 'complained' OR event_status = 'complained' THEN 'complained'
    WHEN o.status = 'bounced' OR event_status = 'bounced' THEN 'bounced'
    WHEN o.status = 'delivered' OR event_status = 'delivered' THEN 'delivered'
    WHEN o.status = 'suppressed' OR event_status = 'suppressed' THEN 'suppressed'
    WHEN o.status = 'failed' OR event_status = 'failed' THEN 'failed'
    WHEN event_status = 'sent'
      AND o.status IN ('queued', 'not_configured', 'uncertain') THEN 'sent'
    ELSE o.status
  END;

  UPDATE bloom_support.outbound_emails
     SET provider_events = provider_events || jsonb_build_array(
           jsonb_build_object('type', p_type, 'at', now())
         ),
         status = next_status
   WHERE id = o.id
   RETURNING * INTO o;

  message_delivery := CASE o.status
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'failed' THEN 'failed'
    WHEN 'suppressed' THEN 'suppressed'
    WHEN 'bounced' THEN 'bounced'
    WHEN 'complained' THEN 'complained'
    ELSE NULL
  END;

  IF message_delivery IS NOT NULL THEN
    UPDATE bloom_support.messages
       SET delivery = message_delivery
     WHERE id = o.message_id
        OR id = ANY(coalesce(o.covered_message_ids, '{}'));
  END IF;

  IF p_type = 'email.delivery_delayed'
     AND o.status NOT IN ('delivered', 'failed', 'suppressed', 'bounced', 'complained') THEN
    PERFORM bloom_support.log(
      o.ticket_id,
      NULL,
      NULL,
      'email.delivery_delayed',
      jsonb_build_object('to', o.to_email, 'purpose', o.purpose, 'provider_id', p_provider_id)
    );
    PERFORM bloom_support.notify_once(
      o.ticket_id,
      'email.delivery_delayed',
      'Email delivery delayed for ' || o.to_email,
      'both',
      'email-delivery-delayed:' || o.id::text
    );
  ELSIF event_status IN ('failed', 'suppressed', 'bounced', 'complained')
        AND o.status IS DISTINCT FROM previous_status
        AND o.ticket_id IS NOT NULL THEN
    PERFORM bloom_support.log(
      o.ticket_id,
      NULL,
      NULL,
      'email.' || o.status,
      jsonb_build_object('to', o.to_email, 'purpose', o.purpose)
    );
    PERFORM bloom_support.notify_once(
      o.ticket_id,
      'email.' || o.status,
      'Email ' || o.status || ' for ' || o.to_email,
      'both',
      'email-' || o.status || ':' || o.id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', true,
    'event', p_type,
    'status', o.status,
    'delivery_delayed', p_type = 'email.delivery_delayed'
  );
END $$;

REVOKE ALL ON FUNCTION bloom_support.record_delivery_event(text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.record_delivery_event(text, text, jsonb)
  TO service_role;

-- A client reply to a person-owned conversation must never disappear into an
-- already-open ticket. Move it to Needs You, notify the accountable owner, and
-- clear that state only after a person actually replies.
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
  IF v_purpose NOT IN ('reply','clarification','resolution','acknowledgement','progress','feature_decision','notification') THEN v_purpose := 'reply'; END IF;
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
          v_vis = 'public' AND v_kind IN ('staff','bloom') AND v_purpose IN ('reply','clarification','resolution','feature_decision'),
          v_notify_client)
  RETURNING * INTO m;

  IF v_kind = 'staff' AND v_vis = 'public' THEN
    IF t.automation = 'auto' OR t.executor = 'bloom' THEN
      UPDATE bloom_support.tickets SET automation = 'human', executor = 'person', executor_id = p_actor, taken_over_by = p_actor, taken_over_at = now(),
        owner_id = coalesce(owner_id, p_actor), version = version + 1, updated_at = now() WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'automation.taken_over', '{"via":"public_reply"}');
    END IF;
    IF t.pending_review = 'client_reply_human' THEN
      UPDATE bloom_support.tickets
         SET status = 'working', stage = 'answering', pending_review = NULL,
             next_action = NULL, next_action_due_at = NULL,
             version = version + 1, updated_at = now()
       WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.client_reply_answered', jsonb_build_object('message_id', m.id));
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
    ELSIF t.automation = 'auto' AND t.executor = 'bloom' THEN
      IF t.status = 'waiting' AND t.waiting_reason = 'customer' THEN
        UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', waiting_reason = NULL, waiting_since = NULL,
          version = version + 1, updated_at = now() WHERE id = t.id;
      ELSE
        UPDATE bloom_support.tickets SET updated_at = now() WHERE id = t.id;
      END IF;
      PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('reason','client_reply','message_id', m.id), 'triage:' || m.id::text);
    ELSE
      UPDATE bloom_support.tickets
         SET status = 'needs_owner', stage = 'escalated', pending_review = 'client_reply_human',
             waiting_reason = NULL, waiting_since = NULL,
             next_action = 'Reply to the client', next_action_due_at = now(),
             version = version + 1, updated_at = now()
       WHERE id = t.id;
      PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.client_reply_needs_owner', jsonb_build_object('message_id', m.id));
      PERFORM bloom_support.notify_once(
        t.id,
        'ticket.client_reply_needs_owner',
        'Client replied on #' || t.number || ': ' || left(t.subject, 70),
        'both',
        'client-reply-needs-owner:' || m.id::text
      );
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

REVOKE ALL ON FUNCTION bloom_support.add_message(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.add_message(uuid, uuid, jsonb)
  TO service_role;

-- Rapid engineering transitions are one client story, not a burst of stale
-- emails. Supersede work the provider has not accepted; the worker also checks
-- the issue's live status before it writes a message.
CREATE OR REPLACE FUNCTION bloom_support.queue_engineering_progress_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ticket record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN (
       'investigating',
       'reproduced',
       'not_reproduced',
       'in_review',
       'deploying',
       'verifying',
       'failed',
       'rolled_back',
       'escalated'
     ) THEN
    RETURN NEW;
  END IF;

  FOR ticket IN
    SELECT id, account_id
    FROM bloom_support.tickets
    WHERE engineering_issue_id = NEW.id
      AND status <> 'resolved'
      AND merged_into IS NULL
  LOOP
    UPDATE bloom_support.messages m
       SET delivery = 'suppressed', withdrawn_at = coalesce(withdrawn_at, now())
     WHERE m.delivery IN ('queued', 'failed')
       AND EXISTS (
         SELECT 1
         FROM bloom_support.jobs old_progress
         WHERE old_progress.ticket_id = ticket.id
           AND old_progress.engineering_issue_id = NEW.id
           AND old_progress.kind = 'answer'
           AND old_progress.payload->>'mode' = 'engineering_progress'
           AND old_progress.payload->>'status' IS DISTINCT FROM NEW.status
           AND m.idempotency_key = 'engineering-progress:' || old_progress.id::text
       );

    UPDATE bloom_support.jobs email_job
       SET status = 'cancelled', last_error = 'superseded by newer engineering progress', updated_at = now()
     WHERE email_job.kind = 'send_email'
       AND email_job.status = 'queued'
       AND EXISTS (
         SELECT 1
         FROM bloom_support.messages m
         JOIN bloom_support.jobs old_progress
           ON m.idempotency_key = 'engineering-progress:' || old_progress.id::text
         WHERE old_progress.ticket_id = ticket.id
           AND old_progress.engineering_issue_id = NEW.id
           AND old_progress.kind = 'answer'
           AND old_progress.payload->>'mode' = 'engineering_progress'
           AND old_progress.payload->>'status' IS DISTINCT FROM NEW.status
           AND m.id::text = email_job.payload->>'message_id'
       );

    UPDATE bloom_support.outbound_emails outbound
       SET status = 'suppressed', error = 'superseded by newer engineering progress'
     WHERE outbound.ticket_id = ticket.id
       AND outbound.provider_id IS NULL
       AND outbound.status IN ('queued', 'failed', 'not_configured')
       AND EXISTS (
         SELECT 1
         FROM bloom_support.messages m
         JOIN bloom_support.jobs old_progress
           ON m.idempotency_key = 'engineering-progress:' || old_progress.id::text
         WHERE old_progress.ticket_id = ticket.id
           AND old_progress.engineering_issue_id = NEW.id
           AND old_progress.kind = 'answer'
           AND old_progress.payload->>'mode' = 'engineering_progress'
           AND old_progress.payload->>'status' IS DISTINCT FROM NEW.status
           AND m.id = outbound.message_id
       );

    UPDATE bloom_support.jobs old_progress
       SET status = 'cancelled', last_error = 'superseded by newer engineering progress', updated_at = now()
     WHERE old_progress.ticket_id = ticket.id
       AND old_progress.engineering_issue_id = NEW.id
       AND old_progress.kind = 'answer'
       AND old_progress.status = 'queued'
       AND old_progress.payload->>'mode' = 'engineering_progress'
       AND old_progress.payload->>'status' IS DISTINCT FROM NEW.status;

    PERFORM bloom_support.enqueue_job(
      'answer',
      ticket.id,
      NEW.id,
      'account:' || coalesce(ticket.account_id::text, 'none:' || ticket.id::text),
      jsonb_build_object('mode', 'engineering_progress', 'status', NEW.status),
      'engineering-progress:' || NEW.id::text || ':' || ticket.id::text || ':' || NEW.status || ':' || NEW.version::text
    );
  END LOOP;

  RETURN NEW;
END
$$;

-- Signed product clients can continue an existing request without creating a
-- duplicate ticket. The product identity, its verified account, the ticket's
-- product/account, and the exact request receipt are all checked atomically.
CREATE TABLE IF NOT EXISTS bloom_support.product_client_action_receipts (
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('still_needs_help', 'confirm_resolved')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (principal_id, idempotency_key)
);
ALTER TABLE bloom_support.product_client_action_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.product_client_action_receipts
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bloom_support.product_client_action(
  p_actor uuid,
  p_product text,
  p_account uuid,
  p_ticket_number bigint,
  p_action text,
  p_message text,
  p_idempotency_key text,
  p_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor bloom_support.principals;
  ticket bloom_support.tickets;
  receipt bloom_support.product_client_action_receipts;
  action_result jsonb;
  outcome jsonb;
BEGIN
  SELECT * INTO actor
  FROM bloom_support.principals
  WHERE id = p_actor
    AND active;
  IF actor.id IS NULL
     OR actor.kind <> 'external_user'
     OR actor.role <> 'client'
     OR actor.product IS DISTINCT FROM p_product
     OR p_product NOT IN ('cms', 'pos') THEN
    RAISE EXCEPTION 'forbidden: product identity' USING ERRCODE = '42501';
  END IF;
  IF p_account IS NULL OR NOT EXISTS (
    SELECT 1
    FROM bloom_support.account_members member
    WHERE member.account_id = p_account
      AND member.principal_id = p_actor
      AND member.verified
  ) THEN
    RAISE EXCEPTION 'forbidden: product account' USING ERRCODE = '42501';
  END IF;
  IF p_ticket_number IS NULL OR p_ticket_number < 1 THEN
    RAISE EXCEPTION 'invalid: ticket number' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('still_needs_help', 'confirm_resolved') THEN
    RAISE EXCEPTION 'invalid: client action' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_message), '') = '' OR length(p_message) > 20000 THEN
    RAISE EXCEPTION 'invalid: follow-up message required' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$'
     OR p_fingerprint IS NULL
     OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid: follow-up idempotency receipt' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO ticket
  FROM bloom_support.tickets
  WHERE number = p_ticket_number
    AND product = p_product
    AND account_id = p_account
    AND merged_into IS NULL
    AND NOT spam
  FOR UPDATE;
  IF ticket.id IS NULL THEN
    -- Do not reveal whether another account's ticket number exists.
    RAISE EXCEPTION 'not_found: ticket' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO bloom_support.product_client_action_receipts(
    principal_id, idempotency_key, fingerprint, ticket_id, action
  )
  VALUES (
    p_actor, p_idempotency_key, p_fingerprint, ticket.id, p_action
  )
  ON CONFLICT (principal_id, idempotency_key) DO NOTHING
  RETURNING * INTO receipt;

  IF receipt.principal_id IS NULL THEN
    SELECT * INTO receipt
    FROM bloom_support.product_client_action_receipts
    WHERE principal_id = p_actor
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF receipt.fingerprint IS DISTINCT FROM p_fingerprint
       OR receipt.ticket_id IS DISTINCT FROM ticket.id
       OR receipt.action IS DISTINCT FROM p_action THEN
      RAISE EXCEPTION 'conflict: idempotency key reused with a different follow-up'
        USING ERRCODE = '23505';
    END IF;
    IF receipt.result IS NULL OR receipt.completed_at IS NULL THEN
      RAISE EXCEPTION 'conflict: incomplete product follow-up receipt'
        USING ERRCODE = '40001';
    END IF;
    RETURN receipt.result || '{"duplicate_delivery":true}'::jsonb;
  END IF;

  -- Add the customer's own words through the normal message function so a
  -- human-owned active ticket becomes Needs You and gets the correct alert.
  PERFORM bloom_support.add_message(
    p_actor,
    ticket.id,
    jsonb_build_object(
      'body', left(p_message, 20000),
      'visibility', 'public',
      'purpose', 'product_follow_up',
      'idempotency_key', 'product-follow-up:' || p_actor::text || ':' || p_idempotency_key,
      'notify_client', false
    )
  );
  action_result := bloom_support.client_action(
    p_actor,
    ticket.id,
    CASE p_action WHEN 'still_needs_help' THEN 'still_broken' ELSE 'confirm_resolved' END,
    NULL
  );
  outcome := jsonb_build_object(
    'received', true,
    'duplicate_delivery', false,
    'ticket_id', ticket.id,
    'number', ticket.number,
    'conversation_id', ticket.conversation_id,
    'client_action', p_action,
    'action_result', action_result
  );
  UPDATE bloom_support.product_client_action_receipts
     SET result = outcome, completed_at = now()
   WHERE principal_id = p_actor
     AND idempotency_key = p_idempotency_key;
  RETURN outcome;
END
$$;

REVOKE ALL ON FUNCTION bloom_support.product_client_action(uuid, text, uuid, bigint, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bloom_support_product_client_action(
  p_actor uuid,
  p_product text,
  p_account uuid,
  p_ticket_number bigint,
  p_action text,
  p_message text,
  p_idempotency_key text,
  p_fingerprint text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT bloom_support.product_client_action(
    p_actor,
    p_product,
    p_account,
    p_ticket_number,
    p_action,
    p_message,
    p_idempotency_key,
    p_fingerprint
  )
$$;

REVOKE ALL ON FUNCTION public.bloom_support_product_client_action(uuid, text, uuid, bigint, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_product_client_action(uuid, text, uuid, bigint, text, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION bloom_support.queue_engineering_progress_email()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.queue_engineering_progress_email()
  TO service_role;

-- A person may authenticate with more than one verified CRM identity. Keep
-- authorization on one principal so an email alias cannot accidentally create
-- a second, client-only identity or acquire a role through an email/domain rule.
CREATE TABLE IF NOT EXISTS bloom_support.principal_auth_identities (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS principal_auth_identities_principal
  ON bloom_support.principal_auth_identities(principal_id);
ALTER TABLE bloom_support.principal_auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.principal_auth_identities
  FROM PUBLIC, anon, authenticated;

INSERT INTO bloom_support.principal_auth_identities(auth_user_id, principal_id, email)
SELECT auth_user_id, id, lower(email)
FROM bloom_support.principals
WHERE auth_user_id IS NOT NULL
ON CONFLICT (auth_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION bloom_support.resolve_crm_user(
  p_auth_user uuid,
  p_email text,
  p_name text,
  p_tenant uuid,
  p_tenant_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pid uuid;
  acct uuid;
  matched_alias boolean := false;
BEGIN
  IF p_auth_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT identity.principal_id
    INTO pid
  FROM bloom_support.principal_auth_identities identity
  JOIN bloom_support.principals principal
    ON principal.id = identity.principal_id
   AND principal.active
  WHERE identity.auth_user_id = p_auth_user;
  matched_alias := FOUND;

  IF pid IS NULL THEN
    SELECT id INTO pid
    FROM bloom_support.principals
    WHERE auth_user_id = p_auth_user
      AND active;
  END IF;

  IF pid IS NULL THEN
    INSERT INTO bloom_support.principals(kind, auth_user_id, product, email, display_name, role)
    VALUES ('user', p_auth_user, 'crm', lower(p_email), p_name, 'client')
    RETURNING id INTO pid;
  ELSIF matched_alias THEN
    -- An alias may refresh the person's name, but never replaces the canonical
    -- address or role. Those remain explicit principal administration choices.
    UPDATE bloom_support.principals
       SET display_name = coalesce(p_name, display_name), updated_at = now()
     WHERE id = pid;
  ELSE
    UPDATE bloom_support.principals
       SET email = coalesce(lower(p_email), email),
           display_name = coalesce(p_name, display_name),
           updated_at = now()
     WHERE id = pid;
  END IF;

  INSERT INTO bloom_support.principal_auth_identities(
    auth_user_id, principal_id, email, last_seen_at
  )
  VALUES (p_auth_user, pid, lower(p_email), now())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET email = EXCLUDED.email,
        last_seen_at = EXCLUDED.last_seen_at
  WHERE bloom_support.principal_auth_identities.principal_id = EXCLUDED.principal_id;

  IF p_tenant IS NOT NULL THEN
    SELECT id INTO acct
    FROM bloom_support.accounts
    WHERE crm_tenant_id = p_tenant;
    IF acct IS NULL THEN
      INSERT INTO bloom_support.accounts(name, crm_tenant_id)
      VALUES (
        coalesce(nullif(btrim(p_tenant_name), ''), 'CRM tenant ' || left(p_tenant::text, 8)),
        p_tenant
      )
      ON CONFLICT (crm_tenant_id) DO NOTHING
      RETURNING id INTO acct;
      IF acct IS NULL THEN
        SELECT id INTO acct
        FROM bloom_support.accounts
        WHERE crm_tenant_id = p_tenant;
      END IF;
      INSERT INTO bloom_support.account_links(account_id, product, external_id, label)
      VALUES (acct, 'crm', p_tenant::text, p_tenant_name)
      ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO bloom_support.account_members(account_id, principal_id, relationship, verified)
    VALUES (acct, pid, 'member', true)
    ON CONFLICT (account_id, principal_id) DO UPDATE SET verified = true;
  END IF;

  UPDATE bloom_support.account_members member
     SET verified = false
   WHERE member.principal_id = pid
     AND member.verified
     AND member.account_id IS DISTINCT FROM acct
     AND EXISTS (
       SELECT 1
       FROM bloom_support.accounts account
       WHERE account.id = member.account_id
         AND account.crm_tenant_id IS NOT NULL
     );
  RETURN pid;
END
$$;

REVOKE ALL ON FUNCTION bloom_support.resolve_crm_user(uuid, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.resolve_crm_user(uuid, text, text, uuid, text)
  TO service_role;

-- Jon's support/admin identity predates the Brands in Blooms CRM login. Link
-- that exact verified auth.users row to the existing administrator principal.
-- This intentionally is not a domain-wide staff rule.
DO $$
DECLARE
  canonical_principal uuid;
  alias_auth_user uuid;
  duplicate_principal uuid;
  duplicate_role text;
BEGIN
  SELECT id INTO canonical_principal
  FROM bloom_support.principals
  WHERE lower(email) = 'jon@getclear.ca'
    AND role = 'platform_admin'
    AND active
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO alias_auth_user
  FROM auth.users
  WHERE lower(email) = 'jon@brandsinblooms.com'
  ORDER BY created_at
  LIMIT 1;

  IF canonical_principal IS NULL OR alias_auth_user IS NULL THEN
    RETURN;
  END IF;

  SELECT id, role
    INTO duplicate_principal, duplicate_role
  FROM bloom_support.principals
  WHERE auth_user_id = alias_auth_user
    AND id <> canonical_principal
  LIMIT 1;

  IF duplicate_principal IS NOT NULL AND duplicate_role <> 'client' THEN
    RAISE EXCEPTION 'refusing to merge a staff principal into the Jon auth alias';
  END IF;

  INSERT INTO bloom_support.principal_auth_identities(auth_user_id, principal_id, email)
  VALUES (alias_auth_user, canonical_principal, 'jon@brandsinblooms.com')
  ON CONFLICT (auth_user_id) DO UPDATE
    SET principal_id = EXCLUDED.principal_id,
        email = EXCLUDED.email,
        last_seen_at = now();

  IF duplicate_principal IS NOT NULL THEN
    INSERT INTO bloom_support.account_members(
      account_id, principal_id, relationship, verified, created_at
    )
    SELECT account_id, canonical_principal, relationship, verified, created_at
    FROM bloom_support.account_members
    WHERE principal_id = duplicate_principal
    ON CONFLICT (account_id, principal_id) DO UPDATE
      SET verified = bloom_support.account_members.verified OR EXCLUDED.verified;

    UPDATE bloom_support.conversations
       SET requester_id = canonical_principal
     WHERE requester_id = duplicate_principal;
    UPDATE bloom_support.tickets
       SET requester_id = canonical_principal
     WHERE requester_id = duplicate_principal;
    UPDATE bloom_support.messages
       SET author_id = canonical_principal
     WHERE author_id = duplicate_principal
       AND author_kind = 'client';
    UPDATE bloom_support.feature_shipment_subscriptions
       SET requester_id = canonical_principal
     WHERE requester_id = duplicate_principal;
    UPDATE bloom_support.notifications
       SET principal_id = canonical_principal
     WHERE principal_id = duplicate_principal;
    DELETE FROM bloom_support.account_members
     WHERE principal_id = duplicate_principal;
    UPDATE bloom_support.principals
       SET active = false, auth_user_id = NULL, updated_at = now()
     WHERE id = duplicate_principal
       AND role = 'client';
  END IF;

  PERFORM bloom_support.log(
    NULL,
    NULL,
    canonical_principal,
    'principal.auth_alias_linked',
    jsonb_build_object(
      'alias', 'jon@brandsinblooms.com',
      'retired_duplicate_principal', duplicate_principal
    )
  );
END
$$;
