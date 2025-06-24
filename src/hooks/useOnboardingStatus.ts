
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
      
      // First check localStorage for immediate feedback
      const hasLocalData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      if (hasLocalData) {
        console.log('✅ useOnboardingStatus: Found localStorage data, marking as completed');
        setIsCompleted(true);
      }
      
      // Then check database for authoritative status
      const { data: onboardingData, error } = await supabase
        .from('onboarding_responses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ useOnboardingStatus: Error checking onboarding status:', error);
        // If there's localStorage data but DB error, trust localStorage
        if (hasLocalData) {
          setIsCompleted(true);
        } else {
          setIsCompleted(false);
        }
      } else {
        const dbCompleted = !!onboardingData;
        const localCompleted = !!hasLocalData;
        
        // Use OR logic - if either localStorage or DB shows completed, consider it completed
        const finalCompleted = dbCompleted || localCompleted;
        
        console.log('✅ useOnboardingStatus: Status check complete', {
          dbCompleted,
          localCompleted,
          finalCompleted
        });
        
        setIsCompleted(finalCompleted);
      }
    } catch (error) {
      console.error('❌ useOnboardingStatus: Error in checkOnboardingStatus:', error);
      
      // Fallback to localStorage if DB fails
      const hasLocalData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      setIsCompleted(!!hasLocalData);
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
