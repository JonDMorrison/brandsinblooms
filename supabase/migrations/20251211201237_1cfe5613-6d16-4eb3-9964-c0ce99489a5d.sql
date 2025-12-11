-- Create email_send_jobs table for queue-based sending
CREATE TABLE public.email_send_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  domain_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  batch_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.email_send_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_send_jobs
CREATE POLICY "Users can view their tenant's jobs"
  ON public.email_send_jobs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all jobs"
  ON public.email_send_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for efficient queue processing
CREATE INDEX idx_email_send_jobs_pending ON public.email_send_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_email_send_jobs_campaign ON public.email_send_jobs(campaign_id);
CREATE INDEX idx_email_send_jobs_tenant ON public.email_send_jobs(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_email_send_jobs_updated_at
  BEFORE UPDATE ON public.email_send_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();