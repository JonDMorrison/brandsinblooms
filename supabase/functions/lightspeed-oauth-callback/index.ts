import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple base64 encoding - for production use proper encryption
async function simpleEncrypt(token: string): Promise<string> {
  return btoa(token);
}

async function simpleDecrypt(encrypted: string): Promise<string> {
  return atob(encrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-CALLBACK] ==========================================');
    console.log('[LS-CALLBACK] Request received');
    console.log('[LS-CALLBACK] Full URL:', req.url);
    console.log('[LS-CALLBACK] Referer:', req.headers.get('referer') || '(none)');
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    console.log('[LS-CALLBACK] Code present:', !!code);
    console.log('[LS-CALLBACK] State present:', !!state);
    console.log('[LS-CALLBACK] Error param:', error || '(none)');

    if (error) {
      console.error('[LS-CALLBACK] OAuth error:', error);
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      console.error('[LS-CALLBACK] Missing code or state');
      throw new Error('Missing code or state');
    }

    console.log('[LS-CALLBACK] Validating state');
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
      if (Date.now() > stateData.exp) {
        throw new Error('State expired');
      }
    } catch (e) {
      console.error('[LS-CALLBACK] Invalid state:', e.message);
      throw new Error('Invalid or expired state');
    }

    const { t: tenantId, d: domainPrefix, u: userId } = stateData;
    console.log('[LS-CALLBACK] State valid. Tenant:', tenantId, 'Domain:', domainPrefix);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');
    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;

    if (!clientId || !clientSecret) {
      console.error('[LS-CALLBACK] Missing credentials');
      throw new Error('Missing credentials');
    }

    console.log('[LS-CALLBACK] Exchanging code for tokens');
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
      console.error('[LS-CALLBACK] Token exchange failed:', tokenResp.status, errorText);
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResp.json();
    console.log('[LS-CALLBACK] Tokens received, fetching retailer info');

    const retailerResp = await fetch(
      `https://${domainPrefix}.retail.lightspeed.app/api/2.0/retailer`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!retailerResp.ok) {
      const errorText = await retailerResp.text();
      console.error('[LS-CALLBACK] Retailer fetch failed:', retailerResp.status, errorText);
      throw new Error('Failed to fetch retailer info');
    }

    const retailer = await retailerResp.json();
    console.log('[LS-CALLBACK] Retailer fetched:', retailer.id);

    // Simple encryption
    const encryptedAccessToken = await simpleEncrypt(tokens.access_token);
    const encryptedRefreshToken = await simpleEncrypt(tokens.refresh_token || tokens.access_token);
    const expiresAt = new Date(Date.now() + ((tokens.expires_in - 120) * 1000));

    console.log('[LS-CALLBACK] Storing connection in database');
    const { error: dbError } = await supabaseAdmin
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
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,domain_prefix',
      });

    if (dbError) {
      console.error('[LS-CALLBACK] DB error:', dbError.message);
      throw new Error('Failed to store connection: ' + dbError.message);
    }

    console.log('[LS-CALLBACK] Success! Connection stored');

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'lightspeed-success'},'*');setTimeout(()=>window.close(),500);</script><p>Connected successfully! Closing...</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('[LS-CALLBACK] Error:', error.message);
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'lightspeed-error',error:'${encodeURIComponent(error.message)}'},'*');setTimeout(()=>window.close(),500);</script><p>Error: ${error.message}</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});
