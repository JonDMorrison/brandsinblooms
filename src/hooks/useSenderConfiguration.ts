import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SenderConfig {
  isVerified: boolean;
  senderEmail: string;
  displayName: string;
  deliveryMethod: 'custom_domain' | 'shared_sender';
  companyName?: string;
}

export const useSenderConfiguration = () => {
  const { user } = useAuth();
  const [senderConfig, setSenderConfig] = useState<SenderConfig>({
    isVerified: false,
    senderEmail: 'noreply@bloomsuite.email',
    displayName: 'BloomSuite',
    deliveryMethod: 'shared_sender'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSenderConfiguration();
    }
  }, [user?.id]);

  const fetchSenderConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('email_auth_status, custom_sender_email, company_name')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching sender config:', error);
        setLoading(false);
        return;
      }

      const isVerified = data?.email_auth_status === 'verified' && data?.custom_sender_email;
      const companyName = data?.company_name || 'Your Garden Center';

      if (isVerified) {
        setSenderConfig({
          isVerified: true,
          senderEmail: data.custom_sender_email,
          displayName: companyName,
          deliveryMethod: 'custom_domain',
          companyName
        });
      } else {
        setSenderConfig({
          isVerified: false,
          senderEmail: 'noreply@bloomsuite.email',
          displayName: `BloomSuite (on behalf of ${companyName})`,
          deliveryMethod: 'shared_sender',
          companyName
        });
      }
    } catch (error) {
      console.error('Error in fetchSenderConfiguration:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    senderConfig,
    loading,
    refetch: fetchSenderConfiguration
  };
};