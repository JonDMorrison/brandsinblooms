-- Keep successful delivery evidence after Resend advances sent to delivered.
CREATE OR REPLACE FUNCTION bloom_support.readiness_facts(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cron_worker boolean := false; cron_watchdog boolean := false; vault_token boolean := false; vault_alert boolean := false;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'escalations.view');
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-worker'' AND active), EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''bloom-support-watchdog'' AND active)' INTO cron_worker, cron_watchdog;
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_worker_token''), EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ''bloom_support_alert_resend_key'')' INTO vault_token, vault_alert;
  END IF;
  RETURN jsonb_build_object(
    'settings', (SELECT jsonb_object_agg(key, value) FROM bloom_support.settings WHERE key IN ('automation_enabled','client_email_enabled','auto_release_enabled','ai','owners','limits',
                 'automation_scopes','notifications','sla','business_hours','digest','closure','retention')),
    'queue', (SELECT jsonb_build_object('queued', count(*) FILTER (WHERE status = 'queued'), 'running', count(*) FILTER (WHERE status = 'running'),
                 'oldest_ready_queued_at', min(run_after) FILTER (WHERE status = 'queued' AND run_after <= now()),
                 'dead_24h', count(*) FILTER (WHERE status = 'dead' AND updated_at > now() - interval '1 day'),
                 'failed_retrying', count(*) FILTER (WHERE status = 'queued' AND attempts > 0)) FROM bloom_support.jobs),
    'release_policy_set', (SELECT value <> '{}'::jsonb FROM bloom_support.settings WHERE key = 'release_policy'),
    'cron', jsonb_build_object('worker', cron_worker, 'watchdog', cron_watchdog),
    'vault', jsonb_build_object('worker_token', vault_token, 'alert_resend_key', vault_alert),
    'worker', (SELECT jsonb_build_object('last_started_at', max(started_at), 'last_finished_at', max(finished_at),
                 'runs_24h', count(*) FILTER (WHERE started_at > now() - interval '1 day'),
                 'processed_24h', coalesce(sum(processed) FILTER (WHERE started_at > now() - interval '1 day'), 0)) FROM bloom_support.worker_runs),
    'last_seen', jsonb_build_object(
      'intake_crm', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'crm'),
      'intake_cms', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'cms'),
      'intake_pos', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'pos'),
      'intake_public', (SELECT max(created_at) FROM bloom_support.tickets WHERE channel = 'public'),
      'intake_email', (SELECT max(received_at) FROM bloom_support.email_events WHERE outcome LIKE 'created%' OR outcome LIKE 'reply%'),
      'email_sent', (SELECT max(sent_at) FROM bloom_support.outbound_emails WHERE status IN ('sent', 'delivered')),
      'model_call', (SELECT max(created_at) FROM bloom_support.activity WHERE action = 'ai.call'),
      'operation_succeeded', (SELECT max(updated_at) FROM bloom_support.operations WHERE status = 'succeeded'),
      'fix_verified', (SELECT max(updated_at) FROM bloom_support.engineering_issues WHERE status = 'verified'),
      'mcp_or_api_key_used', (SELECT max(last_used_at) FROM bloom_support.api_keys)),
    'staff', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', display_name, 'email', email, 'role', role)), '[]') FROM bloom_support.principals WHERE kind = 'user' AND role <> 'client' AND active),
    'open_alerts', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]') FROM (SELECT * FROM bloom_support.alerts WHERE created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 20) a),
    'knowledge', jsonb_build_object('approved_client', (SELECT count(*) FROM bloom_support.knowledge WHERE approved AND audience = 'client'), 'internal', (SELECT count(*) FROM bloom_support.knowledge WHERE audience = 'internal')));
END $$;
