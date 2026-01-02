import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface SenderConfig {
  isVerified: boolean;
  senderEmail: string;
  displayName: string;
  deliveryMethod: 'shared' | 'custom';
  companyName?: string;
  domain?: string;
  domainStatus?: string;
}

export const useSenderConfiguration = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [senderConfig, setSenderConfig] = useState<SenderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSenderConfiguration = useCallback(async () => {
    if (!user?.id || !tenant?.id) {
      setLoading(false);
      return;
    }

    try {
      // Check company_profiles first (legacy)
      const { data: companyProfile, error: companyError } = await supabase
        .from('company_profiles')
        .select('company_name, custom_sender_email, email_auth_status, email_domain, dns_records_verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (companyError) {
        console.error('Error fetching company profile:', companyError);
      }

      // Also check email_domains for any active domains for this tenant
      const { data: activeDomains, error: domainsError } = await supabase
        .from('email_domains')
        .select('domain, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .limit(1);

      if (domainsError) {
        console.error('Error fetching email domains:', domainsError);
      }

      const hasActiveDomain = activeDomains && activeDomains.length > 0;
      const activeDomain = hasActiveDomain ? activeDomains[0] : null;
      
      // Check legacy company_profiles verification
      const hasLegacyVerification = 
        companyProfile?.email_auth_status === 'verified' && 
        companyProfile?.custom_sender_email;

      // Domain is verified if EITHER the email_domains table has an active domain
      // OR the legacy company_profiles has verified status
      const isVerified = hasActiveDomain || !!hasLegacyVerification;
      
      // Use domain from active email_domains first, fall back to company_profiles
      const domain = activeDomain?.domain || companyProfile?.email_domain;
      const senderEmail = domain 
        ? `mail@${domain}` 
        : companyProfile?.custom_sender_email;

      setSenderConfig({
        isVerified,
        senderEmail: isVerified && senderEmail ? senderEmail : 'noreply@bloomsuite.app',
        displayName: companyProfile?.company_name || 'Your Business',
        deliveryMethod: isVerified ? 'custom' : 'shared',
        companyName: companyProfile?.company_name,
        domain: domain,
        domainStatus: activeDomain?.status || (hasLegacyVerification ? 'active' : undefined)
      });
    } catch (error) {
      console.error('Error in fetchSenderConfiguration:', error);
      setSenderConfig({
        isVerified: false,
        senderEmail: 'noreply@bloomsuite.app',
        displayName: 'Your Business',
        deliveryMethod: 'shared'
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, tenant?.id]);

  useEffect(() => {
    fetchSenderConfiguration();
  }, [fetchSenderConfiguration]);

  return {
    senderConfig,
    loading,
    refetch: fetchSenderConfiguration
  };
};