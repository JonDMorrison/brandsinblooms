import { createClient } from 'npm:@supabase/supabase-js@2';
import { detectEnvironment } from '../_shared/environment.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get Clover credentials based on environment
function getCloverCredentials(env: 'development' | 'production'): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  const suffix = env === 'development' ? '_DEV' : '_PROD';
  return {
    clientId: Deno.env.get(`CLOVER_CLIENT_ID${suffix}`),
    clientSecret: Deno.env.get(`CLOVER_CLIENT_SECRET${suffix}`),
  };
}

// Get Clover API base URL based on environment and region
function getCloverAuthUrl(environment: string, region: string = 'na'): string {
  if (environment === 'sandbox') {
    return 'https://sandbox.dev.clover.com/oauth/v2/authorize';
  }
  
  switch (region) {
    case 'eu':
      return 'https://www.eu.clover.com/oauth/v2/authorize';
    case 'la':
      return 'https://www.la.clover.com/oauth/v2/authorize';
    default:
      return 'https://www.clover.com/oauth/v2/authorize';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CLOVER-INIT] Request received');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[CLOVER-INIT] Missing auth header');
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[CLOVER-INIT] Auth error:', userError?.message);
      throw new Error('Unauthorized');
    }

    console.log('[CLOVER-INIT] User authenticated:', user.id);

    const body = await req.json();
    const state = body?.state;
    const region = body?.region || 'na';
    
    console.log('[CLOVER-INIT] State received:', state?.substring(0, 12) + '...', 'Region:', region);

    if (!state) {
      console.error('[CLOVER-INIT] Missing state parameter');
      throw new Error('Missing state parameter');
    }

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      console.error('[CLOVER-INIT] Tenant lookup failed:', userDataError?.message);
      throw new Error('No tenant found for user');
    }

    console.log('[CLOVER-INIT] Tenant found:', userData.tenant_id);

    // Auto-detect environment
    const appEnv = detectEnvironment(req);
    const environment = appEnv === 'development' ? 'sandbox' : 'production';
    
    console.log('[CLOVER-INIT] App environment detected:', appEnv);
    console.log('[CLOVER-INIT] Clover environment:', environment);
    
    const { clientId } = getCloverCredentials(appEnv);

    if (!clientId) {
      console.error('[CLOVER-INIT] Missing CLOVER_CLIENT_ID for', appEnv);
      throw new Error('Clover client ID not configured');
    }

    console.log('[CLOVER-INIT] Using client ID prefix:', clientId.substring(0, 15) + '...');

    // Callback URL based on environment
    const callbackUrl = appEnv === 'development'
      ? `${req.headers.get('origin') || 'https://lovable.app'}/integrations/clover/callback`
      : 'https://bloomsuite.app/integrations/clover/callback';

    console.log('[CLOVER-INIT] Callback URL:', callbackUrl);

    // Delete any existing pending connections for this tenant
    await supabaseClient
      .from('clover_connections')
      .delete()
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'pending');

    // Insert new pending connection
    const { error: insertError } = await supabaseClient
      .from('clover_connections')
      .insert({
        tenant_id: userData.tenant_id,
        user_id: user.id,
        environment,
        region,
        encrypted_access_token: 'pending',
        encrypted_refresh_token: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

    if (insertError) {
      console.error('[CLOVER-INIT] DB insert error:', insertError.message);
      throw new Error('Failed to store connection: ' + insertError.message);
    }

    // Build Clover OAuth URL
    const authBaseUrl = getCloverAuthUrl(environment, region);
    const authUrl = new URL(authBaseUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('[CLOVER-INIT] Success! Auth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(), 
        success: true,
        state: state.substring(0, 12) + '...',
        environment,
        region
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-INIT] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
