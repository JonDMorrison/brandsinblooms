-- send-support-emails: internal key for the daily job, and its send ledger.
--
-- The function now requires this project's secret key in the apikey header
-- (it was deployed without any check, so anyone could trigger trial emails and
-- the internal activity review). The daily job sent a literal placeholder
-- bearer token; it now sends the Vault-resolved key, like the other workers.
--
-- The send ledger from 20260331230000 was never created in production. The
-- function now skips a send when the ledger cannot be read, so the table must
-- exist for trial support emails to go out at most once per condition.

CREATE TABLE IF NOT EXISTS public.sent_support_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  condition_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, condition_key)
);

ALTER TABLE public.sent_support_emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sent_support_emails_tenant
  ON public.sent_support_emails (tenant_id);

-- Server-only ledger: no API access for signed-in or anonymous users.
REVOKE ALL ON TABLE public.sent_support_emails FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.sent_support_emails TO service_role;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job
    WHERE username = current_user
      AND jobname = 'send-support-emails'
  LOOP
    PERFORM cron.alter_job(
      v_job.jobid,
      command := $cmd$SELECT net.http_post(
    url := public.internal_function_url('send-support-emails'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', public.get_service_role_key()),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )$cmd$
    );
  END LOOP;
END $$;
