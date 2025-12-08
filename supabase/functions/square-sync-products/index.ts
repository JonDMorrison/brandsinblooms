import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

// Sync a single product item to the database
async function syncProductToDatabase(
  supabase: any,
  tenantId: string,
  userId: string,
  item: any,
): Promise<boolean> {
  const itemData = item.item_data || {};
  
  try {
    // Upsert main product
    const { data: product, error: productError } = await supabase
      .from('products')
      .upsert({
        tenant_id: tenantId,
        created_by_user_id: userId,
        external_id: item.id,
        name: itemData.name || 'Unnamed Product',
        description: itemData.description || null,
        category: itemData.category?.name || null,
        source: 'square',
        status: item.is_deleted ? 'archived' : 'active',
        sku: itemData.variations?.[0]?.item_variation_data?.sku || null,
        price: itemData.variations?.[0]?.item_variation_data?.price_money?.amount 
          ? itemData.variations[0].item_variation_data.price_money.amount / 100 
          : 0,
        currency: itemData.variations?.[0]?.item_variation_data?.price_money?.currency || 'USD',
        external_data: item,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,external_id' })
      .select()
      .single();
    
    if (productError) {
      console.error(`❌ Error upserting product ${item.id}:`, productError);
      return false;
    }
    
    console.log(`✅ Product synced: ${itemData.name}`);
    
    // Sync variations
    if (itemData.variations && itemData.variations.length > 0) {
      for (const variation of itemData.variations) {
        const variationData = variation.item_variation_data || {};
        
        const { error: varError } = await supabase
          .from('product_variations')
          .upsert({
            product_id: product.id,
            external_id: variation.id,
            name: variationData.name || 'Default',
            sku: variationData.sku || null,
            price: variationData.price_money?.amount 
              ? variationData.price_money.amount / 100 
              : 0,
            attributes: variationData.item_option_values || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'product_id,external_id' });
        
        if (varError) {
          console.error(`❌ Error upserting variation ${variation.id}:`, varError);
        }
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ Error syncing product ${item.id}:`, error.message);
    return false;
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

    // Fetch catalog items from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/catalog/list'
      : 'https://connect.squareup.com/v2/catalog/list';

    let cursor: string | undefined;
    let productsSynced = 0;

    console.log('🔄 Starting Square product sync...');

    do {
      const url = new URL(baseUrl);
      url.searchParams.set('types', 'ITEM');
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch catalog');
      }

      if (data.objects && data.objects.length > 0) {
        for (const item of data.objects) {
          if (item.type === 'ITEM') {
            const synced = await syncProductToDatabase(
              supabaseClient,
              userData.tenant_id,
              user.id,
              item
            );
            if (synced) productsSynced++;
          }
        }
      }

      cursor = data.cursor;
    } while (cursor);

    // Update sync metadata
    await supabaseClient
      .from('square_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: productsSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`✅ Product sync complete. Synced ${productsSynced} products.`);

    return new Response(
      JSON.stringify({ success: true, productsSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-SYNC-PRODUCTS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});