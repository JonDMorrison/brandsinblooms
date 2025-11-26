import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    const { data: connection } = await supabaseClient
      .from('square_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Square connection');

    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Test connection by fetching merchant info
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/merchants'
      : 'https://connect.squareup.com/v2/merchants';

    const response = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || 'Connection test failed');
    }

    const merchant = data.merchant || {};

    return new Response(
      JSON.stringify({
        success: true,
        merchant: {
          id: merchant.id,
          name: merchant.business_name,
          country: merchant.country,
          currency: merchant.currency,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-TEST] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});