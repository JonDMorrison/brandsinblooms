import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Decrypt helper (matches encrypt in oauth-callback)
async function decryptToken(encryptedToken: string): Promise<string> {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key) throw new Error('Encryption key not configured');

  const keyData = new TextEncoder().encode(key.padEnd(32).slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

  const parts = encryptedToken.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted token format');

  const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(parts[1].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    if (!provider || !['mailchimp', 'klaviyo'].includes(provider)) {
      throw new Error('Invalid provider');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get provider connection with encrypted token
    const { data: connection, error: connError } = await supabase
      .from('provider_connections')
      .select('encrypted_access_token, metadata')
      .eq('provider', provider)
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      throw new Error('Provider connection not found');
    }

    let tokenRevoked = false;
    let revokeError = null;

    // Attempt to revoke token at provider's API
    if (connection.encrypted_access_token) {
      try {
        const accessToken = await decryptToken(connection.encrypted_access_token);

        if (provider === 'mailchimp') {
          // Mailchimp OAuth2 token revocation
          // https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/#revoke-access
          const revokeResponse = await fetch('https://login.mailchimp.com/oauth2/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: accessToken,
              token_type_hint: 'access_token'
            })
          });

          if (!revokeResponse.ok) {
            throw new Error(`Mailchimp revocation failed: ${revokeResponse.statusText}`);
          }
          tokenRevoked = true;
        } else if (provider === 'klaviyo') {
          // Klaviyo doesn't have a revocation endpoint - token is simply deleted
          // The token becomes invalid once removed from storage
          tokenRevoked = true;
        }
      } catch (error: any) {
        console.error('Token revocation error:', error);
        revokeError = error.message;
        // Continue to update database even if revocation fails
        // (token might already be invalid)
      }
    }

    // Update provider connection in database
    const { error: updateError } = await supabase
      .from('provider_connections')
      .update({
        status: 'disconnected',
        revoked_at: new Date().toISOString(),
        encrypted_access_token: null, // Clear the token
      })
      .eq('provider', provider)
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenRevoked,
        message: revokeError 
          ? `Connection removed (token revocation warning: ${revokeError})`
          : 'Provider disconnected successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Revoke token error:', error);
    return new Response(
      JSON.stringify({ 
        error: true,
        message: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
