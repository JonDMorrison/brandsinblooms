import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface OnboardingStatusContextType {
  isCompleted: boolean;
  hasEverCompleted: boolean;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  markAsCompleted: () => void;
}

const OnboardingStatusContext = createContext<OnboardingStatusContextType | undefined>(undefined);

export const useOnboardingStatus = () => {
  const context = useContext(OnboardingStatusContext);
  if (context === undefined) {
    throw new Error('useOnboardingStatus must be used within an OnboardingStatusProvider');
  }
  return context;
};

interface OnboardingStatusProviderProps {
  children: ReactNode;
}

export const OnboardingStatusProvider = ({ children }: OnboardingStatusProviderProps) => {
  const { user } = useAuth();
  
  // Sticky flag - once completed, stays completed for the session
  const [hasEverCompleted, setHasEverCompleted] = useState(() => {
    // Initialize from localStorage if available
    return localStorage.getItem('onboarding-has-completed') === '1';
  });

  // Fetch onboarding status with stable React Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['onboarding_status', user?.id],
    queryFn: async () => {
      if (!user) {
        console.log('🔍 OnboardingStatusProvider: No user, setting incomplete');
        return { isCompleted: false };
      }

      console.log('🔍 OnboardingStatusProvider: Checking status for user:', user.id);
      
      // Use order and limit to get the most recent profile (handles duplicates)
      const { data: profile, error: dbError } = await supabase
        .from('company_profiles')
        .select('onboarding_completed_at, company_name, first_content_generated')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError && dbError.code !== 'PGRST116') {
        console.error('❌ OnboardingStatusProvider: Database error:', dbError);
        throw new Error(dbError.message);
      } else if (!profile) {
        // No profile found - definitely not completed
        console.log('📝 OnboardingStatusProvider: No profile found');
        return { isCompleted: false };
      } else {
        // Consider complete if has onboarding_completed_at OR first_content_generated
        // This provides multiple completion criteria and better handles edge cases
        const completed = !!(
          (profile.onboarding_completed_at && profile.company_name) ||
          profile.first_content_generated
        );
        
        console.log('✅ OnboardingStatusProvider: Status check complete', {
          hasProfile: !!profile,
          hasCompletedAt: !!profile?.onboarding_completed_at,
          hasCompanyName: !!profile?.company_name,
          hasFirstContent: !!profile?.first_content_generated,
          completed
        });
        
        return { isCompleted: completed };
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000, // 1 minute
    retry: 1,
  });

  const isCompleted = data?.isCompleted ?? false;

  // Update hasEverCompleted when isCompleted becomes true
  useEffect(() => {
    if (isCompleted && !hasEverCompleted) {
      setHasEverCompleted(true);
      localStorage.setItem('onboarding-has-completed', '1');
      console.log('✅ OnboardingStatusProvider: Set hasEverCompleted to true');
    }
  }, [isCompleted, hasEverCompleted]);

  // Function to force refresh the onboarding status
  const refreshStatus = async () => {
    console.log('🔄 OnboardingStatusProvider: Force refreshing status...');
    await refetch();
  };

  // Function to mark as completed immediately (for avoiding race conditions)
  const markAsCompleted = () => {
    console.log('✅ OnboardingStatusProvider: Marking as completed immediately');
    setHasEverCompleted(true);
    localStorage.setItem('onboarding-has-completed', '1');
    // Note: The query will update on next refetch
  };

  const value = {
    isCompleted,
    hasEverCompleted,
    isLoading,
    error: error?.message || null,
    refreshStatus,
    markAsCompleted
  };

  return (
    <OnboardingStatusContext.Provider value={value}>
      {children}
    </OnboardingStatusContext.Provider>
  );
};