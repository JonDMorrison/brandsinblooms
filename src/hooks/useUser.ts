
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUser = () => {
  const { user } = useAuth();
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user has any campaigns
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        // Check if user has a company profile
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('id, first_content_generated')
          .eq('user_id', user.id)
          .single();

        const hasNoCampaigns = !campaigns || campaigns.length === 0;
        const hasNoProfile = !profile;
        const hasNotGeneratedContent = !profile?.first_content_generated;

        setIsNewUser(hasNoCampaigns || hasNoProfile || hasNotGeneratedContent);
      } catch (error) {
        console.error('Error checking user status:', error);
        setIsNewUser(true);
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [user]);

  return { isNewUser, loading };
};
