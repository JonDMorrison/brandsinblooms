import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const CACHE_KEY_PREFIX = 'onboarding-completed:';

interface OnboardingStatusContextType {
  isCompleted: boolean;
  hasEverCompleted: boolean;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  markAsCompleted: () => void;
}

const OnboardingStatusContext = createContext<
  OnboardingStatusContextType | undefined
>(undefined);

export const useOnboardingStatus = () => {
  const context = useContext(OnboardingStatusContext);
  if (context === undefined) {
    throw new Error(
      "useOnboardingStatus must be used within an OnboardingStatusProvider",
    );
  }
  return context;
};

interface OnboardingStatusProviderProps {
  children: ReactNode;
}

export const OnboardingStatusProvider = ({
  children,
}: OnboardingStatusProviderProps) => {
  const { user } = useAuth();
  // Single localStorage cache key: onboarding-completed:<userId>
  const [hasEverCompleted, setHasEverCompleted] = useState(false);

  // Initialize from cache + clean up legacy keys
  useEffect(() => {
    // Clean up all legacy flags (one-time migration)
    localStorage.removeItem("onboarding-has-completed");
    if (user) {
      // Migrate old key format if present
      const legacyUserFlag = localStorage.getItem(
        `onboarding-has-completed:${user.id}`,
      );
      if (legacyUserFlag === "1") {
        localStorage.setItem(`${CACHE_KEY_PREFIX}${user.id}`, "1");
        localStorage.removeItem(`onboarding-has-completed:${user.id}`);
      }

      const cached =
        localStorage.getItem(`${CACHE_KEY_PREFIX}${user.id}`) === "1";
      setHasEverCompleted(cached);
    } else {
      setHasEverCompleted(false);
    }
  }, [user]);

  // Fetch onboarding status from DB
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["onboarding_status", user?.id],
    queryFn: async () => {
      if (!user) {
        return { isCompleted: false };
      }

      // Optimized query with proper timeout handling
      try {
        const queryPromise = supabase
          .from("company_profiles")
          .select(
            "onboarding_completed_at, company_name, first_content_generated",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Use Promise.race for proper timeout handling
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Onboarding status check timed out")),
            15000,
          ),
        );

        const result = (await Promise.race([
          queryPromise,
          timeoutPromise,
        ])) as any;
        const { data: profile, error: dbError } = result;

        if (dbError && dbError.code !== "PGRST116") {
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
        if (error instanceof Error && error.message.includes("timed out")) {
          return { isCompleted: false };
        }
        throw error;
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 300_000,
    retry: 1,
    gcTime: 300_000,
  });

  const isCompleted = data?.isCompleted ?? false;

  // Sync hasEverCompleted when DB says completed
  useEffect(() => {
    if (user && isCompleted && !hasEverCompleted) {
      setHasEverCompleted(true);
    localStorage.setItem(`${CACHE_KEY_PREFIX}${user.id}`, "1");
    }
  }, [isCompleted, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStatus = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const markAsCompleted = useCallback(() => {
    if (user) {
      setHasEverCompleted(true);
      localStorage.setItem(`${CACHE_KEY_PREFIX}${user.id}`, "1");
    }
  }, [user]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      isCompleted,
      hasEverCompleted,
      isLoading: isLoading || false,
      error: error?.message || null,
      refreshStatus,
      markAsCompleted,
    }),
    [
      isCompleted,
      hasEverCompleted,
      isLoading,
      error,
      refreshStatus,
      markAsCompleted,
    ],
  );
  return (
    <OnboardingStatusContext.Provider value={value}>
      {children}
    </OnboardingStatusContext.Provider>
  );
};
