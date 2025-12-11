-- Opt in all of Jeff's contacts at Brands in Bloom
UPDATE crm_customers 
SET email_opt_in = true,
    email_opt_in_at = NOW(),
    email_consent_source = 'admin_override'
WHERE tenant_id = '0a626809-3f46-45d8-b325-55de9c4ba576'
  AND email IS NOT NULL
  AND email != '';