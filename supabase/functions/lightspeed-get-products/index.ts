import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function simpleDecrypt(encrypted: string): Promise<string> {
  return atob(encrypted);
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
    const accessToken = await simpleDecrypt(connection.encrypted_access_token);

    // Fetch products from Lightspeed API
    const response = await fetch(
      `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/products?limit=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }

    const productsData = await response.json();
    
    // Format products for display
    const products = (productsData.data || []).map((product: any) => ({
      id: product.id,
      name: product.name || 'Unnamed Product',
      sku: product.sku || 'N/A',
      price: product.prices?.[0]?.amount || 0,
      description: product.description || '',
      inventory: product.inventory_count || 0,
    }));

    console.log('Fetched products:', products.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products,
        count: products.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get products error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
