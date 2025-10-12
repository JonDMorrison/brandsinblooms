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
    const { code, state, provider } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get tenant_id
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    // Verify state token
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('provider', provider)
      .single();

    if (!connection || connection.metadata?.state !== state) {
      throw new Error('Invalid state token');
    }

    // Get OAuth credentials
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/migrations-oauth-callback`;

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

    // Update connection with encrypted tokens
    await supabase.from('provider_connections').upsert({
      tenant_id: userData.tenant_id,
      user_id: user.id,
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
    }, {
      onConflict: 'tenant_id,provider'
    });

    console.log(`[migrations-oauth-callback] Successfully connected ${provider} for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, accountInfo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[migrations-oauth-callback] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
