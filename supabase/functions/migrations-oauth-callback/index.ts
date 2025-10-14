import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token encryption using AES-GCM
async function encryptToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  // Get encryption key from environment
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  
  const keyData = encoder.encode(keyString);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
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
    const provider = url.searchParams.get('provider') || 'mailchimp'; // Default to mailchimp for now

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

    // Find the pending connection by matching the exact state token
    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('tenant_id,user_id,provider,status,metadata')
      .eq('status', 'pending')
      .contains('metadata', { state })
      .maybeSingle();

    if (connectionError) {
      console.error('[migrations-oauth-callback] State lookup error:', connectionError);
    }

    if (!connection) {
      throw new Error('Invalid state token or connection not found');
    }

    const user_id = connection.user_id;
    const tenant_id = connection.tenant_id;

    // Get OAuth credentials
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/migrations-oauth-callback?provider=${provider}`;

    if (!clientId || !clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

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

    // Encrypt access token
    const encryptedToken = await encryptToken(tokenData.access_token);

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
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-success',
                provider: '${provider}',
                accountInfo: ${JSON.stringify(accountInfo)}
              }, '*');
            }
            window.close();
          </script>
          <p>Connection successful! This window will close automatically...</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('[migrations-oauth-callback] Error:', error);
    
    // Return HTML with error message
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-error',
                error: '${error.message}'
              }, '*');
            }
            setTimeout(() => window.close(), 3000);
          </script>
          <p>Connection failed: ${error.message}</p>
          <p>This window will close in 3 seconds...</p>
        </body>
      </html>
    `;
    
    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      status: 400
    });
  }
});
