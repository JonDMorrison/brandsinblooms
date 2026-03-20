// IMPROVEMENT: Dedicated edge function to refresh Constant Contact OAuth tokens
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken, encryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[refresh-constant-contact-token] FATAL:', error.message);
}

export async function refreshConstantContactToken(
  supabase: any,
  connectionId: string,
  encryptedRefreshToken: string
): Promise<{ access_token: string; success: boolean; error?: string }> {
  const clientId = Deno.env.get('CONSTANT_CONTACT_CLIENT_ID');
  const clientSecret = Deno.env.get('CONSTANT_CONTACT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return { access_token: '', success: false, error: 'Missing OAuth credentials' };
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptToken(encryptedRefreshToken);
  } catch (e: any) {
    return { access_token: '', success: false, error: 'Failed to decrypt refresh token' };
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
    console.error('[refresh-constant-contact-token] Token refresh failed:', response.status, errorText);
    return { access_token: '', success: false, error: `Refresh failed: ${response.status}` };
  }

  const tokenData = await response.json();

  if (!tokenData.access_token) {
    return { access_token: '', success: false, error: 'No access_token in refresh response' };
  }

  // Encrypt and store new tokens
  const encryptedAccessToken = await encryptToken(tokenData.access_token);
  const updatePayload: any = {
    encrypted_access_token: encryptedAccessToken,
    token_expires_at: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null
  };

  if (tokenData.refresh_token) {
    updatePayload.encrypted_refresh_token = await encryptToken(tokenData.refresh_token);
  }

  const { error: updateErr } = await supabase
    .from('provider_connections')
    .update(updatePayload)
    .eq('id', connectionId);

  if (updateErr) {
    console.error('[refresh-constant-contact-token] Failed to update connection:', updateErr);
    return { access_token: '', success: false, error: 'Failed to store refreshed token' };
  }

  console.log('[refresh-constant-contact-token] Token refreshed successfully');
  return { access_token: tokenData.access_token, success: true };
}

// Also serve as a standalone edge function
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

    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('id, encrypted_refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'constant_contact')
      .eq('status', 'connected')
      .single();

    if (connectionError || !connection?.encrypted_refresh_token) {
      throw new Error('No Constant Contact connection with refresh token found');
    }

    const result = await refreshConstantContactToken(supabase, connection.id, connection.encrypted_refresh_token);

    if (!result.success) {
      throw new Error(result.error || 'Refresh failed');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Token refreshed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[refresh-constant-contact-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
