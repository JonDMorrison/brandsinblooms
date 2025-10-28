import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    const { domainPrefix } = await req.json();
    if (!domainPrefix || !/^[a-z0-9-]+$/i.test(domainPrefix)) {
      throw new Error('Invalid domain prefix');
    }

    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;
    const stateSecret = Deno.env.get('STATE_SIGNING_SECRET');

    if (!clientId || !stateSecret) {
      throw new Error('Missing configuration');
    }

    // Create state with tenant_id and domain_prefix
    const state = btoa(JSON.stringify({
      t: userData.tenant_id,
      d: domainPrefix,
      u: user.id,
      n: crypto.randomUUID(),
      exp: Date.now() + 600000 // 10 minutes
    }));

    // Store pending connection
    await supabaseClient
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

    const authUrl = new URL('https://secure.retail.lightspeed.app/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    console.log('OAuth initiate successful for domain:', domainPrefix);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString(), success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth initiate error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
