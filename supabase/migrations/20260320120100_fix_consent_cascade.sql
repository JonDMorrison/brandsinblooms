-- FIX: [issue #28] - Change consent event tables from CASCADE to SET NULL on customer delete
-- This preserves consent audit trail when customers are deleted

ALTER TABLE crm_email_consent_events DROP CONSTRAINT IF EXISTS crm_email_consent_events_customer_id_fkey;
ALTER TABLE crm_email_consent_events ADD CONSTRAINT crm_email_consent_events_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE SET NULL;

ALTER TABLE crm_sms_consent_events DROP CONSTRAINT IF EXISTS crm_sms_consent_events_customer_id_fkey;
ALTER TABLE crm_sms_consent_events ADD CONSTRAINT crm_sms_consent_events_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE SET NULL;
