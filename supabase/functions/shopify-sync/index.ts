import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ShopifyAdapter } from '../../../src/components/crm/pos/adapters/ShopifyAdapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { connection_id, test_only = false } = await req.json()
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('pos_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = JSON.parse(connection.credentials_encrypted)
    const adapter = new ShopifyAdapter(credentials.shop_domain, credentials.access_token)

    // If test_only, just validate connection
    if (test_only) {
      await adapter.fetchCustomers()
      return new Response(
        JSON.stringify({ success: true, message: 'Connection test successful' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create integration log
    const { data: logEntry } = await supabase
      .from('integration_logs')
      .insert({
        user_id: user.id,
        pos_source: 'shopify',
        status: 'pending',
        customers_imported: 0,
        orders_imported: 0,
      })
      .select()
      .single()

    try {
      // Sync data
      const normalizedData = await adapter.syncData(credentials)
      
      let customersImported = 0
      let ordersImported = 0

      // Import customers
      for (const customer of normalizedData.customers) {
        const { error } = await supabase
          .from('crm_customers')
          .upsert({
            email: customer.email,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' '),
            phone: customer.phone,
            tags: customer.tags,
            pos_source: 'shopify',
            user_id: user.id,
          }, {
            onConflict: 'email,user_id'
          })

        if (!error) customersImported++
      }

      // Import orders to pos_orders table
      for (const order of normalizedData.orders) {
        const { error } = await supabase
          .from('pos_orders')
          .upsert({
            external_id: order.order_id,
            pos_connection_id: connection_id,
            order_date: order.date,
            total_amount: order.total,
            currency: order.currency,
            items: order.items,
            external_customer_id: order.external_customer_id,
          }, {
            onConflict: 'external_id,pos_connection_id'
          })

        if (!error) ordersImported++
      }

      // Update integration log
      await supabase
        .from('integration_logs')
        .update({
          status: 'success',
          customers_imported: customersImported,
          orders_imported: ordersImported,
        })
        .eq('id', logEntry.id)

      // Update connection last sync
      await supabase
        .from('pos_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: 'active',
          sync_error: null,
        })
        .eq('id', connection_id)

      return new Response(
        JSON.stringify({
          success: true,
          customers_imported: customersImported,
          orders_imported: ordersImported,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (syncError) {
      // Update log with error
      await supabase
        .from('integration_logs')
        .update({
          status: 'error',
          error_message: syncError.message,
        })
        .eq('id', logEntry.id)

      // Update connection with error
      await supabase
        .from('pos_connections')
        .update({
          sync_status: 'error',
          sync_error: syncError.message,
        })
        .eq('id', connection_id)

      throw syncError
    }

  } catch (error) {
    console.error('Shopify sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})