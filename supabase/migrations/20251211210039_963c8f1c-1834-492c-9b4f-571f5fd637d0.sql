-- SMS Queue-Based Sending Infrastructure Migration

-- 1. Create sms_send_jobs table for batch job processing
CREATE TABLE IF NOT EXISTS public.sms_send_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.crm_sms_campaigns(id) ON DELETE CASCADE,
  from_phone TEXT,
  messaging_service_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  recipient_message_ids UUID[] NOT NULL,
  batch_index INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.sms_send_jobs IS 'Batch jobs for queue-based SMS sending with warmup enforcement';
COMMENT ON COLUMN public.sms_send_jobs.status IS 'Job status: pending, in_progress, completed, failed';
COMMENT ON COLUMN public.sms_send_jobs.recipient_message_ids IS 'Array of sms_messages.id in this batch';

-- Create indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_status_created_at
  ON public.sms_send_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_campaign
  ON public.sms_send_jobs (campaign_id);

CREATE INDEX IF NOT EXISTS idx_sms_send_jobs_tenant
  ON public.sms_send_jobs (tenant_id);

-- Enable RLS
ALTER TABLE public.sms_send_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_send_jobs (service role bypasses, users see their tenant's jobs)
CREATE POLICY "Users can view their tenant jobs"
  ON public.sms_send_jobs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 2. Add enqueued flag to crm_sms_campaigns for idempotency
ALTER TABLE public.crm_sms_campaigns
  ADD COLUMN IF NOT EXISTS enqueued BOOLEAN NOT NULL DEFAULT false;

-- Add index for fast lookup of enqueued campaigns
CREATE INDEX IF NOT EXISTS idx_crm_sms_campaigns_enqueued
  ON public.crm_sms_campaigns (enqueued) WHERE enqueued = true;

-- 3. Add trigger for updated_at on sms_send_jobs
CREATE OR REPLACE FUNCTION public.update_sms_send_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_send_jobs_updated_at ON public.sms_send_jobs;
CREATE TRIGGER update_sms_send_jobs_updated_at
  BEFORE UPDATE ON public.sms_send_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_send_jobs_updated_at();