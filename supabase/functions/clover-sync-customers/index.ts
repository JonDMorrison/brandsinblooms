import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
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
      // Create new sync job
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
      const customerRecords: any[] = [];

      for (const customer of customers) {
        const primaryEmail = customer.emailAddresses?.elements?.find(e => e.primaryEmail)?.emailAddress 
          || customer.emailAddresses?.elements?.[0]?.emailAddress;
        
        if (!primaryEmail) {
          console.log('[CLOVER-SYNC] Skipping customer without email:', customer.id);
          continue;
        }

        const primaryPhone = customer.phoneNumbers?.elements?.[0]?.phoneNumber;

        customerRecords.push({
          tenant_id: userData.tenant_id,
          user_id: user.id,
          email: primaryEmail,
          first_name: customer.firstName || null,
          last_name: customer.lastName || null,
          phone: primaryPhone || null,
          pos_source: 'clover',
          email_opt_in: customer.marketingAllowed ?? null,
          email_consent_source: customer.marketingAllowed !== undefined ? 'clover_pos_import' : null,
          clover_customer_id: customer.id,
          clover_last_synced_at: new Date().toISOString(),
        });
      }

      if (customerRecords.length > 0) {
        console.log(`[CLOVER-SYNC] Batch upserting ${customerRecords.length} customers...`);
        
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
