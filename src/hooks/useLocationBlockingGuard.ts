import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LocationBlockingStatus {
  isBlocked: boolean;
  isLoading: boolean;
  postalCode: string | null;
  needsConfirmation: boolean;
}

/**
 * Hook to check if a legacy profile needs location confirmation
 * Only returns blocked=true if:
 * - Profile has onboarding_completed_at set (legacy)
 * - AND (postal_code IS NULL OR location_needs_confirmation = true)
 */
export const useLocationBlockingGuard = (): LocationBlockingStatus => {
  const { user } = useAuth();
  const [status, setStatus] = useState<LocationBlockingStatus>({
    isBlocked: false,
    isLoading: true,
    postalCode: null,
    needsConfirmation: false,
  });

  useEffect(() => {
    if (!user?.id) {
      setStatus({
        isBlocked: false,
        isLoading: false,
        postalCode: null,
        needsConfirmation: false,
      });
      return;
    }

    const checkLocationStatus = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('postal_code, location_needs_confirmation, onboarding_completed_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error || !profile) {
          setStatus({
            isBlocked: false,
            isLoading: false,
            postalCode: null,
            needsConfirmation: false,
          });
          return;
        }

        const isOnboardingComplete = Boolean(profile.onboarding_completed_at);
        const postalCode = profile.postal_code;
        const needsConfirmation = profile.location_needs_confirmation === true;

        // Only block legacy profiles that completed onboarding but have invalid location
        const isBlocked = isOnboardingComplete && (!postalCode || needsConfirmation);

        setStatus({
          isBlocked,
          isLoading: false,
          postalCode,
          needsConfirmation,
        });
      } catch (err) {
        console.error('Error checking location blocking status:', err);
        setStatus({
          isBlocked: false,
          isLoading: false,
          postalCode: null,
          needsConfirmation: false,
        });
      }
    };

    checkLocationStatus();
  }, [user?.id]);

  return status;
};
