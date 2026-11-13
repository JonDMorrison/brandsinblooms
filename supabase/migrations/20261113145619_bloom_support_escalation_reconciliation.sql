-- Re-check the deadline before repeating an escalation. No ticket is resolved here.
CREATE OR REPLACE FUNCTION bloom_support.sweep_deadlines()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x record; t record; reminder_key text; new_level integer; reconciled int := 0; moved int := 0; overdue int := 0; fb numeric := coalesce((bloom_support.setting('sla')->>'fallback_hours')::numeric, 4);
  jon uuid := bloom_support.owner_principal('jon'); jeff uuid := bloom_support.owner_principal('jeff'); next_owner uuid;
BEGIN
  -- Reconcile only machine-generated deadline escalations. A reply does not
  -- close customer work, engineering blockers, or human decisions.
  FOR x IN SELECT e.* FROM bloom_support.escalations e
    JOIN bloom_support.tickets ticket_row ON ticket_row.id = e.ticket_id
    WHERE e.status IN ('open','acknowledged') AND e.reason = 'ticket_overdue'
      AND (ticket_row.status = 'resolved' OR ticket_row.spam OR ticket_row.merged_into IS NOT NULL
        OR ticket_row.due_at IS NULL OR ticket_row.due_at >= now()
        OR coalesce(ticket_row.waiting_reason, '') IN ('customer','third_party','scheduled'))
    FOR UPDATE OF e, ticket_row SKIP LOCKED LOOP
    UPDATE bloom_support.escalations SET status = 'resolved', resolved_at = now(),
      decision = 'The ticket deadline no longer applies. Customer work remains in its current state.'
      WHERE id = x.id;
    UPDATE bloom_support.jobs SET status = 'cancelled', updated_at = now()
      WHERE status = 'queued' AND kind = 'escalate' AND payload->>'escalation_id' = x.id::text;
    PERFORM bloom_support.log(x.ticket_id, NULL, NULL, 'escalation.deadline_reconciled',
      jsonb_build_object('escalation_id', x.id));
    reconciled := reconciled + 1;
  END LOOP;
  FOR x IN SELECT * FROM bloom_support.escalations WHERE status = 'open' AND due_at < now() ORDER BY due_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    -- The first two misses retain the existing fallback. After both owners
    -- have been alerted, keep one daily reminder rather than an endless
    -- four-hour escalation ladder. The escalation remains open and actionable.
    new_level := CASE WHEN x.reason = 'ticket_overdue' THEN least(x.fallback_level + 1, 2) ELSE x.fallback_level + 1 END;
    reminder_key := CASE WHEN x.reason <> 'ticket_overdue' OR x.fallback_level < 2 THEN 'fallback:' || new_level
      ELSE 'reminder:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') END;
    next_owner := CASE WHEN x.owner_id = jon THEN coalesce(jeff, jon) WHEN x.owner_id = jeff THEN coalesce(jon, jeff) ELSE coalesce(jon, jeff) END;
    UPDATE bloom_support.escalations SET fallback_level = new_level, audience = 'both', owner_id = next_owner,
      due_at = now() + CASE WHEN x.reason = 'ticket_overdue' AND new_level >= 2 THEN interval '24 hours' ELSE make_interval(secs => (fb * 3600)::int) END WHERE id = x.id;
    PERFORM bloom_support.notify_staff(x.ticket_id, 'escalation.overdue', 'Still needs attention: ' || left(x.reason, 80), 'both');
    PERFORM bloom_support.enqueue_job('escalate', x.ticket_id, NULL, 'email:escalation', jsonb_build_object('escalation_id', x.id), 'escalate:' || x.id::text || ':' || reminder_key);
    IF new_level >= 2 THEN
      INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES ('escalation_unanswered', jsonb_build_object('escalation_id', x.id, 'reason', x.reason), 'esc:' || x.id::text || ':' || reminder_key)
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    PERFORM bloom_support.log(x.ticket_id, NULL, NULL, 'escalation.fallback', jsonb_build_object('escalation_id', x.id, 'level', new_level, 'owner', next_owner));
    moved := moved + 1;
  END LOOP;
  FOR t IN SELECT id, number, subject, due_at FROM bloom_support.tickets WHERE status <> 'resolved' AND due_at < now() AND NOT spam AND merged_into IS NULL
             AND coalesce(waiting_reason, '') NOT IN ('customer','third_party','scheduled')
             AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e WHERE e.ticket_id = tickets.id AND e.reason = 'ticket_overdue' AND e.status IN ('open','acknowledged')) LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    -- Another sweep may have committed after this SELECT's snapshot but
    -- before we acquired the ticket lock. Recheck with a fresh snapshot.
    IF EXISTS (SELECT 1 FROM bloom_support.escalations e WHERE e.ticket_id=t.id
      AND e.reason='ticket_overdue' AND e.status IN ('open','acknowledged')) THEN CONTINUE; END IF;
    INSERT INTO bloom_support.escalations(ticket_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, 'both', 'ticket_overdue', '#' || t.number || ' ' || t.subject, 'overdue:' || t.id::text || ':' || extract(epoch FROM t.due_at)::text || ':episode:' || (SELECT count(*) FROM bloom_support.escalations prior WHERE prior.ticket_id=t.id AND prior.reason='ticket_overdue')::text) ON CONFLICT (dedupe_key) DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    PERFORM bloom_support.notify_staff(t.id, 'ticket.overdue', 'Overdue #' || t.number || ': ' || left(t.subject, 80), 'both');
    overdue := overdue + 1;
  END LOOP;
  RETURN jsonb_build_object('escalations_moved', moved, 'tickets_overdue', overdue, 'escalations_reconciled', reconciled);
END $$;


-- Operator-only evidence import for a reply already sent outside Support.
-- This records a response, never sends mail, closes work, or resumes automation.
-- Deliberately private: no new public RPC or client permissions are granted.
CREATE OR REPLACE FUNCTION bloom_support.record_external_response(
  p_actor uuid, p_ticket uuid, p_responded_at timestamptz, p_source_ref text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; prior jsonb;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF bloom_support.principal_role(p_actor) NOT IN ('platform_admin','platform_operator') THEN
    RAISE EXCEPTION 'forbidden: verified operator response evidence required' USING ERRCODE = '42501';
  END IF;
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  IF p_responded_at IS NULL OR p_responded_at < t.created_at OR p_responded_at > now()
    OR length(btrim(coalesce(p_source_ref,''))) NOT BETWEEN 8 AND 2000 THEN
    RAISE EXCEPTION 'invalid: sent time and source reference required' USING ERRCODE = '22023';
  END IF;
  SELECT detail INTO prior FROM bloom_support.activity
    WHERE ticket_id = p_ticket AND action = 'response.external_verified'
      AND detail->>'source_ref' = p_source_ref LIMIT 1;
  IF FOUND THEN
    IF (prior->>'responded_at')::timestamptz IS DISTINCT FROM p_responded_at THEN
      RAISE EXCEPTION 'conflict: response evidence changed' USING ERRCODE = '40001';
    END IF;
    RETURN jsonb_build_object('recorded', true, 'duplicate', true);
  END IF;
  UPDATE bloom_support.tickets SET
    first_response_at = least(first_response_at, p_responded_at),
    last_team_message_at = greatest(last_team_message_at, p_responded_at),
    version = version + 1, updated_at = now()
    WHERE id = p_ticket;
  PERFORM bloom_support.log(p_ticket, t.account_id, p_actor, 'response.external_verified',
    jsonb_build_object('responded_at', p_responded_at, 'source_ref', p_source_ref));
  RETURN jsonb_build_object('recorded', true, 'duplicate', false);
END $$;
REVOKE ALL ON FUNCTION bloom_support.record_external_response(uuid,uuid,timestamptz,text) FROM PUBLIC, anon, authenticated;
