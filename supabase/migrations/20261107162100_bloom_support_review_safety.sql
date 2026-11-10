-- Keep support review, triage and engineering handoffs safe under concurrent updates.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION bloom_support.set_automation(p_actor uuid, p_ticket uuid, p_mode text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  IF bloom_support.principal_role(p_actor) = 'service' AND p_mode = 'auto' THEN
    RAISE EXCEPTION 'forbidden: Bloom cannot reclaim a ticket' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('human','auto','paused') THEN RAISE EXCEPTION 'invalid mode' USING ERRCODE = '22023'; END IF;
  t := bloom_support.require_ticket(p_actor, p_ticket);
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket FOR UPDATE;
  IF t.status = 'resolved' OR t.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: resolved or merged ticket cannot change automation' USING ERRCODE = '40001';
  END IF;
  UPDATE bloom_support.tickets SET automation = p_mode,
    executor = CASE WHEN p_mode = 'auto' THEN 'bloom' ELSE 'person' END,
    executor_id = CASE WHEN p_mode = 'human' AND bloom_support.is_staff(p_actor) THEN p_actor ELSE NULL END,
    taken_over_by = CASE WHEN p_mode = 'human' THEN p_actor ELSE NULL END,
    taken_over_at = CASE WHEN p_mode = 'human' THEN now() ELSE NULL END,
    owner_id = CASE WHEN p_mode = 'human' THEN coalesce(owner_id, p_actor) ELSE owner_id END,
    version = version + 1, updated_at = now()
  WHERE id = p_ticket RETURNING * INTO t;
  IF p_mode <> 'auto' THEN
    UPDATE bloom_support.jobs SET status = 'cancelled', last_error = 'cancelled: automation ' || p_mode, updated_at = now()
    WHERE ticket_id = p_ticket AND status = 'queued' AND kind IN ('triage','answer','operate','verify_resolution','post_resolution_reply');
    PERFORM bloom_support.invalidate_planned(p_ticket, 'automation ' || p_mode);
  ELSE
    PERFORM bloom_support.enqueue_job('triage', t.id, NULL, 'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
      jsonb_build_object('reason','handed_back'), 'triage:handback:' || t.id::text || ':' || t.version);
  END IF;
  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'automation.' || p_mode, jsonb_build_object('reason', p_reason));
  RETURN bloom_support.ticket_json(p_actor, t, false);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.resolve_escalation(p_actor uuid, p_escalation uuid, p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE x bloom_support.escalations;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.resolve');
  SELECT * INTO x FROM bloom_support.escalations WHERE id = p_escalation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: escalation' USING ERRCODE = 'P0002'; END IF;
  IF x.status = 'resolved' THEN
    IF x.decision IS NOT DISTINCT FROM p_decision THEN RETURN to_jsonb(x); END IF;
    RAISE EXCEPTION 'conflict: escalation was resolved with a different decision' USING ERRCODE = '40001';
  END IF;
  UPDATE bloom_support.escalations SET status = 'resolved', decision = p_decision, decided_by = p_actor, resolved_at = now()
  WHERE id = p_escalation RETURNING * INTO x;
  IF x.ticket_id IS NOT NULL THEN
    UPDATE bloom_support.tickets SET status = CASE WHEN status = 'needs_owner' THEN 'working' ELSE status END,
      stage = CASE WHEN stage = 'escalated' THEN 'triage' ELSE stage END,
      next_action = 'Decision recorded: ' || left(p_decision, 200), version = version + 1, updated_at = now() WHERE id = x.ticket_id;
    PERFORM bloom_support.log(x.ticket_id, NULL, p_actor, 'escalation.resolved', jsonb_build_object('decision', p_decision));
  END IF;
  RETURN to_jsonb(x);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.list_engineering(p_actor uuid, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'engineering.view');
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('tickets',
            (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', t.id, 'number', t.number, 'subject', t.subject, 'account_id', t.account_id,
              'status', t.status, 'automation', t.automation
            )), '[]')
             FROM bloom_support.tickets t WHERE t.engineering_issue_id = e.id)) ORDER BY e.updated_at DESC), '[]')
    FROM (SELECT * FROM bloom_support.engineering_issues WHERE p_status IS NULL OR status = ANY(string_to_array(p_status, ',')) ORDER BY updated_at DESC LIMIT 100) e);
END $$;

CREATE OR REPLACE FUNCTION bloom_support.route_feature_request(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets;
  f uuid;
  feature_status text;
  subscription_id uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  f := coalesce((p->>'feature_request_id')::uuid, t.feature_request_id);
  IF f IS NULL THEN
    INSERT INTO bloom_support.feature_requests(title, description, product)
    VALUES (coalesce(p->>'title', t.subject), coalesce(p->>'description', t.summary), t.product)
    RETURNING id INTO f;
    INSERT INTO bloom_support.escalations(ticket_id, feature_request_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, f, 'jon', 'feature_decision', coalesce(p->>'title', t.subject), 'feature:' || f::text);
    PERFORM bloom_support.notify_staff(t.id, 'feature.awaiting_decision', 'Feature decision: ' || left(coalesce(p->>'title', t.subject), 80), 'jon');
  END IF;

  SELECT status INTO feature_status
  FROM bloom_support.feature_requests
  WHERE id = f
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO t
  FROM bloom_support.tickets
  WHERE id = p_ticket
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: ticket' USING ERRCODE = 'P0002'; END IF;
  IF t.status = 'resolved' OR t.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: resolved or merged ticket cannot be routed' USING ERRCODE = '40001';
  END IF;
  IF bloom_support.principal_role(p_actor) = 'service'
    AND (t.automation <> 'auto' OR t.executor <> 'bloom') THEN
    RAISE EXCEPTION 'conflict: ticket is under human ownership' USING ERRCODE = '40001';
  END IF;
  IF t.engineering_issue_id IS NOT NULL AND (
    t.reopen_count > 0 OR NOT EXISTS (
      SELECT 1 FROM bloom_support.engineering_issues e
      WHERE e.id = t.engineering_issue_id AND e.status IN ('verified','closed')
    )
  ) THEN
    RAISE EXCEPTION 'conflict: linked engineering work requires review before feature routing' USING ERRCODE = '40001';
  END IF;

  INSERT INTO bloom_support.feature_evidence(feature_request_id, ticket_id, account_id, excerpt)
  VALUES (f, t.id, t.account_id, left(coalesce(p->>'excerpt', t.summary), 1000))
  ON CONFLICT DO NOTHING;

  INSERT INTO bloom_support.feature_shipment_subscriptions(feature_request_id, ticket_id, account_id, requester_id)
  VALUES (f, t.id, t.account_id, t.requester_id)
  ON CONFLICT (feature_request_id, ticket_id) DO UPDATE
    SET account_id = coalesce(EXCLUDED.account_id, bloom_support.feature_shipment_subscriptions.account_id),
        requester_id = coalesce(EXCLUDED.requester_id, bloom_support.feature_shipment_subscriptions.requester_id),
        updated_at = now()
  RETURNING id INTO subscription_id;
  PERFORM bloom_support.reconcile_feature_shipment_summary(subscription_id);

  IF feature_status = 'shipped' THEN
    UPDATE bloom_support.tickets
    SET feature_request_id = f,
        kind = 'feature',
        version = version + 1,
        updated_at = now()
    WHERE id = t.id;
    PERFORM bloom_support.begin_feature_shipment_generation(subscription_id, true);
  ELSE
    UPDATE bloom_support.tickets
    SET feature_request_id = f,
        kind = 'feature',
        stage = 'awaiting_decision',
        status = 'needs_owner',
        next_action = 'Admin decides on the feature request',
        version = version + 1,
        updated_at = now()
    WHERE id = t.id;
  END IF;

  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.routed',
    jsonb_build_object('feature_request_id', f, 'shipment_subscription_id', subscription_id));
  RETURN jsonb_build_object('feature_request_id', f, 'shipment_subscription_id', subscription_id);
END
$$;
