
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingStatus {
  isCompleted: boolean;
  isLoading: boolean;
}

export const useOnboardingStatus = (): OnboardingStatus => {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        console.log('🔍 useOnboardingStatus: No user, setting not completed');
        setIsCompleted(false);
        setIsLoading(false);
        return;
      }

      console.log('🔍 useOnboardingStatus: Checking for user:', user.id);

      try {
        // Check if user has a company profile (indicates completed onboarding)
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle instead of single to avoid errors

        if (profileError) {
          console.error('❌ useOnboardingStatus: Error checking company profile:', profileError);
          setIsCompleted(false);
        } else if (profile) {
          console.log('✅ useOnboardingStatus: Company profile found, onboarding completed');
          setIsCompleted(true);
        } else {
          console.log('⏳ useOnboardingStatus: No company profile found, checking localStorage...');
          // Also check localStorage as backup
          const localOnboarding = localStorage.getItem(`garden-center-onboarding-${user.id}`);
          const hasLocalData = !!localOnboarding;
          console.log('📱 useOnboardingStatus: Local onboarding data exists:', hasLocalData);
          setIsCompleted(hasLocalData);
        }
      } catch (error) {
        console.error('❌ useOnboardingStatus: Error in checkOnboardingStatus:', error);
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  console.log('🎯 useOnboardingStatus: Final state - isCompleted:', isCompleted, 'isLoading:', isLoading);
  return { isCompleted, isLoading };
};
