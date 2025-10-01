import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  emailDomain?: string;
}

export const useCompanyInfo = () => {
  const { user } = useAuth();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'Your Company',
    address: '123 Business St, Suite 100, City, State 12345',
    phone: '(555) 123-4567',
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadCompanyInfo = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: profile, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading company profile:', error);
        return;
      }

      if (profile) {
        const featureFlags = profile.feature_flags as any;
        setCompanyInfo({
          name: profile.company_name || 'Your Company',
          address: profile.location_info || '123 Business St, Suite 100, City, State 12345',
          phone: featureFlags?.company_phone || '(555) 123-4567',
          logoUrl: featureFlags?.company_logo_url,
          emailDomain: profile.email_domain,
        });
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCompanyInfo();
  }, [loadCompanyInfo]);

  // Separate effect for real-time subscription to avoid dependency issues
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('company-profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Company profile updated:', payload);
          // Properly map the updated profile to CompanyInfo structure
          if (payload.new) {
            const profile = payload.new as any;
            const featureFlags = profile.feature_flags as any;
            setCompanyInfo({
              name: profile.company_name || 'Your Company',
              address: profile.location_info || '123 Business St, Suite 100, City, State 12345',
              phone: featureFlags?.company_phone || '(555) 123-4567',
              logoUrl: featureFlags?.company_logo_url,
              emailDomain: profile.email_domain,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return useMemo(() => ({
    companyInfo,
    isLoading
  }), [companyInfo, isLoading]);
};