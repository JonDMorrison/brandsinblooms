import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken, encryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';
// IMPROVEMENT: Proactive token refresh for Constant Contact
import { getValidCCAccessToken } from '../_shared/ccTokenRefresh.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[constant-contact-validate] FATAL:', error.message);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  const clientId = Deno.env.get('CONSTANT_CONTACT_CLIENT_ID');
  const clientSecret = Deno.env.get('CONSTANT_CONTACT_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('[constant-contact-validate] Missing OAuth credentials for refresh');
    return null;
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[constant-contact-validate] Token refresh failed:', response.status, errorText);
    return null;
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Get connection with refresh token
    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('id, encrypted_access_token, encrypted_refresh_token, token_expires_at, provider_account_name')
      .eq('user_id', user.id)
      .eq('provider', 'constant_contact')
      .eq('status', 'connected')
      .single();

    if (connectionError || !connection?.encrypted_access_token) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'not_connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPROVEMENT: Proactive token refresh if within 5 min of expiry
    let accessToken: string;
    try {
      accessToken = await getValidCCAccessToken(supabase, connection);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'decryption_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to validate the current token
    const accountRes = await fetch('https://api.cc.email/v3/account/summary', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
    });

    // If token is expired/invalid, try to refresh
    if (accountRes.status === 401 && connection.encrypted_refresh_token) {
      console.log('[constant-contact-validate] Access token expired, attempting refresh');
      
      let refreshToken: string;
      try {
        refreshToken = await decryptToken(connection.encrypted_refresh_token);
      } catch (error: any) {
        return new Response(
          JSON.stringify({ valid: false, reason: 'refresh_token_decryption_failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens?.access_token) {
        return new Response(
          JSON.stringify({ valid: false, reason: 'refresh_failed', needs_reauth: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Encrypt and store new tokens
      const encryptedAccessToken = await encryptToken(newTokens.access_token);
      const updatePayload: any = {
        encrypted_access_token: encryptedAccessToken,
        token_expires_at: newTokens.expires_in 
          ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
          : null
      };
      
      if (newTokens.refresh_token) {
        updatePayload.encrypted_refresh_token = await encryptToken(newTokens.refresh_token);
      }

      await supabase
        .from('provider_connections')
        .update(updatePayload)
        .eq('id', connection.id);

      console.log('[constant-contact-validate] Token refreshed successfully');
      
      return new Response(
        JSON.stringify({ 
          valid: true, 
          refreshed: true,
          account_name: connection.provider_account_name 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accountRes.ok) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'api_error', status: accountRes.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountData = await accountRes.json();

    return new Response(
      JSON.stringify({ 
        valid: true, 
        account_name: accountData.organization_name || connection.provider_account_name,
        account_id: accountData.encoded_account_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[constant-contact-validate] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
