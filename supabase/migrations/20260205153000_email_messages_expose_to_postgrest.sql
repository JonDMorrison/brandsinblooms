-- Ensure `public.email_messages` exists AND is exposed to PostgREST.
-- A PostgREST 404 for a table commonly means the role lacks table privileges,
-- so the table is hidden from the schema cache.

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  domain_id UUID,
  email TEXT NOT NULL,
  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  resend_id TEXT,

  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_token UUID,
  dead_lettered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_campaign_customer
  ON public.email_messages (campaign_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_status
  ON public.email_messages (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_email_messages_claimable
  ON public.email_messages (status, claimed_at, created_at)
  WHERE status IN ('queued', 'sending');

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Grants are required for PostgREST to expose the table, even for service_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_messages TO service_role;
GRANT SELECT ON TABLE public.email_messages TO authenticated;

-- Ensure the service role policy exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_messages'
      AND policyname = 'Service role can manage all email messages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role can manage all email messages"
      ON public.email_messages FOR ALL
      USING (true)
      WITH CHECK (true);
    $policy$;
  END IF;
END$$;

-- updated_at trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_messages_updated_at'
  ) THEN
    EXECUTE $trg$
      CREATE TRIGGER update_email_messages_updated_at
        BEFORE UPDATE ON public.email_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    $trg$;
  END IF;
END$$;

-- Reload PostgREST schema cache so the table becomes visible immediately.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;
