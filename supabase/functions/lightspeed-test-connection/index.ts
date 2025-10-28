import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptToken(encrypted: string): Promise<string> {
  const encoder = new TextEncoder();
  const raw = atob(encrypted);
  const iv = new Uint8Array(Array.from(raw.substring(0, 12), c => c.charCodeAt(0)));
  const data = new Uint8Array(Array.from(raw.substring(12), c => c.charCodeAt(0)));
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('STATE_SIGNING_SECRET')?.substring(0, 32) || ''),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

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

    // Decrypt token
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Test API call
    const response = await fetch(
      `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/retailer`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error('Connection test failed');
    }

    const retailer = await response.json();

    console.log('Connection test successful for retailer:', retailer.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        retailer: {
          id: retailer.id,
          name: retailer.name || 'Unknown',
        }
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
