import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface LocationBlockingStatus {
  isBlocked: boolean;
  postalCode: string | null;
  needsConfirmation: boolean;
}

export const LOCATION_BLOCKING_QUERY_KEY = ['location-blocking-status'];

/**
 * Hook to check if a legacy profile needs location confirmation
 * Only returns blocked=true if:
 * - Profile has onboarding_completed_at set (legacy)
 * - AND (postal_code IS NULL OR location_needs_confirmation = true)
 * 
 * Uses React Query for automatic cache invalidation when location is confirmed.
 */
export const useLocationBlockingGuard = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: [...LOCATION_BLOCKING_QUERY_KEY, user?.id],
    queryFn: async (): Promise<LocationBlockingStatus> => {
      if (!user?.id) {
        return {
          isBlocked: false,
          postalCode: null,
          needsConfirmation: false,
        };
      }

      const { data: profile, error } = await supabase
        .from('company_profiles')
        .select('postal_code, location_needs_confirmation, onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !profile) {
        return {
          isBlocked: false,
          postalCode: null,
          needsConfirmation: false,
        };
      }

      const isOnboardingComplete = Boolean(profile.onboarding_completed_at);
      const postalCode = profile.postal_code;
      const needsConfirmation = profile.location_needs_confirmation === true;

      // Only block legacy profiles that completed onboarding but have invalid location
      const isBlocked = isOnboardingComplete && (!postalCode || needsConfirmation);

      return {
        isBlocked,
        postalCode,
        needsConfirmation,
      };
    },
    enabled: !!user?.id,
    staleTime: 60_000, // 1 minute
  });

  return {
    isBlocked: data?.isBlocked ?? false,
    isLoading,
    postalCode: data?.postalCode ?? null,
    needsConfirmation: data?.needsConfirmation ?? false,
  };
};
