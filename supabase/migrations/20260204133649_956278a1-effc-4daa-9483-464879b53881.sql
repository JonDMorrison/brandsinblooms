-- Fix: Update crm_campaigns status constraint to allow 'sending' and 'failed' statuses
-- This fixes the scheduled campaign sending pipeline which was failing silently

-- Drop the existing constraint
ALTER TABLE crm_campaigns 
DROP CONSTRAINT IF EXISTS crm_campaigns_status_check;

-- Add updated constraint with all valid statuses
ALTER TABLE crm_campaigns 
ADD CONSTRAINT crm_campaigns_status_check 
CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed'));