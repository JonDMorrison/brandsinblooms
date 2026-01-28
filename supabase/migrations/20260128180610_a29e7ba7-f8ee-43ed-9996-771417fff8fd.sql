-- ============================================================
-- Phase 0: Form Builder Database Schema
-- Creates forms, form_submissions, form_rate_limits tables
-- Adds consent detail columns to crm_customers
-- ============================================================

-- ============================================================
-- TABLE 1: forms (Form Definitions)
-- ============================================================
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json JSONB NOT NULL DEFAULT '{
    "success_message": "Thank you for your submission!",
    "success_redirect_url": null,
    "submit_button_text": "Submit",
    "show_branding": true,
    "theme": {},
    "notification_emails": []
  }'::jsonb,
  compliance_json JSONB NOT NULL DEFAULT '{
    "email_consent_required": false,
    "email_consent_text": "I agree to receive marketing emails",
    "sms_consent_required": false,
    "sms_consent_text": "I agree to receive SMS messages",
    "double_opt_in": false,
    "gdpr_compliant": false
  }'::jsonb,
  embed_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for forms
CREATE INDEX idx_forms_tenant_id ON public.forms(tenant_id);
CREATE INDEX idx_forms_status ON public.forms(tenant_id, status);

-- Enable RLS on forms
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage forms in their tenant
CREATE POLICY "Users can manage forms for their tenant"
ON public.forms
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = forms.tenant_id 
    AND u.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = forms.tenant_id 
    AND u.id = auth.uid()
  )
);

-- ============================================================
-- TABLE 2: form_submissions (Audit Trail)
-- ============================================================
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  result TEXT NOT NULL DEFAULT 'accepted' CHECK (result IN ('accepted', 'rejected_invalid', 'rejected_rate_limited', 'rejected_spam')),
  reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for form_submissions
CREATE INDEX idx_form_submissions_tenant_id ON public.form_submissions(tenant_id);
CREATE INDEX idx_form_submissions_form_id ON public.form_submissions(form_id);
CREATE INDEX idx_form_submissions_customer_id ON public.form_submissions(customer_id);
CREATE INDEX idx_form_submissions_submitted_at ON public.form_submissions(submitted_at DESC);
CREATE INDEX idx_form_submissions_result ON public.form_submissions(tenant_id, result);

-- Enable RLS on form_submissions
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view/insert submissions for their tenant
CREATE POLICY "Users can view submissions for their tenant"
ON public.form_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = form_submissions.tenant_id 
    AND u.id = auth.uid()
  )
);

-- RLS Policy: Allow service role to insert submissions (for public endpoint)
CREATE POLICY "Service role can manage all submissions"
ON public.form_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABLE 3: form_rate_limits (Abuse Protection)
-- ============================================================
CREATE TABLE public.form_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 1
);

-- Indexes for form_rate_limits
CREATE INDEX idx_form_rate_limits_lookup ON public.form_rate_limits(form_id, ip_hash, window_start);
CREATE INDEX idx_form_rate_limits_cleanup ON public.form_rate_limits(window_start);

-- Enable RLS on form_rate_limits
ALTER TABLE public.form_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only (managed by edge functions)
CREATE POLICY "Service role manages rate limits"
ON public.form_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABLE 4: Add consent detail columns to crm_customers
-- ============================================================
ALTER TABLE public.crm_customers 
ADD COLUMN IF NOT EXISTS email_consent_details JSONB,
ADD COLUMN IF NOT EXISTS sms_consent_details JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.crm_customers.email_consent_details IS 'Stores consent text, page_url, form_id, form_embed_key, captured_at for CASL/TCPA compliance';
COMMENT ON COLUMN public.crm_customers.sms_consent_details IS 'Stores SMS consent text, page_url, form_id, form_embed_key, captured_at for TCPA compliance';

-- ============================================================
-- TRIGGER: Auto-update forms.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_forms_updated_at();

-- ============================================================
-- Comments for table documentation
-- ============================================================
COMMENT ON TABLE public.forms IS 'Form definitions for the Form Builder feature';
COMMENT ON TABLE public.form_submissions IS 'Audit trail for all form submissions with compliance proof';
COMMENT ON TABLE public.form_rate_limits IS 'Rate limiting tracking for public form endpoints';