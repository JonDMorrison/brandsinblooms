-- Create sms_compliance_events table for tracking STOP/START/HELP events
CREATE TABLE IF NOT EXISTS public.sms_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  customer_id uuid REFERENCES crm_customers(id),
  phone text NOT NULL,
  event_type text NOT NULL, -- 'STOP', 'START', 'HELP', 'CARRIER_OPT_OUT'
  message_content text,
  source text DEFAULT 'inbound_sms', -- 'inbound_sms', 'twilio_callback', 'manual'
  twilio_sid text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- Enable RLS
ALTER TABLE public.sms_compliance_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their tenant sms_compliance_events"
ON public.sms_compliance_events
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Service role can insert sms_compliance_events"
ON public.sms_compliance_events
FOR INSERT
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_sms_compliance_events_tenant ON sms_compliance_events(tenant_id);
CREATE INDEX idx_sms_compliance_events_customer ON sms_compliance_events(customer_id);
CREATE INDEX idx_sms_compliance_events_phone ON sms_compliance_events(phone);
CREATE INDEX idx_sms_compliance_events_type ON sms_compliance_events(event_type);
CREATE INDEX idx_sms_compliance_events_created ON sms_compliance_events(created_at DESC);