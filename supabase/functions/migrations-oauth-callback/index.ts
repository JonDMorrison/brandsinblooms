import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify state token
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (!connection || connection.metadata?.state !== state) {
      throw new Error('Invalid state token');
    }

    // Get OAuth credentials
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
    const redirectUri = Deno.env.get(`${provider.toUpperCase()}_REDIRECT_URI`);

    if (!clientId || !clientSecret || !redirectUri) {
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
          revision: '2024-10-15'
        },
      });
      const accData = await accountRes.json();
      accountInfo = accData.data?.[0]?.attributes || {};
    }

    // Update connection with tokens (encrypted)
    await supabase.from('provider_connections').upsert({
      user_id: user.id,
      provider,
      status: 'connected',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      account_info: accountInfo,
      connected_at: new Date().toISOString(),
      metadata: { ...connection.metadata, state: null }
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
