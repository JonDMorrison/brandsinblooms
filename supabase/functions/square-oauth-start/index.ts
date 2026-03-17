import { createClient } from 'npm:@supabase/supabase-js@2';
import { detectEnvironment, getSquareCredentials } from '../_shared/environment.ts';
import { encryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SQUARE-INIT] Request received');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[SQUARE-INIT] Missing auth header');
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[SQUARE-INIT] Auth error:', userError?.message);
      throw new Error('Unauthorized');
    }

    console.log('[SQUARE-INIT] User authenticated:', user.id);

    const body = await req.json();
    const state = body?.state;
    
    console.log('[SQUARE-INIT] State received:', state?.substring(0, 12) + '...');

    if (!state) {
      console.error('[SQUARE-INIT] Missing state parameter');
      throw new Error('Missing state parameter');
    }

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      console.error('[SQUARE-INIT] Tenant lookup failed:', userDataError?.message);
      throw new Error('No tenant found for user');
    }

    console.log('[SQUARE-INIT] Tenant found:', userData.tenant_id);

    // TEMPORARY: Force production mode for testing
    const appEnv = 'production'; // detectEnvironment(req);
    const environment = 'production'; // appEnv === 'development' ? 'sandbox' : 'production';
    
    console.log('[SQUARE-INIT] App environment detected:', appEnv);
    console.log('[SQUARE-INIT] Square environment:', environment);
    console.log('[SQUARE-INIT] Request origin:', req.headers.get('origin'));
    
    const { clientId } = getSquareCredentials(appEnv);

    if (!clientId) {
      console.error('[SQUARE-INIT] Missing SQUARE_CLIENT_ID for', appEnv);
      throw new Error('Square client ID not configured');
    }

    console.log('[SQUARE-INIT] Using client ID prefix:', clientId.substring(0, 20) + '...');

    // Use production redirect URI
    const callbackUrl = 'https://bloomsuite.app/integrations/square/callback';

    console.log('[SQUARE-INIT] Callback URL:', callbackUrl);

    console.log('[SQUARE-INIT] Storing pending connection');

    // Delete any existing pending connections for this tenant to handle abandoned OAuth flows
    await supabaseClient
      .from('square_connections')
      .delete()
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'pending');

    // Insert new pending connection
    const { error: insertError } = await supabaseClient
      .from('square_connections')
      .insert({
        tenant_id: userData.tenant_id,
        user_id: user.id,
        environment,
        encrypted_access_token: 'pending',
        encrypted_refresh_token: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

    if (insertError) {
      console.error('[SQUARE-INIT] DB insert error:', insertError.message);
      throw new Error('Failed to store connection: ' + insertError.message);
    }

    // Build Square OAuth URL
    const authBaseUrl = environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com/oauth2/authorize'
      : 'https://connect.squareup.com/oauth2/authorize';

    const authUrl = new URL(authBaseUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', 'MERCHANT_PROFILE_READ CUSTOMERS_READ CUSTOMERS_WRITE PAYMENTS_READ ITEMS_READ ORDERS_READ LOYALTY_READ');
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('session', 'false'); // Don't remember on Square side

    console.log('[SQUARE-INIT] Success! Auth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(), 
        success: true,
        state: state.substring(0, 12) + '...',
        environment
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-INIT] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});