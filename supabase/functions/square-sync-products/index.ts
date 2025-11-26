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

    // Fetch catalog items from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/catalog/list'
      : 'https://connect.squareup.com/v2/catalog/list';

    let cursor: string | undefined;
    let productsSynced = 0;

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
            const itemData = item.item_data || {};
            productsSynced++;
            // Store in a products table (you might need to create this)
            console.log(`Product: ${itemData.name}`);
          }
        }
      }

      cursor = data.cursor;
    } while (cursor);

    await supabaseClient
      .from('square_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: productsSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

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