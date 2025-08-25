
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkOnboardingStatus = async () => {
    if (!user) {
      console.log('🔍 useOnboardingStatus: No user, setting incomplete');
      setIsLoading(false);
      setIsCompleted(false);
      setError(null);
      return;
    }

    console.log('🔍 useOnboardingStatus: Checking status for user:', user.id);
    
    try {
      // Use order and limit to get the most recent profile (handles duplicates)
      const { data: profile, error: dbError } = await supabase
        .from('company_profiles')
        .select('onboarding_completed_at, company_name, first_content_generated')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError && dbError.code !== 'PGRST116') {
        console.error('❌ useOnboardingStatus: Database error:', dbError);
        setError(dbError.message);
        setIsCompleted(false);
      } else if (!profile) {
        // No profile found - definitely not completed
        console.log('📝 useOnboardingStatus: No profile found');
        setIsCompleted(false);
        setError(null);
      } else {
        // Consider complete if has onboarding_completed_at OR first_content_generated
        // This provides multiple completion criteria and better handles edge cases
        const completed = !!(
          (profile.onboarding_completed_at && profile.company_name) ||
          profile.first_content_generated
        );
        
        console.log('✅ useOnboardingStatus: Status check complete', {
          hasProfile: !!profile,
          hasCompletedAt: !!profile?.onboarding_completed_at,
          hasCompanyName: !!profile?.company_name,
          hasFirstContent: !!profile?.first_content_generated,
          completed
        });
        
        setIsCompleted(completed);
        setError(null);
      }
    } catch (error: any) {
      console.error('❌ useOnboardingStatus: Error in checkOnboardingStatus:', error);
      setError(error.message || 'Failed to check onboarding status');
      setIsCompleted(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Immediate check with shorter delay
    const timer = setTimeout(() => {
      checkOnboardingStatus();
    }, 50); // Reduced from 100ms to 50ms

    return () => clearTimeout(timer);
  }, [user]);

  // Function to force refresh the onboarding status
  const refreshStatus = async () => {
    console.log('🔄 useOnboardingStatus: Force refreshing status...');
    setIsLoading(true);
    setError(null);
    await checkOnboardingStatus();
  };

  // Function to mark as completed immediately (for avoiding race conditions)
  const markAsCompleted = () => {
    console.log('✅ useOnboardingStatus: Marking as completed immediately');
    setIsCompleted(true);
    setError(null);
    setIsLoading(false);
  };

  return { isCompleted, isLoading, error, refreshStatus, markAsCompleted };
};
