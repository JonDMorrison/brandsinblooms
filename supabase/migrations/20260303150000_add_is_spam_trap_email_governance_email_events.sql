-- Ensure email_governance_email_events has spam-trap flag.
-- Some environments may have applied table-repair migrations out of order.

DO $$
BEGIN
  IF to_regclass('public.email_governance_email_events') IS NOT NULL THEN
    ALTER TABLE public.email_governance_email_events
      ADD COLUMN IF NOT EXISTS is_spam_trap BOOLEAN NOT NULL DEFAULT false;

    -- Index used by governance reporting/analytics.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_email_gov_events_tenant_spamtrap_time '
            'ON public.email_governance_email_events (tenant_id, is_spam_trap, event_ts_provider DESC, ingested_at DESC) '
            'WHERE is_spam_trap = true';
  END IF;
END
$$;
