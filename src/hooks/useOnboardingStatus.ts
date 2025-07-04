
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

    try {
      console.log('🔍 useOnboardingStatus: Checking status for user:', user.id);
      
      // Add timeout to database query with reduced time
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 3000); // Reduced from 5000 to 3000
      });

      const queryPromise = supabase
        .from('company_profiles')
        .select('id, first_content_generated, onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: profile, error: dbError } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (dbError && dbError.code !== 'PGRST116') {
        console.error('❌ useOnboardingStatus: Database error:', dbError);
        setError(dbError.message);
        // On database error, assume not completed to be safe
        setIsCompleted(false);
      } else {
        // Enhanced completion check - consider multiple completion indicators
        const completed = !!(profile && (
          profile.first_content_generated || 
          profile.onboarding_completed_at
        ));
        
        console.log('✅ useOnboardingStatus: Status check complete', {
          hasProfile: !!profile,
          hasGeneratedContent: !!profile?.first_content_generated,
          hasCompletedAt: !!profile?.onboarding_completed_at,
          completed
        });
        
        setIsCompleted(completed);
        setError(null);
      }
    } catch (error: any) {
      console.error('❌ useOnboardingStatus: Error in checkOnboardingStatus:', error);
      
      if (error.message === 'Database query timeout') {
        setError('Connection timeout - please try refreshing');
      } else {
        setError(error.message || 'Failed to check onboarding status');
      }
      
      // On timeout or error, assume not completed to be safe
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
