import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders } from '../_shared/cors.ts';
import { setCookie, generateState, isValidPrefix, LS_STATE_COOKIE, LS_PREFIX_COOKIE } from '../_shared/cookies.ts';
import { detectEnvironment, getLightspeedCredentials } from '../_shared/environment.ts';

console.log('[LS-START] Edge function starting');

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-START] Processing OAuth start request');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[LS-START] No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Authenticate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[LS-START] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-START] User authenticated:', user.id);

    // Parse request body
    const { domainPrefix, redirectOrigin } = await req.json();

    if (!domainPrefix || !isValidPrefix(domainPrefix)) {
      console.error('[LS-START] Invalid domain prefix:', domainPrefix);
      return new Response(
        JSON.stringify({ error: 'Invalid domain prefix. Use only letters, numbers, and dashes (3-50 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-START] Domain prefix:', domainPrefix);

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      console.error('[LS-START] Tenant lookup failed:', userDataError?.message);
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-START] Tenant found:', userData.tenant_id);

    // Generate secure state token
    const state = generateState();
    console.log('[LS-START] Generated state:', state.substring(0, 12) + '...');

    // Detect environment and get appropriate credentials
    const environment = detectEnvironment(req);
    console.log('[LS-START] Environment detected:', environment);
    
    const { clientId } = getLightspeedCredentials(environment);
    if (!clientId) {
      console.error(`[LS-START] LIGHTSPEED_CLIENT_ID_${environment.toUpperCase()} not set`);
      return new Response(
        JSON.stringify({ 
          error: 'Lightspeed integration not configured for this environment',
          environment 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[LS-START] Using client ID for:', environment);

    // Create pending connection in database
    console.log('[LS-START] Creating pending connection');
    const { error: upsertError } = await supabaseClient
      .from('lightspeed_connections')
      .upsert({
        tenant_id: userData.tenant_id,
        user_id: user.id,
        domain_prefix: domainPrefix,
        encrypted_access_token: 'pending',
        encrypted_refresh_token: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }, {
        onConflict: 'tenant_id,domain_prefix',
      });

    if (upsertError) {
      console.error('[LS-START] DB upsert error:', upsertError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to store connection: ' + upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Lightspeed OAuth URL using the origin that initiated the flow
    const origin = (typeof redirectOrigin === 'string' && redirectOrigin.startsWith('http'))
      ? redirectOrigin
      : 'https://bloomsuite.app';
    const callbackUrl = `${origin}/integrations/lightspeed/callback`;
    const authUrl = new URL('https://secure.retail.lightspeed.app/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('[LS-START] Success! Auth URL created');

    // Create response with cookies
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('Content-Type', 'application/json');
    
    // Set HttpOnly cookies for state and domain prefix
    setCookie(responseHeaders, LS_STATE_COOKIE, state);
    setCookie(responseHeaders, LS_PREFIX_COOKIE, domainPrefix);

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        success: true
      }),
      { headers: responseHeaders }
    );

  } catch (error) {
    console.error('[LS-START] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
