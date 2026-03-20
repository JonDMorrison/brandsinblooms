import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-WEBHOOK] Edge function starting');

// FIX: [P3] - Add HMAC-SHA256 webhook signature verification
async function verifyLightspeedSignature(body: string, signature: string | null): Promise<boolean> {
  const secret = Deno.env.get('LIGHTSPEED_WEBHOOK_SECRET');
  if (!secret) {
    console.error('LIGHTSPEED_WEBHOOK_SECRET not configured - rejecting webhook');
    return false;
  }
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
    return signature === expected;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // FIX: [P28] - Replaced stale [CLOVER-WEBHOOK] log prefixes with [LIGHTSPEED-WEBHOOK]
    console.log('[LIGHTSPEED-WEBHOOK] Webhook received');

    // FIX: [P3] - Verify webhook signature before processing
    const rawBody = await req.text();
    const signature = req.headers.get('X-Lightspeed-Signature');
    const isValid = await verifyLightspeedSignature(rawBody, signature);
    if (!isValid) {
      console.error('[LS-WEBHOOK] Invalid or missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(rawBody);
    console.log('[LIGHTSPEED-WEBHOOK] Payload:', JSON.stringify(payload));

    // Check for verification request from Lightspeed
    if (payload.verificationCode) {
      console.log('[LIGHTSPEED-WEBHOOK] VERIFICATION CODE:', payload.verificationCode);
      console.log('[LIGHTSPEED-WEBHOOK] Enter this code in the Lightspeed dashboard to complete verification');
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Extract event details
    const eventType = payload.event_type || payload.type;
    const data = payload.data || payload;
    console.log('[LIGHTSPEED-WEBHOOK] Event:', eventType);

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // SECURITY: [T1] - Extract merchant identifier from webhook payload and resolve to a single tenant
    // FIX: [P1] - Also extract retailer_id / retailerID / retailerId from payload
    const merchantId = payload.retailer_id || payload.retailerID || payload.retailerId || payload.merchant_id || payload.merchantId || payload.account_id || payload.store_id || data.retailer_id || data.retailerID || data.retailerId || data.merchant_id || data.merchantId || data.account_id || data.store_id;
    if (!merchantId) {
      console.error('[LS-WEBHOOK] No merchant identifier found in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing merchant identifier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: [T1] - Look up only the single tenant whose Lightspeed connection matches this merchant
    const { data: connection, error: connError } = await supabaseAdmin
      .from('lightspeed_connections')
      .select('tenant_id, domain_prefix')
      // FIX: [P1] - Query retailer_id column (merchant_id does not exist in lightspeed_connections)
      .eq('retailer_id', merchantId)
      .eq('status', 'connected')
      .single();

    if (connError || !connection) {
      console.error('[LS-WEBHOOK] No matching tenant for merchant:', merchantId);
      return new Response(
        JSON.stringify({ error: 'No tenant found for merchant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = connection.tenant_id;
    console.log('[LS-WEBHOOK] Resolved merchant', merchantId, 'to tenant', tenantId);

    // Handle different event types
    switch (eventType) {
      case 'sale.completed':
      case 'sale.updated':
        await handleSaleEvent(supabaseAdmin, data, tenantId);
        break;

      case 'customer.created':
      case 'customer.updated':
        await handleCustomerEvent(supabaseAdmin, data, tenantId);
        break;

      case 'product.updated':
        await handleProductEvent(supabaseAdmin, data, tenantId);
        break;

      case 'loyalty.updated':
        await handleLoyaltyEvent(supabaseAdmin, data, tenantId);
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

// SECURITY: [T1] - Each handler now receives a single tenantId instead of querying all tenants
async function handleSaleEvent(supabase: any, data: any, tenantId: string) {
  console.log('[LS-WEBHOOK] Processing sale event:', data.saleID, 'for tenant:', tenantId);

  await supabase
    .from('lightspeed_sales')
    .upsert({
      tenant_id: tenantId,
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

  console.log('[LS-WEBHOOK] Sale synced for tenant:', tenantId);
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleCustomerEvent(supabase: any, data: any, tenantId: string) {
  console.log('[LS-WEBHOOK] Processing customer event:', data.customerID, 'for tenant:', tenantId);

  await supabase
    .from('lightspeed_customers')
    .upsert({
      tenant_id: tenantId,
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

  console.log('[LS-WEBHOOK] Customer synced for tenant:', tenantId);
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleProductEvent(supabase: any, data: any, tenantId: string) {
  console.log('[LS-WEBHOOK] Processing product event:', data.itemID, 'for tenant:', tenantId);

  await supabase
    .from('lightspeed_products')
    .upsert({
      tenant_id: tenantId,
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

  console.log('[LS-WEBHOOK] Product synced for tenant:', tenantId);
}

// SECURITY: [T1] - Write only to the single matched tenant
async function handleLoyaltyEvent(supabase: any, data: any, tenantId: string) {
  console.log('[LS-WEBHOOK] Processing loyalty event:', data.customerID, 'for tenant:', tenantId);

  await supabase
    .from('lightspeed_customers')
    .update({
      loyalty_balance: parseFloat(data.balance || 0),
      synced_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('lightspeed_customer_id', data.customerID);

  console.log('[LS-WEBHOOK] Loyalty updated for tenant:', tenantId);
}
