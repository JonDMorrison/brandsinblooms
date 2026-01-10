import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FinalizeRequest {
  company_profile_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 finalize-onboarding: Starting request');

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('❌ Auth verification failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Parse request body
    let requestBody: FinalizeRequest = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (e) {
      // Empty body is acceptable
    }

    // Service role client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the user's company profile
    let query = serviceClient
      .from('company_profiles')
      .select('id, user_id, postal_code, location_needs_confirmation, onboarding_completed_at')
      .eq('user_id', user.id);

    // If specific profile ID provided, verify ownership
    if (requestBody.company_profile_id) {
      query = query.eq('id', requestBody.company_profile_id);
    }

    const { data: profile, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching company profile:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch company profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      console.error('❌ No company profile found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Company profile not found. Please complete the initial setup first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Profile found:', {
      id: profile.id,
      postal_code: profile.postal_code || 'NULL',
      location_needs_confirmation: profile.location_needs_confirmation,
      onboarding_completed_at: profile.onboarding_completed_at || 'NULL'
    });

    // Verify ownership (defense in depth)
    if (profile.user_id !== user.id) {
      console.error('❌ Profile ownership mismatch');
      return new Response(
        JSON.stringify({ error: 'Access denied: Profile does not belong to authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INVARIANT CHECK: Validate location confirmation
    const postalCode = profile.postal_code;
    const needsConfirmation = profile.location_needs_confirmation === true;

    if (!postalCode) {
      console.error('❌ INVARIANT VIOLATION: postal_code is NULL');
      return new Response(
        JSON.stringify({ 
          error: 'Please confirm your primary location to continue.',
          code: 'LOCATION_NOT_SET',
          details: { postal_code: null, location_needs_confirmation: needsConfirmation }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (needsConfirmation) {
      console.error('❌ INVARIANT VIOLATION: location_needs_confirmation is true');
      return new Response(
        JSON.stringify({ 
          error: 'Please confirm your primary location to continue.',
          code: 'LOCATION_NOT_CONFIRMED',
          details: { postal_code: postalCode, location_needs_confirmation: true }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Location invariant check passed');

    // If already completed, return success without updating
    if (profile.onboarding_completed_at) {
      console.log('ℹ️ Onboarding already completed at:', profile.onboarding_completed_at);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Onboarding already completed',
          onboarding_completed_at: profile.onboarding_completed_at,
          already_completed: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set onboarding_completed_at using service role (bypasses trigger)
    const completedAt = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from('company_profiles')
      .update({ 
        onboarding_completed_at: completedAt,
        updated_at: completedAt
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('❌ Error updating onboarding_completed_at:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to finalize onboarding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Onboarding finalized successfully at:', completedAt);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Onboarding completed successfully',
        onboarding_completed_at: completedAt,
        profile_id: profile.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error in finalize-onboarding:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
