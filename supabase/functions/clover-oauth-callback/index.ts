import { createClient } from 'npm:@supabase/supabase-js@2';
import { detectEnvironment } from '../_shared/environment.ts';
import { encryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';
import { corsHeaders, corsJsonResponse } from '../_shared/cors.ts';
import { ensureCloverWebhooks } from '../_shared/webhooks/ensureCloverWebhooks.ts';

console.log('[CLOVER-CALLBACK] Edge function module loaded');

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
function getCloverApiUrl(environment: string, region: string = 'na'): string {
  if (environment === 'sandbox') {
    return 'https://apisandbox.dev.clover.com';
  }
  
  switch (region) {
    case 'eu':
      return 'https://api.eu.clover.com';
    case 'la':
      return 'https://api.la.clover.com';
    default:
      return 'https://api.clover.com';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[CLOVER-CALLBACK] Handler reached, method:', req.method);

  try {
    // Validate encryption key is configured
    try {
      assertEncryptionKeyConfigured();
      console.log('[CLOVER-CALLBACK] Encryption key validation passed');
    } catch (keyError: any) {
      console.error('[CLOVER-CALLBACK] Encryption key not configured:', keyError.message);
      return corsJsonResponse({
        success: false,
        error: 'Server configuration error - encryption key missing',
      }, { status: 500 });
    }

    console.log('[CLOVER-CALLBACK] Processing callback');
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[CLOVER-CALLBACK] Failed to parse request body:', parseError.message);
      return corsJsonResponse({
        success: false,
        error: 'Invalid request body',
      }, { status: 400 });
    }

    const { code, merchant_id, employee_id, redirectUri } = body;
    
    console.log('[CLOVER-CALLBACK] Code:', !!code, 'Merchant ID:', merchant_id);

    if (!code || !merchant_id) {
      throw new Error('Missing code or merchant_id parameter');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find pending connection
    const { data: connectionData, error: connectionError } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('encrypted_access_token', 'pending')
      .single();

    if (connectionError || !connectionData) {
      console.error('[CLOVER-CALLBACK] Connection not found:', connectionError?.message);
      throw new Error('No pending connection found');
    }

    console.log('[CLOVER-CALLBACK] Found pending connection for tenant:', connectionData.tenant_id);
    console.log('[CLOVER-CALLBACK] Connection environment:', connectionData.environment);

    const appEnv = connectionData.environment === 'sandbox' ? 'development' : 'production';
    const { clientId, clientSecret } = getCloverCredentials(appEnv);

    if (!clientId || !clientSecret) {
      console.error('[CLOVER-CALLBACK] Missing Clover credentials for', appEnv);
      throw new Error('Clover credentials not configured');
    }

    // Get API base URL
    const apiBaseUrl = getCloverApiUrl(connectionData.environment, connectionData.region);

    // Exchange code for tokens
    const tokenUrl = `${apiBaseUrl}/oauth/v2/token`;
    console.log('[CLOVER-CALLBACK] Exchanging code for tokens at:', tokenUrl);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[CLOVER-CALLBACK] Token exchange failed:', tokenData);
      throw new Error(tokenData.message || 'Failed to exchange authorization code');
    }

    console.log('[CLOVER-CALLBACK] Tokens received');

    // Get merchant information
    const merchantUrl = `${apiBaseUrl}/v3/merchants/${merchant_id}`;
    const merchantResponse = await fetch(merchantUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const merchantData = await merchantResponse.json();
    console.log('[CLOVER-CALLBACK] Merchant info retrieved:', merchantData.name);

    // Encrypt tokens
    const encryptedAccessToken = await encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token 
      ? await encryptToken(tokenData.refresh_token) 
      : null;

    // Calculate token expiry (Clover tokens can have configurable expiry)
    const expiresIn = tokenData.access_token_expiration || (30 * 24 * 60 * 60); // Default 30 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update connection with tokens and merchant info
    const { error: updateError } = await supabaseClient
      .from('clover_connections')
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        merchant_id,
        employee_id,
        merchant_name: merchantData.name || 'Clover Account',
        status: 'connected',
        connected_at: new Date().toISOString(),
      })
      .eq('id', connectionData.id);

    if (updateError) {
      console.error('[CLOVER-CALLBACK] Update error:', updateError.message);
      throw new Error('Failed to save connection');
    }

    console.log('[CLOVER-CALLBACK] Connection saved, setting up webhooks automatically...');

    // ============================================
    // AUTO-SUBSCRIBE WEBHOOKS - No user action needed
    // ============================================
    let webhookResult;
    try {
      webhookResult = await ensureCloverWebhooks(supabaseClient, connectionData.id);
      console.log('[CLOVER-CALLBACK] Webhook setup result:', JSON.stringify(webhookResult));
      
      if (webhookResult.verified) {
        console.log('[CLOVER-CALLBACK] ✓ Webhooks configured:', webhookResult.subscription_id);
      } else {
        console.warn('[CLOVER-CALLBACK] ⚠ Webhook setup pending:', webhookResult.error);
      }
    } catch (webhookError: any) {
      console.error('[CLOVER-CALLBACK] Webhook setup error:', webhookError.message);
      webhookResult = { verified: false, error: webhookError.message };
    }

    console.log('[CLOVER-CALLBACK] Connection successful!');

    return corsJsonResponse({
      success: true,
      message: 'Clover connected successfully',
      merchantName: merchantData.name || 'Clover Account',
      webhooks: {
        configured: webhookResult?.verified || false,
        subscription_id: webhookResult?.subscription_id || null,
        error: webhookResult?.error || null,
      },
    });
  } catch (error: any) {
    console.error('[CLOVER-CALLBACK] Error:', error.message);
    console.error('[CLOVER-CALLBACK] Error stack:', error.stack);
    return corsJsonResponse({
      success: false,
      error: error.message || 'Failed to complete Clover connection',
    }, { status: 400 });
  }
});
