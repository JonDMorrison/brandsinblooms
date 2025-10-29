import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders } from '../_shared/cors.ts';
import { detectEnvironment, getLightspeedCredentials } from '../_shared/environment.ts';

console.log('[LS-CALLBACK] Edge function starting');

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-CALLBACK] Processing OAuth callback request');

    // Create Supabase client with service role (no auth required)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { code, state, redirectUri } = await req.json();

    console.log('[LS-CALLBACK] Request data:', { 
      hasCode: !!code, 
      hasState: !!state,
      redirectUri
    });

    if (!code || !state || !redirectUri) {
      console.error('[LS-CALLBACK] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing code, state, or redirect URI' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up state in database
    console.log('[LS-CALLBACK] Looking up state token...');
    const { data: stateData, error: stateError } = await supabaseClient
      .from('oauth_states')
      .select('user_id, tenant_id, domain_prefix, expires_at')
      .eq('state_token', state)
      .single();

    if (stateError || !stateData) {
      console.error('[LS-CALLBACK] State lookup failed:', stateError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired state token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if state has expired
    if (new Date(stateData.expires_at) < new Date()) {
      console.error('[LS-CALLBACK] State token expired');
      await supabaseClient.from('oauth_states').delete().eq('state_token', state);
      return new Response(
        JSON.stringify({ error: 'State token expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id: userId, tenant_id: tenantId, domain_prefix: domainPrefix } = stateData;
    console.log('[LS-CALLBACK] State verified for user');

    // Delete used state token
    await supabaseClient.from('oauth_states').delete().eq('state_token', state);

    // Detect environment and get appropriate credentials
    const environment = detectEnvironment(req);
    console.log('[LS-CALLBACK] Environment detected:', environment);
    
    const { clientId, clientSecret } = getLightspeedCredentials(environment);
    if (!clientId || !clientSecret) {
      console.error(`[LS-CALLBACK] Missing Lightspeed credentials for ${environment}`);
      return new Response(
        JSON.stringify({ 
          error: 'Lightspeed credentials not configured for this environment',
          environment 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[LS-CALLBACK] Using credentials for:', environment);

    console.log('[LS-CALLBACK] Exchanging code for tokens...');

    // Exchange code for access token (X-Series)
    const tokenUrl = `https://${domainPrefix}.retail.lightspeed.app/api/1.0/token`;
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[LS-CALLBACK] Token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to exchange authorization code',
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('[LS-CALLBACK] Token exchange successful');

    // Get account info
    const accountUrl = `https://${domainPrefix}.retail.lightspeed.app/api/2.0/Account.json`;
    const accountResponse = await fetch(accountUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    let retailerName = domainPrefix;
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      retailerName = accountData.Account?.name || domainPrefix;
      console.log('[LS-CALLBACK] Got retailer name:', retailerName);
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    console.log('[LS-CALLBACK] Updating connection in database...');

    // Update connection with real tokens
    const { error: updateError } = await supabaseClient
      .from('lightspeed_connections')
      .update({
        encrypted_access_token: tokenData.access_token,
        encrypted_refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        retailer_name: retailerName,
        status: 'connected',
        connected_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('domain_prefix', domainPrefix);

    if (updateError) {
      console.error('[LS-CALLBACK] Failed to update connection:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save connection', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-CALLBACK] Connection saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        retailerName,
        message: 'Lightspeed connected successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-CALLBACK] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
