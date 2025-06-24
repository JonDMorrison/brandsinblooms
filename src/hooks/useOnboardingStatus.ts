
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setIsLoading(false);
        setIsCompleted(false);
        return;
      }

      try {
        // Check if user has completed onboarding by looking for onboarding_responses
        const { data: onboardingData, error } = await supabase
          .from('onboarding_responses')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
          console.error('Error checking onboarding status:', error);
          setIsCompleted(false);
        } else {
          // If we have onboarding data, consider it completed
          setIsCompleted(!!onboardingData);
        }
      } catch (error) {
        console.error('Error in checkOnboardingStatus:', error);
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { isCompleted, isLoading };
};
