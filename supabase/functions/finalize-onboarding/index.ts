import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Service role client to call the RPC function
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Call the server-only RPC function that enforces the invariant
    console.log('🔒 Calling server_finalize_onboarding RPC...');
    const { data: result, error: rpcError } = await serviceClient.rpc('server_finalize_onboarding', {
      p_user_id: user.id
    });

    if (rpcError) {
      console.error('❌ RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to finalize onboarding', details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 RPC result:', result);

    // Check if the RPC returned an error
    if (!result.success) {
      console.error('❌ Finalization failed:', result.error);
      const statusCode = result.code === 'LOCATION_NOT_SET' || result.code === 'LOCATION_NOT_CONFIRMED' ? 422 : 400;
      return new Response(
        JSON.stringify({ 
          error: result.error,
          code: result.code
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Onboarding finalized successfully');

    // Trigger climate profile derivation in the background
    // This runs asynchronously - don't wait for it
    try {
      console.log('🌡️ Triggering climate profile derivation...');
      const { data: profile } = await serviceClient
        .from('company_profiles')
        .select('postal_code, country')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profile?.postal_code) {
        // Fire and forget - don't await
        serviceClient.functions.invoke('derive-climate-profile', {
          body: {
            user_id: user.id,
            postal_code: profile.postal_code,
            country: profile.country || 'US',
            force_refresh: false
          }
        }).then(({ error }) => {
          if (error) {
            console.error('⚠️ Climate profile derivation failed (non-blocking):', error);
          } else {
            console.log('✅ Climate profile derivation triggered successfully');
          }
        });
      }
    } catch (climateError) {
      // Non-blocking - log and continue
      console.error('⚠️ Climate profile trigger error (non-blocking):', climateError);
    }

    return new Response(
      JSON.stringify(result),
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
