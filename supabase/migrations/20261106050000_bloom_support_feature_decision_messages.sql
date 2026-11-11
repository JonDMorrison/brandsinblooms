-- Preserve feature decisions as their own customer lifecycle event. They are
-- substantive responses: reporting and SLA timestamps must not treat a client
-- as unanswered after Bloom has delivered the product team's decision.

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
