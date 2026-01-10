import { supabase } from "@/integrations/supabase/client";

interface LocationExtraction {
  postal_code: string | null;
  city: string | null;
  state_province: string | null;
  country: 'US' | 'CA' | null;
  source: 'jsonld' | 'footer' | 'contact' | 'regex' | 'none';
  confidence: 'high' | 'medium' | 'low';
  snippet: string | null;
  candidates: any[];
  requires_confirmation: boolean;
}

interface PersistLocationOptions {
  userId: string;
  websiteUrl?: string;
  locationExtraction: LocationExtraction;
  forceOverwrite?: boolean; // For re-detect with user confirmation
}

interface PersistLocationResult {
  success: boolean;
  profileId?: string;
  needsConfirmation: boolean;
  error?: string;
}

/**
 * Persists location extraction results to company_profiles.
 * 
 * Rules:
 * - Always updates detection metadata (source, confidence, snippet, candidates, timestamp)
 * - Only updates structured address fields (postal_code, city, etc.) if currently NULL
 * - Sets location_needs_confirmation based on confidence and candidates
 * - Use forceOverwrite=true when user explicitly confirms re-detection
 */
export async function persistLocationExtraction(
  options: PersistLocationOptions
): Promise<PersistLocationResult> {
  const { userId, websiteUrl, locationExtraction, forceOverwrite = false } = options;

  console.log('📍 Persisting location extraction for user:', userId);
  console.log('📍 Location data:', locationExtraction);

  try {
    // First, get the existing profile to check current values
    const { data: existingProfile, error: fetchError } = await supabase
      .from('company_profiles')
      .select('id, postal_code, city, state_province, country, website_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching existing profile:', fetchError);
      return { success: false, needsConfirmation: false, error: fetchError.message };
    }

    // Calculate whether confirmation is needed
    const needsConfirmation = 
      locationExtraction.requires_confirmation || 
      !locationExtraction.postal_code ||
      locationExtraction.confidence === 'low';

    // Build the update payload
    const updatePayload: Record<string, any> = {
      // Always update detection metadata
      location_detection_source: locationExtraction.source || 'none',
      location_confidence: locationExtraction.confidence || 'low',
      location_detection_snippet: locationExtraction.snippet || null,
      location_detection_candidates: locationExtraction.candidates || [],
      location_last_detected_at: new Date().toISOString(),
      location_needs_confirmation: needsConfirmation,
      updated_at: new Date().toISOString(),
    };

    // Update website_url if provided
    if (websiteUrl) {
      updatePayload.website_url = websiteUrl;
    }

    // Conditionally update structured address fields
    // Only set if currently NULL OR forceOverwrite is true
    if (existingProfile) {
      if ((existingProfile.postal_code === null || forceOverwrite) && locationExtraction.postal_code) {
        updatePayload.postal_code = locationExtraction.postal_code;
      }
      if ((existingProfile.city === null || forceOverwrite) && locationExtraction.city) {
        updatePayload.city = locationExtraction.city;
      }
      if ((existingProfile.state_province === null || forceOverwrite) && locationExtraction.state_province) {
        updatePayload.state_province = locationExtraction.state_province;
      }
      if ((existingProfile.country === null || forceOverwrite) && locationExtraction.country) {
        updatePayload.country = locationExtraction.country;
      }
    } else {
      // No existing profile - include all fields for insert
      if (locationExtraction.postal_code) {
        updatePayload.postal_code = locationExtraction.postal_code;
      }
      if (locationExtraction.city) {
        updatePayload.city = locationExtraction.city;
      }
      if (locationExtraction.state_province) {
        updatePayload.state_province = locationExtraction.state_province;
      }
      if (locationExtraction.country) {
        updatePayload.country = locationExtraction.country;
      }
    }

    console.log('📍 Update payload:', updatePayload);

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('company_profiles')
        .update(updatePayload)
        .eq('user_id', userId)
        .select('id')
        .single();

      if (updateError) {
        console.error('❌ Error updating profile with location data:', updateError);
        return { success: false, needsConfirmation, error: updateError.message };
      }

      console.log('✅ Location data persisted to existing profile:', updatedProfile.id);
      return { success: true, profileId: updatedProfile.id, needsConfirmation };
    } else {
      // Create new profile with location data
      const { data: newProfile, error: insertError } = await supabase
        .from('company_profiles')
        .insert({
          user_id: userId,
          ...updatePayload,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Error creating profile with location data:', insertError);
        return { success: false, needsConfirmation, error: insertError.message };
      }

      console.log('✅ Location data persisted to new profile:', newProfile.id);
      return { success: true, profileId: newProfile.id, needsConfirmation };
    }
  } catch (error: any) {
    console.error('❌ Unexpected error persisting location:', error);
    return { success: false, needsConfirmation: false, error: error.message };
  }
}

/**
 * Confirms a location selection after user review.
 * Sets the selected postal code and marks confirmation as complete.
 */
export async function confirmLocationSelection(
  userId: string,
  selectedPostalCode: string,
  selectedCity?: string,
  selectedStateProvince?: string,
  selectedCountry?: 'US' | 'CA'
): Promise<{ success: boolean; error?: string }> {
  console.log('📍 Confirming location selection for user:', userId);

  try {
    const updatePayload: Record<string, any> = {
      postal_code: selectedPostalCode,
      location_needs_confirmation: false,
      location_detection_source: 'manual', // User confirmed = manual
      location_confidence: 'high', // User confirmed = high confidence
      updated_at: new Date().toISOString(),
    };

    if (selectedCity) updatePayload.city = selectedCity;
    if (selectedStateProvince) updatePayload.state_province = selectedStateProvince;
    if (selectedCountry) updatePayload.country = selectedCountry;

    const { error } = await supabase
      .from('company_profiles')
      .update(updatePayload)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error confirming location:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Location confirmed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Unexpected error confirming location:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Checks if a profile needs location confirmation.
 */
export async function checkLocationConfirmationNeeded(
  userId: string
): Promise<{ needed: boolean; candidates?: any[]; currentPostalCode?: string }> {
  try {
    const { data: profile, error } = await supabase
      .from('company_profiles')
      .select('location_needs_confirmation, location_detection_candidates, postal_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !profile) {
      return { needed: false };
    }

    return {
      needed: profile.location_needs_confirmation === true,
      candidates: profile.location_detection_candidates as any[] || [],
      currentPostalCode: profile.postal_code || undefined,
    };
  } catch {
    return { needed: false };
  }
}
