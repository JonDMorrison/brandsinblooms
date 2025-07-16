import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Shopify adapter implementation directly in edge function
interface NormalizedCustomer {
  name: string;
  email: string;
  phone?: string;
  pos_source: string;
  tags?: string[];
  external_id?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

interface NormalizedOrder {
  order_id: string;
  customer_email: string;
  date: string;
  total: number;
  currency?: string;
  items: Array<{
    name: string;
    category?: string;
    quantity: number;
    price?: number;
  }>;
  external_customer_id?: string;
}

interface NormalizedData {
  customers: NormalizedCustomer[];
  orders: NormalizedOrder[];
}

class ShopifyAdapter {
  private baseUrl: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    this.baseUrl = `https://${shopDomain}`;
    this.accessToken = accessToken;
  }

  async fetchCustomers(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/api/2024-01/customers.json`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.customers || [];
  }

  async fetchOrders(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/api/2024-01/orders.json?status=any&limit=250`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.orders || [];
  }

  adaptCustomers(rawCustomers: any[]): NormalizedCustomer[] {
    return rawCustomers.map(customer => ({
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email,
      phone: customer.phone,
      pos_source: 'shopify',
      tags: customer.tags ? customer.tags.split(',').map((tag: string) => tag.trim()) : [],
      external_id: customer.id.toString(),
      address: customer.default_address ? {
        street: `${customer.default_address.address1 || ''} ${customer.default_address.address2 || ''}`.trim(),
        city: customer.default_address.city,
        state: customer.default_address.province,
        zip: customer.default_address.zip,
        country: customer.default_address.country,
      } : undefined,
    }));
  }

  adaptOrders(rawOrders: any[]): NormalizedOrder[] {
    return rawOrders.map(order => ({
      order_id: order.id.toString(),
      customer_email: order.email || order.customer?.email || '',
      date: order.created_at,
      total: parseFloat(order.total_price),
      currency: order.currency,
      external_customer_id: order.customer?.id?.toString(),
      items: order.line_items.map((item: any) => ({
        name: item.name,
        category: item.product_type || 'Uncategorized',
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
    }));
  }

  async syncData(credentials: any): Promise<NormalizedData> {
    const [rawCustomers, rawOrders] = await Promise.all([
      this.fetchCustomers(),
      this.fetchOrders()
    ]);

    return {
      customers: this.adaptCustomers(rawCustomers),
      orders: this.adaptOrders(rawOrders)
    };
  }
}

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
        const { data: insertedCustomer, error } = await supabase
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
          .select()

        if (!error) {
          customersImported++
          
          // Trigger persona auto-assignment for new customers
          if (insertedCustomer && insertedCustomer.length > 0) {
            try {
              await supabase.functions.invoke('persona-auto-assignment', {
                body: { customer_id: insertedCustomer[0].id }
              })
            } catch (personaError) {
              console.log('Persona auto-assignment failed:', personaError)
              // Don't fail the sync if persona assignment fails
            }
          }
        }
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