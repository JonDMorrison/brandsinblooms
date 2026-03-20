import { createClient } from 'npm:@supabase/supabase-js@2';
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

interface CloverCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  marketingAllowed?: boolean;
  emailAddresses?: {
    elements?: Array<{ id: string; emailAddress: string; primaryEmail?: boolean }>;
  };
  phoneNumbers?: {
    elements?: Array<{ id: string; phoneNumber: string }>;
  };
  addresses?: {
    elements?: Array<{ id: string; address1?: string; city?: string; state?: string; zip?: string }>;
  };
  metadata?: {
    businessName?: string;
  };
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
    let pageOffset: number = 0;
    let isChainCall = false;

    try {
      const body = await req.json();
      jobId = body.job_id;
      pageOffset = body.page_offset || 0;
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

    // Get Clover connection
    const { data: connection } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Clover connection');

    // FIX: [P21] - Clean up stuck in_progress jobs older than 30 minutes
    await supabaseClient
      .from('pos_sync_jobs')
      .update({ status: 'failed', error_message: 'Timed out (stuck for >30 minutes)' })
      .eq('connection_id', connection.id)
      .eq('sync_type', 'customers')
      .eq('status', 'in_progress')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // FIX: [P18] - Replace check-then-create with atomic insert to prevent race condition on job creation
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
        console.log('[CLOVER-SYNC] Sync already in progress, returning existing job');
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
      // Create new sync job - wrapped in try/catch to handle race condition
      // where another request creates the job between our check and insert
      try {
        const { data: newJob, error: createError } = await supabaseClient
          .from('pos_sync_jobs')
          .insert({
            tenant_id: userData.tenant_id,
            connection_id: connection.id,
            connection_type: 'clover',
            sync_type: 'customers',
            status: 'in_progress',
            started_at: new Date().toISOString(),
            page_offset: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        job = newJob;
        jobId = newJob.id;
      } catch (err: any) {
        if (err?.code === '23505') { // unique violation - another concurrent request created the job first
          return new Response(JSON.stringify({ message: 'Sync already started' }), { status: 409, headers: corsHeaders });
        }
        throw err;
      }
    }

    console.log(`[CLOVER-SYNC] Processing job ${jobId}, page offset: ${pageOffset}`);

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);

    // Fetch ONE page of customers from Clover
    const limit = 100;
    const url = `${apiBaseUrl}/v3/merchants/${connection.merchant_id}/customers?expand=emailAddresses,phoneNumbers,addresses&limit=${limit}&offset=${pageOffset}`;

    console.log(`[CLOVER-SYNC] Fetching customers from Clover, offset: ${pageOffset}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CLOVER-SYNC] API error:', errorData);
      throw new Error(errorData.message || 'Failed to fetch customers');
    }

    const data = await response.json();
    const customers: CloverCustomer[] = data.elements || [];

    console.log(`[CLOVER-SYNC] Fetched ${customers.length} customers`);

    // BATCH UPSERT - Process all customers in one database call
    let synced = 0;
    let failed = 0;

    if (customers.length > 0) {
      // DEDUPLICATE within batch - Clover may return same email multiple times
      // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
      const deduplicatedMap = new Map<string, CloverCustomer>();
      let skippedNoEmail = 0;

      for (const customer of customers) {
        const primaryEmail = customer.emailAddresses?.elements?.find(e => e.primaryEmail)?.emailAddress 
          || customer.emailAddresses?.elements?.[0]?.emailAddress;
        
        if (!primaryEmail) {
          skippedNoEmail++;
          continue;
        }

        // Keep the most recent version (last occurrence wins)
        deduplicatedMap.set(primaryEmail.toLowerCase(), customer);
      }

      if (skippedNoEmail > 0) {
        console.log(`[CLOVER-SYNC] Skipped ${skippedNoEmail} customers without email`);
      }

      const deduplicatedCustomers = Array.from(deduplicatedMap.values());
      console.log(`[CLOVER-SYNC] Deduplicated ${customers.length - skippedNoEmail} → ${deduplicatedCustomers.length} unique customers`);

      const customerRecords = deduplicatedCustomers.map(customer => {
        const primaryEmail = customer.emailAddresses?.elements?.find(e => e.primaryEmail)?.emailAddress 
          || customer.emailAddresses?.elements?.[0]?.emailAddress;
        const primaryPhone = customer.phoneNumbers?.elements?.[0]?.phoneNumber;

        return {
          tenant_id: userData.tenant_id,
          user_id: user.id,
          email: primaryEmail!.toLowerCase(),
          first_name: customer.firstName || null,
          last_name: customer.lastName || null,
          phone: primaryPhone || null,
          pos_source: 'clover',
          email_opt_in: customer.marketingAllowed ?? null,
          email_consent_source: customer.marketingAllowed !== undefined ? 'clover_pos_import' : null,
          clover_customer_id: customer.id,
          clover_last_synced_at: new Date().toISOString(),
        };
      });

      if (customerRecords.length > 0) {
        console.log(`[CLOVER-SYNC] Batch upserting ${customerRecords.length} customers...`);
        
        try {
          const { error: upsertError } = await supabaseClient
            .from('crm_customers')
            .upsert(customerRecords, {
              onConflict: 'tenant_id,email',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error('[CLOVER-SYNC] Batch upsert error:', upsertError);
            failed = customerRecords.length;
          } else {
            synced = customerRecords.length;
            console.log(`[CLOVER-SYNC] Successfully upserted ${synced} customers`);
          }
        } catch (upsertCatchError: any) {
          console.error('[CLOVER-SYNC] Batch upsert exception:', upsertCatchError.message);
          failed = customerRecords.length;
        }
      }
    }

    // Determine if there are more pages
    const hasMorePages = customers.length >= limit;
    const nextOffset = pageOffset + limit;

    // Update job progress
    const newTotalFetched = job.total_fetched + customers.length;
    const newTotalSynced = job.total_synced + synced;
    const newTotalFailed = job.total_failed + failed;
    const newCurrentPage = job.current_page + 1;

    await supabaseClient
      .from('pos_sync_jobs')
      .update({
        total_fetched: newTotalFetched,
        total_synced: newTotalSynced,
        total_failed: newTotalFailed,
        current_page: newCurrentPage,
        page_offset: nextOffset,
        has_more_pages: hasMorePages,
        status: hasMorePages ? 'in_progress' : 'completed',
        completed_at: hasMorePages ? null : new Date().toISOString(),
      })
      .eq('id', jobId);

    // Chain to next page if there's more data
    if (hasMorePages) {
      console.log(`[CLOVER-SYNC] Chaining to next page, offset: ${nextOffset}`);
      
      // Use EdgeRuntime.waitUntil for background processing
      const chainPromise = supabaseClient.functions.invoke('clover-sync-customers', {
        body: { job_id: jobId, page_offset: nextOffset },
      });

      // Fire and forget - don't await
      EdgeRuntime.waitUntil(chainPromise);
    } else {
      // Update connection with final sync info
      await supabaseClient
        .from('clover_connections')
        .update({
          last_customer_sync: new Date().toISOString(),
          customers_synced: newTotalSynced,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      console.log(`[CLOVER-SYNC] Customer sync complete. Total synced: ${newTotalSynced}`);
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
    console.error('[CLOVER-SYNC-CUSTOMERS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
