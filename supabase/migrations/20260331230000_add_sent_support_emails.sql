-- Track which onboarding support emails have been sent to prevent duplicates
CREATE TABLE IF NOT EXISTS public.sent_support_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  condition_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, condition_key)
);

-- RLS: only service role needs access (Edge Function with service key)
ALTER TABLE public.sent_support_emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sent_support_emails_tenant
ON public.sent_support_emails (tenant_id);
