-- A bounded read-only explanation of an actual alert notification job.
-- Prevents Slack delivery errors from creating an hourly self-alert loop.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

CREATE OR REPLACE FUNCTION public.bloom_support_slack_alert_context(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j bloom_support.jobs%ROWTYPE;
  v_kind text;
  v_condition text;
  v_count integer := 0;
  v_groups jsonb := '[]'::jsonb;
  v_issue uuid;
  v_matches integer := 0;
  v_detail jsonb := '{}'::jsonb;
  v_reason text;
  v_escalation_status text;
BEGIN
  SELECT * INTO j FROM bloom_support.jobs WHERE id=p_job_id;
  IF NOT FOUND OR j.kind <> 'notify' OR j.payload->>'slack' IS DISTINCT FROM 'true' THEN
    RETURN pg_catalog.jsonb_build_object('actionable',false,'reason','not_a_slack_notification');
  END IF;

  v_kind := j.payload->>'kind';
  IF v_kind = 'alert.dead_jobs' THEN
    -- The watchdog counts every dead job, including Slack notifications. A
    -- failed Slack message must not cause yet another Slack alert next hour.
    SELECT count(*)::int INTO v_count FROM bloom_support.jobs x
     WHERE x.status='dead' AND x.updated_at > j.created_at - interval '1 hour'
       AND x.updated_at <= j.created_at + interval '1 minute'
       AND x.lane NOT LIKE 'slack:%'
       AND NOT (x.kind='notify' AND x.payload->>'slack'='true');
    IF v_count = 0 THEN
      RETURN pg_catalog.jsonb_build_object(
        'actionable',false,'reason','slack_delivery_failures_only',
        'kind','dead_jobs','count',0);
    END IF;
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('type',x.kind,'count',x.n)
      ORDER BY x.n DESC, x.kind
    ),'[]'::jsonb) INTO v_groups
    FROM (
      SELECT x.kind,count(*)::integer AS n FROM bloom_support.jobs x
       WHERE x.status='dead'
         AND x.updated_at > j.created_at - interval '1 hour'
         AND x.updated_at <= j.created_at + interval '1 minute'
         AND x.lane NOT LIKE 'slack:%'
         AND NOT (x.kind='notify' AND x.payload->>'slack'='true')
       GROUP BY x.kind ORDER BY n DESC LIMIT 5
    ) x;
    RETURN pg_catalog.jsonb_build_object(
      'actionable',true,'kind','dead_jobs',
      'count',v_count,'groups',v_groups,
      'customer_impact','unverified');
  END IF;

  IF v_kind LIKE 'alert.%' THEN
    v_condition := substring(v_kind from 7);
    IF v_condition NOT IN (
      'worker_not_running','queue_backlog','email_failures',
      'bloom_tool_failures','bloom_tool_timeouts','bloom_request_errors',
      'bloom_negative_feedback','duplicate_system_segments',
      'orphan_segment_memberships','watchdog_check_failed'
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'actionable',false,'reason','unknown_alert_condition');
    END IF;
    SELECT a.detail INTO v_detail FROM bloom_support.alerts a
     WHERE a.condition=v_condition
       AND a.created_at BETWEEN j.created_at - interval '3 minutes'
                            AND j.created_at + interval '3 minutes'
     ORDER BY abs(extract(epoch FROM (a.created_at-j.created_at))) LIMIT 1;
    IF v_detail IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'actionable',false,'reason','no_matching_alert_evidence');
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'actionable',true,'kind',v_condition,
      'count',greatest(0,least(10000,coalesce(
        CASE WHEN (v_detail->>'jobs') ~ '^[0-9]{1,6}$'
             THEN (v_detail->>'jobs')::int END,
        CASE WHEN (v_detail->>'customers') ~ '^[0-9]{1,6}$'
             THEN (v_detail->>'customers')::int END,
        CASE WHEN (v_detail->>'answers') ~ '^[0-9]{1,6}$'
             THEN (v_detail->>'answers')::int END,0))),
      'customer_impact','unverified');
  END IF;

  IF v_kind = 'engineering.escalated' AND j.ticket_id IS NULL THEN
    -- Some engineering notices were emitted without the ticket ID. Only
    -- attach a ticket when exactly one escalation matches the job timestamp.
    SELECT count(*)::int,(array_agg(t.id))[1] INTO v_matches,v_issue
      FROM bloom_support.engineering_issues e
      JOIN bloom_support.tickets t ON t.engineering_issue_id=e.id
     WHERE e.status='escalated' AND t.spam=false
       AND t.redacted_at IS NULL AND t.merged_into IS NULL
       AND e.updated_at BETWEEN j.created_at - interval '2 minutes'
                            AND j.created_at + interval '2 minutes';
    IF v_matches <> 1 THEN
      RETURN pg_catalog.jsonb_build_object(
        'actionable',false,'reason','ambiguous_engineering_issue');
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'actionable',true,'kind','engineering_escalated',
      'ticket_id',v_issue,'customer_impact','unverified');
  END IF;

  IF j.ticket_id IS NOT NULL AND v_kind IN (
    'escalation.overdue','ticket.overdue','ticket.stalled',
    'ticket.needs_owner','engineering.escalated','engineering.failed',
    'job.dead'
  ) THEN
    IF v_kind='escalation.overdue' THEN
      SELECT e.reason,e.status INTO v_reason,v_escalation_status
        FROM bloom_support.escalations e
       WHERE e.ticket_id=j.ticket_id AND e.status IN ('open','acknowledged')
       ORDER BY e.created_at DESC LIMIT 1;
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'actionable',true,'kind',v_kind,
      'ticket_id',j.ticket_id,
      'escalation_reason',CASE WHEN v_reason IN (
        'engineering_start_requested','engineering_escalated',
        'ticket_overdue','decision_needed','client_reply_human'
      ) THEN v_reason ELSE NULL END,
      'escalation_status',CASE WHEN v_escalation_status IN ('open','acknowledged')
        THEN v_escalation_status ELSE NULL END,
      'customer_impact','unverified');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'actionable',false,'reason','no_actionable_context');
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_alert_context(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_alert_context(uuid)
  TO service_role;
