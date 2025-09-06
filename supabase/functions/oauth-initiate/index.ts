import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return corsJsonResponse({ error: 'Property ID is required' }, { status: 400 });
    }

    // Get auth header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return corsJsonResponse({ error: 'Authorization header required' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    // Check for required environment variables
    const clientId = Deno.env.get('GA_CLIENT_ID');
    const clientSecret = Deno.env.get('GA_CLIENT_SECRET');
    const baseUrl = Deno.env.get('APP_BASE_URL');

    if (!clientId || !clientSecret || !baseUrl) {
      console.error('Missing OAuth credentials:', { 
        hasClientId: !!clientId, 
        hasClientSecret: !!clientSecret, 
        hasBaseUrl: !!baseUrl 
      });
      return corsJsonResponse({ 
        error: 'OAuth credentials not configured. Please contact support.' 
      }, { status: 500 });
    }

    // Generate state parameter for security
    const state = crypto.randomUUID();
    
    // Store state and property ID in database for verification
    const { error: stateError } = await supabase
      .from('google_analytics_settings')
      .upsert({
        user_id: user.id,
        property_id: propertyId,
        connection_status: 'authorizing'
      });

    if (stateError) {
      console.error('Error storing GA settings:', stateError);
      return corsJsonResponse({ error: 'Failed to initiate authorization' }, { status: 500 });
    }

    // Build OAuth URL
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', `${baseUrl}/api/oauth-callback`);
    oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/analytics.readonly');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('state', `${state}:${user.id}:${propertyId}`);
    oauthUrl.searchParams.set('access_type', 'offline');
    oauthUrl.searchParams.set('prompt', 'consent');

    console.log('✅ OAuth initiation successful for user:', user.id);

    return corsJsonResponse({ 
      success: true, 
      authUrl: oauthUrl.toString() 
    });

  } catch (error) {
    console.error('❌ OAuth initiation error:', error);
    return corsJsonResponse({ 
      error: 'Failed to initiate OAuth flow',
      details: error.message 
    }, { status: 500 });
  }
});