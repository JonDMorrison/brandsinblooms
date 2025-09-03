import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';

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
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());

  const setLoading = useCallback((key: string, state: LoadingState | null) => {
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

  const clearLoading = useCallback((key: string) => {
    setLoading(key, null);
  }, [setLoading]);

  const currentLoading = useMemo(() => {
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

  const value = useMemo(() => ({
    currentLoading,
    setLoading,
    clearLoading,
    isAnyLoading,
  }), [currentLoading, setLoading, clearLoading, isAnyLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};