import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

interface SquareCustomer {
  id: string;
  email_address?: string;
  phone_number?: string;
  given_name?: string;
  family_name?: string;
  created_at?: string;
  updated_at?: string;
  group_ids?: string[];
  preferences?: {
    email_unsubscribed?: boolean;
  };
}

interface SquareCustomerGroup {
  id: string;
  name: string;
}

// Fetch all customer groups from Square
async function fetchSquareCustomerGroups(
  accessToken: string, 
  environment: string
): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  const baseUrl = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2/customers/groups'
    : 'https://connect.squareup.com/v2/customers/groups';

  let cursor: string | undefined;

  try {
    do {
      const url = new URL(baseUrl);
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[SQUARE-SYNC] Failed to fetch customer groups:', data.errors);
        break;
      }

      if (data.groups && data.groups.length > 0) {
        for (const group of data.groups as SquareCustomerGroup[]) {
          groupMap.set(group.id, group.name);
        }
      }

      cursor = data.cursor;
    } while (cursor);

    console.log(`[SQUARE-SYNC] Loaded ${groupMap.size} customer groups`);
  } catch (error) {
    console.error('[SQUARE-SYNC] Error fetching customer groups:', error);
  }

  return groupMap;
}

// Map group IDs to group names
function mapGroupIdsToNames(groupIds: string[] | undefined, groupMap: Map<string, string>): string[] {
  if (!groupIds || groupIds.length === 0) return [];
  return groupIds
    .map(id => groupMap.get(id))
    .filter((name): name is string => !!name);
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

    // Get user's tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    // Get Square connection
    const { data: connection } = await supabaseClient
      .from('square_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Square connection');

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Phase 2: Fetch customer groups first
    console.log('[SQUARE-SYNC] Fetching customer groups...');
    const groupMap = await fetchSquareCustomerGroups(accessToken, connection.environment);

    // Fetch customers from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/customers'
      : 'https://connect.squareup.com/v2/customers';

    let cursor: string | undefined;
    let customersSynced = 0;

    do {
      const url = new URL(baseUrl);
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch customers');
      }

      // Process customers and insert into crm_customers
      if (data.customers && data.customers.length > 0) {
        for (const customer of data.customers as SquareCustomer[]) {
          const customerEmail = customer.email_address || `square-${customer.id}@noemail.local`;
          
          console.log(`[SQUARE-SYNC] Processing customer: ${customerEmail} (Square ID: ${customer.id})`);
          
          // Phase 1: Extract marketing preferences
          const emailOptIn = customer.preferences?.email_unsubscribed === true 
            ? false 
            : customer.preferences?.email_unsubscribed === false 
              ? true 
              : null; // null = unknown consent (tri-state)
          
          // Phase 2: Map group IDs to tag names
          const tags = mapGroupIdsToNames(customer.group_ids, groupMap);
          
          // Get existing customer to preserve data
          const { data: existingCustomer } = await supabaseClient
            .from('crm_customers')
            .select('tags, product_tags, email_opt_in, sms_opt_in')
            .eq('tenant_id', userData.tenant_id)
            .eq('email', customerEmail)
            .single();
          
          // Merge tags (preserve existing + add new from Square groups)
          const existingTags = existingCustomer?.tags || [];
          const mergedTags = [...new Set([...existingTags, ...tags])];
          
          // Preserve existing product_tags
          const productTags = existingCustomer?.product_tags || [];
          
          // Only update opt-in if we have data from Square
          const finalEmailOptIn = emailOptIn !== null ? emailOptIn : existingCustomer?.email_opt_in;
          
          const { data: upsertData, error: upsertError } = await supabaseClient
            .from('crm_customers')
            .upsert({
              tenant_id: userData.tenant_id,
              user_id: user.id,
              email: customerEmail,
              first_name: customer.given_name,
              last_name: customer.family_name,
              phone: customer.phone_number,
              pos_source: 'square',
              // Phase 1: Marketing preferences
              email_opt_in: finalEmailOptIn,
              sms_opt_in: existingCustomer?.sms_opt_in ?? null, // Preserve or null (unknown)
              email_consent_source: emailOptIn !== null ? 'square_pos_import' : undefined,
              // Phase 2: Tags from customer groups
              tags: mergedTags.length > 0 ? mergedTags : null,
              product_tags: productTags.length > 0 ? productTags : null,
              // Phase 4: Square-specific tracking
              square_customer_id: customer.id,
              square_group_ids: customer.group_ids || null,
              square_last_synced_at: new Date().toISOString(),
              created_at: customer.created_at,
              updated_at: customer.updated_at,
            }, {
              onConflict: 'tenant_id,email',
            })
            .select();
          
          if (upsertError) {
            console.error(`[SQUARE-SYNC] Failed to upsert customer ${customerEmail}:`, upsertError);
            continue; // Skip this customer but continue with others
          }
          
          console.log(`[SQUARE-SYNC] Successfully upserted customer ${customerEmail} (tags: ${mergedTags.length}, email_opt_in: ${finalEmailOptIn})`);
          customersSynced++;
        }
      }

      cursor = data.cursor;
    } while (cursor);

    // Update connection with sync info
    await supabaseClient
      .from('square_connections')
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: customersSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[SQUARE-SYNC] Customer sync complete. Total synced: ${customersSynced}`);

    return new Response(
      JSON.stringify({ success: true, customersSynced, groupsLoaded: groupMap.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SQUARE-SYNC-CUSTOMERS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
