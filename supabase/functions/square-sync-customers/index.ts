import { createClient } from 'npm:@supabase/supabase-js@2';
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

    // Parse request body for chain parameters
    let jobId: string | undefined;
    let cursor: string | undefined;
    let isChainCall = false;

    try {
      const body = await req.json();
      jobId = body.job_id;
      cursor = body.cursor;
      isChainCall = !!jobId;
    } catch {
      // No body or invalid JSON - first call
    }

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

    // Check for existing in-progress job (prevent duplicate syncs)
    if (!isChainCall) {
      const { data: existingJob } = await supabaseClient
        .from('pos_sync_jobs')
        .select('id, status')
        .eq('connection_id', connection.id)
        .eq('sync_type', 'customers')
        .in('status', ['pending', 'in_progress'])
        .single();

      if (existingJob) {
        console.log('[SQUARE-SYNC] Sync already in progress, returning existing job');
        return new Response(
          JSON.stringify({ 
            success: true, 
            jobId: existingJob.id, 
            status: existingJob.status,
            message: 'Sync already in progress' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create or fetch sync job
    let job: any;
    if (isChainCall && jobId) {
      const { data: existingJob, error: jobError } = await supabaseClient
        .from('pos_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (jobError || !existingJob) {
        throw new Error('Sync job not found');
      }
      job = existingJob;
    } else {
      // Create new sync job
      const { data: newJob, error: createError } = await supabaseClient
        .from('pos_sync_jobs')
        .insert({
          tenant_id: userData.tenant_id,
          connection_id: connection.id,
          connection_type: 'square',
          sync_type: 'customers',
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      job = newJob;
      jobId = newJob.id;
    }

    console.log(`[SQUARE-SYNC] Processing job ${jobId}, page ${job.current_page}, cursor: ${cursor || 'none'}`);

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // On first page, fetch customer groups
    let groupMap = new Map<string, string>();
    if (!cursor) {
      console.log('[SQUARE-SYNC] First page - fetching customer groups...');
      groupMap = await fetchSquareCustomerGroups(accessToken, connection.environment);
    }

    // Fetch ONE page of customers from Square
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/customers'
      : 'https://connect.squareup.com/v2/customers';

    const url = new URL(baseUrl);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    console.log(`[SQUARE-SYNC] Fetching customers from Square...`);
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

    const customers: SquareCustomer[] = data.customers || [];
    const nextCursor = data.cursor;

    console.log(`[SQUARE-SYNC] Fetched ${customers.length} customers, next cursor: ${nextCursor ? 'yes' : 'no'}`);

    // BATCH UPSERT - Process all customers in one database call
    let synced = 0;
    let failed = 0;

    if (customers.length > 0) {
      // DEDUPLICATE within batch - Square may return same email multiple times
      // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
      const deduplicatedMap = new Map<string, SquareCustomer>();
      for (const customer of customers) {
        const customerEmail = customer.email_address || `square-${customer.id}@noemail.local`;
        // Keep the most recent version (last occurrence wins)
        deduplicatedMap.set(customerEmail.toLowerCase(), customer);
      }

      const deduplicatedCustomers = Array.from(deduplicatedMap.values());
      console.log(`[SQUARE-SYNC] Deduplicated ${customers.length} → ${deduplicatedCustomers.length} unique customers`);

      const customerRecords = deduplicatedCustomers.map(customer => {
        const customerEmail = customer.email_address || `square-${customer.id}@noemail.local`;
        const emailOptIn = customer.preferences?.email_unsubscribed === true 
          ? false 
          : customer.preferences?.email_unsubscribed === false 
            ? true 
            : null;
        const tags = mapGroupIdsToNames(customer.group_ids, groupMap);

        return {
          tenant_id: userData.tenant_id,
          user_id: user.id,
          email: customerEmail.toLowerCase(),
          first_name: customer.given_name || null,
          last_name: customer.family_name || null,
          phone: customer.phone_number || null,
          pos_source: 'square',
          email_opt_in: emailOptIn,
          email_consent_source: emailOptIn !== null ? 'square_pos_import' : null,
          tags: tags.length > 0 ? tags : null,
          square_customer_id: customer.id,
          square_group_ids: customer.group_ids || null,
          square_last_synced_at: new Date().toISOString(),
          created_at: customer.created_at || new Date().toISOString(),
          updated_at: customer.updated_at || new Date().toISOString(),
        };
      });

      console.log(`[SQUARE-SYNC] Batch upserting ${customerRecords.length} customers...`);
      
      try {
        const { error: upsertError } = await supabaseClient
          .from('crm_customers')
          .upsert(customerRecords, {
            onConflict: 'tenant_id,email',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('[SQUARE-SYNC] Batch upsert error:', upsertError);
          failed = customerRecords.length;
        } else {
          synced = customerRecords.length;
          console.log(`[SQUARE-SYNC] Successfully upserted ${synced} customers`);
        }
      } catch (upsertCatchError: any) {
        console.error('[SQUARE-SYNC] Batch upsert exception:', upsertCatchError.message);
        failed = customerRecords.length;
      }
    }

    // Update job progress
    const newTotalFetched = job.total_fetched + customers.length;
    const newTotalSynced = job.total_synced + synced;
    const newTotalFailed = job.total_failed + failed;
    const newCurrentPage = job.current_page + 1;
    const hasMorePages = !!nextCursor;

    await supabaseClient
      .from('pos_sync_jobs')
      .update({
        total_fetched: newTotalFetched,
        total_synced: newTotalSynced,
        total_failed: newTotalFailed,
        current_page: newCurrentPage,
        cursor: nextCursor || null,
        has_more_pages: hasMorePages,
        status: hasMorePages ? 'in_progress' : 'completed',
        completed_at: hasMorePages ? null : new Date().toISOString(),
      })
      .eq('id', jobId);

    // Chain to next page if there's more data
    if (hasMorePages && nextCursor) {
      console.log(`[SQUARE-SYNC] Chaining to next page...`);
      
      // Use EdgeRuntime.waitUntil for background processing
      const chainPromise = supabaseClient.functions.invoke('square-sync-customers', {
        body: { job_id: jobId, cursor: nextCursor },
      });

      // Fire and forget - don't await
      EdgeRuntime.waitUntil(chainPromise);
    } else {
      // Update connection with final sync info
      await supabaseClient
        .from('square_connections')
        .update({
          last_customer_sync: new Date().toISOString(),
          customers_synced: newTotalSynced,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      console.log(`[SQUARE-SYNC] Customer sync complete. Total synced: ${newTotalSynced}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        status: hasMorePages ? 'in_progress' : 'completed',
        progress: {
          fetched: newTotalFetched,
          synced: newTotalSynced,
          failed: newTotalFailed,
          page: newCurrentPage,
          hasMore: hasMorePages,
        }
      }),
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
