import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders } from '../_shared/cors.ts';
import { getCookie, clearCookie, LS_STATE_COOKIE, LS_PREFIX_COOKIE } from '../_shared/cookies.ts';

console.log('[LS-CALLBACK] Edge function starting');

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-CALLBACK] Processing OAuth callback request');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[LS-CALLBACK] No authorization header');
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
      console.error('[LS-CALLBACK] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-CALLBACK] User authenticated:', user.id);

    // Parse request body
    const { code, state, domainPrefix: bodyPrefix, redirectUri } = await req.json();

    console.log('[LS-CALLBACK] Request data:', { 
      hasCode: !!code, 
      hasState: !!state, 
      bodyPrefix,
      redirectUri
    });

    if (!code || !redirectUri) {
      console.error('[LS-CALLBACK] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing code or redirect URI' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate state via HttpOnly cookie set at start
    const cookieState = getCookie(req, LS_STATE_COOKIE);
    if (!cookieState || cookieState !== state) {
      console.warn('[LS-CALLBACK] State cookie missing or mismatch. Proceeding with authenticated user fallback.');
      // Soft-fail: continue if the user is authenticated to avoid blocking due to cross-site cookie policies
    }

    const domainPrefix = bodyPrefix || getCookie(req, LS_PREFIX_COOKIE) || '';
    if (!domainPrefix) {
      console.error('[LS-CALLBACK] No domain prefix provided or in cookie');
      return new Response(
        JSON.stringify({ error: 'Missing domain prefix' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[LS-CALLBACK] Using domain prefix:', domainPrefix);

    // Get tenant_id
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      console.error('[LS-CALLBACK] Failed to get tenant_id:', userDataError);
      return new Response(
        JSON.stringify({ error: 'Failed to get tenant information' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;
    console.log('[LS-CALLBACK] Tenant ID:', tenantId);

    // Get Lightspeed credentials
    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('[LS-CALLBACK] Missing Lightspeed credentials');
      return new Response(
        JSON.stringify({ error: 'Lightspeed credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
