import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface OnboardingStatusContextType {
  isCompleted: boolean;
  hasEverCompleted: boolean;
  hasCheckedOnce: boolean;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  markAsCompleted: (payload?: { company_name?: string }) => Promise<void>;
}

export const OnboardingStatusContext = createContext<OnboardingStatusContextType | undefined>(undefined);

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
  
  console.log('🔍 OnboardingStatusProvider: Rendering with user:', !!user);
  
  // State management for onboarding status
  const [hasEverCompleted, setHasEverCompleted] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  
  // Initialize user-specific flag when user becomes available
  useEffect(() => {
    // Clean up legacy global flag once
    const legacyFlag = localStorage.getItem('onboarding-has-completed');
    if (legacyFlag) {
      localStorage.removeItem('onboarding-has-completed');
    }
    
    // Set user-specific flag when user is available
    if (user) {
      const userSpecificFlag = localStorage.getItem(`onboarding-has-completed:${user.id}`) === '1';
      setHasEverCompleted(userSpecificFlag);
    } else {
      setHasEverCompleted(false);
    }
  }, [user]);

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

  // Track when we've completed our first check
  useEffect(() => {
    if (!isLoading && !hasCheckedOnce) {
      setHasCheckedOnce(true);
    }
  }, [isLoading, hasCheckedOnce]);

  const isCompleted = data?.isCompleted ?? false;

  // Update hasEverCompleted when isCompleted becomes true
  useEffect(() => {
    if (user && isCompleted && !hasEverCompleted) {
      setHasEverCompleted(true);
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      console.log('✅ OnboardingStatusProvider: Set hasEverCompleted to true for user:', user.id);
    }
  }, [isCompleted, hasEverCompleted, user]);

  // Function to force refresh the onboarding status
  const refreshStatus = async () => {
    console.log('🔄 OnboardingStatusProvider: Force refreshing status...');
    await refetch();
  };

  // Function to mark as completed - writes to DB and sets localStorage
  const markAsCompleted = async (payload?: { company_name?: string }) => {
    if (!user) return;

    console.log('✅ OnboardingStatusProvider: Marking as completed for user:', user.id);
    
    try {
      // Write to database first
      const { error: updateError } = await supabase
        .from('company_profiles')
        .upsert({
          user_id: user.id,
          onboarding_completed_at: new Date().toISOString(),
          ...(payload?.company_name && { company_name: payload.company_name }),
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error('❌ Failed to update database:', updateError);
        throw updateError;
      }

      // Set sticky completion flag after successful DB write
      setHasEverCompleted(true);
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      
      console.log('✅ OnboardingStatusProvider: Successfully marked as completed');
    } catch (error) {
      console.error('❌ OnboardingStatusProvider: Failed to mark as completed:', error);
      throw error;
    }
  };

  const value = {
    isCompleted,
    hasEverCompleted,
    hasCheckedOnce,
    isLoading: isLoading || false,
    error: error?.message || null,
    refreshStatus,
    markAsCompleted
  };

  console.log('🔍 OnboardingStatusProvider: Providing context value:', value);

  return (
    <OnboardingStatusContext.Provider value={value}>
      {children}
    </OnboardingStatusContext.Provider>
  );
}