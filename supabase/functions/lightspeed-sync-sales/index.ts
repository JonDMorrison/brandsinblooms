import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-SYNC-SALES] Edge function starting');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-SYNC-SALES] Processing sync request');

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

    console.log('[LS-SYNC-SALES] Fetching sales from Lightspeed...');

    // Get sales from last 90 days for initial sync, or since last sync
    const lastSync = connection.last_sales_sync;
    const sinceDate = lastSync 
      ? new Date(lastSync).toISOString().split('T')[0]
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let allSales: any[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const offset = page * limit;
      const salesUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Sale.json?completeTime=>,${sinceDate}&limit=${limit}&offset=${offset}&load_relations=["SaleLines","Customer"]`;
      
      const response = await fetch(salesUrl, {
        headers: {
          'Authorization': `Bearer ${connection.encrypted_access_token}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-SALES] API error:', response.status);
        break;
      }

      const data = await response.json();
      const sales = Array.isArray(data.Sale) ? data.Sale : [data.Sale].filter(Boolean);
      
      if (sales.length === 0) {
        hasMore = false;
      } else {
        allSales = allSales.concat(sales);
        page++;
        console.log(`[LS-SYNC-SALES] Fetched page ${page}, total: ${allSales.length}`);
      }

      if (sales.length < limit) {
        hasMore = false;
      }
    }

    console.log(`[LS-SYNC-SALES] Total sales fetched: ${allSales.length}`);

    let syncedCount = 0;
    let firstPurchases = 0;

    for (const sale of allSales) {
      // Extract line items
      const lineItems = Array.isArray(sale.SaleLines?.SaleLine) 
        ? sale.SaleLines.SaleLine 
        : sale.SaleLines?.SaleLine ? [sale.SaleLines.SaleLine] : [];

      // Get linked contact if exists
      let contactId = null;
      if (sale.customerID) {
        const { data: lsCustomer } = await supabaseClient
          .from('lightspeed_customers')
          .select('contact_id')
          .eq('tenant_id', tenantId)
          .eq('lightspeed_customer_id', sale.customerID)
          .single();
        
        contactId = lsCustomer?.contact_id || null;
      }

      // Upsert sale
      const { error: upsertError } = await supabaseClient
        .from('lightspeed_sales')
        .upsert({
          tenant_id: tenantId,
          lightspeed_sale_id: sale.saleID,
          lightspeed_customer_id: sale.customerID || null,
          contact_id: contactId,
          sale_date: sale.completeTime || sale.createTime,
          total_amount: parseFloat(sale.total || 0),
          status: sale.completed === 'true' ? 'CLOSED' : 'OPEN',
          line_items: lineItems,
          payment_method: sale.SalePayments?.SalePayment?.[0]?.paymentType?.name || null,
          note: sale.note || null,
          raw_data: sale,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,lightspeed_sale_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-SALES] Upsert error:', upsertError);
        continue;
      }

      // Update customer purchase stats
      if (sale.customerID && sale.completed === 'true') {
        const { data: customerSales } = await supabaseClient
          .from('lightspeed_sales')
          .select('total_amount, sale_date')
          .eq('tenant_id', tenantId)
          .eq('lightspeed_customer_id', sale.customerID)
          .eq('status', 'CLOSED')
          .order('sale_date', { ascending: true });

        if (customerSales) {
          const totalSpend = customerSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
          const purchaseCount = customerSales.length;
          const firstPurchaseDate = customerSales[0]?.sale_date;
          const lastPurchaseDate = customerSales[customerSales.length - 1]?.sale_date;

          await supabaseClient
            .from('lightspeed_customers')
            .update({
              total_spend: totalSpend,
              purchase_count: purchaseCount,
              first_purchase_date: firstPurchaseDate,
              last_purchase_date: lastPurchaseDate,
            })
            .eq('tenant_id', tenantId)
            .eq('lightspeed_customer_id', sale.customerID);

          // Track first purchases for trigger
          if (purchaseCount === 1) {
            firstPurchases++;
          }
        }
      }

      syncedCount++;
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: syncedCount,
      })
      .eq('tenant_id', tenantId);

    console.log(`[LS-SYNC-SALES] Sync complete: ${syncedCount} sales, ${firstPurchases} first purchases`);

    return new Response(
      JSON.stringify({ 
        success: true,
        salesSynced: syncedCount,
        firstPurchases: firstPurchases,
        message: `Synced ${syncedCount} sales`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-SALES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
