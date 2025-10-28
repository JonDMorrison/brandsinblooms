import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function encryptToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('STATE_SIGNING_SECRET')?.substring(0, 32) || ''),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(encrypted)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state');
    }

    let stateData;
    try {
      stateData = JSON.parse(atob(state));
      if (Date.now() > stateData.exp) {
        throw new Error('State expired');
      }
    } catch {
      throw new Error('Invalid state');
    }

    const { t: tenantId, d: domainPrefix, u: userId } = stateData;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');
    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing credentials');
    }

    // Exchange code for tokens
    const tokenUrl = `https://${domainPrefix}.retail.lightspeed.app/api/1.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResp.json();

    // Fetch retailer info
    const retailerResp = await fetch(
      `https://${domainPrefix}.retail.lightspeed.app/api/2.0/retailer`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!retailerResp.ok) {
      throw new Error('Failed to fetch retailer info');
    }

    const retailer = await retailerResp.json();

    // Encrypt tokens
    const encryptedAccessToken = await encryptToken(tokens.access_token);
    const encryptedRefreshToken = await encryptToken(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + ((tokens.expires_in - 120) * 1000));

    // Store connection
    await supabaseAdmin
      .from('lightspeed_connections')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        domain_prefix: domainPrefix,
        retailer_id: retailer.id,
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        expires_at: expiresAt.toISOString(),
        installed_by: userId,
      }, {
        onConflict: 'tenant_id,domain_prefix',
      });

    console.log('Lightspeed connection established for retailer:', retailer.id);

    return new Response(
      `<html><body><script>window.opener.postMessage({type:'lightspeed-success'},'*');window.close();</script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><script>window.opener.postMessage({type:'lightspeed-error',error:'${error.message}'},'*');window.close();</script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});
