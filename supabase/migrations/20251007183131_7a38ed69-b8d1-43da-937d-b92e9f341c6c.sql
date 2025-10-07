-- Add from_phone column to crm_sms_campaigns table
ALTER TABLE crm_sms_campaigns 
ADD COLUMN from_phone TEXT NULL;

COMMENT ON COLUMN crm_sms_campaigns.from_phone IS 
'Custom sender phone number for this campaign in E.164 format (e.g., +16048393258). NULL means use global default.';

-- Add from_phone column to sms_messages table
ALTER TABLE sms_messages 
ADD COLUMN from_phone TEXT NULL;

COMMENT ON COLUMN sms_messages.from_phone IS 
'Actual sender phone number used for this message in E.164 format. Copied from campaign or global default.';

-- Create twilio_phone_numbers table for future scalability
CREATE TABLE twilio_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- E.164 format
  friendly_name TEXT NOT NULL, -- e.g., "Main Support", "Marketing Line"
  is_verified BOOLEAN DEFAULT false,
  capabilities JSONB DEFAULT '{"sms": false, "mms": false, "voice": false}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, phone_number)
);

-- Enable RLS on twilio_phone_numbers
ALTER TABLE twilio_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their tenant's phone numbers
CREATE POLICY "Users can view their tenant's phone numbers"
  ON twilio_phone_numbers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.tenant_id = twilio_phone_numbers.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Policy: Users can manage their tenant's phone numbers
CREATE POLICY "Users can manage their tenant's phone numbers"
  ON twilio_phone_numbers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.tenant_id = twilio_phone_numbers.tenant_id 
      AND u.id = auth.uid()
    )
  );

-- Updated_at trigger for twilio_phone_numbers
CREATE TRIGGER update_twilio_phone_numbers_updated_at
  BEFORE UPDATE ON twilio_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();