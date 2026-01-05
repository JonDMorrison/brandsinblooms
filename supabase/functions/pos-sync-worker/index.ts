import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { decryptToken } from '../_shared/crypto/tokens.ts';
import { 
  shouldThrottleSync, 
  checkCircuitBreaker, 
  getNextCircuitOpenUntil,
  getOptimalBatchSize,
  getAdaptiveCooldown,
  type CircuitBreakerState 
} from '../_shared/syncThrottling.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Provider-specific sync handlers
interface SyncResult {
  customers: number;
  orders: number;
  products: number;
  rows: number;
  cursor: string | null;
  error?: string;
}

// Get connection based on provider
async function getConnection(supabase: any, tenantId: string, provider: string) {
  const tableMap: Record<string, string> = {
    square: 'square_connections',
    clover: 'clover_connections',
    lightspeed: 'lightspeed_connections',
  };
  
  const table = tableMap[provider];
  if (!table) throw new Error(`Unknown provider: ${provider}`);
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected')
    .single();
    
  if (error || !data) throw new Error(`No active ${provider} connection`);
  return data;
}

// Square sync implementation
async function syncSquare(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean
): Promise<SyncResult> {
  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl = connection.environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2'
    : 'https://connect.squareup.com/v2';
  
  const result: SyncResult = { customers: 0, orders: 0, products: 0, rows: 0, cursor: null };
  
  if (syncType === 'customers' || syncType === 'full') {
    const url = new URL(`${baseUrl}/customers`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Square-Version': '2024-01-18' },
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.errors?.[0]?.detail || 'Square API error');
    }
    
    const data = await response.json();
    const customers = data.customers || [];
    result.cursor = data.cursor || null;
    result.rows = customers.length;
    
    // Batch upsert with deduplication
    if (customers.length > 0) {
      const deduped = new Map();
      for (const c of customers) {
        const email = (c.email_address || `square-${c.id}@noemail.local`).toLowerCase();
        deduped.set(email, c);
      }
      
      const records = Array.from(deduped.values()).map(c => ({
        tenant_id: connection.tenant_id,
        email: (c.email_address || `square-${c.id}@noemail.local`).toLowerCase(),
        first_name: c.given_name || null,
        last_name: c.family_name || null,
        phone: c.phone_number || null,
        pos_source: 'square',
        square_customer_id: c.id,
        square_last_synced_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('crm_customers')
        .upsert(records, { onConflict: 'tenant_id,email' });
        
      if (!error) result.customers = records.length;
    }
  }

  // Loyalty sync
  if (syncType === 'loyalty') {
    console.log('[SQUARE-SYNC] Starting loyalty accounts sync...');
    
    const response = await fetch(`${baseUrl}/loyalty/accounts/search`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 100,
        cursor: cursor || undefined
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.errors?.[0]?.detail || 'Square Loyalty API error');
    }
    
    const data = await response.json();
    const loyaltyAccounts = data.loyalty_accounts || [];
    result.cursor = data.cursor || null;
    result.rows = loyaltyAccounts.length;
    
    console.log(`[SQUARE-SYNC] Found ${loyaltyAccounts.length} loyalty accounts`);
    
    // Process each loyalty account
    for (const account of loyaltyAccounts) {
      // 1. Find the customer by square_customer_id
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('id, tags')
        .eq('tenant_id', connection.tenant_id)
        .eq('square_customer_id', account.customer_id)
        .single();
      
      if (customer) {
        // 2. Add "Loyalty Member" tag if not present
        const existingTags = customer.tags || [];
        if (!existingTags.includes('Loyalty Member')) {
          await supabase
            .from('crm_customers')
            .update({ 
              tags: [...existingTags, 'Loyalty Member'],
              updated_at: new Date().toISOString()
            })
            .eq('id', customer.id);
        }
        
        // 3. Upsert loyalty metrics
        await supabase
          .from('customer_loyalty_metrics')
          .upsert({
            tenant_id: connection.tenant_id,
            customer_id: customer.id,
            program_name: 'Square Loyalty',
            points_balance: account.balance || 0,
            lifetime_points: account.lifetime_points || 0,
            enrolled_at: account.enrolled_at,
            external_loyalty_id: account.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'external_loyalty_id' });
        
        result.customers++;
      }
    }
    
    console.log(`[SQUARE-SYNC] Processed ${result.customers} loyalty accounts`);
  }
  
  return result;
}

// Clover sync implementation
async function syncClover(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean
): Promise<SyncResult> {
  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl = connection.environment === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : connection.region === 'eu' ? 'https://api.eu.clover.com'
    : connection.region === 'la' ? 'https://api.la.clover.com'
    : 'https://api.clover.com';
  
  const result: SyncResult = { customers: 0, orders: 0, products: 0, rows: 0, cursor: null };
  const offset = cursor ? parseInt(cursor) : 0;
  
  if (syncType === 'customers' || syncType === 'full') {
    const url = `${baseUrl}/v3/merchants/${connection.merchant_id}/customers?expand=emailAddresses,phoneNumbers&limit=100&offset=${offset}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Clover API error');
    }
    
    const data = await response.json();
    const customers = data.elements || [];
    result.rows = customers.length;
    result.cursor = customers.length >= 100 ? String(offset + 100) : null;
    
    if (customers.length > 0) {
      const deduped = new Map();
      for (const c of customers) {
        const email = c.emailAddresses?.elements?.[0]?.emailAddress;
        if (email) deduped.set(email.toLowerCase(), c);
      }
      
      const records = Array.from(deduped.values()).map(c => ({
        tenant_id: connection.tenant_id,
        email: c.emailAddresses.elements[0].emailAddress.toLowerCase(),
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        phone: c.phoneNumbers?.elements?.[0]?.phoneNumber || null,
        pos_source: 'clover',
        clover_customer_id: c.id,
        clover_last_synced_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('crm_customers')
        .upsert(records, { onConflict: 'tenant_id,email' });
        
      if (!error) result.customers = records.length;
    }
  }
  
  return result;
}

// Lightspeed sync implementation  
async function syncLightspeed(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean
): Promise<SyncResult> {
  const result: SyncResult = { customers: 0, orders: 0, products: 0, rows: 0, cursor: null };
  const offset = cursor ? parseInt(cursor) : 0;
  
  if (syncType === 'customers' || syncType === 'full') {
    const url = `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Customer.json?limit=100&offset=${offset}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${connection.encrypted_access_token}` },
    });
    
    if (!response.ok) throw new Error('Lightspeed API error');
    
    const data = await response.json();
    const customers = Array.isArray(data.Customer) ? data.Customer : [data.Customer].filter(Boolean);
    result.rows = customers.length;
    result.cursor = customers.length >= 100 ? String(offset + 100) : null;
    
    if (customers.length > 0) {
      const deduped = new Map();
      for (const c of customers) {
        if (c.email) deduped.set(c.email.toLowerCase(), c);
      }
      
      const records = Array.from(deduped.values()).map(c => ({
        tenant_id: connection.tenant_id,
        email: c.email.toLowerCase(),
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        phone: c.Contact?.Phones?.Phone?.[0]?.number || null,
        pos_source: 'lightspeed',
      }));
      
      const { error } = await supabase
        .from('crm_customers')
        .upsert(records, { onConflict: 'tenant_id,email' });
        
      if (!error) result.customers = records.length;
    }
  }
  
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Parse optional provider filter from request
    let providerFilter: string | null = null;
    try {
      const body = await req.json();
      providerFilter = body.provider || null;
    } catch { /* no body */ }

    console.log(`[POS-SYNC-WORKER] Starting, provider filter: ${providerFilter || 'all'}`);

    // Claim next job using the enum-typed function
    const { data: jobs, error: claimError } = await supabase
      .rpc('claim_next_pos_sync_job', { p_provider: providerFilter });

    // Handle the SETOF return - it returns an array
    const job = Array.isArray(jobs) ? jobs[0] : jobs;

    if (claimError) {
      console.error('[POS-SYNC-WORKER] Claim error:', claimError.message);
      return new Response(
        JSON.stringify({ success: false, error: claimError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!job) {
      // Could be queue empty OR global concurrency limit reached
      // Check which case for better logging
      const { data: queueStatus } = await supabase.rpc('get_sync_queue_status');
      const isLimitReached = queueStatus?.queue_full === true;
      const reason = isLimitReached ? 'global_limit_reached' : 'queue_empty';
      
      console.log(`[POS-SYNC-WORKER] No jobs available (${reason}). Status: ${JSON.stringify(queueStatus)}`);
      
      // If global limit reached and there are pending jobs, schedule a retry
      if (isLimitReached && (queueStatus?.pending > 0 || queueStatus?.delayed > 0)) {
        console.log('[POS-SYNC-WORKER] Global limit reached with pending jobs, will retry in 10s');
        
        EdgeRuntime.waitUntil(
          (async () => {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
            console.log('[POS-SYNC-WORKER] Retrying after global limit delay');
            await supabase.functions.invoke('pos-sync-worker', { body: { provider: providerFilter } });
          })()
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No jobs available',
          reason,
          queueStatus: queueStatus || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[POS-SYNC-WORKER] Processing job ${job.id}: ${job.provider} ${job.sync_type}`);

    // Check circuit breaker status for this tenant+provider
    const circuitState: CircuitBreakerState = {
      consecutiveFailures: job.consecutive_failures || 0,
      lastFailureAt: job.last_failure_at || null,
      circuitOpenUntil: job.circuit_open_until || null,
    };
    
    const circuitStatus = checkCircuitBreaker(circuitState);
    if (circuitStatus.isOpen) {
      console.log(`[POS-SYNC-WORKER] Circuit breaker OPEN for job ${job.id}, reopens at ${circuitStatus.reopenAt}`);
      // Mark job as delayed instead of failed
      await supabase
        .from('pos_sync_jobs_v2')
        .update({
          status: 'delayed',
          error_message: `Circuit breaker open until ${circuitStatus.reopenAt?.toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      return new Response(
        JSON.stringify({ success: false, reason: 'circuit_breaker_open', reopenAt: circuitStatus.reopenAt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection for this provider
    const connection = await getConnection(supabase, job.tenant_id, job.provider);

    // Execute sync based on provider
    let result: SyncResult;
    const cursor = job.current_cursor || job.last_sync_cursor;
    
    switch (job.provider) {
      case 'square':
        result = await syncSquare(supabase, connection, job.sync_type, cursor, job.is_delta);
        break;
      case 'clover':
        result = await syncClover(supabase, connection, job.sync_type, cursor, job.is_delta);
        break;
      case 'lightspeed':
        result = await syncLightspeed(supabase, connection, job.sync_type, cursor, job.is_delta);
        break;
      default:
        throw new Error(`Unknown provider: ${job.provider}`);
    }

    console.log(`[POS-SYNC-WORKER] Sync result:`, result);

    // If there's more data, update cursor and re-queue; otherwise complete
    if (result.cursor) {
      // Update job with progress and new cursor
      await supabase
        .from('pos_sync_jobs_v2')
        .update({
          current_cursor: result.cursor,
          customers_synced: job.customers_synced + result.customers,
          orders_synced: job.orders_synced + result.orders,
          products_synced: job.products_synced + result.products,
          processed_rows: job.processed_rows + result.rows,
          current_batch: job.current_batch + 1,
          status: 'pending', // Re-queue for next batch
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      console.log(`[POS-SYNC-WORKER] Job ${job.id} re-queued with cursor: ${result.cursor}`);

      // Get estimated customer count for adaptive cooldown
      const estimatedCustomers = connection.customers_synced || job.customers_synced || 0;
      const cooldownMs = getAdaptiveCooldown(estimatedCustomers);
      
      if (cooldownMs > 0) {
        console.log(`[POS-SYNC-WORKER] Applying ${cooldownMs}ms cooldown before next batch (est. ${estimatedCustomers} customers)`);
      }

      // Chain to process next batch with adaptive cooldown
      EdgeRuntime.waitUntil(
        (async () => {
          if (cooldownMs > 0) {
            await new Promise(resolve => setTimeout(resolve, cooldownMs));
          }
          await supabase.functions.invoke('pos-sync-worker', { body: { provider: job.provider } });
        })()
      );
    } else {
      // Complete the job and reset circuit breaker on success
      const { error: completeError } = await supabase.rpc('complete_pos_sync_job', {
        p_job_id: job.id,
        p_cursor: result.cursor,
        p_customers: job.customers_synced + result.customers,
        p_orders: job.orders_synced + result.orders,
        p_products: job.products_synced + result.products,
        p_rows: job.processed_rows + result.rows,
      });

      if (completeError) {
        console.error('[POS-SYNC-WORKER] Complete error:', completeError.message);
      } else {
        console.log(`[POS-SYNC-WORKER] Job ${job.id} completed successfully`);
        
        // Reset circuit breaker on success
        if (circuitStatus.shouldReset || circuitState.consecutiveFailures > 0) {
          await supabase
            .from('pos_sync_jobs_v2')
            .update({
              consecutive_failures: 0,
              circuit_open_until: null,
            })
            .eq('tenant_id', job.tenant_id)
            .eq('provider', job.provider);
          console.log(`[POS-SYNC-WORKER] Circuit breaker reset for ${job.tenant_id}:${job.provider}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        provider: job.provider,
        syncType: job.sync_type,
        result,
        hasMore: !!result.cursor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[POS-SYNC-WORKER] Error:', error.message);

    // Update circuit breaker on failure
    try {
      // We need to get job info to update circuit breaker
      const body = await req.clone().json().catch(() => ({}));
      
      // Increment consecutive failures and potentially open circuit
      const newFailures = (circuitState?.consecutiveFailures || 0) + 1;
      const circuitOpenUntil = getNextCircuitOpenUntil(newFailures);
      
      if (job?.id) {
        await supabase.rpc('fail_pos_sync_job', {
          p_job_id: job.id,
          p_error: error.message,
        });
        
        // Update circuit breaker state
        await supabase
          .from('pos_sync_jobs_v2')
          .update({
            consecutive_failures: newFailures,
            last_failure_at: new Date().toISOString(),
            circuit_open_until: circuitOpenUntil,
          })
          .eq('id', job.id);
        
        if (circuitOpenUntil) {
          console.log(`[POS-SYNC-WORKER] Circuit breaker OPENED for job ${job.id}, until ${circuitOpenUntil}`);
        }
      } else if (body.job_id) {
        await supabase.rpc('fail_pos_sync_job', {
          p_job_id: body.job_id,
          p_error: error.message,
        });
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
