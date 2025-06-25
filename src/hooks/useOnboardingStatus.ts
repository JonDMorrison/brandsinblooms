
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkOnboardingStatus = async () => {
    if (!user) {
      console.log('🔍 useOnboardingStatus: No user, setting incomplete');
      setIsLoading(false);
      setIsCompleted(false);
      return;
    }

    try {
      console.log('🔍 useOnboardingStatus: Checking status for user:', user.id);
      
      // Check database for authoritative onboarding status
      const { data: profile, error } = await supabase
        .from('company_profiles')
        .select('id, first_content_generated')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ useOnboardingStatus: Error checking onboarding status:', error);
        setIsCompleted(false);
      } else {
        // User has completed onboarding if they have a profile with content generated
        const completed = !!(profile && profile.first_content_generated);
        
        console.log('✅ useOnboardingStatus: Status check complete', {
          hasProfile: !!profile,
          hasGeneratedContent: !!profile?.first_content_generated,
          completed
        });
        
        setIsCompleted(completed);
      }
    } catch (error) {
      console.error('❌ useOnboardingStatus: Error in checkOnboardingStatus:', error);
      setIsCompleted(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  // Function to force refresh the onboarding status
  const refreshStatus = async () => {
    console.log('🔄 useOnboardingStatus: Force refreshing status...');
    setIsLoading(true);
    await checkOnboardingStatus();
  };

  // Function to mark as completed immediately (for avoiding race conditions)
  const markAsCompleted = () => {
    console.log('✅ useOnboardingStatus: Marking as completed immediately');
    setIsCompleted(true);
  };

  return { isCompleted, isLoading, refreshStatus, markAsCompleted };
};
