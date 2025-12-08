import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

interface SquarePayment {
  id: string;
  status: string;
  created_at: string;
  order_id?: string;
  customer_id?: string;
  receipt_email?: string;
  buyer_phone_number?: string;
  amount_money?: {
    amount: number;
    currency: string;
  };
}

interface SquareOrderLineItem {
  name?: string;
  quantity: string;
  catalog_object_id?: string;
  variation_name?: string;
}

interface SquareOrder {
  id: string;
  line_items?: SquareOrderLineItem[];
  customer_id?: string;
}

// Fetch order details from Square
async function fetchSquareOrder(
  orderId: string,
  accessToken: string,
  environment: string
): Promise<SquareOrder | null> {
  const baseUrl = environment === 'sandbox'
    ? `https://connect.squareupsandbox.com/v2/orders/${orderId}`
    : `https://connect.squareup.com/v2/orders/${orderId}`;

  try {
    const response = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[SQUARE-SYNC-SALES] Failed to fetch order ${orderId}:`, data.errors);
      return null;
    }

    return data.order as SquareOrder;
  } catch (error) {
    console.error(`[SQUARE-SYNC-SALES] Error fetching order ${orderId}:`, error);
    return null;
  }
}

// Extract product names from order line items
function extractProductNames(order: SquareOrder | null): string[] {
  if (!order?.line_items) return [];
  
  return order.line_items
    .map(item => item.name || item.variation_name)
    .filter((name): name is string => !!name);
}

// Update customer product tags
async function updateCustomerProductTags(
  supabase: any,
  tenantId: string,
  customerEmail: string,
  newProductTags: string[]
) {
  if (newProductTags.length === 0) return;

  // Get existing customer
  const { data: customer, error: fetchError } = await supabase
    .from('crm_customers')
    .select('id, product_tags')
    .eq('tenant_id', tenantId)
    .eq('email', customerEmail)
    .single();

  if (fetchError || !customer) {
    console.log(`[SQUARE-SYNC-SALES] Customer not found for product tags update: ${customerEmail}`);
    return;
  }

  // Merge product tags
  const existingTags = customer.product_tags || [];
  const mergedTags = [...new Set([...existingTags, ...newProductTags])];

  const { error: updateError } = await supabase
    .from('crm_customers')
    .update({ 
      product_tags: mergedTags,
      updated_at: new Date().toISOString()
    })
    .eq('id', customer.id);

  if (updateError) {
    console.error(`[SQUARE-SYNC-SALES] Failed to update product tags for ${customerEmail}:`, updateError);
  } else {
    console.log(`[SQUARE-SYNC-SALES] Updated product tags for ${customerEmail}: +${newProductTags.length} tags`);
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

    // Fetch payments from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/payments'
      : 'https://connect.squareup.com/v2/payments';

    let cursor: string | undefined;
    let salesSynced = 0;
    const customerProductTagsMap = new Map<string, string[]>();

    do {
      const url = new URL(baseUrl);
      if (cursor) url.searchParams.set('cursor', cursor);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch payments');
      }

      if (data.payments && data.payments.length > 0) {
        for (const payment of data.payments as SquarePayment[]) {
          if (payment.status === 'COMPLETED') {
            // Phase 3: Fetch order details to get product names
            let orderData: SquareOrder | null = null;
            let productNames: string[] = [];

            if (payment.order_id) {
              orderData = await fetchSquareOrder(payment.order_id, accessToken, connection.environment);
              productNames = extractProductNames(orderData);
              
              // Track product tags by customer email
              if (payment.receipt_email && productNames.length > 0) {
                const existing = customerProductTagsMap.get(payment.receipt_email) || [];
                customerProductTagsMap.set(payment.receipt_email, [...existing, ...productNames]);
              }
            }

            // Upsert order with line items data
            const { error: orderError } = await supabaseClient
              .from('pos_orders')
              .upsert({
                pos_connection_id: connection.id,
                external_id: payment.id,
                external_customer_id: payment.customer_id,
                order_date: payment.created_at,
                total_amount: payment.amount_money?.amount ? payment.amount_money.amount / 100 : 0,
                currency: payment.amount_money?.currency || 'USD',
                status: payment.status,
                items: orderData?.line_items ? orderData.line_items.map(li => ({
                  name: li.name || li.variation_name,
                  quantity: li.quantity,
                  catalog_object_id: li.catalog_object_id
                })) : [],
                raw_data: { payment, order: orderData },
              }, {
                onConflict: 'pos_connection_id,external_id',
              });

            if (orderError) {
              console.error(`[SQUARE-SYNC-SALES] Failed to upsert order ${payment.id}:`, orderError);
            } else {
              salesSynced++;
            }
          }
        }
      }

      cursor = data.cursor;
    } while (cursor);

    // Phase 3: Update customer product tags in batch
    console.log(`[SQUARE-SYNC-SALES] Updating product tags for ${customerProductTagsMap.size} customers...`);
    for (const [email, tags] of customerProductTagsMap) {
      const uniqueTags = [...new Set(tags)];
      await updateCustomerProductTags(supabaseClient, userData.tenant_id, email, uniqueTags);
    }

    await supabaseClient
      .from('square_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: salesSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[SQUARE-SYNC-SALES] Sales sync complete. Total: ${salesSynced}, Customers with product tags: ${customerProductTagsMap.size}`);

    return new Response(
      JSON.stringify({ success: true, salesSynced, customersWithProductTags: customerProductTagsMap.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-SYNC-SALES] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
