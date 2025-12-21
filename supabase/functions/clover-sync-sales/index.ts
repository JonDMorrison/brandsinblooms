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

interface CloverOrder {
  id: string;
  currency?: string;
  total?: number;
  state?: string;
  paymentState?: string;
  createdTime?: number;
  modifiedTime?: number;
  lineItems?: {
    elements?: Array<{
      id: string;
      name?: string;
      price?: number;
      unitQty?: number;
      item?: { id: string; name?: string };
    }>;
  };
  customers?: {
    elements?: Array<{ id: string }>;
  };
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

    console.log('[CLOVER-SYNC-SALES] Starting sales sync...');

    // Fetch orders from Clover with pagination
    let offset = 0;
    const limit = 100;
    let salesSynced = 0;
    let customersWithProductTags = 0;

    // Build customer clover_id to crm_customer map
    const { data: existingCustomers } = await supabaseClient
      .from('crm_customers')
      .select('id, clover_customer_id, email, product_tags, lifetime_value, first_purchase_date, last_purchase_date')
      .eq('tenant_id', userData.tenant_id)
      .not('clover_customer_id', 'is', null);

    const customerMap = new Map(
      (existingCustomers || []).map(c => [c.clover_customer_id, c])
    );

    do {
      const url = `${apiBaseUrl}/v3/merchants/${connection.merchant_id}/orders?expand=lineItems,customers&filter=paymentState=PAID&limit=${limit}&offset=${offset}`;
      
      console.log('[CLOVER-SYNC-SALES] Fetching orders, offset:', offset);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CLOVER-SYNC-SALES] API error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch orders');
      }

      const data = await response.json();
      const orders: CloverOrder[] = data.elements || [];

      if (orders.length === 0) break;

      // Process orders
      for (const order of orders) {
        const orderTotal = (order.total || 0) / 100; // Clover stores in cents
        const orderDate = order.createdTime 
          ? new Date(order.createdTime).toISOString() 
          : new Date().toISOString();

        // Insert order into pos_orders
        const { error: orderError } = await supabaseClient
          .from('pos_orders')
          .upsert({
            pos_connection_id: connection.id,
            external_order_id: order.id,
            order_date: orderDate,
            total_amount: orderTotal,
            currency: order.currency || 'USD',
            status: order.state || 'COMPLETED',
            line_items: order.lineItems?.elements || [],
            raw_data: order,
            created_at: orderDate,
          }, {
            onConflict: 'pos_connection_id,external_order_id',
          });

        if (orderError) {
          console.error(`[CLOVER-SYNC-SALES] Failed to upsert order ${order.id}:`, orderError);
          continue;
        }

        salesSynced++;

        // Update customer metrics if order has customer association
        const cloverCustomerId = order.customers?.elements?.[0]?.id;
        if (cloverCustomerId && customerMap.has(cloverCustomerId)) {
          const customer = customerMap.get(cloverCustomerId)!;
          
          // Extract product names for tags
          const productNames = (order.lineItems?.elements || [])
            .map(item => item.name || item.item?.name)
            .filter(Boolean) as string[];
          
          const existingTags = customer.product_tags || [];
          const mergedTags = [...new Set([...existingTags, ...productNames])];
          
          const newLifetimeValue = (customer.lifetime_value || 0) + orderTotal;
          const firstPurchase = customer.first_purchase_date || orderDate;
          const lastPurchase = orderDate > (customer.last_purchase_date || '') ? orderDate : customer.last_purchase_date;

          const { error: updateError } = await supabaseClient
            .from('crm_customers')
            .update({
              product_tags: mergedTags.length > 0 ? mergedTags : null,
              lifetime_value: newLifetimeValue,
              first_purchase_date: firstPurchase,
              last_purchase_date: lastPurchase,
            })
            .eq('id', customer.id);

          if (!updateError) {
            if (productNames.length > 0) {
              customersWithProductTags++;
            }
            
            // Trigger purchase metrics recalculation
            const { error: metricsError } = await supabaseClient.rpc('recalculate_purchase_metrics', {
              p_customer_id: customer.id,
            });
            if (metricsError) {
              console.error(`[CLOVER-SYNC-SALES] Failed to recalculate purchase metrics for ${customer.id}:`, metricsError);
            }
          }
        }
      }

      offset += limit;
      if (orders.length < limit) break;

    } while (true);

    // Update connection with sync info
    await supabaseClient
      .from('clover_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: salesSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[CLOVER-SYNC-SALES] Sales sync complete. Total synced: ${salesSynced}`);

    return new Response(
      JSON.stringify({ success: true, salesSynced, customersWithProductTags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-SYNC-SALES] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
