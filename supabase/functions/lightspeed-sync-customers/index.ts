import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken } from '../_shared/crypto/tokens.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[LS-SYNC-CUSTOMERS] Edge function starting');

interface LightspeedCustomer {
  customerID: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  Contact?: {
    Phones?: { Phone?: Array<{ number?: string }> };
  };
  CustomerType?: { customerTypeID?: string };
  creditAccountID?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-SYNC-CUSTOMERS] Processing sync request');

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
    console.log('[LS-SYNC-CUSTOMERS] Tenant ID:', tenantId);

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

    // FIX: [P24] - Add sync lock to prevent concurrent syncs
    const { data: existingJob } = await supabaseClient
      .from('pos_sync_jobs')
      .select('id, status')
      .eq('connection_id', connection.id)
      .eq('sync_type', 'customers')
      .in('status', ['pending', 'in_progress'])
      .single();

    if (existingJob) {
      console.log('[LS-SYNC-CUSTOMERS] Sync already in progress, returning existing job');
      return new Response(
        JSON.stringify({ success: true, jobId: existingJob.id, message: 'Sync already in progress' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-SYNC-CUSTOMERS] Fetching customers from Lightspeed...');

    let allCustomers: any[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const offset = page * limit;
      const customersUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Customer.json?limit=${limit}&offset=${offset}`;
      
      // FIX: [issue #24] - Decrypt access token before using as Bearer token
      const accessToken = await decryptToken(connection.encrypted_access_token);
      const response = await fetch(customersUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-CUSTOMERS] API error:', response.status);
        break;
      }

      const data = await response.json();
      const customers = Array.isArray(data.Customer) ? data.Customer : [data.Customer].filter(Boolean);
      
      if (customers.length === 0) {
        hasMore = false;
      } else {
        allCustomers = allCustomers.concat(customers);
        page++;
        console.log(`[LS-SYNC-CUSTOMERS] Fetched page ${page}, total: ${allCustomers.length}`);
      }

      if (customers.length < limit) {
        hasMore = false;
      }
    }

    console.log(`[LS-SYNC-CUSTOMERS] Total customers fetched: ${allCustomers.length}`);

    // Sync customers to database
    let syncedCount = 0;
    let createdContacts = 0;

    // FIX: [issue #66] - TODO: Batch customer upserts instead of processing individually (N+1 pattern)
    // FIX: [P23] - TODO: Batch these per-customer DB calls to eliminate N+1 pattern
    // Approach: collect all records, batch upsert to lightspeed_customers, then batch upsert CRM contacts
    for (const customer of allCustomers) {
      const phone = customer.Contact?.Phones?.Phone?.[0]?.number || null;
      const email = customer.email || null;

      // Upsert to lightspeed_customers
      const { error: upsertError } = await supabaseClient
        .from('lightspeed_customers')
        .upsert({
          tenant_id: tenantId,
          lightspeed_customer_id: customer.customerID,
          email: email,
          phone: phone,
          first_name: customer.firstName || null,
          last_name: customer.lastName || null,
          customer_group_id: customer.CustomerType?.customerTypeID || null,
          loyalty_balance: customer.creditAccountID ? 0 : null,
          raw_data: customer,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,lightspeed_customer_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-CUSTOMERS] Upsert error:', upsertError);
        continue;
      }

      // Create or link to CRM contact if email or phone exists
      if (email || phone) {
        // FIX: [P12] - Build .or() filter conditionally to handle null email/phone correctly
        const filters: string[] = [];
        if (email) filters.push(`email.eq.${email}`);
        if (phone) filters.push(`phone.eq.${phone}`);
        if (filters.length === 0) {
          // No identifiers to match - skip CRM link
          continue;
        }
        const { data: existingContact } = await supabaseClient
          .from('crm_customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .or(filters.join(','))
          .limit(1)
          .maybeSingle();

        if (!existingContact) {
          // FIX: [P13] - Generate synthetic email for phone-only customers to prevent duplicates
          const crmEmail = email || `ls-${customer.customerID}@noemail.local`;

          // FIX: [issue #27] - Use upsert instead of insert to prevent duplicate key errors
          const { data: newContact } = await supabaseClient
            .from('crm_customers')
            .upsert({
              tenant_id: tenantId,
              email: crmEmail,
              phone: phone,
              first_name: customer.firstName || null,
              last_name: customer.lastName || null,
              source: 'lightspeed',
            }, {
              onConflict: 'tenant_id,email'
            })
            .select('id')
            .single();

          if (newContact) {
            // Link the contact
            await supabaseClient
              .from('lightspeed_customers')
              .update({ contact_id: newContact.id })
              .eq('tenant_id', tenantId)
              .eq('lightspeed_customer_id', customer.customerID);

            createdContacts++;
          }
        } else {
          // Link existing contact
          await supabaseClient
            .from('lightspeed_customers')
            .update({ contact_id: existingContact.id })
            .eq('tenant_id', tenantId)
            .eq('lightspeed_customer_id', customer.customerID);
        }
      }

      syncedCount++;
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: syncedCount,
      })
      .eq('tenant_id', tenantId);

    console.log(`[LS-SYNC-CUSTOMERS] Sync complete: ${syncedCount} customers, ${createdContacts} new contacts`);

    return new Response(
      JSON.stringify({ 
        success: true,
        customersSync: syncedCount,
        contactsCreated: createdContacts,
        message: `Synced ${syncedCount} customers, created ${createdContacts} new contacts`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-CUSTOMERS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
