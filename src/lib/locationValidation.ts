import { supabase } from '@/integrations/supabase/client';

export interface LocationValidationResult {
  isValid: boolean;
  postalCode: string | null;
  needsConfirmation: boolean;
  error?: string;
}

/**
 * Server-side validation to ensure location confirmation invariant is met.
 * No onboarding path may complete while:
 * - company_profiles.postal_code is NULL OR
 * - company_profiles.location_needs_confirmation is true
 */
export const validateLocationConfirmation = async (userId: string): Promise<LocationValidationResult> => {
  try {
    const { data: profile, error: fetchError } = await supabase
      .from('company_profiles')
      .select('postal_code, location_needs_confirmation')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Location validation failed - fetch error:', fetchError);
      return {
        isValid: false,
        postalCode: null,
        needsConfirmation: true,
        error: 'Failed to verify location status'
      };
    }

    // No profile exists yet - this is acceptable during initial creation
    if (!profile) {
      return {
        isValid: false,
        postalCode: null,
        needsConfirmation: true,
        error: 'No profile found - location confirmation required'
      };
    }

    const postalCode = profile.postal_code;
    const needsConfirmation = profile.location_needs_confirmation === true;

    // Invariant check: postal_code must exist AND location_needs_confirmation must be false
    const isValid = !!postalCode && !needsConfirmation;

    if (!isValid) {
      console.warn('⚠️ Location confirmation invariant violated:', {
        userId,
        postalCode: postalCode || 'NULL',
        needsConfirmation
      });
    }

    return {
      isValid,
      postalCode,
      needsConfirmation,
      error: isValid ? undefined : 'Location confirmation required: Please confirm your primary location before completing setup.'
    };
  } catch (error) {
    console.error('❌ Location validation exception:', error);
    return {
      isValid: false,
      postalCode: null,
      needsConfirmation: true,
      error: `Location validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Reusable check that can be called before any onboarding completion
 */
export const enforceLocationConfirmation = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  const validation = await validateLocationConfirmation(userId);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || 'Location confirmation required'
    };
  }

  return { success: true };
};
