import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  emailDomain?: string;
}

export const useCompanyInfo = () => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'Your Company',
    address: '123 Business St, Suite 100, City, State 12345',
    phone: '(555) 123-4567',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        setIsLoading(true);
        
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('*')
          .single();

        if (error && error.code !== 'PGRST116') {
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
    };

    loadCompanyInfo();
  }, []);

  return {
    companyInfo,
    isLoading
  };
};