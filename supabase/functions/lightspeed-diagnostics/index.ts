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

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    connection: null,
    apiTests: {},
    syncStats: {},
    errors: [],
  };

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

    // 1. Get connection status
    const { data: connection, error: connError } = await supabaseClient
      .from('lightspeed_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (connError || !connection) {
      diagnostics.errors.push('No connection found');
      diagnostics.connection = { status: 'not_connected' };
    } else {
      const expiresAt = new Date(connection.expires_at);
      const now = new Date();
      const minutesRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
      
      diagnostics.connection = {
        status: 'connected',
        domain_prefix: connection.domain_prefix,
        retailer_name: connection.retailer_name,
        last_synced_at: connection.last_synced_at,
        expires_at: connection.expires_at,
        minutes_until_expiry: minutesRemaining,
        token_valid: minutesRemaining > 0,
      };

      // 2. Test API calls if connected
      try {
        const accessToken = await simpleDecrypt(connection.encrypted_access_token);

        // Test retailer endpoint
        try {
          const retailerResp = await fetch(
            `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/retailer`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          diagnostics.apiTests.retailer = {
            success: retailerResp.ok,
            status: retailerResp.status,
            data: retailerResp.ok ? await retailerResp.json() : null,
          };
        } catch (error) {
          diagnostics.apiTests.retailer = { success: false, error: error.message };
          diagnostics.errors.push(`Retailer API test failed: ${error.message}`);
        }

        // Test products endpoint
        try {
          const productsResp = await fetch(
            `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/products?limit=5`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const productsData = productsResp.ok ? await productsResp.json() : null;
          diagnostics.apiTests.products = {
            success: productsResp.ok,
            status: productsResp.status,
            count: productsData?.data?.length || 0,
            sample: productsData?.data?.slice(0, 2) || [],
          };
        } catch (error) {
          diagnostics.apiTests.products = { success: false, error: error.message };
          diagnostics.errors.push(`Products API test failed: ${error.message}`);
        }
      } catch (error) {
        diagnostics.errors.push(`Token decryption failed: ${error.message}`);
      }

      // 3. Get sync statistics from database
      try {
        const { count: customersCount } = await supabaseClient
          .from('lightspeed_customers')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', userData.tenant_id);

        const { count: salesCount } = await supabaseClient
          .from('lightspeed_sales')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', userData.tenant_id);

        const { count: productsCount } = await supabaseClient
          .from('lightspeed_products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', userData.tenant_id);

        diagnostics.syncStats = {
          customers: customersCount || 0,
          sales: salesCount || 0,
          products: productsCount || 0,
        };
      } catch (error) {
        diagnostics.errors.push(`Failed to fetch sync stats: ${error.message}`);
      }
    }

    diagnostics.success = diagnostics.errors.length === 0;

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    diagnostics.errors.push(error.message);
    diagnostics.success = false;
    
    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
