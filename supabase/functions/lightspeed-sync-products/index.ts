import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-SYNC-PRODUCTS] Edge function starting');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-SYNC-PRODUCTS] Processing sync request');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;

    // Get connection
    const { data: connection, error: connError } = await supabaseClient
      .from('lightspeed_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No active Lightspeed connection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-SYNC-PRODUCTS] Fetching products from Lightspeed...');

    let allProducts: any[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const offset = page * limit;
      const productsUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/3.0/Item.json?limit=${limit}&offset=${offset}`;
      
      const response = await fetch(productsUrl, {
        headers: {
          'Authorization': `Bearer ${connection.encrypted_access_token}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-PRODUCTS] API error:', response.status);
        break;
      }

      const data = await response.json();
      const products = Array.isArray(data.Item) ? data.Item : [data.Item].filter(Boolean);
      
      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(products);
        page++;
        console.log(`[LS-SYNC-PRODUCTS] Fetched page ${page}, total: ${allProducts.length}`);
      }

      if (products.length < limit) {
        hasMore = false;
      }
    }

    console.log(`[LS-SYNC-PRODUCTS] Total products fetched: ${allProducts.length}`);

    let syncedCount = 0;

    for (const product of allProducts) {
      // Extract tags from category or custom fields
      const tags = [];
      if (product.Category?.name) {
        tags.push(product.Category.name);
      }
      if (product.Tags?.tag) {
        const productTags = Array.isArray(product.Tags.tag) ? product.Tags.tag : [product.Tags.tag];
        tags.push(...productTags.map((t: any) => t.name || t));
      }

      const { error: upsertError } = await supabaseClient
        .from('lightspeed_products')
        .upsert({
          tenant_id: tenantId,
          lightspeed_product_id: product.itemID,
          name: product.description || 'Unnamed Product',
          sku: product.customSku || product.manufacturerSku || null,
          description: product.longDescription || product.description || null,
          price: parseFloat(product.Prices?.ItemPrice?.[0]?.amount || product.defaultCost || 0),
          inventory_count: parseInt(product.ItemShops?.ItemShop?.[0]?.qoh || 0),
          category: product.Category?.name || null,
          tags: tags,
          raw_data: product,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,lightspeed_product_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-PRODUCTS] Upsert error:', upsertError);
        continue;
      }

      syncedCount++;
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: syncedCount,
      })
      .eq('tenant_id', tenantId);

    console.log(`[LS-SYNC-PRODUCTS] Sync complete: ${syncedCount} products`);

    return new Response(
      JSON.stringify({ 
        success: true,
        productsSynced: syncedCount,
        message: `Synced ${syncedCount} products`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-PRODUCTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
