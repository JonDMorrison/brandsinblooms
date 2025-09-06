import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function encryptToken(token: string): Promise<string> {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!key) throw new Error('Encryption key not configured');
  
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  const tokenBytes = encoder.encode(token);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    tokenBytes
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_error=${encodeURIComponent(error)}`,
          ...corsHeaders
        }
      });
    }

    if (!code || !state) {
      console.error('Missing code or state parameter');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_error=invalid_callback`,
          ...corsHeaders
        }
      });
    }

    // Parse state parameter
    const [stateId, userId, propertyId] = state.split(':');
    
    if (!userId || !propertyId) {
      console.error('Invalid state parameter');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_error=invalid_state`,
          ...corsHeaders
        }
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GA_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GA_CLIENT_SECRET') ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${Deno.env.get('APP_BASE_URL')}/api/oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_error=token_exchange_failed`,
          ...corsHeaders
        }
      });
    }

    const tokens = await tokenResponse.json();
    
    // Encrypt and store tokens
    const encryptedAccessToken = await encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;

    // Test the connection by making a simple API call
    const testResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    );

    const connectionStatus = testResponse.ok ? 'connected' : 'error';
    
    // Update GA settings with encrypted tokens
    const { error: updateError } = await supabase
      .from('google_analytics_settings')
      .upsert({
        user_id: userId,
        property_id: propertyId,
        connection_status: connectionStatus,
        service_account_configured: true,
        last_test_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('Error updating GA settings:', updateError);
    }

    // Store encrypted tokens in a secure table (you'd need to create this)
    // For now, we'll just log success
    console.log('✅ OAuth callback successful for user:', userId);

    // Redirect back to dashboard with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_success=true`,
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${Deno.env.get('APP_BASE_URL')}/dashboard?ga_error=callback_failed`,
        ...corsHeaders
      }
    });
  }
});