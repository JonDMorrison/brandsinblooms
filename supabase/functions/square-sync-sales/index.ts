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

// Track customer purchase metrics
interface CustomerPurchaseMetrics {
  productTags: string[];
  totalSpent: number;
  orderCount: number;
  orderHistory: any[];
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
}

// Update customer with purchase metrics and product tags
async function updateCustomerPurchaseData(
  supabase: any,
  tenantId: string,
  customerEmail: string,
  squareCustomerId: string | null,
  metrics: CustomerPurchaseMetrics
): Promise<{ matched: boolean; matchedBy: 'email' | 'square_customer_id' | null }> {
  // First try to match by email
  let customer = null;
  let matchedBy: 'email' | 'square_customer_id' | null = null;
  
  const isPlaceholderEmail = customerEmail?.includes('@noemail.local') || !customerEmail;
  
  if (customerEmail && !isPlaceholderEmail) {
    const { data: customerByEmail } = await supabase
      .from('crm_customers')
      .select('id, product_tags, order_history, lifetime_value, first_purchase_date, last_purchase_date, square_customer_id')
      .eq('tenant_id', tenantId)
      .eq('email', customerEmail)
      .single();
    
    if (customerByEmail) {
      customer = customerByEmail;
      matchedBy = 'email';
      console.log(`[SQUARE-SYNC-SALES] Matched by email: ${customerEmail}`);
    }
  }

  // Fallback: match by square_customer_id if email match failed or was placeholder
  if (!customer && squareCustomerId) {
    const { data: customerBySquareId } = await supabase
      .from('crm_customers')
      .select('id, product_tags, order_history, lifetime_value, first_purchase_date, last_purchase_date, square_customer_id')
      .eq('tenant_id', tenantId)
      .eq('square_customer_id', squareCustomerId)
      .single();
    
    if (customerBySquareId) {
      customer = customerBySquareId;
      matchedBy = 'square_customer_id';
      console.log(`[SQUARE-SYNC-SALES] Matched by square_customer_id: ${squareCustomerId}`);
    }
  }

  if (!customer) {
    console.log(`[SQUARE-SYNC-SALES] Customer not found - email: ${customerEmail}, square_id: ${squareCustomerId}`);
    return { matched: false, matchedBy: null };
  }

  // Merge product tags
  const existingTags = customer.product_tags || [];
  const mergedTags = [...new Set([...existingTags, ...metrics.productTags])];

  // Merge order history (avoid duplicates by order ID)
  const existingHistory = customer.order_history || [];
  const existingIds = new Set(existingHistory.map((o: any) => o.id));
  const newOrders = metrics.orderHistory.filter(o => !existingIds.has(o.id));
  const mergedHistory = [...existingHistory, ...newOrders];

  // Calculate cumulative lifetime value
  const cumulativeLifetimeValue = (customer.lifetime_value || 0) + metrics.totalSpent;

  // Determine first and last purchase dates
  const firstPurchaseDate = customer.first_purchase_date || metrics.firstPurchaseDate;
  const lastPurchaseDate = metrics.lastPurchaseDate 
    ? (customer.last_purchase_date && customer.last_purchase_date > metrics.lastPurchaseDate
        ? customer.last_purchase_date 
        : metrics.lastPurchaseDate)
    : customer.last_purchase_date;

  const { error: updateError } = await supabase
    .from('crm_customers')
    .update({ 
      product_tags: mergedTags,
      order_history: mergedHistory,
      lifetime_value: cumulativeLifetimeValue,
      total_spent: cumulativeLifetimeValue,
      first_purchase_date: firstPurchaseDate,
      last_purchase_date: lastPurchaseDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', customer.id);

  if (updateError) {
    console.error(`[SQUARE-SYNC-SALES] Failed to update customer ${customer.id}:`, updateError);
  } else {
    console.log(`[SQUARE-SYNC-SALES] Updated customer (matched_by=${matchedBy}): LTV=$${cumulativeLifetimeValue}, orders=${mergedHistory.length}, tags=${mergedTags.length}`);
    
    // Trigger purchase metrics recalculation
    const { error: metricsError } = await supabase.rpc('recalculate_purchase_metrics', {
      p_customer_id: customer.id,
    });
    if (metricsError) {
      console.error(`[SQUARE-SYNC-SALES] Failed to recalculate purchase metrics for ${customer.id}:`, metricsError);
    }
  }
  
  return { matched: true, matchedBy };
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
    const customerMetricsMap = new Map<string, CustomerPurchaseMetrics>();

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
            // Fetch order details to get product names
            let orderData: SquareOrder | null = null;
            let productNames: string[] = [];
            const orderAmount = payment.amount_money?.amount ? payment.amount_money.amount / 100 : 0;

            if (payment.order_id) {
              orderData = await fetchSquareOrder(payment.order_id, accessToken, connection.environment);
              productNames = extractProductNames(orderData);
            }

            // Track purchase metrics by customer (email or square_customer_id)
            const email = payment.receipt_email?.toLowerCase() || '';
            const squareCustomerId = payment.customer_id || '';
            const trackingKey = email || `square:${squareCustomerId}`;
            
            if (trackingKey && trackingKey !== 'square:') {
              const existing = customerMetricsMap.get(trackingKey) || {
                productTags: [],
                totalSpent: 0,
                orderCount: 0,
                orderHistory: [],
                firstPurchaseDate: null,
                lastPurchaseDate: null,
                squareCustomerId: squareCustomerId
              };

              // Add product tags
              existing.productTags = [...existing.productTags, ...productNames];
              
              // Add to total spent
              existing.totalSpent += orderAmount;
              existing.orderCount++;

              // Track order history
              existing.orderHistory.push({
                id: payment.id,
                date: payment.created_at,
                total: orderAmount,
                items: orderData?.line_items?.map(li => ({
                  name: li.name || li.variation_name,
                  quantity: parseInt(li.quantity) || 1,
                })) || []
              });

              // Track purchase dates
              const orderDate = payment.created_at;
              if (!existing.firstPurchaseDate || orderDate < existing.firstPurchaseDate) {
                existing.firstPurchaseDate = orderDate;
              }
              if (!existing.lastPurchaseDate || orderDate > existing.lastPurchaseDate) {
                existing.lastPurchaseDate = orderDate;
              }
              
              // Store square_customer_id
              if (squareCustomerId) {
                existing.squareCustomerId = squareCustomerId;
              }

              customerMetricsMap.set(trackingKey, existing);
            }

            // Upsert order with line items data
            const { error: orderError } = await supabaseClient
              .from('pos_orders')
              .upsert({
                pos_connection_id: connection.id,
                external_id: payment.id,
                external_customer_id: payment.customer_id,
                order_date: payment.created_at,
                total_amount: orderAmount,
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

    // Update customer purchase metrics in batch
    console.log(`[SQUARE-SYNC-SALES] Updating purchase metrics for ${customerMetricsMap.size} customers...`);
    let customersUpdated = 0;
    let matchedByEmail = 0;
    let matchedBySquareId = 0;
    
    for (const [key, metrics] of customerMetricsMap) {
      metrics.productTags = [...new Set(metrics.productTags)]; // Deduplicate
      
      // Determine email vs square_customer_id from key
      const email = key.startsWith('square:') ? '' : key;
      const squareCustomerId = (metrics as any).squareCustomerId || '';
      
      const result = await updateCustomerPurchaseData(
        supabaseClient, 
        userData.tenant_id, 
        email, 
        squareCustomerId,
        metrics
      );
      
      if (result.matched) {
        customersUpdated++;
        if (result.matchedBy === 'email') matchedByEmail++;
        if (result.matchedBy === 'square_customer_id') matchedBySquareId++;
      }
    }
    
    console.log(`[SQUARE-SYNC-SALES] Customer matching: ${matchedByEmail} by email, ${matchedBySquareId} by square_customer_id`);

    await supabaseClient
      .from('square_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: salesSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[SQUARE-SYNC-SALES] Sales sync complete. Total: ${salesSynced}, Customers updated: ${customersUpdated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        salesSynced, 
        customersWithPurchaseData: customersUpdated 
      }),
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
