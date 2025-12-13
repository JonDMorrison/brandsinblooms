import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

// Get Clover API base URL based on environment and region
function getCloverApiUrl(environment: string, region: string = 'na'): string {
  if (environment === 'sandbox') {
    return 'https://apisandbox.dev.clover.com';
  }
  
  switch (region) {
    case 'eu':
      return 'https://api.eu.clover.com';
    case 'la':
      return 'https://api.la.clover.com';
    default:
      return 'https://api.clover.com';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Get user's tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    // Get Clover connection
    const { data: connection } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Clover connection');

    console.log('[CLOVER-TEST] Testing connection for merchant:', connection.merchant_id);

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);

    // Fetch merchant info to verify token
    const merchantUrl = `${apiBaseUrl}/v3/merchants/${connection.merchant_id}`;
    const response = await fetch(merchantUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CLOVER-TEST] API error:', errorData);
      throw new Error(errorData.message || 'Failed to verify connection');
    }

    const merchantData = await response.json();

    console.log('[CLOVER-TEST] Connection verified for:', merchantData.name);

    return new Response(
      JSON.stringify({
        success: true,
        merchant: {
          id: merchantData.id,
          name: merchantData.name,
          address: merchantData.address,
          phoneNumber: merchantData.phoneNumber,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-TEST] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
