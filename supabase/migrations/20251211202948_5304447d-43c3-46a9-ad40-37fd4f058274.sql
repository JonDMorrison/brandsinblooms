-- Add suppressed column to crm_customers
ALTER TABLE crm_customers 
ADD COLUMN IF NOT EXISTS suppressed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS suppressed_at timestamptz,
ADD COLUMN IF NOT EXISTS suppressed_reason text,
ADD COLUMN IF NOT EXISTS last_open_at timestamptz;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_crm_customers_suppressed ON crm_customers(tenant_id, suppressed) WHERE suppressed = true;
CREATE INDEX IF NOT EXISTS idx_crm_customers_last_open ON crm_customers(tenant_id, last_open_at);

-- Function to update last_open_at when customer opens an email
CREATE OR REPLACE FUNCTION update_customer_last_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'opened' THEN
    UPDATE crm_customers 
    SET 
      last_open_at = NEW.created_at,
      suppressed = false,
      suppressed_at = NULL,
      suppressed_reason = NULL
    WHERE email = NEW.customer_email
      AND suppressed = true;
    
    -- Also update last_open_at for non-suppressed customers
    UPDATE crm_customers 
    SET last_open_at = NEW.created_at
    WHERE email = NEW.customer_email
      AND suppressed = false
      AND (last_open_at IS NULL OR last_open_at < NEW.created_at);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-unsuppression on open
DROP TRIGGER IF EXISTS trg_update_customer_last_open ON email_tracking_events;
CREATE TRIGGER trg_update_customer_last_open
AFTER INSERT ON email_tracking_events
FOR EACH ROW
EXECUTE FUNCTION update_customer_last_open();