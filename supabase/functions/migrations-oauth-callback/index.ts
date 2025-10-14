import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { encryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[migrations-oauth-callback] FATAL:', error.message);
}

function htmlClose(type: 'oauth-success' | 'oauth-error', message: string): Response {
  const appOrigin = Deno.env.get('APP_ORIGIN') ?? Deno.env.get('APP_BASE_URL') ?? '*';
  return new Response(`
    <!DOCTYPE html><html><body>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: '${type}', message: ${JSON.stringify(message)}, provider: 'mailchimp' }, '${appOrigin}');
      }
      setTimeout(() => window.close(), 300);
    </script>
    <p>${message}</p>
    </body></html>`, { 
    headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    status: type === 'oauth-error' ? 400 : 200
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse query parameters from the URL (OAuth callback is a GET request)
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    let provider = url.searchParams.get('provider') || 'mailchimp'; // May be overridden by verified state

    if (!code || !state) {
      throw new Error('Missing required parameters: code and state');
    }

    // OAuth callback doesn't have Authorization header - use service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Validate encryption key is configured before proceeding
    try {
      assertEncryptionKeyConfigured();
    } catch (error: any) {
      console.error('[migrations-oauth-callback] Missing encryption key:', error.message);
      return htmlClose('oauth-error', 'TOKEN_ENCRYPTION_KEY not configured. Please contact support.');
    }

    // Verify signed JWT state
    let claims: any;
    try {
      const secret = Deno.env.get('OAUTH_STATE_SECRET');
      if (!secret) {
        return htmlClose('oauth-error', 'OAUTH_STATE_SECRET not configured');
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      claims = await verify(state, key);
    } catch (e) {
      console.error('[migrations-oauth-callback] JWT verification failed:', e);
      return htmlClose('oauth-error', 'Invalid or expired state token');
    }

    // Override provider from claims and derive redirectUri/user/tenant
    provider = (claims?.provider as string) || provider;
    const redirectUri = claims?.redirectUri as string;
    const uid = claims?.uid as string;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', uid)
      .maybeSingle();

    if (userErr || !userRow?.tenant_id) {
      throw new Error('User or tenant not found for state');
    }

    const user_id = uid;
    const tenant_id = userRow.tenant_id;

    // Get OAuth credentials
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
    if (!clientId || !clientSecret) {
      throw new Error('OAuth credentials not configured');
    }
    // redirectUri is derived from verified state claims

    // Exchange code for tokens
    let tokenUrl = '';
    let tokenData: any = null;

    if (provider === 'mailchimp') {
      tokenUrl = 'https://login.mailchimp.com/oauth2/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      tokenData = await response.json();
    } else if (provider === 'klaviyo') {
      tokenUrl = 'https://a.klaviyo.com/oauth/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      tokenData = await response.json();
    }

    if (!tokenData.access_token) {
      throw new Error('Failed to obtain access token');
    }

    // Encrypt access token before storing
    let encryptedToken: string;
    try {
      encryptedToken = await encryptToken(tokenData.access_token);
      console.log(`[migrations-oauth-callback] Token encrypted successfully`);
    } catch (error: any) {
      console.error('[migrations-oauth-callback] Encryption failed:', error.message);
      return htmlClose('oauth-error', 'Failed to encrypt token');
    }

    // Fetch account info
    let accountInfo: any = {};
    if (provider === 'mailchimp') {
      const metadataRes = await fetch('https://login.mailchimp.com/oauth2/metadata', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      accountInfo = await metadataRes.json();
    } else if (provider === 'klaviyo') {
      const accountRes = await fetch('https://a.klaviyo.com/api/accounts/', {
        headers: { 
          Authorization: `Klaviyo-OAuth ${tokenData.access_token}`,
          revision: '2024-10-15',
          'Accept': 'application/json'
        },
      });
      const accData = await accountRes.json();
      accountInfo = accData.data?.[0]?.attributes || {};
    }

    // Update connection with encrypted tokens (update existing tenant+provider row if present)
    const { data: existingConn, error: findConnErr } = await supabase
      .from('provider_connections')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('provider', provider)
      .maybeSingle();

    if (findConnErr) {
      console.error('[migrations-oauth-callback] Find connection error:', findConnErr);
    }

    if (existingConn) {
      const { error: updateConnErr } = await supabase
        .from('provider_connections')
        .update({
          status: 'connected',
          encrypted_access_token: encryptedToken,
          provider_account_id: accountInfo.id || accountInfo.account_id || '',
          provider_account_name: accountInfo.accountname || accountInfo.name || '',
          token_expires_at: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          metadata: accountInfo,
          connected_at: new Date().toISOString()
        })
        .eq('id', existingConn.id);
      if (updateConnErr) {
        console.error('[migrations-oauth-callback] Update connection error:', updateConnErr);
      }
    } else {
      const { error: insertConnErr } = await supabase
        .from('provider_connections')
        .insert({
          tenant_id,
          user_id,
          provider,
          status: 'connected',
          encrypted_access_token: encryptedToken,
          provider_account_id: accountInfo.id || accountInfo.account_id || '',
          provider_account_name: accountInfo.accountname || accountInfo.name || '',
          token_expires_at: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          metadata: accountInfo,
          connected_at: new Date().toISOString()
        });
      if (insertConnErr) {
        console.error('[migrations-oauth-callback] Insert connection error:', insertConnErr);
      }
    }

    console.log(`[migrations-oauth-callback] Successfully connected ${provider} for user ${user_id}`);

    // Return HTML that closes the popup and notifies parent window
    return htmlClose('oauth-success', `Successfully connected ${provider}`);

  } catch (error: any) {
    console.error('[migrations-oauth-callback] Error:', error);
    return htmlClose('oauth-error', error.message || 'Connection failed');
  }
});
