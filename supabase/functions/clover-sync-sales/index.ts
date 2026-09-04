import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCloverApproval } from "../_shared/cloverApprovalGate.ts";
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
  const approvalResponse = requireCloverApproval(req);
  if (approvalResponse) return approvalResponse;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseClient: any = null;
  let syncJobId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    supabaseClient = createClient(
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

    const requestBody = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};
    const requestedConnectionId = typeof requestBody?.connectionId === 'string'
      ? requestBody.connectionId
      : null;

    // A tenant can have multiple Clover merchants/locations. Require the
    // caller to identify the connection when more than one is active.
    let connectionQuery = supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected');
    if (requestedConnectionId) {
      connectionQuery = connectionQuery.eq('id', requestedConnectionId);
    }
    const { data: connections, error: connectionError } =
      await connectionQuery.limit(2);

    if (connectionError) throw connectionError;
    if (!connections?.length) throw new Error('No active Clover connection');
    if (connections.length > 1) {
      throw new Error('Multiple Clover connections found; connectionId is required');
    }
    const connection = connections[0];

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);

    console.log('[CLOVER-SYNC-SALES] Starting sales sync...');

    // FIX: [P15] - Add sync lock to prevent concurrent sales syncs from corrupting financial data
    const { data: existingJob } = await supabaseClient
      .from('pos_sync_jobs')
      .select('id, status')
      .eq('connection_id', connection.id)
      .eq('sync_type', 'sales')
      .in('status', ['pending', 'in_progress'])
      .maybeSingle();

    if (existingJob) {
      return new Response(
        JSON.stringify({ message: 'Sales sync already in progress', jobId: existingJob.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: syncJob, error: syncJobError } = await supabaseClient
      .from('pos_sync_jobs')
      .insert({
        tenant_id: userData.tenant_id,
        connection_id: connection.id,
        connection_type: 'clover',
        sync_type: 'sales',
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (syncJobError) {
      if (syncJobError.code === '23505') {
        return new Response(
          JSON.stringify({ message: 'Sales sync already in progress' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw syncJobError;
    }
    syncJobId = syncJob.id;

    // Fetch orders from Clover with pagination
    let offset = 0;
    const limit = 100;
    let salesSynced = 0;
    let customersWithProductTags = 0;

    // Build customer clover_id to crm_customer map
    const { data: existingCustomers } = await supabaseClient
      .from('crm_customers')
      .select('id, clover_customer_id, email, product_tags, lifetime_value, first_purchase_date, last_purchase_date, pos_source')
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

        const cloverCustomerId = order.customers?.elements?.[0]?.id;
        let customer = cloverCustomerId
          ? customerMap.get(cloverCustomerId)
          : undefined;

        // Persist against the normalized order schema. The database trigger
        // validates tenant/provider and resolves the Clover merchant location.
        const { data: storedOrder, error: orderError } = await supabaseClient
          .from('pos_orders')
          .upsert({
            pos_connection_id: connection.id,
            external_id: order.id,
            external_customer_id: cloverCustomerId || null,
            crm_customer_id: customer?.id || null,
            tenant_id: userData.tenant_id,
            provider: 'clover',
            external_location_id: connection.merchant_id,
            order_date: orderDate,
            total_amount: orderTotal,
            currency: order.currency || 'USD',
            status: order.paymentState || order.state || 'PAID',
            items: order.lineItems?.elements || [],
            raw_data: order,
          }, {
            onConflict: 'pos_connection_id,external_id',
          })
          .select('crm_customer_id')
          .single();

        if (orderError) {
          throw new Error(`Failed to persist Clover order ${order.id}: ${orderError.message}`);
        }

        // The database identity resolver is authoritative and is not limited
        // by the client's customer preload window.
        if (!customer && storedOrder?.crm_customer_id) {
          const { data: resolvedCustomer, error: resolvedCustomerError } =
            await supabaseClient
              .from('crm_customers')
              .select('id, clover_customer_id, email, product_tags, lifetime_value, first_purchase_date, last_purchase_date, pos_source')
              .eq('tenant_id', userData.tenant_id)
              .eq('id', storedOrder.crm_customer_id)
              .single();
          if (resolvedCustomerError) throw resolvedCustomerError;
          customer = resolvedCustomer;
          if (cloverCustomerId) customerMap.set(cloverCustomerId, customer);
        }

        salesSynced++;

        // Update customer metrics if order has customer association
        if (cloverCustomerId && customer) {

          // Extract product names for tags
          const productNames = (order.lineItems?.elements || [])
            .map(item => item.name || item.item?.name)
            .filter(Boolean) as string[];

          const existingTags = customer.product_tags || [];
          const mergedTags = [...new Set([...existingTags, ...productNames])];

          const { data: orderTotals, error: totalsError } = await supabaseClient
            .from('pos_orders')
            .select('total_amount, refund_amount, order_date, status')
            .eq('crm_customer_id', customer.id)
            .eq('tenant_id', userData.tenant_id)
            .eq('provider', 'clover');
          if (totalsError) throw totalsError;

          const qualifyingOrders = (orderTotals || []).filter((stored: any) =>
            ['COMPLETED', 'REFUNDED', 'PAID'].includes(
              String(stored.status || '').toUpperCase(),
            )
          );
          const computedLifetime = Math.round(qualifyingOrders.reduce(
            (sum: number, stored: any) => sum + Math.max(
              Number(stored.total_amount || 0) - Number(stored.refund_amount || 0),
              0,
            ),
            0,
          ) * 100) / 100;
          const purchaseDates = qualifyingOrders
            .map((stored: any) => String(stored.order_date || '').slice(0, 10))
            .filter(Boolean)
            .sort();
          const ownsCloverValue = customer.pos_source === 'clover' ||
            customer.clover_customer_id === cloverCustomerId;

          const customerUpdate: Record<string, unknown> = {
            product_tags: mergedTags.length > 0 ? mergedTags : null,
            first_purchase_date: purchaseDates[0] || customer.first_purchase_date,
            last_purchase_date: purchaseDates.at(-1) || customer.last_purchase_date,
            updated_at: new Date().toISOString(),
          };
          if (ownsCloverValue) {
            customerUpdate.lifetime_value = computedLifetime;
            customerUpdate.total_spent = computedLifetime;
            customerUpdate.pos_total_spent = computedLifetime;
            customerUpdate.pos_order_count = qualifyingOrders.length;
          }
          const { error: updateError } = await supabaseClient
            .from('crm_customers')
            .update(customerUpdate)
            .eq('id', customer.id);

          if (updateError) throw updateError;
          if (productNames.length > 0) customersWithProductTags++;

          const { error: metricsError } = await supabaseClient.rpc(
            'recalculate_purchase_metrics',
            { p_customer_id: customer.id },
          );
          if (metricsError) {
            throw new Error(
              `Failed to recalculate purchase metrics for ${customer.id}: ${metricsError.message}`,
            );
          }
        }
      }

      await supabaseClient.from('pos_sync_jobs').update({
        total_fetched: salesSynced,
        total_synced: salesSynced,
        page_offset: offset,
        updated_at: new Date().toISOString(),
      }).eq('id', syncJobId);

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

    await supabaseClient.from('pos_sync_jobs').update({
      status: 'completed',
      total_fetched: salesSynced,
      total_synced: salesSynced,
      has_more_pages: false,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', syncJobId);

    console.log(`[CLOVER-SYNC-SALES] Sales sync complete. Total synced: ${salesSynced}`);

    return new Response(
      JSON.stringify({ success: true, salesSynced, customersWithProductTags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CLOVER-SYNC-SALES] Error:', error.message);
    if (supabaseClient && syncJobId) {
      await supabaseClient.from('pos_sync_jobs').update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', syncJobId);
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
