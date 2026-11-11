-- A new client message must invalidate work based on the old ticket snapshot,
-- even when the ticket was already working (rather than waiting for a reply).
-- Existing update_ticket optimistic locking then rejects stale closure/decisions.
CREATE OR REPLACE FUNCTION bloom_support.bump_client_evidence_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, bloom_support
AS $$
BEGIN
  IF NEW.author_kind = 'client' AND NEW.ticket_id IS NOT NULL THEN
    WITH RECURSIVE targets(id, merged_into) AS (
      SELECT id, merged_into FROM bloom_support.tickets WHERE id = NEW.ticket_id
      UNION
      SELECT parent.id, parent.merged_into FROM bloom_support.tickets parent
      JOIN targets child ON parent.id = child.merged_into
    )
    UPDATE bloom_support.tickets
    SET version = version + 1, updated_at = now()
    WHERE id IN (SELECT id FROM targets);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloom_support.bump_client_evidence_version() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_client_evidence_version ON bloom_support.messages;
CREATE TRIGGER bloom_support_client_evidence_version
AFTER INSERT ON bloom_support.messages
FOR EACH ROW EXECUTE FUNCTION bloom_support.bump_client_evidence_version();

-- A bounded staff timeline is useful for prompts, not authoritative closure.
-- Check the unbounded underlying evidence inside the ticket update transaction.
CREATE OR REPLACE FUNCTION bloom_support.require_fresh_client_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, bloom_support
AS $$
DECLARE latest_client timestamptz; started timestamptz;
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved'
     AND NEW.resolution_verified
     AND NEW.resolution_evidence->>'resolved_by' = 'bloom'
     AND (NEW.engineering_issue_id IS NOT NULL
       OR NEW.resolution_evidence->>'engineering_issue_id' IS NOT NULL) THEN
    WITH RECURSIVE sources(id, created_at) AS (
      SELECT id, created_at FROM bloom_support.tickets WHERE id = NEW.id
      UNION
      SELECT source.id, source.created_at FROM bloom_support.tickets source
      JOIN sources target ON source.merged_into = target.id
    )
    -- Staff/system-filed requests may have no client messages. Their durable
    -- creation time is still authoritative evidence; an absent timeline is not.
    SELECT greatest(max(m.created_at), max(s.created_at)) INTO latest_client
    FROM sources s LEFT JOIN bloom_support.messages m
      ON m.ticket_id = s.id AND m.author_kind = 'client';
    BEGIN
      started := (NEW.resolution_evidence #>> '{verification,started_at}')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      started := NULL;
    END;
    IF started IS NULL OR latest_client IS NULL OR started < latest_client THEN
      RAISE EXCEPTION 'blocked: current client evidence requires fresh verification' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloom_support.require_fresh_client_verification() FROM PUBLIC;
DROP TRIGGER IF EXISTS bloom_support_fresh_client_verification ON bloom_support.tickets;
CREATE TRIGGER bloom_support_fresh_client_verification
BEFORE UPDATE ON bloom_support.tickets
FOR EACH ROW EXECUTE FUNCTION bloom_support.require_fresh_client_verification();

-- Keep the staff/client projection and existing permissions unchanged; include
-- every explicitly merged same-account source in both messages and source IDs.
CREATE OR REPLACE FUNCTION bloom_support.ticket_json(p_actor uuid, t bloom_support.tickets, p_full boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff boolean := bloom_support.has_permission(p_actor, 'tickets.read_all'); base jsonb; merged uuid[];
BEGIN
  base := jsonb_build_object(
    'id', t.id, 'number', t.number, 'subject', t.subject,
    'status', CASE WHEN staff THEN t.status ELSE bloom_support.client_status(t) END, 'product', t.product, 'kind', t.kind,
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
  merged := ARRAY(
    WITH RECURSIVE sources(id) AS (
      SELECT source.id FROM bloom_support.tickets source
      WHERE source.merged_into = t.id AND source.account_id IS NOT DISTINCT FROM t.account_id
      UNION
      SELECT source.id FROM bloom_support.tickets source JOIN sources parent ON source.merged_into = parent.id
      WHERE source.account_id IS NOT DISTINCT FROM t.account_id
    ) SELECT id FROM sources WHERE id <> t.id
  );
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
    'conversation_tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject,
                      'status', CASE WHEN staff THEN o.status ELSE bloom_support.client_status(o) END) ORDER BY o.number), '[]')
                    FROM bloom_support.tickets o WHERE o.conversation_id = t.conversation_id AND o.id <> t.id AND o.merged_into IS NULL AND (staff OR bloom_support.can_read_ticket(p_actor, o.id))));
  IF staff THEN
    base := base || jsonb_build_object(
      'context', t.context, 'resolution_evidence', t.resolution_evidence, 'timers', bloom_support.ticket_timers(t.id),
      'merged_tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'subject', o.subject)), '[]') FROM bloom_support.tickets o WHERE o.id = ANY(merged)),
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
