-- Add approvals_pending count to the morning digest report so staff can see
-- how many auto-generated replies are held in the approval queue before Bloom sends them.
CREATE OR REPLACE FUNCTION public.bloom_support_digest_report(p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN jsonb_build_object(
    'needs_you', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]') FROM (
        SELECT DISTINCT ON (t.id) jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'client', a.name,
               'reason', e.reason, 'since', e.created_at,
               'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)) x
          FROM bloom_support.escalations e
          JOIN bloom_support.tickets t ON t.id = e.ticket_id
          LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
         WHERE e.status IN ('open','acknowledged') AND t.status <> 'resolved' AND t.merged_into IS NULL AND NOT t.spam AND NOT t.internal_test
         ORDER BY t.id, (e.reason = 'ticket_overdue'), e.created_at DESC
         LIMIT 20) n),
    'resolved', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
                   'by_bloom', coalesce(pr.kind = 'service' OR pr.role = 'service', false), 'summary', t.resolution_summary) ORDER BY ev.at), '[]')
        FROM (SELECT DISTINCT ON (ticket_id) ticket_id, actor_id, at FROM bloom_support.ticket_events
               WHERE kind = 'status' AND to_value = 'resolved' AND at >= p_since ORDER BY ticket_id, at DESC) ev
        JOIN bloom_support.tickets t ON t.id = ev.ticket_id AND t.status = 'resolved' AND NOT t.spam AND NOT t.internal_test AND t.merged_into IS NULL
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        LEFT JOIN bloom_support.principals pr ON pr.id = ev.actor_id),
    'said', (SELECT coalesce(jsonb_agg(jsonb_build_object('number', t.number, 'subject', t.subject, 'client', a.name,
               'body', left(m.body, 600), 'at', m.created_at,'purpose',m.purpose,'delivery',m.delivery,'meaningful',m.meaningful) ORDER BY m.created_at), '[]')
        FROM bloom_support.messages m
        JOIN bloom_support.tickets t ON t.id = m.ticket_id AND NOT t.spam AND NOT t.internal_test
        LEFT JOIN bloom_support.accounts a ON a.id = t.account_id
        WHERE m.author_kind = 'bloom' AND m.visibility = 'public' AND m.withdrawn_at IS NULL AND m.delivery IN ('sent','delivered') AND m.created_at >= p_since),
    'repairs', (SELECT coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'status', e.status,
                  'client', (SELECT a.name FROM bloom_support.tickets t JOIN bloom_support.accounts a ON a.id = t.account_id
                              WHERE t.engineering_issue_id = e.id AND NOT t.internal_test ORDER BY t.created_at LIMIT 1)) ORDER BY e.updated_at DESC), '[]')
        FROM bloom_support.engineering_issues e
        WHERE e.status NOT IN ('open', 'verified', 'closed')
          -- Shared issues remain customer work if any linked ticket is a customer.
          AND (NOT EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id)
            OR EXISTS (SELECT 1 FROM bloom_support.tickets t WHERE t.engineering_issue_id=e.id AND NOT t.internal_test))),
    'alerts', (SELECT coalesce(jsonb_agg(jsonb_build_object('condition', al.condition, 'detail', al.detail, 'at', al.created_at) ORDER BY al.created_at), '[]')
        FROM bloom_support.alerts al WHERE al.created_at >= p_since
          AND NOT EXISTS (SELECT 1 FROM bloom_support.escalations e JOIN bloom_support.tickets t ON t.id=e.ticket_id
            WHERE e.id::text=al.detail->>'escalation_id' AND t.internal_test)),
    'internal_tests', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id',t.id,'number',t.number,'subject',t.subject,'status',t.status,'stage',t.stage,
        'next_action',t.next_action,'engineering_status',e.status,
        'deployment_state',e.deployment->>'state',
        'verification_summary',CASE
          WHEN e.verification IS NULL OR e.verification IN ('null'::jsonb,'{}'::jsonb) THEN 'No check recorded'
          WHEN e.verification->'passed'='false'::jsonb THEN 'A failed check is recorded'
          WHEN e.verification->'passed'='true'::jsonb THEN 'A passing check is recorded; affected-flow coverage and release binding still require review'
          ELSE 'Check evidence recorded; outcome requires review' END,
        'first_response_at',t.first_response_at,'communication',bloom_support.digest_communication(t.id)
      ) ORDER BY t.created_at), '[]')
      FROM bloom_support.tickets t LEFT JOIN bloom_support.engineering_issues e ON e.id=t.engineering_issue_id
      WHERE t.internal_test AND NOT t.spam AND t.merged_into IS NULL
        AND (t.status <> 'resolved' OR t.resolved_at >= p_since)),
    'counts', jsonb_build_object(
      'open',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND status <> 'resolved'),
      'new',(SELECT count(*) FROM bloom_support.tickets WHERE NOT internal_test AND NOT spam AND merged_into IS NULL AND created_at >= p_since)),
    'staff', (SELECT coalesce(jsonb_agg(lower(pr.email)), '[]') FROM bloom_support.principals pr
        WHERE pr.kind = 'user' AND pr.active AND pr.email IS NOT NULL AND pr.role IN ('platform_admin', 'platform_operator')),
    'approvals_pending', (SELECT count(*)::int FROM bloom_support.approval_queue WHERE status = 'pending'));
END $$;
REVOKE ALL ON FUNCTION public.bloom_support_digest_report(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_digest_report(timestamptz) TO service_role;
