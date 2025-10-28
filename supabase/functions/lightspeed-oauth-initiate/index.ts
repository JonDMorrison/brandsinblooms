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
    
    console.log('[LS-INIT] Domain prefix:', domainPrefix);

    if (!domainPrefix || !isValidPrefix(domainPrefix)) {
      console.error('[LS-INIT] Invalid domain prefix:', domainPrefix);
      throw new Error('Invalid domain prefix. Use only letters, numbers, and dashes (3-50 chars)');
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
    const stateSecret = Deno.env.get('STATE_SIGNING_SECRET');

    if (!clientId) {
      console.error('[LS-INIT] Missing LIGHTSPEED_CLIENT_ID');
      throw new Error('Lightspeed client ID not configured');
    }
    if (!stateSecret) {
      console.error('[LS-INIT] Missing STATE_SIGNING_SECRET');
      throw new Error('State secret not configured');
    }

    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;

    // Create state
    const state = btoa(JSON.stringify({
      t: userData.tenant_id,
      d: domainPrefix,
      u: user.id,
      n: crypto.randomUUID(),
      exp: Date.now() + 600000
    }));

    console.log('[LS-INIT] State created, storing pending connection');

    // Store pending connection
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
      console.error('[LS-INIT] DB upsert error:', upsertError.message);
      throw new Error('Failed to store connection: ' + upsertError.message);
    }

    const authUrl = new URL('https://secure.retail.lightspeed.app/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('[LS-INIT] Success, returning auth URL');

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString(), success: true }),
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
