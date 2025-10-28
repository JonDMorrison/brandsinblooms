import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isValidPrefix = (s: string) => /^[a-z0-9-]+$/i.test(s) && s.length >= 3 && s.length <= 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-INIT] Request received');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[LS-INIT] Missing auth header');
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[LS-INIT] Auth error:', userError?.message);
      throw new Error('Unauthorized');
    }

    console.log('[LS-INIT] User authenticated:', user.id);

    const body = await req.json();
    const domainPrefix = body?.domainPrefix;
    const state = body?.state; // Receive state from frontend
    
    console.log('[LS-INIT] Domain prefix:', domainPrefix);
    console.log('[LS-INIT] State received:', state?.substring(0, 12) + '...');

    if (!domainPrefix || !isValidPrefix(domainPrefix)) {
      console.error('[LS-INIT] Invalid domain prefix:', domainPrefix);
      throw new Error('Invalid domain prefix. Use only letters, numbers, and dashes (3-50 chars)');
    }

    if (!state) {
      console.error('[LS-INIT] Missing state parameter');
      throw new Error('Missing state parameter');
    }

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      console.error('[LS-INIT] Tenant lookup failed:', userDataError?.message);
      throw new Error('No tenant found for user');
    }

    console.log('[LS-INIT] Tenant found:', userData.tenant_id);

    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');

    if (!clientId) {
      console.error('[LS-INIT] Missing LIGHTSPEED_CLIENT_ID');
      throw new Error('Lightspeed client ID not configured');
    }

    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;

    console.log('[LS-INIT] Storing pending connection with metadata');

    // Store pending connection with state metadata for validation
    const { error: upsertError } = await supabaseClient
      .from('lightspeed_connections')
      .upsert({
        tenant_id: userData.tenant_id,
        user_id: user.id,
        domain_prefix: domainPrefix,
        encrypted_access_token: 'pending',
        encrypted_refresh_token: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        // Store state for validation in callback (optional - frontend validates too)
        retailer_id: state.substring(0, 50), // Temporarily store state prefix
      }, {
        onConflict: 'tenant_id,domain_prefix',
      });

    if (upsertError) {
      console.error('[LS-INIT] DB upsert error:', upsertError.message);
      throw new Error('Failed to store connection: ' + upsertError.message);
    }

    // Build Lightspeed OAuth URL
    const authUrl = new URL('https://secure.retail.lightspeed.app/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('[LS-INIT] Success! Auth URL:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(), 
        success: true,
        state: state.substring(0, 12) + '...' // Echo back for logging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[LS-INIT] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
