-- Slack is a transport for existing staff permissions, never a new identity.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
CREATE TABLE bloom_support.slack_repair_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id),
  engineering_issue_id uuid NOT NULL REFERENCES bloom_support.engineering_issues(id),
  ticket_version integer NOT NULL,
  message_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  engineering_version integer NOT NULL,
  job_id uuid NOT NULL UNIQUE REFERENCES bloom_support.jobs(id),
  channel_id text NOT NULL CHECK (channel_id = 'C0CFNEQBS2X'),
  message_ts text,
  root_ts text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  choice text CHECK (choice IN ('do','reject')),
  decided_by uuid REFERENCES bloom_support.principals(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (message_ts IS NULL OR message_ts ~ '^[0-9]{10}[.][0-9]{6}$'),
  CHECK (root_ts IS NULL OR root_ts ~ '^[0-9]{10}[.][0-9]{6}$')
);
ALTER TABLE bloom_support.slack_repair_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.slack_repair_decisions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bloom_support_slack_repair_snapshot(p_ticket uuid, p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t bloom_support.tickets; e bloom_support.engineering_issues; d bloom_support.slack_repair_decisions;
BEGIN
  IF coalesce(bloom_support.setting('slack')->>'enabled','false') <> 'true' THEN RETURN NULL; END IF;
  SELECT * INTO t FROM bloom_support.tickets WHERE id = p_ticket;
  IF NOT FOUND OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL
    OR t.status = 'resolved' OR t.automation <> 'auto' OR t.executor <> 'bloom'
    OR t.kind <> 'bug' OR t.pending_review IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id = t.engineering_issue_id;
  IF NOT FOUND OR e.status <> 'open' OR e.repair_started_at IS NOT NULL
    OR coalesce((e.reproduction->>'needs_human')::boolean,false)
    OR coalesce(e.reproduction->>'result','') = 'not_reproduced'
    OR coalesce((e.evidence->>'dispatches')::int,0) >= coalesce((bloom_support.setting('limits')->>'max_repair_attempts')::int,2)
  THEN RETURN NULL; END IF;
  -- A card cannot grant a shared repair for an undisclosed second ticket.
  IF (SELECT count(*) FROM bloom_support.tickets WHERE engineering_issue_id=e.id) <> 1
    OR NOT EXISTS (SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id=e.id AND reason='engineering_start_requested' AND status<>'resolved')
    OR NOT EXISTS (SELECT 1 FROM bloom_support.jobs WHERE id=p_job AND ticket_id=t.id AND kind='notify')
    OR EXISTS (SELECT 1 FROM bloom_support.slack_repair_decisions WHERE ticket_id=t.id AND engineering_issue_id=e.id AND engineering_version=e.version AND choice='reject')
  THEN RETURN NULL; END IF;
  INSERT INTO bloom_support.slack_repair_decisions(ticket_id,engineering_issue_id,ticket_version,engineering_version,job_id,channel_id,message_ids)
  VALUES(t.id,e.id,t.version,e.version,p_job,'C0CFNEQBS2X',ARRAY(SELECT id FROM bloom_support.messages WHERE conversation_id=t.conversation_id AND author_kind IN ('client','staff') ORDER BY id)) ON CONFLICT(job_id) DO NOTHING;
  SELECT * INTO d FROM bloom_support.slack_repair_decisions WHERE job_id=p_job;
  IF d.ticket_id IS DISTINCT FROM t.id OR d.ticket_version<>t.version OR d.engineering_version<>e.version
    OR d.expires_at<=now() OR d.choice IS NOT NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',d.id,'action','start-repair','ticket_id',d.ticket_id,'engineering_issue_id',d.engineering_issue_id,'ticket_version',d.ticket_version,
    'engineering_version',d.engineering_version,'message_ids',to_jsonb(d.message_ids),'expires_at',d.expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_bind_slack_repair(p_decision uuid,p_message_ts text,p_root_ts text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_message_ts IS NULL OR p_root_ts IS NULL OR p_message_ts !~ '^[0-9]{10}[.][0-9]{6}$' OR p_root_ts !~ '^[0-9]{10}[.][0-9]{6}$'
  THEN RAISE EXCEPTION 'invalid Slack message' USING ERRCODE='22023'; END IF;
  UPDATE bloom_support.slack_repair_decisions SET message_ts=p_message_ts,root_ts=p_root_ts
  WHERE id=p_decision AND (message_ts IS NULL OR (message_ts=p_message_ts AND root_ts=p_root_ts));
  IF NOT FOUND THEN RAISE EXCEPTION 'conflict: recommendation already bound' USING ERRCODE='40001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bloom_support_apply_slack_repair(p_decision uuid,p_user_id text,p_channel text,p_message_ts text,p_choice text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d bloom_support.slack_repair_decisions; t bloom_support.tickets; e bloom_support.engineering_issues; a uuid;
BEGIN
  IF coalesce(bloom_support.setting('slack')->>'enabled','false') <> 'true' THEN RETURN jsonb_build_object('applied',false,'reason','disabled'); END IF;
  IF p_choice IS NULL OR p_choice NOT IN ('do','reject') OR p_user_id IS NULL OR p_user_id !~ '^[UW][A-Z0-9]{8,24}$'
    OR p_channel IS DISTINCT FROM 'C0CFNEQBS2X' OR p_message_ts IS NULL OR p_message_ts !~ '^[0-9]{10}[.][0-9]{6}$'
  THEN RETURN jsonb_build_object('applied',false,'reason','unauthorized'); END IF;
  SELECT pr.id INTO a FROM bloom_support.slack_staff_principals m JOIN bloom_support.principals pr ON pr.id=m.principal_id
  WHERE m.slack_user_id=p_user_id AND m.enabled AND pr.active AND pr.role IN ('platform_admin','platform_operator')
    AND bloom_support.has_permission(pr.id,'engineering.dispatch') AND bloom_support.has_permission(pr.id,'tickets.write')
  FOR SHARE OF m,pr;
  IF a IS NULL THEN RETURN jsonb_build_object('applied',false,'reason','unauthorized'); END IF;
  SELECT * INTO d FROM bloom_support.slack_repair_decisions WHERE id=p_decision FOR UPDATE;
  IF NOT FOUND OR d.channel_id IS DISTINCT FROM p_channel OR d.message_ts IS DISTINCT FROM p_message_ts
    OR bloom_support.can_read_ticket(a,d.ticket_id) IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM bloom_support.slack_ticket_threads WHERE ticket_id=d.ticket_id AND channel_id=p_channel AND root_ts=d.root_ts)
  THEN RETURN jsonb_build_object('applied',false,'reason','unauthorized'); END IF;
  IF d.choice IS NOT NULL THEN RETURN jsonb_build_object('applied',false,'reason','already_recorded'); END IF;
  IF d.expires_at<=now() THEN RETURN jsonb_build_object('applied',false,'reason','expired'); END IF;
  -- Match the existing engineering writer's lock order. Recheck all scope after locks.
  SELECT * INTO e FROM bloom_support.engineering_issues WHERE id=d.engineering_issue_id FOR UPDATE;
  PERFORM id FROM bloom_support.escalations WHERE engineering_issue_id=e.id AND reason='engineering_start_requested' ORDER BY id FOR UPDATE;
  SELECT * INTO t FROM bloom_support.tickets WHERE id=d.ticket_id FOR UPDATE;
  IF d.message_ids IS DISTINCT FROM ARRAY(SELECT id FROM bloom_support.messages WHERE conversation_id=t.conversation_id AND author_kind IN ('client','staff') ORDER BY id)
    OR t.version IS DISTINCT FROM d.ticket_version OR e.version IS DISTINCT FROM d.engineering_version
    OR t.engineering_issue_id IS DISTINCT FROM e.id OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL
    OR t.status='resolved' OR t.kind<>'bug' OR t.pending_review IS NOT NULL OR t.automation<>'auto' OR t.executor<>'bloom'
    OR e.status<>'open' OR e.repair_started_at IS NOT NULL
    OR coalesce((e.reproduction->>'needs_human')::boolean,false)
    OR (SELECT count(*) FROM bloom_support.tickets WHERE engineering_issue_id=e.id)<>1
    OR NOT EXISTS(SELECT 1 FROM bloom_support.escalations WHERE engineering_issue_id=e.id AND reason='engineering_start_requested' AND status<>'resolved')
  THEN RETURN jsonb_build_object('applied',false,'reason','stale'); END IF;
  IF p_choice='do' THEN
    -- Existing function owns authorization, attempt limits, audit and job dispatch.
    PERFORM bloom_support.update_engineering_issue(a,e.id,jsonb_build_object('version',e.version,'start_repair',true,'note','Approved current repair recommendation in Slack'));
  ELSE
    -- Decline the recommendation, not the customer ticket. No close, send, takeover,
    -- feature decision, access change, or release is implied by this button.
    UPDATE bloom_support.escalations SET status='resolved',decision='Repair recommendation declined in Slack',decided_by=a,resolved_at=now()
      WHERE engineering_issue_id=e.id AND reason='engineering_start_requested' AND status<>'resolved';
    UPDATE bloom_support.tickets SET status='needs_owner',next_action='Repair recommendation declined. Review another approach in Bloom Support.',
      version=version+1,updated_at=now() WHERE id=t.id;
  END IF;
  UPDATE bloom_support.slack_repair_decisions SET choice=p_choice,decided_by=a,decided_at=now() WHERE id=d.id;
  PERFORM bloom_support.log(t.id,t.account_id,a,'slack.repair_decision',jsonb_build_object('decision_id',d.id,'choice',p_choice,'engineering_issue_id',e.id,'engineering_version',e.version));
  RETURN jsonb_build_object('applied',true,'choice',p_choice);
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_slack_repair_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_bind_slack_repair(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bloom_support_apply_slack_repair(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_repair_snapshot(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_bind_slack_repair(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bloom_support_apply_slack_repair(uuid,text,text,text,text) TO service_role;
