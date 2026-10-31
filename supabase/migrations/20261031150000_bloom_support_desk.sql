-- Bloom Support — support desk: status rules, event history, timers on business
-- hours, response targets, shared problems/incidents, merging, saved views,
-- notifications and digests, reporting, retention, scoped pause controls.
-- Works without any AI: every rule here is deterministic.

-- ---------------------------------------------------------------------------
-- Tables and columns
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'problem' CHECK (kind IN ('problem','incident')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','monitoring','resolved')),
  product text NOT NULL DEFAULT 'unknown',
  summary text,
  engineering_issue_id uuid REFERENCES bloom_support.engineering_issues(id),
  created_by uuid REFERENCES bloom_support.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bloom_support.tickets ADD COLUMN problem_id uuid REFERENCES bloom_support.problems(id);
ALTER TABLE bloom_support.engineering_issues ADD COLUMN problem_id uuid REFERENCES bloom_support.problems(id);
CREATE INDEX tickets_problem ON bloom_support.tickets(problem_id);
CREATE INDEX tickets_owner_open ON bloom_support.tickets(owner_id, status) WHERE status <> 'resolved';
CREATE INDEX tickets_next_due ON bloom_support.tickets(next_action_due_at) WHERE status <> 'resolved';
CREATE INDEX tickets_merged ON bloom_support.tickets(merged_into) WHERE merged_into IS NOT NULL;
CREATE INDEX tickets_updated ON bloom_support.tickets(updated_at DESC, id DESC);
CREATE INDEX tickets_tags ON bloom_support.tickets USING gin(tags);

ALTER TABLE bloom_support.escalations ADD COLUMN recommendation text, ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bloom_support.notifications ADD COLUMN dedupe_key text UNIQUE, ADD COLUMN delivered_email_at timestamptz;

-- Every state change, for timers and historical reporting (never derived from current status).
CREATE TABLE bloom_support.ticket_events (
  id bigserial PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  kind text NOT NULL CHECK (kind IN ('created','status','owner','executor','priority','merged','spam','redacted')),
  from_value text,
  to_value text,
  actor_id uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket ON bloom_support.ticket_events(ticket_id, id);
CREATE INDEX ticket_events_at ON bloom_support.ticket_events(kind, at);
CREATE TRIGGER ticket_events_append_only BEFORE UPDATE OR DELETE ON bloom_support.ticket_events FOR EACH ROW EXECUTE FUNCTION bloom_support.reject_mutation();

CREATE TABLE bloom_support.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  filters jsonb NOT NULL,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (principal_id, name)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['problems','ticket_events','saved_views'] LOOP
    EXECUTE format('ALTER TABLE bloom_support.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON bloom_support.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

INSERT INTO bloom_support.settings(key, value) VALUES
  -- Internal targets, not customer promises. contractual=false until an SLA is agreed.
  ('business_hours', '{"enabled":true,"timezone":"America/Toronto","days":[1,2,3,4,5],"start":"09:00","end":"17:00","holidays":[]}'),
  ('timers', '{"pause_our_clock_for":["customer","third_party","scheduled"],"note":"internal and deployment waits keep our clock running"}'),
  ('notifications', '{"urgent_new":true,"unassigned_minutes":60,"response_warning_minutes":60,"next_action_overdue":true,"stalled":true,"email_staff":false}'),
  ('digest', '{"daily":{"enabled":false,"hour":8},"weekly":{"enabled":false,"isodow":1,"hour":8},"recipients":[]}'),
  ('closure', '{"auto_close_resolved_after_days":null,"close_on_client_confirm":true,"never_auto_resolve_waiting":true}'),
  ('retention', '{"redact_resolved_after_days":null,"keep_audit":true}'),
  ('automation_scopes', '{"triage":true,"answer":true,"email":true,"operations":true,"engineering":true}'),
  ('support', '{"default_owner_email":null}')
ON CONFLICT (key) DO NOTHING;
UPDATE bloom_support.settings SET value = value || '{"contractual":false,"first_response_business_hours":{"urgent":2,"high":8,"normal":16,"low":40},"due_soon_minutes":120,"stale_hours":72}'::jsonb
WHERE key = 'sla';

-- ---------------------------------------------------------------------------
-- Business time
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.business_seconds(p_from timestamptz, p_to timestamptz)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg jsonb := coalesce(bloom_support.setting('business_hours'), '{}'); tz text := coalesce(cfg->>'timezone', 'UTC');
  d date; ws timestamptz; we timestamptz; total bigint := 0; n int := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN RETURN 0; END IF;
  IF NOT coalesce((cfg->>'enabled')::boolean, false) THEN RETURN extract(epoch FROM p_to - p_from)::bigint; END IF;
  d := (p_from AT TIME ZONE tz)::date;
  WHILE d <= (p_to AT TIME ZONE tz)::date AND n < 800 LOOP
    IF extract(isodow FROM d)::int IN (SELECT jsonb_array_elements_text(coalesce(cfg->'days', '[1,2,3,4,5]'))::int)
       AND NOT (to_jsonb(d::text) <@ coalesce(cfg->'holidays', '[]')) THEN
      ws := (d + coalesce(cfg->>'start', '09:00')::time) AT TIME ZONE tz;
      we := (d + coalesce(cfg->>'end', '17:00')::time) AT TIME ZONE tz;
      total := total + greatest(0, extract(epoch FROM least(we, p_to) - greatest(ws, p_from)))::bigint;
    END IF;
    d := d + 1; n := n + 1;
  END LOOP;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.add_business_seconds(p_start timestamptz, p_seconds bigint)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg jsonb := coalesce(bloom_support.setting('business_hours'), '{}'); tz text := coalesce(cfg->>'timezone', 'UTC');
  d date; ws timestamptz; we timestamptz; left_s bigint := p_seconds; avail bigint; n int := 0;
BEGIN
  IF p_start IS NULL THEN RETURN NULL; END IF;
  IF NOT coalesce((cfg->>'enabled')::boolean, false) THEN RETURN p_start + make_interval(secs => p_seconds); END IF;
  d := (p_start AT TIME ZONE tz)::date;
  WHILE n < 800 LOOP
    IF extract(isodow FROM d)::int IN (SELECT jsonb_array_elements_text(coalesce(cfg->'days', '[1,2,3,4,5]'))::int)
       AND NOT (to_jsonb(d::text) <@ coalesce(cfg->'holidays', '[]')) THEN
      ws := greatest((d + coalesce(cfg->>'start', '09:00')::time) AT TIME ZONE tz, p_start);
      we := (d + coalesce(cfg->>'end', '17:00')::time) AT TIME ZONE tz;
      avail := greatest(0, extract(epoch FROM we - ws))::bigint;
      IF avail >= left_s THEN RETURN ws + make_interval(secs => left_s); END IF;
      left_s := left_s - avail;
    END IF;
    d := d + 1; n := n + 1;
  END LOOP;
  RETURN p_start + make_interval(secs => p_seconds);
END $$;

-- ---------------------------------------------------------------------------
-- Status rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.valid_transition(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_from = p_to OR (p_from, p_to) IN (
    ('new','working'),('new','waiting'),('new','needs_owner'),('new','resolved'),
    ('working','waiting'),('working','needs_owner'),('working','resolved'),
    ('waiting','working'),('waiting','needs_owner'),('waiting','resolved'),
    ('needs_owner','working'),('needs_owner','waiting'),('needs_owner','resolved'),
    ('resolved','working'))
$$;

CREATE OR REPLACE FUNCTION bloom_support.default_owner()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT p.id FROM bloom_support.principals p WHERE p.active AND p.kind = 'user' AND p.role <> 'client'
       AND lower(p.email) = lower(bloom_support.setting('support')->>'default_owner_email') LIMIT 1),
    bloom_support.owner_principal('jon'),
    (SELECT id FROM bloom_support.principals WHERE active AND role = 'platform_admin' ORDER BY created_at LIMIT 1))
$$;

-- Plain-language progress for clients (no internal states or jargon).
CREATE OR REPLACE FUNCTION bloom_support.client_progress(t bloom_support.tickets)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN t.merged_into IS NOT NULL THEN 'This request continues in another request from you.'
    WHEN t.status = 'new' THEN 'We have your request and will look at it shortly.'
    WHEN t.status = 'working' AND t.stage IN ('investigating','fixing','releasing','verifying') THEN 'We are fixing this and will confirm once it is working.'
    WHEN t.status = 'working' THEN 'We are working on this.'
    WHEN t.status = 'waiting' AND t.waiting_reason = 'customer' THEN 'We need a reply from you to continue.'
    WHEN t.status = 'waiting' AND t.waiting_reason = 'third_party' THEN 'We are waiting on a partner service and will follow up.'
    WHEN t.status = 'waiting' AND t.waiting_reason = 'deployment' THEN 'A fix is on its way and we will confirm once it is live.'
    WHEN t.status = 'waiting' AND t.waiting_reason = 'scheduled' THEN 'This is scheduled and we will confirm when it is done.'
    WHEN t.status = 'waiting' THEN 'We are working on this with our team.'
    WHEN t.status = 'needs_owner' THEN 'A senior member of our team is reviewing this.'
    WHEN t.status = 'resolved' THEN 'Resolved. Reply if anything is still not right.'
    ELSE 'We are working on this.' END
$$;

CREATE OR REPLACE FUNCTION bloom_support.ticket_flags(t bloom_support.tickets)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'response_due_at', CASE WHEN t.first_response_at IS NULL AND t.status <> 'resolved' THEN t.due_at END,
    'next_due_at', least(t.due_at, t.next_action_due_at),
    'clock_paused', coalesce(t.waiting_reason, '') IN (SELECT jsonb_array_elements_text(coalesce(bloom_support.setting('timers')->'pause_our_clock_for', '[]'))),
    'overdue', t.status <> 'resolved' AND least(t.due_at, t.next_action_due_at) < now()
               AND coalesce(t.waiting_reason, '') NOT IN (SELECT jsonb_array_elements_text(coalesce(bloom_support.setting('timers')->'pause_our_clock_for', '[]'))),
    'due_soon', t.status NOT IN ('resolved','waiting') AND least(t.due_at, t.next_action_due_at) BETWEEN now()
               AND now() + make_interval(mins => coalesce((bloom_support.setting('sla')->>'due_soon_minutes')::int, 120)),
    'stalled', t.status IN ('new','working','needs_owner') AND coalesce(t.last_team_message_at, t.created_at) < now() - make_interval(hours => coalesce((bloom_support.setting('sla')->>'stale_hours')::int, 72))
               AND t.updated_at < now() - make_interval(hours => coalesce((bloom_support.setting('sla')->>'stale_hours')::int, 72)),
    'unassigned', t.owner_id IS NULL AND t.status <> 'resolved',
    'accountable_id', coalesce(t.owner_id, bloom_support.default_owner()),
    'targets_are_internal', NOT coalesce((bloom_support.setting('sla')->>'contractual')::boolean, false))
$$;

-- Keeps derived state consistent so contradictory states cannot be stored.
CREATE OR REPLACE FUNCTION bloom_support.ticket_state() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'waiting' AND NEW.waiting_reason IS NULL THEN NEW.waiting_reason := 'customer'; END IF;
  IF NEW.status <> 'waiting' THEN NEW.waiting_reason := NULL; NEW.waiting_since := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.status <> 'waiting' OR OLD.waiting_reason IS DISTINCT FROM NEW.waiting_reason THEN NEW.waiting_since := now(); END IF;
  IF NEW.status = 'resolved' THEN
    NEW.first_resolved_at := coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.first_resolved_at END, NEW.resolved_at, now());
  ELSE
    NEW.closed_at := NULL;
  END IF;
  IF NEW.executor = 'bloom' THEN NEW.executor_id := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_state BEFORE INSERT OR UPDATE ON bloom_support.tickets FOR EACH ROW EXECUTE FUNCTION bloom_support.ticket_state();

-- Response target before the first meaningful response; next-action deadline after it.
CREATE OR REPLACE FUNCTION bloom_support.ticket_due() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE hours numeric;
BEGIN
  IF NEW.status = 'resolved' THEN NEW.due_at := NULL; RETURN NEW; END IF;
  IF NEW.first_response_at IS NULL THEN
    hours := coalesce((bloom_support.setting('sla')->'first_response_business_hours'->>NEW.priority)::numeric,
                      (bloom_support.setting('sla')->'ticket_hours'->>NEW.priority)::numeric, 16);
    NEW.due_at := bloom_support.add_business_seconds(CASE WHEN TG_OP = 'UPDATE' AND OLD.status = 'resolved' THEN now() ELSE NEW.created_at END, (hours * 3600)::bigint);
  ELSE
    NEW.due_at := NEW.next_action_due_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tickets_due ON bloom_support.tickets;
CREATE TRIGGER tickets_due BEFORE INSERT OR UPDATE OF priority, status, first_response_at, next_action_due_at ON bloom_support.tickets
  FOR EACH ROW EXECUTE FUNCTION bloom_support.ticket_due();

CREATE OR REPLACE FUNCTION bloom_support.ticket_events_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a uuid := nullif(current_setting('bloom.actor', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, to_value, actor_id, at) VALUES
      (NEW.id, 'created', NEW.channel, a, NEW.created_at),
      (NEW.id, 'status', NEW.status || coalesce(':' || NEW.waiting_reason, ''), a, NEW.created_at);
    RETURN NEW;
  END IF;
  IF NEW.status <> OLD.status OR NEW.waiting_reason IS DISTINCT FROM OLD.waiting_reason THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id)
    VALUES (NEW.id, 'status', OLD.status || coalesce(':' || OLD.waiting_reason, ''), NEW.status || coalesce(':' || NEW.waiting_reason, ''), a);
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id) VALUES (NEW.id, 'owner', OLD.owner_id::text, NEW.owner_id::text, a);
  END IF;
  IF NEW.executor <> OLD.executor OR NEW.executor_id IS DISTINCT FROM OLD.executor_id THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id)
    VALUES (NEW.id, 'executor', OLD.executor || coalesce(':' || OLD.executor_id, ''), NEW.executor || coalesce(':' || NEW.executor_id, ''), a);
  END IF;
  IF NEW.priority <> OLD.priority THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id) VALUES (NEW.id, 'priority', OLD.priority, NEW.priority, a);
  END IF;
  IF NEW.merged_into IS DISTINCT FROM OLD.merged_into THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id) VALUES (NEW.id, 'merged', OLD.merged_into::text, NEW.merged_into::text, a);
  END IF;
  IF NEW.spam <> OLD.spam THEN
    INSERT INTO bloom_support.ticket_events(ticket_id, kind, from_value, to_value, actor_id) VALUES (NEW.id, 'spam', OLD.spam::text, NEW.spam::text, a);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_events AFTER INSERT OR UPDATE ON bloom_support.tickets FOR EACH ROW EXECUTE FUNCTION bloom_support.ticket_events_capture();

-- Message timestamps: acknowledgements and progress notes are not meaningful responses.
CREATE OR REPLACE FUNCTION bloom_support.message_timestamps() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.author_kind = 'client' AND NEW.visibility = 'public' THEN
    UPDATE bloom_support.tickets SET last_customer_message_at = NEW.created_at WHERE id = NEW.ticket_id;
  ELSIF NEW.meaningful THEN
    UPDATE bloom_support.tickets SET last_team_message_at = NEW.created_at, first_response_at = coalesce(first_response_at, NEW.created_at) WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_timestamps AFTER INSERT ON bloom_support.messages FOR EACH ROW EXECUTE FUNCTION bloom_support.message_timestamps();

-- Cancels Bloom's planned replies/actions that new information made stale.
CREATE OR REPLACE FUNCTION bloom_support.invalidate_planned(p_ticket uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  UPDATE bloom_support.messages SET delivery = 'suppressed'
  WHERE ticket_id = p_ticket AND author_kind = 'bloom' AND visibility = 'public' AND delivery = 'queued';
  UPDATE bloom_support.jobs j SET status = 'cancelled', last_error = 'invalidated: ' || p_reason, updated_at = now()
  WHERE j.ticket_id = p_ticket AND j.status = 'queued'
    AND (j.kind IN ('answer','operate')
         OR (j.kind = 'send_email' AND EXISTS (SELECT 1 FROM bloom_support.messages m WHERE m.id = (j.payload->>'message_id')::uuid AND m.author_kind = 'bloom')));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM bloom_support.log(p_ticket, NULL, NULL, 'automation.invalidated', jsonb_build_object('jobs', n, 'reason', p_reason)); END IF;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Timers
-- ---------------------------------------------------------------------------
-- our_clock: time our team is accountable (new, working, needs_owner, and waits on internal/deployment).
-- customer / third_party / scheduled: paused for us. Business-hour variants use settings.business_hours.
CREATE OR REPLACE FUNCTION bloom_support.ticket_timers(p_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; e record; prev_at timestamptz; prev_state text; per_status jsonb := '{}'; secs bigint; bsecs bigint;
  ours bigint := 0; ours_b bigint := 0; cust bigint := 0; third bigint := 0; sched bigint := 0; endt timestamptz;
  paused text[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(bloom_support.setting('timers')->'pause_our_clock_for', '["customer","third_party","scheduled"]')));
BEGIN
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket;
  IF NOT FOUND THEN RETURN NULL; END IF;
  endt := CASE WHEN t.status = 'resolved' THEN coalesce(t.resolved_at, now()) ELSE now() END;
  FOR e IN SELECT at, to_value FROM bloom_support.ticket_events WHERE ticket_id = p_ticket AND kind = 'status'
           UNION ALL SELECT endt, NULL ORDER BY 1 LOOP
    IF prev_at IS NOT NULL AND e.at > prev_at THEN
      secs := extract(epoch FROM e.at - prev_at)::bigint;
      bsecs := bloom_support.business_seconds(prev_at, e.at);
      per_status := per_status || jsonb_build_object(split_part(prev_state, ':', 1), coalesce((per_status->>split_part(prev_state, ':', 1))::bigint, 0) + secs);
      IF split_part(prev_state, ':', 1) = 'resolved' THEN NULL;
      ELSIF split_part(prev_state, ':', 2) = 'customer' THEN cust := cust + secs;
      ELSIF split_part(prev_state, ':', 2) = 'third_party' THEN third := third + secs;
      ELSIF split_part(prev_state, ':', 2) = 'scheduled' THEN sched := sched + secs;
      END IF;
      IF split_part(prev_state, ':', 1) <> 'resolved' AND NOT (split_part(prev_state, ':', 2) = ANY(paused)) THEN
        ours := ours + secs; ours_b := ours_b + bsecs;
      END IF;
    END IF;
    prev_at := e.at; prev_state := e.to_value;
  END LOOP;
  RETURN jsonb_build_object(
    'age_seconds', extract(epoch FROM now() - t.created_at)::bigint,
    'our_clock_seconds', ours, 'our_clock_business_seconds', ours_b,
    'waiting_customer_seconds', cust, 'waiting_third_party_seconds', third, 'scheduled_seconds', sched,
    'per_status_seconds', per_status,
    'first_response_seconds', CASE WHEN t.first_response_at IS NOT NULL THEN extract(epoch FROM t.first_response_at - t.created_at)::bigint END,
    'first_response_business_seconds', CASE WHEN t.first_response_at IS NOT NULL THEN bloom_support.business_seconds(t.created_at, t.first_response_at) END,
    'first_resolution_seconds', CASE WHEN t.first_resolved_at IS NOT NULL THEN extract(epoch FROM t.first_resolved_at - t.created_at)::bigint END,
    'latest_resolution_seconds', CASE WHEN t.status = 'resolved' THEN extract(epoch FROM t.resolved_at - t.created_at)::bigint END,
    'reopened', t.reopen_count > 0,
    'targets_are_internal', NOT coalesce((bloom_support.setting('sla')->>'contractual')::boolean, false));
END $$;

-- ---------------------------------------------------------------------------
-- Shared problems / incidents (one investigation; private conversations stay separate)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.create_problem(p_actor uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pb bloom_support.problems;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  INSERT INTO bloom_support.problems(title, kind, product, summary, created_by)
  VALUES (left(coalesce(p->>'title', 'Shared problem'), 200), coalesce(p->>'kind', 'problem'), coalesce(p->>'product', 'unknown'), p->>'summary', p_actor)
  RETURNING * INTO pb;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'problem.created', jsonb_build_object('problem_id', pb.id, 'kind', pb.kind));
  RETURN to_jsonb(pb);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.link_problem(p_actor uuid, p_ticket uuid, p_problem uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; pb bloom_support.problems;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO pb FROM bloom_support.problems WHERE id = p_problem;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: problem' USING ERRCODE = 'P0002'; END IF;
  UPDATE bloom_support.tickets SET problem_id = pb.id, engineering_issue_id = coalesce(engineering_issue_id, pb.engineering_issue_id), updated_at = now() WHERE id = t.id;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'problem.linked', jsonb_build_object('problem_id', pb.id));
  RETURN jsonb_build_object('problem_id', pb.id, 'engineering_issue_id', pb.engineering_issue_id);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_problems(p_actor uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(pb) || jsonb_build_object(
      'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'status', t.status, 'account', (SELECT name FROM bloom_support.accounts a WHERE a.id = t.account_id))), '[]')
                  FROM bloom_support.tickets t WHERE t.problem_id = pb.id AND t.merged_into IS NULL),
      'engineering', (SELECT jsonb_build_object('status', e.status, 'pr_url', e.pr_url) FROM bloom_support.engineering_issues e WHERE e.id = pb.engineering_issue_id))
      ORDER BY pb.updated_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.problems WHERE p_status IS NULL OR status = p_status ORDER BY updated_at DESC LIMIT 100) pb);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.update_problem(p_actor uuid, p_problem uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pb bloom_support.problems;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  UPDATE bloom_support.problems SET title = coalesce(p->>'title', title), status = coalesce(p->>'status', status), kind = coalesce(p->>'kind', kind),
    summary = coalesce(p->>'summary', summary), updated_at = now() WHERE id = p_problem RETURNING * INTO pb;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: problem' USING ERRCODE = 'P0002'; END IF;
  -- Closing a problem never resolves its tickets: each ticket is verified for its own flow.
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'problem.updated', jsonb_build_object('problem_id', pb.id, 'status', pb.status));
  RETURN to_jsonb(pb);
END $$;

-- ---------------------------------------------------------------------------
-- Merge, spam, bulk, client actions, post-resolution replies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.merge_tickets(p_actor uuid, p_source uuid, p_target uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s bloom_support.tickets; tg bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  s := bloom_support.require_ticket(p_actor, p_source);
  tg := bloom_support.require_ticket(p_actor, p_target);
  IF s.id = tg.id THEN RAISE EXCEPTION 'invalid: cannot merge a ticket into itself' USING ERRCODE = '22023'; END IF;
  IF s.merged_into IS NOT NULL OR tg.merged_into IS NOT NULL THEN RAISE EXCEPTION 'invalid: one of the tickets is already merged' USING ERRCODE = '22023'; END IF;
  -- Never merge different clients into one conversation; link them to a shared problem instead.
  IF s.account_id IS DISTINCT FROM tg.account_id OR s.account_id IS NULL THEN
    RAISE EXCEPTION 'invalid: tickets from different clients cannot be merged — link them to a shared problem' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('bloom.actor', p_actor::text, true);
  UPDATE bloom_support.tickets SET merged_into = tg.id, status = 'resolved', stage = 'closed', resolved_at = now(),
    resolution_summary = 'Merged into #' || tg.number, resolution_evidence = jsonb_build_object('merged_into', tg.id, 'reason', p_reason, 'resolved_by', 'merge'),
    version = version + 1, updated_at = now() WHERE id = s.id;
  UPDATE bloom_support.jobs SET status = 'cancelled', last_error = 'cancelled: merged', updated_at = now() WHERE ticket_id = s.id AND status = 'queued';
  UPDATE bloom_support.tickets SET problem_id = coalesce(problem_id, s.problem_id), engineering_issue_id = coalesce(engineering_issue_id, s.engineering_issue_id),
    priority = CASE WHEN (CASE s.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END) < (CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END) THEN s.priority ELSE priority END,
    version = version + 1, updated_at = now() WHERE id = tg.id;
  INSERT INTO bloom_support.ticket_links(from_ticket, to_ticket, kind, created_by) VALUES (s.id, tg.id, 'duplicate', p_actor) ON CONFLICT DO NOTHING;
  PERFORM bloom_support.log(s.id, s.account_id, p_actor, 'ticket.merged', jsonb_build_object('into', tg.id, 'number', tg.number, 'reason', p_reason));
  PERFORM bloom_support.log(tg.id, tg.account_id, p_actor, 'ticket.merge_received', jsonb_build_object('from', s.id, 'number', s.number));
  RETURN jsonb_build_object('merged', s.id, 'into', tg.id);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.set_spam(p_actor uuid, p_ticket uuid, p_spam boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  PERFORM set_config('bloom.actor', p_actor::text, true);
  IF p_spam THEN
    UPDATE bloom_support.tickets SET spam = true, status = 'resolved', stage = 'closed', resolved_at = coalesce(resolved_at, now()),
      resolution_summary = coalesce(resolution_summary, 'Marked as spam'), automation = 'paused', version = version + 1, updated_at = now() WHERE id = t.id;
    UPDATE bloom_support.jobs SET status = 'cancelled', last_error = 'cancelled: spam', updated_at = now() WHERE ticket_id = t.id AND status = 'queued';
    UPDATE bloom_support.messages SET delivery = 'suppressed' WHERE ticket_id = t.id AND delivery = 'queued';
  ELSE
    UPDATE bloom_support.tickets SET spam = false, status = 'working', stage = 'triage', resolved_at = NULL, version = version + 1, updated_at = now() WHERE id = t.id;
  END IF;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, CASE WHEN p_spam THEN 'ticket.spam' ELSE 'ticket.not_spam' END, '{}');
  RETURN jsonb_build_object('id', t.id, 'spam', p_spam);
END $$;

-- Safe bulk changes. Consequential changes (resolve, Needs Jon/Jeff, more than 20 tickets) need confirm = the ticket count.
CREATE OR REPLACE FUNCTION bloom_support.bulk_update(p_actor uuid, p_ids uuid[], p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE id uuid; ok jsonb := '[]'; failed jsonb := '[]'; patch jsonb := coalesce(p->'patch', '{}'::jsonb); t bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF bloom_support.principal_role(p_actor) = 'service' THEN RAISE EXCEPTION 'forbidden: bulk actions are for people' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_ids) = 0 OR cardinality(p_ids) > 100 THEN RAISE EXCEPTION 'invalid: 1 to 100 tickets per bulk action' USING ERRCODE = '22023'; END IF;
  IF (patch->>'status' IN ('resolved','needs_owner') OR cardinality(p_ids) > 20) AND p->>'confirm' IS DISTINCT FROM cardinality(p_ids)::text THEN
    RAISE EXCEPTION 'confirm: type % to confirm this change to % tickets', cardinality(p_ids), cardinality(p_ids) USING ERRCODE = '22023';
  END IF;
  FOREACH id IN ARRAY p_ids LOOP
    BEGIN
      IF p ? 'add_tags' OR p ? 'remove_tags' THEN
        t := bloom_support.require_ticket(p_actor, id);
        patch := patch || jsonb_build_object('tags', (SELECT coalesce(jsonb_agg(DISTINCT x), '[]') FROM (
          SELECT unnest(t.tags) x UNION SELECT jsonb_array_elements_text(coalesce(p->'add_tags', '[]'))) u
          WHERE x NOT IN (SELECT jsonb_array_elements_text(coalesce(p->'remove_tags', '[]')))));
      END IF;
      PERFORM bloom_support.update_ticket(p_actor, id, patch || jsonb_build_object('reason', 'bulk'));
      ok := ok || to_jsonb(id);
    EXCEPTION WHEN OTHERS THEN
      failed := failed || jsonb_build_object('id', id, 'error', SQLERRM);
    END;
    patch := coalesce(p->'patch', '{}'::jsonb);
  END LOOP;
  PERFORM bloom_support.log(NULL, NULL, p_actor, 'tickets.bulk_update', jsonb_build_object('count', cardinality(p_ids), 'patch', p->'patch', 'failed', jsonb_array_length(failed)));
  RETURN jsonb_build_object('updated', ok, 'failed', failed);
END $$;

-- Client actions: confirm resolution, report it continues, ask for a person.
CREATE OR REPLACE FUNCTION bloom_support.client_action(p_actor uuid, p_ticket uuid, p_action text, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  t := bloom_support.require_ticket(p_actor, p_ticket);
  PERFORM set_config('bloom.actor', p_actor::text, true);
  IF p_action = 'confirm_resolved' THEN
    IF t.status <> 'resolved' THEN RAISE EXCEPTION 'invalid: this request is not resolved yet' USING ERRCODE = '22023'; END IF;
    UPDATE bloom_support.tickets SET pending_review = NULL,
      closed_at = CASE WHEN coalesce((bloom_support.setting('closure')->>'close_on_client_confirm')::boolean, true) THEN now() ELSE closed_at END,
      resolution_evidence = coalesce(resolution_evidence, '{}') || jsonb_build_object('client_confirmed_at', now()), updated_at = now() WHERE id = t.id;
  ELSIF p_action = 'still_broken' THEN
    IF t.status = 'resolved' THEN
      UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', reopen_count = reopen_count + 1, resolution_verified = false, resolved_at = NULL,
        pending_review = NULL, version = version + 1, updated_at = now() WHERE id = t.id;
      PERFORM bloom_support.notify_staff(t.id, 'ticket.reopened', 'Client says #' || t.number || ' is still not fixed', 'both');
      PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('reason','client_reopened'), 'triage:reopen:' || t.id::text || ':' || (t.reopen_count + 1));
    END IF;
  ELSIF p_action = 'request_person' THEN
    UPDATE bloom_support.tickets SET executor = 'person', automation = 'human', executor_id = NULL,
      next_action = 'Client asked for a person — reply personally', next_action_due_at = bloom_support.add_business_seconds(now(), 4 * 3600),
      version = version + 1, updated_at = now() WHERE id = t.id;
    PERFORM bloom_support.invalidate_planned(t.id, 'client asked for a person');
    PERFORM bloom_support.notify_staff(t.id, 'ticket.person_requested', 'Client asked for a person on #' || t.number, 'both');
  ELSE
    RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_message), '') <> '' AND p_action <> 'confirm_resolved' THEN
    INSERT INTO bloom_support.messages(conversation_id, ticket_id, author_id, author_kind, visibility, direction, body)
    VALUES (t.conversation_id, t.id, p_actor, 'client', 'public', 'inbound', left(p_message, 20000));
  END IF;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'client.' || p_action, '{}');
  RETURN jsonb_build_object('ok', true, 'action', p_action);
END $$;

-- Decide what a reply on a resolved ticket means: reopen, new linked ticket, or human review.
CREATE OR REPLACE FUNCTION bloom_support.resolve_post_reply(p_actor uuid, p_ticket uuid, p_decision text, p_message uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; m bloom_support.messages; created jsonb;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO m FROM bloom_support.messages WHERE id = p_message AND ticket_id = t.id;
  IF t.pending_review IS DISTINCT FROM 'reply_after_resolution' THEN RETURN jsonb_build_object('skipped', 'no pending reply'); END IF;
  PERFORM set_config('bloom.actor', p_actor::text, true);
  IF p_decision = 'reopen' THEN
    UPDATE bloom_support.tickets SET status = 'working', stage = 'triage', reopen_count = reopen_count + 1, resolution_verified = false, resolved_at = NULL,
      pending_review = NULL, version = version + 1, updated_at = now() WHERE id = t.id;
    PERFORM bloom_support.notify_staff(t.id, 'ticket.reopened', 'Reopened #' || t.number || ': ' || left(t.subject, 80), 'both');
    IF t.automation = 'auto' THEN
      PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
        jsonb_build_object('reason','client_reply','message_id', p_message), 'triage:' || p_message::text);
    END IF;
  ELSIF p_decision = 'new_ticket' THEN
    IF m.id IS NULL THEN RAISE EXCEPTION 'invalid: message required' USING ERRCODE = '22023'; END IF;
    created := bloom_support.create_ticket(p_actor, jsonb_build_object('product', t.product, 'channel', t.channel, 'body', m.body,
      'subject', left(regexp_replace(m.body, '\s+', ' ', 'g'), 120), 'account_id', t.account_id, 'requester_id', t.requester_id,
      'conversation_id', t.conversation_id, 'dedupe_key', 'followup:' || m.id::text));
    INSERT INTO bloom_support.ticket_links(from_ticket, to_ticket, kind, created_by) VALUES ((created->>'ticket_id')::uuid, t.id, 'follow_up', p_actor) ON CONFLICT DO NOTHING;
    UPDATE bloom_support.tickets SET pending_review = NULL, updated_at = now() WHERE id = t.id;
  ELSIF p_decision = 'review' THEN
    UPDATE bloom_support.tickets SET next_action = 'Review the client''s reply after resolution: reopen, start a new request, or reply',
      next_action_due_at = bloom_support.add_business_seconds(now(), 8 * 3600), updated_at = now() WHERE id = t.id;
  ELSIF p_decision = 'dismiss' THEN
    UPDATE bloom_support.tickets SET pending_review = NULL, updated_at = now() WHERE id = t.id;
  ELSE RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.post_reply_' || p_decision, jsonb_build_object('message_id', p_message, 'note', p_note, 'new_ticket', created->'ticket_id'));
  RETURN jsonb_build_object('decision', p_decision, 'new_ticket', created);
END $$;

-- ---------------------------------------------------------------------------
-- Saved views
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.save_view(p_actor uuid, p_name text, p_filters jsonb, p_shared boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v bloom_support.saved_views;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  INSERT INTO bloom_support.saved_views(principal_id, name, filters, shared) VALUES (p_actor, btrim(p_name), coalesce(p_filters, '{}'), coalesce(p_shared, false))
  ON CONFLICT (principal_id, name) DO UPDATE SET filters = EXCLUDED.filters, shared = EXCLUDED.shared RETURNING * INTO v;
  RETURN to_jsonb(v);
END $$;
CREATE OR REPLACE FUNCTION bloom_support.list_views(p_actor uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.name), '[]') FROM bloom_support.saved_views v
  WHERE bloom_support.has_permission(p_actor, 'tickets.read_all') AND (v.principal_id = p_actor OR v.shared)
$$;
CREATE OR REPLACE FUNCTION bloom_support.delete_view(p_actor uuid, p_view uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM bloom_support.saved_views WHERE id = p_view AND principal_id = p_actor;
$$;

-- ---------------------------------------------------------------------------
-- Notifications (deduplicated, cooldown via keyed buckets), incidents, closure, digests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.notify_once(p_ticket uuid, p_kind text, p_title text, p_audience text, p_key text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; r record; owners jsonb := coalesce(bloom_support.setting('owners'), '{}'); emails text[];
BEGIN
  emails := ARRAY(SELECT lower(e) FROM jsonb_array_elements_text(
      CASE p_audience WHEN 'jon' THEN coalesce(owners->'jon','[]') WHEN 'jeff' THEN coalesce(owners->'jeff','[]') ELSE coalesce(owners->'jon','[]') || coalesce(owners->'jeff','[]') END) e);
  FOR r IN SELECT p.id FROM bloom_support.principals p WHERE p.active AND p.kind = 'user'
      AND (lower(p.email) = ANY(emails) OR (cardinality(emails) = 0 AND p.role IN ('platform_admin','platform_operator')))
      UNION SELECT t.owner_id FROM bloom_support.tickets t WHERE t.id = p_ticket AND t.owner_id IS NOT NULL LOOP
    INSERT INTO bloom_support.notifications(principal_id, ticket_id, kind, title, dedupe_key)
    VALUES (r.id, p_ticket, p_kind, p_title, p_key || ':' || r.id::text) ON CONFLICT (dedupe_key) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  IF n > 0 AND coalesce((bloom_support.setting('notifications')->>'email_staff')::boolean, false) THEN
    PERFORM bloom_support.enqueue_job('notify', p_ticket, NULL, 'email:notify', jsonb_build_object('kind', p_kind, 'title', p_title, 'audience', p_audience), 'notify:' || p_key);
  END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.sweep_operational()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg jsonb := coalesce(bloom_support.setting('notifications'), '{}'); t bloom_support.tickets; c record; sent int := 0; incidents int := 0; closed int := 0; pb uuid;
  tz text := coalesce(bloom_support.setting('business_hours')->>'timezone', 'UTC'); dg jsonb := coalesce(bloom_support.setting('digest'), '{}');
  local timestamp := now() AT TIME ZONE tz; days int;
BEGIN
  FOR t IN SELECT * FROM bloom_support.tickets WHERE status <> 'resolved' AND merged_into IS NULL AND NOT spam LIMIT 2000 LOOP
    IF coalesce((cfg->>'urgent_new')::boolean, true) AND t.priority = 'urgent' AND t.status = 'new' THEN
      sent := sent + bloom_support.notify_once(t.id, 'urgent.new', 'Urgent #' || t.number || ': ' || left(t.subject, 80), 'both', 'urgent:' || t.id::text);
    END IF;
    IF t.owner_id IS NULL AND t.created_at < now() - make_interval(mins => coalesce((cfg->>'unassigned_minutes')::int, 60)) THEN
      sent := sent + bloom_support.notify_once(t.id, 'ticket.unassigned', 'Unassigned #' || t.number || ': ' || left(t.subject, 80), 'both', 'unassigned:' || t.id::text);
    END IF;
    IF t.first_response_at IS NULL AND t.due_at IS NOT NULL AND t.status <> 'waiting' THEN
      IF t.due_at < now() THEN
        sent := sent + bloom_support.notify_once(t.id, 'response.missed', 'Response target missed on #' || t.number, 'both', 'response_missed:' || t.id::text);
      ELSIF t.due_at < now() + make_interval(mins => coalesce((cfg->>'response_warning_minutes')::int, 60)) THEN
        sent := sent + bloom_support.notify_once(t.id, 'response.due_soon', 'Response due soon on #' || t.number, 'both', 'response_soon:' || t.id::text);
      END IF;
    END IF;
    IF coalesce((cfg->>'next_action_overdue')::boolean, true) AND t.next_action_due_at < now() THEN
      sent := sent + bloom_support.notify_once(t.id, 'next_action.overdue', 'Next action overdue on #' || t.number || ': ' || coalesce(left(t.next_action, 60), ''), 'both',
        'next_overdue:' || t.id::text || ':' || extract(epoch FROM t.next_action_due_at)::bigint);
    END IF;
    IF coalesce((cfg->>'stalled')::boolean, true) AND (bloom_support.ticket_flags(t)->>'stalled')::boolean THEN
      sent := sent + bloom_support.notify_once(t.id, 'ticket.stalled', 'Stalled #' || t.number || ': no progress', 'both', 'stalled:' || t.id::text || ':' || to_char(now(), 'YYYY-MM-DD'));
    END IF;
  END LOOP;

  -- Several clients reporting the same thing at once becomes one incident (one alert, one investigation).
  FOR c IN SELECT product, category, count(*) n, count(DISTINCT account_id) accounts, array_agg(id) ids
           FROM bloom_support.tickets
           WHERE kind IN ('bug','incident') AND status <> 'resolved' AND problem_id IS NULL AND merged_into IS NULL AND NOT spam
             AND created_at > now() - interval '2 hours' AND category IS NOT NULL
           GROUP BY product, category HAVING count(DISTINCT account_id) >= 2 AND count(*) >= 3 LOOP
    INSERT INTO bloom_support.problems(title, kind, product, summary)
    VALUES ('Possible incident: ' || c.category || ' (' || c.product || ')', 'incident', c.product, c.n || ' reports from ' || c.accounts || ' clients in 2 hours')
    RETURNING id INTO pb;
    UPDATE bloom_support.tickets SET problem_id = pb WHERE id = ANY(c.ids);
    INSERT INTO bloom_support.alerts(condition, detail, dedupe_key) VALUES ('possible_incident', jsonb_build_object('problem_id', pb, 'tickets', c.n, 'clients', c.accounts), 'incident:' || pb::text)
    ON CONFLICT DO NOTHING;
    PERFORM bloom_support.notify_once(NULL, 'incident', 'Possible incident: ' || c.n || ' reports about ' || c.category, 'both', 'incident:' || pb::text);
    incidents := incidents + 1;
  END LOOP;

  -- Closure policy: only resolved tickets are ever closed automatically. Waiting tickets are never auto-resolved.
  days := (bloom_support.setting('closure')->>'auto_close_resolved_after_days')::int;
  IF days IS NOT NULL THEN
    UPDATE bloom_support.tickets SET closed_at = now() WHERE status = 'resolved' AND closed_at IS NULL AND resolved_at < now() - make_interval(days => days);
    GET DIAGNOSTICS closed = ROW_COUNT;
  END IF;

  -- Digests at the configured local hour.
  IF coalesce((dg->'daily'->>'enabled')::boolean, false) AND extract(hour FROM local)::int = coalesce((dg->'daily'->>'hour')::int, 8) THEN
    PERFORM bloom_support.enqueue_job('digest', NULL, NULL, 'email:digest', '{"period":"daily"}', 'digest:daily:' || to_char(local, 'YYYY-MM-DD'));
  END IF;
  IF coalesce((dg->'weekly'->>'enabled')::boolean, false) AND extract(isodow FROM local)::int = coalesce((dg->'weekly'->>'isodow')::int, 1)
     AND extract(hour FROM local)::int = coalesce((dg->'weekly'->>'hour')::int, 8) THEN
    PERFORM bloom_support.enqueue_job('digest', NULL, NULL, 'email:digest', '{"period":"weekly"}', 'digest:weekly:' || to_char(local, 'IYYY-IW'));
  END IF;
  RETURN jsonb_build_object('notifications', sent, 'incidents', incidents, 'closed', closed);
END $$;

-- ---------------------------------------------------------------------------
-- Reporting (event-based; spam and merged tickets excluded everywhere)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.summary_report(p_period text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE since timestamptz := now() - CASE WHEN p_period = 'weekly' THEN interval '7 days' ELSE interval '1 day' END;
BEGIN
  RETURN jsonb_build_object('period', p_period, 'since', since, 'generated_at', now(),
    'new', (SELECT count(*) FROM bloom_support.tickets WHERE created_at >= since AND NOT spam AND merged_into IS NULL),
    'resolved', (SELECT count(DISTINCT e.ticket_id) FROM bloom_support.ticket_events e JOIN bloom_support.tickets t ON t.id = e.ticket_id
                 WHERE e.kind = 'status' AND e.to_value = 'resolved' AND e.at >= since AND NOT t.spam AND t.merged_into IS NULL),
    'reopened', (SELECT count(DISTINCT e.ticket_id) FROM bloom_support.ticket_events e WHERE e.kind = 'status' AND e.from_value = 'resolved' AND e.at >= since),
    'open', (SELECT count(*) FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL),
    'overdue', (SELECT count(*) FROM bloom_support.tickets t WHERE t.status <> 'resolved' AND (bloom_support.ticket_flags(t)->>'overdue')::boolean AND NOT t.spam AND t.merged_into IS NULL),
    'unassigned', (SELECT count(*) FROM bloom_support.tickets WHERE status <> 'resolved' AND owner_id IS NULL AND NOT spam AND merged_into IS NULL),
    'needs_owner', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', number, 'subject', subject)), '[]') FROM bloom_support.tickets WHERE status = 'needs_owner'),
    'oldest', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', number, 'subject', subject, 'age_days', round(extract(epoch FROM now() - created_at) / 86400.0, 1)) ORDER BY created_at), '[]')
               FROM (SELECT * FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL ORDER BY created_at LIMIT 5) o),
    'automation_failures', (SELECT count(*) FROM bloom_support.jobs WHERE status = 'dead' AND updated_at >= since),
    'repeated_problems', (SELECT coalesce(jsonb_agg(jsonb_build_object('category', category, 'product', product, 'tickets', n)), '[]')
                          FROM (SELECT category, product, count(*) n FROM bloom_support.tickets WHERE created_at >= since AND category IS NOT NULL AND NOT spam
                                GROUP BY 1, 2 HAVING count(*) >= 2 ORDER BY 3 DESC LIMIT 5) r));
END $$;

CREATE OR REPLACE FUNCTION bloom_support.report_metrics(p_actor uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f timestamptz := coalesce(p_from, now() - interval '30 days'); tt timestamptz := coalesce(p_to, now());
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.read_all');
  IF tt - f > interval '366 days' THEN RAISE EXCEPTION 'invalid: range limited to one year' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', f, 'to', tt),
    'definitions', jsonb_build_object(
      'population', 'All tickets except spam and tickets merged into another ticket.',
      'open_by', 'Current open (not resolved) tickets grouped by status, priority, product, client and owner.',
      'daily.incoming', 'Tickets created that day.',
      'daily.resolved', 'Tickets that entered Resolved that day (a ticket resolved twice counts on both days).',
      'daily.backlog', 'Tickets open at the end of that day, reconstructed from the status event history.',
      'age_distribution', 'Open tickets by time since creation.',
      'first_response', 'Created → first meaningful response (acknowledgements and progress notes excluded); tickets created in range that have one. Business hours from settings.business_hours.',
      'first_resolution', 'Created → first time Resolved, for tickets first resolved in range.',
      'final_resolution', 'Created → latest Resolved, for tickets resolved in range and still resolved (includes reopened work).',
      'overdue_now', 'Open tickets past their response target or next-action deadline whose clock is not paused.',
      'reopen_rate', 'Of tickets first resolved in range, the share later reopened.',
      'handling', 'Tickets resolved in range, by who resolved them (person or Bloom).',
      'verified_autonomous', 'Resolved by Bloom with resolution_verified, no public reply from a person, and not reopened.',
      'automation', 'Jobs that ended dead in range; model calls and tokens recorded in range.',
      'targets', 'Internal targets unless settings.sla.contractual is true.'),
    'open_by', jsonb_build_object(
      'status', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL GROUP BY 1) x),
      'priority', (SELECT coalesce(jsonb_object_agg(priority, n), '{}') FROM (SELECT priority, count(*) n FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL GROUP BY 1) x),
      'product', (SELECT coalesce(jsonb_object_agg(product, n), '{}') FROM (SELECT product, count(*) n FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL GROUP BY 1) x),
      'client', (SELECT coalesce(jsonb_agg(jsonb_build_object('account', coalesce(a.name, 'No client'), 'open', x.n) ORDER BY x.n DESC), '[]')
                 FROM (SELECT account_id, count(*) n FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x
                 LEFT JOIN bloom_support.accounts a ON a.id = x.account_id),
      'owner', (SELECT coalesce(jsonb_agg(jsonb_build_object('owner', coalesce(p.display_name, 'Unassigned'), 'open', x.n)), '[]')
                FROM (SELECT owner_id, count(*) n FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL GROUP BY 1) x
                LEFT JOIN bloom_support.principals p ON p.id = x.owner_id)),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d::date,
        'incoming', (SELECT count(*) FROM bloom_support.tickets t WHERE t.created_at >= d AND t.created_at < d + interval '1 day' AND NOT t.spam AND t.merged_into IS NULL),
        'resolved', (SELECT count(*) FROM bloom_support.ticket_events e JOIN bloom_support.tickets t ON t.id = e.ticket_id
                     WHERE e.kind = 'status' AND e.to_value = 'resolved' AND e.from_value IS DISTINCT FROM 'resolved' AND e.at >= d AND e.at < d + interval '1 day' AND NOT t.spam AND t.merged_into IS NULL),
        'backlog', (SELECT count(*) FROM bloom_support.tickets t WHERE t.created_at < d + interval '1 day' AND NOT t.spam AND t.merged_into IS NULL
                     AND coalesce((SELECT split_part(e.to_value, ':', 1) FROM bloom_support.ticket_events e WHERE e.ticket_id = t.id AND e.kind = 'status' AND e.at < d + interval '1 day' ORDER BY e.id DESC LIMIT 1), 'new') <> 'resolved')
      ) ORDER BY d), '[]') FROM generate_series(date_trunc('day', f), date_trunc('day', tt), interval '1 day') d),
    'age_distribution', (SELECT jsonb_build_object(
        'under_1d', count(*) FILTER (WHERE age < interval '1 day'), '1_3d', count(*) FILTER (WHERE age >= interval '1 day' AND age < interval '3 days'),
        '3_7d', count(*) FILTER (WHERE age >= interval '3 days' AND age < interval '7 days'), '7_30d', count(*) FILTER (WHERE age >= interval '7 days' AND age < interval '30 days'),
        'over_30d', count(*) FILTER (WHERE age >= interval '30 days'))
      FROM (SELECT now() - created_at AS age FROM bloom_support.tickets WHERE status <> 'resolved' AND NOT spam AND merged_into IS NULL) a),
    'first_response', (SELECT jsonb_build_object('n', count(*),
        'median_business_seconds', percentile_cont(0.5) WITHIN GROUP (ORDER BY s), 'p90_business_seconds', percentile_cont(0.9) WITHIN GROUP (ORDER BY s),
        'median_seconds', percentile_cont(0.5) WITHIN GROUP (ORDER BY w), 'p90_seconds', percentile_cont(0.9) WITHIN GROUP (ORDER BY w))
      FROM (SELECT bloom_support.business_seconds(created_at, first_response_at) s, extract(epoch FROM first_response_at - created_at) w
            FROM bloom_support.tickets WHERE created_at >= f AND created_at < tt AND first_response_at IS NOT NULL AND NOT spam AND merged_into IS NULL) x),
    'first_resolution', (SELECT jsonb_build_object('n', count(*), 'median_seconds', percentile_cont(0.5) WITHIN GROUP (ORDER BY w), 'p90_seconds', percentile_cont(0.9) WITHIN GROUP (ORDER BY w))
      FROM (SELECT extract(epoch FROM first_resolved_at - created_at) w FROM bloom_support.tickets
            WHERE first_resolved_at >= f AND first_resolved_at < tt AND NOT spam AND merged_into IS NULL) x),
    'final_resolution', (SELECT jsonb_build_object('n', count(*), 'median_seconds', percentile_cont(0.5) WITHIN GROUP (ORDER BY w), 'p90_seconds', percentile_cont(0.9) WITHIN GROUP (ORDER BY w))
      FROM (SELECT extract(epoch FROM resolved_at - created_at) w FROM bloom_support.tickets
            WHERE status = 'resolved' AND resolved_at >= f AND resolved_at < tt AND NOT spam AND merged_into IS NULL) x),
    'overdue_now', (SELECT count(*) FROM bloom_support.tickets t WHERE t.status <> 'resolved' AND NOT t.spam AND t.merged_into IS NULL AND (bloom_support.ticket_flags(t)->>'overdue')::boolean),
    'reopen_rate', (SELECT jsonb_build_object('denominator', count(*), 'reopened', count(*) FILTER (WHERE reopen_count > 0),
        'rate', CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE reopen_count > 0)::numeric / count(*), 4) END)
      FROM bloom_support.tickets WHERE first_resolved_at >= f AND first_resolved_at < tt AND NOT spam AND merged_into IS NULL),
    'handling', (SELECT jsonb_build_object('resolved', count(*),
        'by_person', count(*) FILTER (WHERE resolution_evidence->>'resolved_by' = 'person'),
        'by_bloom', count(*) FILTER (WHERE resolution_evidence->>'resolved_by' = 'bloom'),
        'verified_autonomous', count(*) FILTER (WHERE resolution_evidence->>'resolved_by' = 'bloom' AND resolution_verified AND reopen_count = 0
            AND NOT EXISTS (SELECT 1 FROM bloom_support.messages m WHERE m.ticket_id = t.id AND m.author_kind = 'staff' AND m.visibility = 'public')))
      FROM bloom_support.tickets t WHERE status = 'resolved' AND resolved_at >= f AND resolved_at < tt AND NOT spam AND merged_into IS NULL),
    'automation', jsonb_build_object(
      'dead_jobs', (SELECT count(*) FROM bloom_support.jobs WHERE status = 'dead' AND updated_at >= f AND updated_at < tt),
      'jobs_succeeded', (SELECT count(*) FROM bloom_support.jobs WHERE status = 'succeeded' AND updated_at >= f AND updated_at < tt),
      'model_calls', (SELECT count(*) FROM bloom_support.activity WHERE action = 'ai.call' AND created_at >= f AND created_at < tt),
      'model_tokens', (SELECT coalesce(sum((detail->'usage'->>'total_tokens')::bigint), 0) FROM bloom_support.activity WHERE action = 'ai.call' AND created_at >= f AND created_at < tt)));
END $$;

-- ---------------------------------------------------------------------------
-- Delivery events, retention
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.record_delivery_event(p_provider_id text, p_type text, p_detail jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o bloom_support.outbound_emails; st text := CASE p_type WHEN 'email.delivered' THEN 'delivered' WHEN 'email.bounced' THEN 'bounced'
  WHEN 'email.complained' THEN 'complained' WHEN 'email.sent' THEN 'sent' ELSE NULL END;
BEGIN
  SELECT * INTO o FROM bloom_support.outbound_emails WHERE provider_id = p_provider_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('matched', false); END IF;
  UPDATE bloom_support.outbound_emails SET provider_events = provider_events || jsonb_build_array(jsonb_build_object('type', p_type, 'at', now())),
    status = CASE WHEN st IS NULL OR (status IN ('bounced','complained')) THEN status ELSE st END WHERE id = o.id;
  IF st IN ('bounced','delivered') AND o.message_id IS NOT NULL THEN UPDATE bloom_support.messages SET delivery = st WHERE id = o.message_id; END IF;
  IF st IN ('bounced','complained') AND o.ticket_id IS NOT NULL THEN
    PERFORM bloom_support.log(o.ticket_id, NULL, NULL, 'email.' || st, jsonb_build_object('to', o.to_email, 'purpose', o.purpose));
    PERFORM bloom_support.notify_once(o.ticket_id, 'email.' || st, 'Email ' || st || ' for ' || o.to_email, 'both', 'email-' || st || ':' || o.id::text);
  END IF;
  RETURN jsonb_build_object('matched', true, 'status', st);
END $$;

-- Redacts content but keeps the ticket, its events and the audit log (operational and audit records survive).
CREATE OR REPLACE FUNCTION bloom_support.redact_ticket(p_actor uuid, p_ticket uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; paths jsonb;
BEGIN
  IF p_actor IS NOT NULL THEN PERFORM bloom_support.require_permission(p_actor, 'admin.policy'); END IF;
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: ticket' USING ERRCODE = 'P0002'; END IF;
  IF t.status <> 'resolved' THEN RAISE EXCEPTION 'invalid: only resolved tickets can be redacted' USING ERRCODE = '22023'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'invalid: reason required' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', storage_bucket, 'path', storage_path)), '[]') INTO paths FROM bloom_support.attachments WHERE ticket_id = t.id;
  UPDATE bloom_support.messages SET body = '[redacted]' WHERE ticket_id = t.id;
  DELETE FROM bloom_support.attachments WHERE ticket_id = t.id;
  UPDATE bloom_support.tickets SET subject = '[redacted]', summary = '[redacted]', context = '{}', resolution_summary = '[redacted]', redacted_at = now() WHERE id = t.id;
  INSERT INTO bloom_support.ticket_events(ticket_id, kind, to_value, actor_id) VALUES (t.id, 'redacted', p_reason, p_actor);
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'ticket.redacted', jsonb_build_object('reason', p_reason, 'attachments', jsonb_array_length(paths)));
  RETURN jsonb_build_object('redacted', t.id, 'storage_objects', paths);
END $$;

-- ---------------------------------------------------------------------------
-- Job claiming with scoped pauses, per-client lanes and per-repository engineering concurrency
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloom_support.claim_jobs(p_worker text, p_limit integer DEFAULT 5)
RETURNS SETOF bloom_support.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j bloom_support.jobs; n int := 0; scopes jsonb := coalesce(bloom_support.setting('automation_scopes'), '{}'); repo text;
BEGIN
  UPDATE bloom_support.jobs SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
    last_error = coalesce(last_error || ' | ', '') || 'lease expired', lease_until = NULL, locked_by = NULL,
    run_after = now() + make_interval(secs => least(600, 15 * power(2, attempts)::int)), updated_at = now()
  WHERE status = 'running' AND lease_until < now();
  IF NOT coalesce((bloom_support.setting('automation_enabled'))::text::boolean, false) THEN RETURN; END IF;
  FOR j IN
    SELECT q.* FROM bloom_support.jobs q
    LEFT JOIN bloom_support.tickets t ON t.id = q.ticket_id
    LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
    WHERE q.status = 'queued' AND q.run_after <= now()
      AND coalesce((scopes->>q.scope)::boolean, true)
      AND NOT coalesce(a.automation_paused, false)
      AND NOT EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = q.lane AND r.status = 'running')
    ORDER BY q.run_after, q.created_at
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    EXIT WHEN n >= p_limit;
    CONTINUE WHEN EXISTS (SELECT 1 FROM bloom_support.jobs r WHERE r.lane = j.lane AND r.status = 'running');
    IF j.scope = 'engineering' AND j.engineering_issue_id IS NOT NULL THEN
      SELECT repository INTO repo FROM bloom_support.engineering_issues WHERE id = j.engineering_issue_id;
      CONTINUE WHEN repo IS NOT NULL AND EXISTS (
        SELECT 1 FROM bloom_support.jobs r JOIN bloom_support.engineering_issues e ON e.id = r.engineering_issue_id
        WHERE r.status = 'running' AND r.scope = 'engineering' AND e.repository = repo AND e.id <> j.engineering_issue_id);
    END IF;
    UPDATE bloom_support.jobs SET status = 'running', attempts = attempts + 1, locked_by = p_worker,
      lease_until = now() + make_interval(secs => timeout_seconds), updated_at = now()
    WHERE id = j.id RETURNING * INTO j;
    n := n + 1;
    RETURN NEXT j;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION bloom_support.set_account_automation(p_actor uuid, p_account uuid, p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'automation.control');
  UPDATE bloom_support.accounts SET automation_paused = p_paused, updated_at = now() WHERE id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: account' USING ERRCODE = 'P0002'; END IF;
  PERFORM bloom_support.log(NULL, p_account, p_actor, CASE WHEN p_paused THEN 'automation.account_paused' ELSE 'automation.account_resumed' END, '{}');
  RETURN jsonb_build_object('account_id', p_account, 'automation_paused', p_paused);
END $$;

-- Backfill events for tickets that predate this migration (none in a fresh install).
INSERT INTO bloom_support.ticket_events(ticket_id, kind, to_value, at)
SELECT id, 'status', status, created_at FROM bloom_support.tickets t WHERE NOT EXISTS (SELECT 1 FROM bloom_support.ticket_events e WHERE e.ticket_id = t.id);

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'bloom_support' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
