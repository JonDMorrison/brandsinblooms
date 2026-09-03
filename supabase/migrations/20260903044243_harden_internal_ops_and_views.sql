-- BloomSuite release gate: operational tables and reporting views must never
-- bypass tenant isolation. Edge functions use the service-role client, which
-- continues to bypass RLS; browsers receive no direct access to internal
-- operational tables.

ALTER TABLE public.provider_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue_html ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provider_rate_limits FROM anon, authenticated;
REVOKE ALL ON TABLE public.idempotency_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.edge_function_errors FROM anon, authenticated;
REVOKE ALL ON TABLE public.reconciliation_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.health_scores FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_queue_html FROM anon, authenticated;

GRANT ALL ON TABLE public.provider_rate_limits TO service_role;
GRANT ALL ON TABLE public.idempotency_log TO service_role;
GRANT ALL ON TABLE public.edge_function_errors TO service_role;
GRANT ALL ON TABLE public.reconciliation_log TO service_role;
GRANT ALL ON TABLE public.health_scores TO service_role;
GRANT ALL ON TABLE public.email_queue_html TO service_role;

COMMENT ON TABLE public.provider_rate_limits IS
  'Internal provider throttle state. Service-role access only.';
COMMENT ON TABLE public.idempotency_log IS
  'Internal idempotency ledger. Service-role access only.';
COMMENT ON TABLE public.edge_function_errors IS
  'Internal edge-function error ledger. Service-role access only.';
COMMENT ON TABLE public.reconciliation_log IS
  'Internal Stripe/Notion reconciliation ledger. Service-role access only.';
COMMENT ON TABLE public.health_scores IS
  'Internal operational health ledger. Service-role access only.';
COMMENT ON TABLE public.email_queue_html IS
  'Internal queued-email payloads. Service-role access only.';

-- These tenant-scoped views must execute with the caller's privileges so the
-- RLS policies on their source tables remain effective.
ALTER VIEW public.content_library_view SET (security_invoker = true);
ALTER VIEW public.customer_360_enriched SET (security_invoker = true);
ALTER VIEW public.deliverability_summary_30d SET (security_invoker = true);
ALTER VIEW public.email_domain_stats_30d SET (security_invoker = true);

REVOKE ALL ON TABLE public.content_library_view FROM anon;
REVOKE ALL ON TABLE public.customer_360_enriched FROM anon;
REVOKE ALL ON TABLE public.deliverability_summary_30d FROM anon;
REVOKE ALL ON TABLE public.email_domain_stats_30d FROM anon;

REVOKE ALL ON TABLE public.content_library_view FROM authenticated;
REVOKE ALL ON TABLE public.customer_360_enriched FROM authenticated;
REVOKE ALL ON TABLE public.deliverability_summary_30d FROM authenticated;
REVOKE ALL ON TABLE public.email_domain_stats_30d FROM authenticated;

GRANT SELECT ON TABLE public.content_library_view TO authenticated;
GRANT SELECT ON TABLE public.customer_360_enriched TO authenticated;
GRANT SELECT ON TABLE public.deliverability_summary_30d TO authenticated;
GRANT SELECT ON TABLE public.email_domain_stats_30d TO authenticated;

-- admin_tenant_overview includes auth.users data. Only the guarded
-- admin_list_tenants/admin_get_stats SECURITY DEFINER RPCs may read it.
ALTER VIEW public.admin_tenant_overview SET (security_invoker = true);
REVOKE ALL ON TABLE public.admin_tenant_overview FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_tenant_overview TO service_role;

-- Remove legacy cron jobs that either contain a literal JWT or duplicate a
-- healthy v2 job. Leaving them active generated a failed run every minute.
-- Two jobs are owned by postgres and can be removed directly.
SELECT cron.unschedule('watchdog-stuck-content');
SELECT cron.unschedule('run-automation-executor-5m');

-- Six older jobs were created by Supabase's reserved SQL-editor role. The
-- platform intentionally prevents migrations from assuming that role, so
-- those jobs must be removed through Supabase's Cron control plane.

-- The watchdog has no v2 replacement, so recreate it using the Vault-backed
-- key helper. jsonb_build_object avoids the string-concatenation bug that
-- affected another automation cron.
SELECT cron.schedule(
  'watchdog-stuck-content',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/watchdog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_service_role_key()
      ),
      body := jsonb_build_object('time', now()::text, 'trigger', 'cron')
    ) AS request_id
  $cron$
);
