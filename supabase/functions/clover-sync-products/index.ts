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

interface CloverItem {
  id: string;
  name: string;
  price?: number;
  priceType?: string;
  stockCount?: number;
  sku?: string;
  code?: string;
  hidden?: boolean;
  available?: boolean;
  categories?: {
    elements?: Array<{ id: string; name: string }>;
  };
  modifiedTime?: number;
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

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);

    console.log('[CLOVER-SYNC-PRODUCTS] Starting products sync...');

    // Fetch items from Clover with pagination
    let offset = 0;
    const limit = 100;
    let productsSynced = 0;

    do {
      const url = `${apiBaseUrl}/v3/merchants/${connection.merchant_id}/items?expand=categories&limit=${limit}&offset=${offset}`;
      
      console.log('[CLOVER-SYNC-PRODUCTS] Fetching items, offset:', offset);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CLOVER-SYNC-PRODUCTS] API error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch items');
      }

      const data = await response.json();
      const items: CloverItem[] = data.elements || [];

      if (items.length === 0) break;

      // Process items
      for (const item of items) {
        const categoryNames = (item.categories?.elements || []).map(c => c.name);
        
        const { error: upsertError } = await supabaseClient
          .from('products')
          .upsert({
            tenant_id: userData.tenant_id,
            external_id: item.id,
            source: 'clover',
            name: item.name,
            sku: item.sku || item.code,
            price: item.price ? item.price / 100 : null, // Clover stores in cents
            stock_quantity: item.stockCount,
            categories: categoryNames.length > 0 ? categoryNames : null,
            is_active: item.available !== false && item.hidden !== true,
            raw_data: item,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,external_id,source',
          });

        if (upsertError) {
          console.error(`[CLOVER-SYNC-PRODUCTS] Failed to upsert item ${item.name}:`, upsertError);
          continue;
        }

        productsSynced++;
      }

      offset += limit;
      if (items.length < limit) break;

    } while (true);

    // Update connection with sync info
    await supabaseClient
      .from('clover_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: productsSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[CLOVER-SYNC-PRODUCTS] Products sync complete. Total synced: ${productsSynced}`);

    return new Response(
      JSON.stringify({ success: true, productsSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-SYNC-PRODUCTS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
