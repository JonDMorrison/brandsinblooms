-- Add compliance fields to crm_customers table
ALTER TABLE public.crm_customers 
ADD COLUMN IF NOT EXISTS opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS footer_last_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Create compliance_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'deferred_send' | 'footer_inserted' | 'opt_out' | 'opt_in' | 'help_request'
  msisdn TEXT NOT NULL,
  campaign_id UUID NULL,
  automation_id UUID NULL,
  message_content TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on compliance_logs
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for compliance_logs
CREATE POLICY "Users can manage compliance logs for their tenant" 
ON public.compliance_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.tenant_id = compliance_logs.tenant_id 
    AND u.id = auth.uid()
  )
);

-- Add compliance settings to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS compliance_settings JSONB DEFAULT '{
  "quiet_hours": {"start": "20:00", "end": "08:00"},
  "timezone": "America/New_York",
  "footer_enabled": true,
  "footer_text": "Reply STOP to opt out, HELP for help. Msg&Data Rates May Apply.",
  "help_response": "For support, contact us at support@example.com or call 1-800-XXX-XXXX. Reply STOP to opt out."
}'::jsonb;

-- Create function to update compliance_logs updated_at
CREATE OR REPLACE FUNCTION public.update_compliance_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column and trigger to compliance_logs
ALTER TABLE public.compliance_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TRIGGER update_compliance_logs_updated_at
  BEFORE UPDATE ON public.compliance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_compliance_logs_updated_at();