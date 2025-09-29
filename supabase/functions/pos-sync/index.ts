import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dynamic adapter imports
async function getAdapter(platform: string, credentials: any) {
  switch (platform.toLowerCase()) {
    case 'mock':
      const { MockAdapter } = await import('../../../src/components/crm/pos/adapters/MockAdapter.ts');
      return new MockAdapter();
    case 'vmx':
      const { VMXAdapter } = await import('../../../src/components/crm/pos/adapters/VMXAdapter.ts');
      return new VMXAdapter();
    case 'shopify':
      const { ShopifyAdapter } = await import('../../../src/components/crm/pos/adapters/ShopifyAdapter.ts');
      return new ShopifyAdapter(credentials.shop_domain, credentials.access_token);
    case 'square':
      const { SquareAdapter } = await import('../../../src/components/crm/pos/adapters/SquareAdapter.ts');
      return new SquareAdapter(credentials.access_token, credentials.environment || 'production');
    case 'counterpoint':
      const { CounterpointAdapter } = await import('../../../src/components/crm/pos/adapters/CounterpointAdapter.ts');
      return new CounterpointAdapter(credentials.api_key, credentials.base_url, credentials.account_id);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function upsertCustomers(supabase: any, connectionId: string, tenantId: string, customers: any[]) {
  let upserted = 0;
  let skipped = 0;

  for (const customer of customers) {
    try {
      const { error } = await supabase
        .from('pos_customers')
        .upsert({
          tenant_id: tenantId,
          connection_id: connectionId,
          pos_id: customer.external_id,
          email: customer.email,
          first_name: customer.name.split(' ')[0],
          last_name: customer.name.split(' ').slice(1).join(' '),
          phone: customer.phone,
          tags: customer.tags || [],
          address: customer.address,
          raw_data: customer
        }, { 
          onConflict: 'tenant_id,connection_id,pos_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error upserting customer:', error);
        skipped++;
      } else {
        upserted++;
      }
    } catch (err) {
      console.error('Customer upsert error:', err);
      skipped++;
    }
  }

  return { upserted, skipped };
}

async function upsertOrders(supabase: any, connectionId: string, tenantId: string, orders: any[]) {
  let upserted = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      const { error } = await supabase
        .from('pos_orders')
        .upsert({
          tenant_id: tenantId,
          connection_id: connectionId,
          pos_id: order.order_id,
          customer_pos_id: order.external_customer_id,
          order_number: order.order_id,
          total_amount: order.total,
          currency: order.currency || 'USD',
          status: 'completed',
          order_date: order.date,
          line_items: order.items,
          raw_data: order
        }, {
          onConflict: 'tenant_id,connection_id,pos_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error upserting order:', error);
        skipped++;
      } else {
        upserted++;
      }
    } catch (err) {
      console.error('Order upsert error:', err);
      skipped++;
    }
  }

  return { upserted, skipped };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let logId: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const body = await req.json();
    const { 
      connection_id, 
      entity = 'customers', 
      mode = 'incremental',
      page_limit = 50 
    } = body;

    console.log('Starting POS sync:', { connection_id, entity, mode });

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('pos_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (connectionError || !connection) {
      throw new Error('Connection not found');
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('pos_sync_logs')
      .insert({
        connection_id: connection_id,
        status: 'running'
      })
      .select()
      .single();

    if (logError || !syncLog) {
      throw new Error('Failed to create sync log');
    }

    logId = syncLog.id;

    // Parse credentials (in real implementation, these should be encrypted)
    const credentials = connection.settings || {};
    
    // Get adapter
    const adapter = await getAdapter(connection.platform, credentials);
    
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalSkipped = 0;
    let cursor = mode === 'incremental' ? connection.cursor : undefined;
    let hasMore = true;
    const errors: string[] = [];

    // Sync loop with pagination
    while (hasMore) {
      try {
        let result;
        
        if (entity === 'customers') {
          result = await adapter.fetchCustomers(credentials, {
            cursor,
            pageLimit: page_limit,
            mode
          });
          
          if (result.data.length > 0) {
            const normalizedCustomers = adapter.adaptCustomers(result.data);
            const upsertResult = await upsertCustomers(
              supabase, 
              connection_id, 
              userData.tenant_id, 
              normalizedCustomers
            );
            totalUpserted += upsertResult.upserted;
            totalSkipped += upsertResult.skipped;
          }
        } else if (entity === 'orders') {
          result = await adapter.fetchOrders(credentials, {
            cursor,
            pageLimit: page_limit,
            mode
          });
          
          if (result.data.length > 0) {
            const normalizedOrders = adapter.adaptOrders(result.data);
            const upsertResult = await upsertOrders(
              supabase, 
              connection_id, 
              userData.tenant_id, 
              normalizedOrders
            );
            totalUpserted += upsertResult.upserted;
            totalSkipped += upsertResult.skipped;
          }
        }

        totalFetched += result?.data.length || 0;
        cursor = result?.nextCursor;
        hasMore = result?.hasMore || false;

        // Break if we've processed enough for this run
        if (totalFetched >= page_limit * 10) { // Max 10 pages per sync
          break;
        }

      } catch (syncError) {
        console.error('Sync page error:', syncError);
        errors.push(syncError instanceof Error ? syncError.message : 'Unknown sync error');
        break;
      }
    }

    // Update connection with new cursor and last sync time
    await supabase
      .from('pos_connections')
      .update({
        cursor: cursor,
        last_sync_at: new Date().toISOString(),
        sync_status: errors.length > 0 ? 'error' : 'success'
      })
      .eq('id', connection_id);

    // Update sync log
    const syncResult = {
      status: errors.length > 0 ? 'error' : 'completed',
      completed_at: new Date().toISOString(),
      customers_synced: entity === 'customers' ? totalUpserted : 0,
      orders_synced: entity === 'orders' ? totalUpserted : 0,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      metadata: {
        fetched: totalFetched,
        upserted: totalUpserted,
        skipped: totalSkipped,
        duration_ms: Date.now() - startTime,
        final_cursor: cursor
      }
    };

    await supabase
      .from('pos_sync_logs')
      .update(syncResult)
      .eq('id', logId);

    console.log('Sync completed:', syncResult);

    return new Response(JSON.stringify({
      success: errors.length === 0,
      fetched: totalFetched,
      upserted: totalUpserted,
      skipped: totalSkipped,
      errors: errors,
      duration_ms: Date.now() - startTime,
      cursor: cursor,
      new_customers: entity === 'customers' ? totalUpserted : 0,
      new_orders: entity === 'orders' ? totalUpserted : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in POS sync:', error);
    
    // Update sync log with error if we have one
    if (logId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        
        await supabase
          .from('pos_sync_logs')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              duration_ms: Date.now() - startTime
            }
          })
          .eq('id', logId);
      } catch (logUpdateError) {
        console.error('Failed to update sync log:', logUpdateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        duration_ms: Date.now() - startTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});