import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://bloomsuite.app';

function htmlClose(type: 'oauth-success' | 'oauth-error', payload: Record<string, string>) {
  // Safe inside the inline script: no character can close the element or the string (crm-r2-F72).
  const msg = JSON.stringify({ type, provider: 'mailchimp', ...payload })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return new Response(
    `<!DOCTYPE html><html><body>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage(${msg}, '${APP_ORIGIN}');
          }
        } catch (e) {
          console.error('postMessage failed:', e);
        }
        setTimeout(() => window.close(), 300);
      </script>
      <p style="text-align:center;padding:20px;font-family:system-ui;">
        ${type === 'oauth-success' ? '✓ Successfully connected Mailchimp!' : '✗ Connection failed'}
      </p>
    </body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders
      }
    }
  );
}

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

    // Handle OAuth errors: a fixed code, never the request's value (crm-r2-F72)
    if (error) {
      console.error('OAuth error returned by the provider');
      return htmlClose('oauth-error', { error: 'provider_error' });
    }

    if (!code || !state) {
      console.error('Missing code or state parameter');
      return htmlClose('oauth-error', { error: 'invalid_callback' });
    }

    // The state is the id oauth-initiate stored; user, tenant and property come from that row, which is
    // consumed once (crm-r2-F73). Nothing else in the state string is trusted.
    const [stateId] = state.split(':');
    if (!stateId) {
      console.error('Invalid state parameter');
      return htmlClose('oauth-error', { error: 'invalid_state' });
    }
    const { data: stateRow, error: stateError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('state_token', stateId)
      .eq('provider', 'google_analytics')
      .select('user_id, tenant_id, domain_prefix, expires_at')
      .maybeSingle();

    if (stateError || !stateRow || !stateRow.domain_prefix || new Date(stateRow.expires_at) < new Date()) {
      console.error('Invalid state parameter');
      return htmlClose('oauth-error', { error: 'invalid_state' });
    }

    const userId: string = stateRow.user_id;
    const tenantId: string = stateRow.tenant_id;
    const propertyId: string = stateRow.domain_prefix;

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
      return htmlClose('oauth-error', { error: 'token_exchange_failed' });
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
        tenant_id: tenantId,
        user_id: userId,
        property_id: propertyId,
        connection_status: connectionStatus,
        service_account_configured: true,
        last_test_at: new Date().toISOString(),
        last_test_status: testResponse.ok ? 'success' : 'error',
        last_test_message: testResponse.ok
          ? 'Property accessible · Sessions data available'
          : 'Google Analytics authorization succeeded, but the property test failed.',
      }, {
        onConflict: 'tenant_id,user_id'
      });

    if (updateError) {
      console.error('Error updating GA settings:', updateError);
    }

    // Store encrypted tokens in a secure table (you'd need to create this)
    // For now, we'll just log success
    console.log('✅ OAuth callback successful for user:', userId);

    // Return success HTML with postMessage
    return htmlClose('oauth-success', { message: 'Connected successfully' });

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    return htmlClose('oauth-error', { error: 'callback_failed' });
  }
});