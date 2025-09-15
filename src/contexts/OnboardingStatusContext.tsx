import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
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
  
  console.log('🔍 OnboardingStatusProvider: Rendering with user:', !!user);
  
  // Clean up legacy global flag (once per app load)
  const [hasEverCompleted, setHasEverCompleted] = useState(false);
  
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

  // Fetch onboarding status with optimized React Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['onboarding_status', user?.id],
    queryFn: async () => {
      if (!user) {
        return { isCompleted: false };
      }
      
      // Optimized query with timeout
      try {
        const queryPromise = supabase
          .from('company_profiles')
          .select('onboarding_completed_at, company_name, first_content_generated')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Set a timeout for the query
        const timeoutId = setTimeout(() => {
          throw new Error('Onboarding status check timed out');
        }, 5000);

        const result = await queryPromise;
        clearTimeout(timeoutId);

        const { data: profile, error: dbError } = result;

        if (dbError && dbError.code !== 'PGRST116') {
          throw new Error(dbError.message);
        }
        
        if (!profile) {
          return { isCompleted: false };
        }
        
        const completed = !!(
          (profile.onboarding_completed_at && profile.company_name) ||
          profile.first_content_generated
        );
        
        return { isCompleted: completed };
      } catch (error) {
        throw error;
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 300_000, // 5 minutes - longer cache
    retry: 1,
    gcTime: 300_000, // Keep in cache for 5 minutes
  });

  const isCompleted = data?.isCompleted ?? false;

  // Update hasEverCompleted when isCompleted becomes true (prevent infinite loop with dependency check)
  useEffect(() => {
    if (user && isCompleted && !hasEverCompleted) {
      setHasEverCompleted(true);
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      console.log('✅ OnboardingStatusProvider: Set hasEverCompleted to true for user:', user.id);
    }
  }, [isCompleted, user]); // Remove hasEverCompleted from deps to prevent infinite loop

  // Memoized functions to prevent re-renders
  const refreshStatus = useCallback(async () => {
    console.log('🔄 OnboardingStatusProvider: Force refreshing status...');
    await refetch();
  }, [refetch]);

  // Function to mark as completed immediately (for avoiding race conditions)
  const markAsCompleted = useCallback(() => {
    if (user) {
      console.log('✅ OnboardingStatusProvider: Marking as completed immediately for user:', user.id);
      setHasEverCompleted(true);
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      // Note: The query will update on next refetch
    }
  }, [user]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isCompleted,
    hasEverCompleted,
    isLoading: isLoading || false,
    error: error?.message || null,
    refreshStatus,
    markAsCompleted
  }), [isCompleted, hasEverCompleted, isLoading, error, refreshStatus, markAsCompleted]);

  console.log('🔍 OnboardingStatusProvider: Providing context value:', value);

  return (
    <OnboardingStatusContext.Provider value={value}>
      {children}
    </OnboardingStatusContext.Provider>
  );
}