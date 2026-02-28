CREATE TABLE IF NOT EXISTS public.campaign_hygiene_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  audience_total INTEGER NOT NULL DEFAULT 0,
  duplicate_emails_count INTEGER NOT NULL DEFAULT 0,
  invalid_emails_count INTEGER NOT NULL DEFAULT 0,
  invalid_emails_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  inactive_count INTEGER NOT NULL DEFAULT 0,
  inactive_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  deliverability JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_hygiene_reports_campaign_created
  ON public.campaign_hygiene_reports (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_hygiene_reports_tenant_created
  ON public.campaign_hygiene_reports (tenant_id, created_at DESC);

ALTER TABLE public.campaign_hygiene_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view hygiene reports for their tenant" ON public.campaign_hygiene_reports;
CREATE POLICY "Users can view hygiene reports for their tenant"
  ON public.campaign_hygiene_reports FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));