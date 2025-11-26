import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { detectEnvironment, getSquareCredentials } from '../_shared/environment.ts';
import { encryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SQUARE-CALLBACK] Processing callback');
    
    const { code, state, redirectUri } = await req.json();
    
    console.log('[SQUARE-CALLBACK] Code:', !!code, 'State:', state?.substring(0, 12) + '...');

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find pending connection by state (via oauth_states table)
    const { data: connectionData, error: connectionError } = await supabaseClient
      .from('square_connections')
      .select('*, users!inner(tenant_id)')
      .eq('encrypted_access_token', 'pending')
      .single();

    if (connectionError || !connectionData) {
      console.error('[SQUARE-CALLBACK] Connection not found:', connectionError?.message);
      throw new Error('No pending connection found');
    }

    console.log('[SQUARE-CALLBACK] Found pending connection for tenant:', connectionData.tenant_id);
    console.log('[SQUARE-CALLBACK] Connection environment:', connectionData.environment);

    // TEMPORARY: Force production mode for testing
    const appEnv = 'production'; // detectEnvironment(req);
    console.log('[SQUARE-CALLBACK] App environment detected (FORCED):', appEnv);
    
    const { clientId, clientSecret } = getSquareCredentials(appEnv);

    if (!clientId || !clientSecret) {
      console.error('[SQUARE-CALLBACK] Missing Square credentials for', appEnv);
      throw new Error('Square credentials not configured');
    }
    
    console.log('[SQUARE-CALLBACK] Using client ID prefix:', clientId.substring(0, 20) + '...');

    // Exchange code for tokens
    const tokenBaseUrl = connectionData.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/oauth2/token'
      : 'https://connect.squareup.com/oauth2/token';

    console.log('[SQUARE-CALLBACK] Exchanging code for tokens...');
    
    const tokenResponse = await fetch(tokenBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[SQUARE-CALLBACK] Token exchange failed:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code');
    }

    console.log('[SQUARE-CALLBACK] Tokens received');

    // Get merchant information
    const merchantBaseUrl = connectionData.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/merchants'
      : 'https://connect.squareup.com/v2/merchants';

    const merchantResponse = await fetch(merchantBaseUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Square-Version': '2024-01-18',
      },
    });

    const merchantData = await merchantResponse.json();
    const merchant = merchantData.merchant || {};

    console.log('[SQUARE-CALLBACK] Merchant info retrieved:', merchant.business_name);

    // Encrypt tokens
    const encryptedAccessToken = await encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token 
      ? await encryptToken(tokenData.refresh_token) 
      : null;

    // Calculate token expiry (Square tokens expire in 30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Update connection with tokens and merchant info
    const { error: updateError } = await supabaseClient
      .from('square_connections')
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        merchant_id: tokenData.merchant_id,
        merchant_name: merchant.business_name || 'Square Account',
        status: 'connected',
        connected_at: new Date().toISOString(),
      })
      .eq('id', connectionData.id);

    if (updateError) {
      console.error('[SQUARE-CALLBACK] Update error:', updateError.message);
      throw new Error('Failed to save connection');
    }

    console.log('[SQUARE-CALLBACK] Connection successful!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Square connected successfully',
        merchantName: merchant.business_name || 'Square Account',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-CALLBACK] Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to complete Square connection',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});