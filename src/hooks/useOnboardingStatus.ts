
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
        setIsLoading(false);
        return;
      }

      try {
        // Check if user has a company profile (indicates completed onboarding)
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking company profile:', profileError);
          setIsCompleted(false);
        } else if (profile) {
          setIsCompleted(true);
        } else {
          // Also check localStorage as backup
          const localOnboarding = localStorage.getItem(`garden-center-onboarding-${user.id}`);
          setIsCompleted(!!localOnboarding);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { isCompleted, isLoading };
};
