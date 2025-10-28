import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-WEBHOOK] Edge function starting');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-WEBHOOK] Webhook received');

    const payload = await req.json();
    console.log('[LS-WEBHOOK] Event:', payload.event_type);

    // Extract event details
    const eventType = payload.event_type;
    const data = payload.data;

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different event types
    switch (eventType) {
      case 'sale.completed':
      case 'sale.updated':
        await handleSaleEvent(supabaseAdmin, data);
        break;

      case 'customer.created':
      case 'customer.updated':
        await handleCustomerEvent(supabaseAdmin, data);
        break;

      case 'product.updated':
        await handleProductEvent(supabaseAdmin, data);
        break;

      case 'loyalty.updated':
        await handleLoyaltyEvent(supabaseAdmin, data);
        break;

      default:
        console.log('[LS-WEBHOOK] Unhandled event type:', eventType);
    }

    return new Response(
      JSON.stringify({ success: true, processed: eventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSaleEvent(supabase: any, data: any) {
  console.log('[LS-WEBHOOK] Processing sale event:', data.saleID);
  
  // Find tenant by checking existing connection
  const { data: connections } = await supabase
    .from('lightspeed_connections')
    .select('tenant_id, domain_prefix')
    .eq('status', 'connected')
    .limit(10);

  if (!connections || connections.length === 0) {
    console.log('[LS-WEBHOOK] No active connections found');
    return;
  }

  // Process for each tenant (in case multiple stores connected)
  for (const conn of connections) {
    // Update or insert sale
    await supabase
      .from('lightspeed_sales')
      .upsert({
        tenant_id: conn.tenant_id,
        lightspeed_sale_id: data.saleID,
        lightspeed_customer_id: data.customerID || null,
        sale_date: data.completeTime || data.createTime,
        total_amount: parseFloat(data.total || 0),
        status: data.completed === 'true' ? 'CLOSED' : 'OPEN',
        raw_data: data,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,lightspeed_sale_id'
      });

    console.log('[LS-WEBHOOK] Sale synced for tenant:', conn.tenant_id);
  }
}

async function handleCustomerEvent(supabase: any, data: any) {
  console.log('[LS-WEBHOOK] Processing customer event:', data.customerID);

  const { data: connections } = await supabase
    .from('lightspeed_connections')
    .select('tenant_id')
    .eq('status', 'connected')
    .limit(10);

  if (!connections || connections.length === 0) return;

  for (const conn of connections) {
    await supabase
      .from('lightspeed_customers')
      .upsert({
        tenant_id: conn.tenant_id,
        lightspeed_customer_id: data.customerID,
        email: data.email || null,
        phone: data.Contact?.Phones?.Phone?.[0]?.number || null,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        raw_data: data,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,lightspeed_customer_id'
      });

    console.log('[LS-WEBHOOK] Customer synced for tenant:', conn.tenant_id);
  }
}

async function handleProductEvent(supabase: any, data: any) {
  console.log('[LS-WEBHOOK] Processing product event:', data.itemID);

  const { data: connections } = await supabase
    .from('lightspeed_connections')
    .select('tenant_id')
    .eq('status', 'connected')
    .limit(10);

  if (!connections || connections.length === 0) return;

  for (const conn of connections) {
    await supabase
      .from('lightspeed_products')
      .upsert({
        tenant_id: conn.tenant_id,
        lightspeed_product_id: data.itemID,
        name: data.description || 'Unnamed Product',
        sku: data.customSku || null,
        price: parseFloat(data.defaultCost || 0),
        inventory_count: parseInt(data.qoh || 0),
        raw_data: data,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,lightspeed_product_id'
      });

    console.log('[LS-WEBHOOK] Product synced for tenant:', conn.tenant_id);
  }
}

async function handleLoyaltyEvent(supabase: any, data: any) {
  console.log('[LS-WEBHOOK] Processing loyalty event:', data.customerID);

  const { data: connections } = await supabase
    .from('lightspeed_connections')
    .select('tenant_id')
    .eq('status', 'connected')
    .limit(10);

  if (!connections || connections.length === 0) return;

  for (const conn of connections) {
    await supabase
      .from('lightspeed_customers')
      .update({
        loyalty_balance: parseFloat(data.balance || 0),
        synced_at: new Date().toISOString(),
      })
      .eq('tenant_id', conn.tenant_id)
      .eq('lightspeed_customer_id', data.customerID);

    console.log('[LS-WEBHOOK] Loyalty updated for tenant:', conn.tenant_id);
  }
}
