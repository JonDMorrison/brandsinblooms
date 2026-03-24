import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken } from '../_shared/crypto/tokens.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found');
    }

    // Get connection
    const { data: connection } = await supabaseClient
      .from('lightspeed_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (!connection) {
      throw new Error('No Lightspeed connection found');
    }

    let usedLegacyPlaintextFallback = false;
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch {
      usedLegacyPlaintextFallback = true;
      console.warn(
        `[LS] Token for connection ${connection.id} appears unencrypted. Re-encryption required.`,
      );
      accessToken = connection.encrypted_access_token;
    }

    // Test the same customer endpoint contract used by the real sync worker.
    const response = await fetch(
      `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Customer.json?limit=1&offset=0`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Connection probe failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const customerCount = Array.isArray(payload?.Customer)
      ? payload.Customer.length
      : payload?.Customer
        ? 1
        : 0;

    console.log('Connection probe successful for Lightspeed customer endpoint');

    return new Response(
      JSON.stringify({
        success: true,
        probeType: 'customer-api-lite',
        isFullHealthCheck: false,
        message: 'Customer endpoint is reachable. Use Lightspeed Diagnostics for full sync-path health.',
        tokenMode: usedLegacyPlaintextFallback ? 'legacy_plaintext' : 'encrypted',
        connection: {
          retailerName: connection.retailer_name || 'Unknown',
          domainPrefix: connection.domain_prefix,
          expiresAt: connection.expires_at,
        },
        sampleCount: customerCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
