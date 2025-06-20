
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingStatus {
  isCompleted: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export const useOnboardingStatus = (): OnboardingStatus => {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        console.log('🔍 useOnboardingStatus: No user, setting not completed');
        setIsCompleted(false);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      console.log('🔍 useOnboardingStatus: Checking status for user:', user.id);

      try {
        setHasError(false);
        setErrorMessage(undefined);

        // Check if user has a company profile (indicates completed onboarding)
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select('id, onboarding_completed_at, first_content_generated')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('❌ useOnboardingStatus: Error checking company profile:', profileError);
          setHasError(true);
          setErrorMessage(`Failed to check onboarding status: ${profileError.message}`);
          setIsCompleted(false);
        } else if (profile && profile.onboarding_completed_at) {
          console.log('✅ useOnboardingStatus: Complete profile found with completion date');
          setIsCompleted(true);
        } else if (profile) {
          console.log('⚠️ useOnboardingStatus: Profile exists but no completion date - partial onboarding');
          // Profile exists but onboarding not marked complete - this might be a partially completed onboarding
          setIsCompleted(false);
        } else {
          console.log('⏳ useOnboardingStatus: No company profile found, checking localStorage...');
          // Also check localStorage as backup
          const localOnboarding = localStorage.getItem(`garden-center-onboarding-${user.id}`);
          const hasLocalData = !!localOnboarding;
          console.log('📱 useOnboardingStatus: Local onboarding data exists:', hasLocalData);
          
          if (hasLocalData) {
            console.log('⚠️ useOnboardingStatus: Found local data but no profile - incomplete onboarding');
            // Local data exists but no profile - this indicates a failed onboarding
            setIsCompleted(false);
            setHasError(true);
            setErrorMessage('Previous setup attempt was incomplete. Please try again.');
          } else {
            setIsCompleted(false);
          }
        }
      } catch (error) {
        console.error('❌ useOnboardingStatus: Unexpected error:', error);
        setHasError(true);
        setErrorMessage(`Unexpected error checking onboarding status: ${error.message}`);
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  console.log('🎯 useOnboardingStatus: Final state:', { 
    isCompleted, 
    isLoading, 
    hasError, 
    errorMessage: errorMessage ? errorMessage.substring(0, 50) + '...' : 'none'
  });

  return { isCompleted, isLoading, hasError, errorMessage };
};
