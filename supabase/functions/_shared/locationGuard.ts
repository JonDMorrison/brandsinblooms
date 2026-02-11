/**
 * Shared location validation guard for edge functions
 * Enforces the invariant: postal_code IS NOT NULL AND location_needs_confirmation = false
 */

import { createClient } from "npm:@supabase/supabase-js@2.7.1";

export interface LocationValidationResult {
  isValid: boolean;
  postalCode: string | null;
  needsConfirmation: boolean;
  error?: string;
  code?: 'LOCATION_NOT_SET' | 'LOCATION_NOT_CONFIRMED' | 'PROFILE_NOT_FOUND';
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validates that a user's location is confirmed before allowing content generation
 */
export async function validateLocationForGeneration(
  userId: string
): Promise<LocationValidationResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: profile, error } = await supabase
      .from('company_profiles')
      .select('postal_code, location_needs_confirmation, onboarding_completed_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Location validation query failed:', error);
      return {
        isValid: false,
        postalCode: null,
        needsConfirmation: true,
        error: 'Failed to verify location status',
      };
    }

    if (!profile) {
      return {
        isValid: false,
        postalCode: null,
        needsConfirmation: true,
        error: 'No profile found',
        code: 'PROFILE_NOT_FOUND',
      };
    }

    const postalCode = profile.postal_code;
    const needsConfirmation = profile.location_needs_confirmation === true;
    const isOnboardingComplete = Boolean(profile.onboarding_completed_at);

    // Only enforce for legacy profiles (onboarding already completed but location not confirmed)
    // New profiles will be blocked at onboarding completion
    if (isOnboardingComplete) {
      if (!postalCode) {
        console.warn(`⚠️ Legacy profile missing postal_code: ${userId}`);
        return {
          isValid: false,
          postalCode: null,
          needsConfirmation: true,
          error: 'Please confirm your primary location to generate local content.',
          code: 'LOCATION_NOT_SET',
        };
      }

      if (needsConfirmation) {
        console.warn(`⚠️ Legacy profile needs location confirmation: ${userId}`);
        return {
          isValid: false,
          postalCode,
          needsConfirmation: true,
          error: 'Please confirm your primary location to generate local content.',
          code: 'LOCATION_NOT_CONFIRMED',
        };
      }
    }

    return {
      isValid: true,
      postalCode,
      needsConfirmation: false,
    };
  } catch (err) {
    console.error('❌ Location validation exception:', err);
    return {
      isValid: false,
      postalCode: null,
      needsConfirmation: true,
      error: 'Location validation failed',
    };
  }
}

/**
 * Returns a 422 response if location is not valid
 */
export function locationBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Please confirm your primary location to generate local content.',
      code: 'LOCATION_NOT_CONFIRMED',
      action: 'Navigate to Settings > Business Profile to confirm your location.',
    }),
    {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
