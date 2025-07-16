import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { VMXAdapter } from '../../../src/components/crm/pos/adapters/VMXAdapter.ts'

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

    const { csv_data, file_name } = await req.json()
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    if (!csv_data || !Array.isArray(csv_data)) {
      throw new Error('Invalid CSV data provided')
    }

    // Create integration log
    const { data: logEntry } = await supabase
      .from('integration_logs')
      .insert({
        user_id: user.id,
        pos_source: 'vmx',
        status: 'pending',
        customers_imported: 0,
        orders_imported: 0,
        metadata: { file_name }
      })
      .select()
      .single()

    try {
      // Process data with VMX adapter
      const adapter = new VMXAdapter()
      const normalizedData = await adapter.syncData(csv_data)
      
      let customersImported = 0
      let ordersImported = 0

      // Import customers
      for (const customer of normalizedData.customers) {
        if (!customer.email) continue // Skip rows without email
        
        const { error } = await supabase
          .from('crm_customers')
          .upsert({
            email: customer.email,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' '),
            phone: customer.phone,
            tags: customer.tags,
            pos_source: 'vmx',
            user_id: user.id,
          }, {
            onConflict: 'email,user_id'
          })

        if (!error) customersImported++
      }

      // Import orders
      for (const order of normalizedData.orders) {
        if (!order.customer_email) continue // Skip orders without customer email
        
        const { error } = await supabase
          .from('pos_orders')
          .upsert({
            external_id: order.order_id,
            pos_connection_id: null, // VMX doesn't have connections
            order_date: order.date,
            total_amount: order.total,
            currency: order.currency,
            items: order.items,
            external_customer_id: order.external_customer_id,
          }, {
            onConflict: 'external_id'
          })

        if (!error) ordersImported++
      }

      // Update customer order history and spending totals
      const customerSpending = new Map()
      
      for (const order of normalizedData.orders) {
        if (!order.customer_email) continue
        
        const current = customerSpending.get(order.customer_email) || { total: 0, orders: [] }
        current.total += order.total
        current.orders.push({
          order_id: order.order_id,
          date: order.date,
          total: order.total,
          items: order.items
        })
        customerSpending.set(order.customer_email, current)
      }

      // Update customers with order history and totals
      for (const [email, spending] of customerSpending) {
        await supabase
          .from('crm_customers')
          .update({
            total_spent: spending.total,
            order_history: spending.orders,
            last_purchase_date: spending.orders.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]?.date
          })
          .eq('email', email)
          .eq('user_id', user.id)
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

      return new Response(
        JSON.stringify({
          success: true,
          customers_imported: customersImported,
          orders_imported: ordersImported,
          message: `Successfully imported ${customersImported} customers and ${ordersImported} orders from ${file_name}`
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

      throw syncError
    }

  } catch (error) {
    console.error('VMX sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})