-- Function to sync email_domains status to company_profiles
CREATE OR REPLACE FUNCTION sync_email_domain_to_company_profile()
RETURNS TRIGGER AS $$
DECLARE
  profile_user_id UUID;
BEGIN
  -- Only act when status changes to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Get the user_id for this tenant (primary user)
    SELECT u.id INTO profile_user_id
    FROM users u
    WHERE u.tenant_id = NEW.tenant_id
    ORDER BY u.created_at ASC
    LIMIT 1;
    
    IF profile_user_id IS NOT NULL THEN
      UPDATE company_profiles
      SET 
        email_auth_status = 'verified',
        email_domain = NEW.domain,
        custom_sender_email = 'mail@' || NEW.domain,
        dns_records_verified = true,
        email_auth_setup_at = NOW(),
        updated_at = NOW()
      WHERE user_id = profile_user_id;
      
      RAISE NOTICE 'Synced email_domain % to company_profile for user %', NEW.domain, profile_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_email_domain_verification ON email_domains;
CREATE TRIGGER trigger_sync_email_domain_verification
  AFTER UPDATE ON email_domains
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_domain_to_company_profile();