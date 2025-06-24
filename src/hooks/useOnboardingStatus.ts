
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
      
      // Check if user has completed onboarding by looking for onboarding_responses
      const { data: onboardingData, error } = await supabase
        .from('onboarding_responses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('❌ useOnboardingStatus: Error checking onboarding status:', error);
        setIsCompleted(false);
      } else {
        // If we have onboarding data, consider it completed
        const completed = !!onboardingData;
        console.log('✅ useOnboardingStatus: Onboarding status:', completed ? 'COMPLETED' : 'NOT COMPLETED');
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
