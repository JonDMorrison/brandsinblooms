import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { detectEnvironment, getSquareCredentials } from '../_shared/environment.ts';
import { encryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';
import { corsHeaders, corsJsonResponse } from '../_shared/cors.ts';
import { ensureSquareWebhooks } from '../_shared/webhooks/ensureSquareWebhooks.ts';

console.log('[SQUARE-CALLBACK] Edge function module loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[SQUARE-CALLBACK] Handler reached, method:', req.method);

  try {
    // Validate encryption key is configured
    try {
      assertEncryptionKeyConfigured();
      console.log('[SQUARE-CALLBACK] Encryption key validation passed');
    } catch (keyError: any) {
      console.error('[SQUARE-CALLBACK] Encryption key not configured:', keyError.message);
      return corsJsonResponse({
        success: false,
        error: 'Server configuration error - encryption key missing',
      }, { status: 500 });
    }

    console.log('[SQUARE-CALLBACK] Processing callback');
    
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[SQUARE-CALLBACK] Failed to parse request body:', parseError.message);
      return corsJsonResponse({
        success: false,
        error: 'Invalid request body',
      }, { status: 400 });
    }

    const { code, state, redirectUri } = body;
    
    console.log('[SQUARE-CALLBACK] Code:', !!code, 'State:', state?.substring(0, 12) + '...');

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find pending connection by encrypted_access_token = 'pending'
    const { data: connectionData, error: connectionError } = await supabaseClient
      .from('square_connections')
      .select('*')
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

    console.log('[SQUARE-CALLBACK] Connection saved, now setting up webhooks automatically...');

    // ============================================
    // AUTO-SUBSCRIBE WEBHOOKS - No user action needed
    // ============================================
    let webhookResult;
    try {
      webhookResult = await ensureSquareWebhooks(supabaseClient, connectionData.id);
      console.log('[SQUARE-CALLBACK] Webhook setup result:', JSON.stringify(webhookResult));
      
      if (webhookResult.verified) {
        console.log('[SQUARE-CALLBACK] ✓ Webhooks automatically configured:', webhookResult.subscription_id);
      } else {
        // Log but don't fail - background retry will handle it
        console.warn('[SQUARE-CALLBACK] ⚠ Webhook setup pending retry:', webhookResult.error);
      }
    } catch (webhookError: any) {
      // Log but don't fail the OAuth - connection is still valid
      console.error('[SQUARE-CALLBACK] Webhook setup error (will retry):', webhookError.message);
      webhookResult = { verified: false, error: webhookError.message };
    }

    console.log('[SQUARE-CALLBACK] Connection successful!');

    return corsJsonResponse({
      success: true,
      message: 'Square connected successfully',
      merchantName: merchant.business_name || 'Square Account',
      webhooks: {
        configured: webhookResult?.verified || false,
        subscription_id: webhookResult?.subscription_id || null,
        error: webhookResult?.error || null,
      },
    });
  } catch (error: any) {
    console.error('[SQUARE-CALLBACK] Error:', error.message);
    console.error('[SQUARE-CALLBACK] Error stack:', error.stack);
    return corsJsonResponse({
      success: false,
      error: error.message || 'Failed to complete Square connection',
    }, { status: 400 });
  }
});
