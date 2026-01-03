import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface SenderConfig {
  isVerified: boolean;
  senderEmail: string;
  displayName: string;
  deliveryMethod: 'shared' | 'platform' | 'custom';
  companyName?: string;
  domain?: string;
  domainStatus?: string;
  fallbackEmail?: string;
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
      // Priority 1: Check for active custom domain in email_domains table
      const { data: activeDomains, error: domainsError } = await supabase
        .from('email_domains')
        .select('id, domain, status, default_from_email, default_from_name')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (domainsError) {
        console.error('Error fetching email domains:', domainsError);
      }

      const hasActiveDomain = activeDomains && activeDomains.length > 0;
      const activeDomain = hasActiveDomain ? activeDomains[0] : null;

      // If we have an active custom domain, use it (Priority 1)
      if (activeDomain) {
        const domainEmail = activeDomain.default_from_email || `mail@${activeDomain.domain}`;
        const domainName = activeDomain.default_from_name || tenant.name || 'Your Business';

        setSenderConfig({
          isVerified: true,
          senderEmail: domainEmail,
          displayName: domainName,
          deliveryMethod: 'custom',
          companyName: tenant.name,
          domain: activeDomain.domain,
          domainStatus: activeDomain.status,
        });
        setLoading(false);
        return;
      }

      // Track latest domain status (so UI can show pending verification, even while sending via shared/platform)
      const { data: latestDomains, error: latestDomainError } = await supabase
        .from('email_domains')
        .select('domain, status')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestDomainError) {
        console.error('Error fetching latest email domain:', latestDomainError);
      }

      const latestDomain = latestDomains && latestDomains.length > 0 ? latestDomains[0] : null;

      // Priority 2: Check for tenant platform fallback email
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('fallback_sender_email, fallback_from_name, name')
        .eq('id', tenant.id)
        .single();

      if (tenantError) {
        console.error('Error fetching tenant data:', tenantError);
      }

      // Also fetch company_profiles to get the preferred company name
      const { data: companyProfileForName } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // Prefer company_profiles.company_name over tenant.name/fallback_from_name
      const preferredCompanyName =
        companyProfileForName?.company_name ||
        tenantData?.fallback_from_name ||
        tenantData?.name ||
        'BloomSuite';

      if (tenantData?.fallback_sender_email) {
        setSenderConfig({
          isVerified: false,
          senderEmail: tenantData.fallback_sender_email,
          displayName: preferredCompanyName,
          deliveryMethod: 'platform',
          companyName: preferredCompanyName,
          fallbackEmail: tenantData.fallback_sender_email,
          domain: latestDomain?.domain,
          domainStatus: latestDomain?.status,
        });
        setLoading(false);
        return;
      }

      // Priority 3: Check legacy company_profiles for verification status
      const { data: companyProfile, error: companyError } = await supabase
        .from('company_profiles')
        .select('company_name, custom_sender_email, email_auth_status, email_domain, dns_records_verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (companyError) {
        console.error('Error fetching company profile:', companyError);
      }

      // Check legacy company_profiles verification
      const hasLegacyVerification =
        companyProfile?.email_auth_status === 'verified' &&
        companyProfile?.custom_sender_email;

      if (hasLegacyVerification) {
        setSenderConfig({
          isVerified: true,
          senderEmail: companyProfile.custom_sender_email!,
          displayName: companyProfile.company_name || 'Your Business',
          deliveryMethod: 'custom',
          companyName: companyProfile.company_name,
          domain: companyProfile.email_domain,
          domainStatus: 'active',
        });
        setLoading(false);
        return;
      }

      // Priority 4: Fallback to generic BloomSuite sender
      // At this point, we already fetched companyProfileForName above, so use that
      const fallbackDisplayName =
        companyProfileForName?.company_name ||
        companyProfile?.company_name ||
        tenant.name ||
        'BloomSuite';

      setSenderConfig({
        isVerified: false,
        senderEmail: 'noreply@bloomsuite.app',
        displayName: fallbackDisplayName,
        deliveryMethod: 'shared',
        companyName: fallbackDisplayName,
        domain: latestDomain?.domain,
        domainStatus: latestDomain?.status,
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
  }, [user?.id, tenant?.id, tenant?.name]);

  useEffect(() => {
    fetchSenderConfiguration();
  }, [fetchSenderConfiguration]);

  // Auto-refresh when domains/tenant sender settings change (so campaigns switch to custom domain automatically)
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`sender-config-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_domains', filter: `tenant_id=eq.${tenant.id}` },
        () => {
          fetchSenderConfiguration();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
        () => {
          fetchSenderConfiguration();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, fetchSenderConfiguration]);

  return {
    senderConfig,
    loading,
    refetch: fetchSenderConfiguration
  };
};
