import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';

// Debug logging to help identify the issue
console.log('LoadingContext: React import:', React);
console.log('LoadingContext: useState import:', useState);

type LoadingPriority = 'auth' | 'onboarding' | 'page';

interface LoadingState {
  isLoading: boolean;
  message: string;
  priority: LoadingPriority;
}

interface LoadingContextType {
  currentLoading: LoadingState | null;
  setLoading: (key: string, state: LoadingState | null) => void;
  clearLoading: (key: string) => void;
  isAnyLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

const PRIORITY_ORDER: Record<LoadingPriority, number> = {
  auth: 1,
  onboarding: 2,
  page: 3,
};

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  console.log('LoadingProvider render: React is', React);
  console.log('LoadingProvider render: useState is', useState);
  
  try {
    // Try using React.useState instead of destructured useState
    const [loadingStates, setLoadingStates] = React.useState<Map<string, LoadingState>>(new Map());

    const setLoading = React.useCallback((key: string, state: LoadingState | null) => {
      setLoadingStates(prev => {
        const newStates = new Map(prev);
        if (state === null) {
          newStates.delete(key);
          console.log(`🔄 LoadingContext: Cleared loading for '${key}'. Active keys:`, Array.from(newStates.keys()));
        } else {
          newStates.set(key, state);
          console.log(`🔄 LoadingContext: Set loading for '${key}' (${state.priority}). Active keys:`, Array.from(newStates.keys()));
        }
        return newStates;
      });
    }, []);

    const clearLoading = React.useCallback((key: string) => {
      setLoading(key, null);
    }, [setLoading]);

    const currentLoading = React.useMemo(() => {
      if (loadingStates.size === 0) return null;

      // Find the highest priority loading state
      let highestPriority: LoadingState | null = null;
      let lowestPriorityNumber = Infinity;

      for (const state of loadingStates.values()) {
        const priorityNumber = PRIORITY_ORDER[state.priority];
        if (priorityNumber < lowestPriorityNumber) {
          lowestPriorityNumber = priorityNumber;
          highestPriority = state;
        }
      }

      return highestPriority;
    }, [loadingStates]);

    const isAnyLoading = loadingStates.size > 0;

    const value = React.useMemo(() => ({
      currentLoading,
      setLoading,
      clearLoading,
      isAnyLoading,
    }), [currentLoading, setLoading, clearLoading, isAnyLoading]);

    return React.createElement(LoadingContext.Provider, { value }, children);
  } catch (error) {
    console.error('LoadingProvider error:', error);
    console.error('React object:', React);
    console.error('useState function:', useState);
    throw error;
  }
};