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
        .maybeSingle(); // Use maybeSingle instead of single

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
  }, [user?.id]); // Only depend on user.id

  useEffect(() => {
    loadCompanyInfo();
  }, [loadCompanyInfo]);

  return useMemo(() => ({
    companyInfo,
    isLoading
  }), [companyInfo, isLoading]);
};