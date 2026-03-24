import { createClient } from 'npm:@supabase/supabase-js@2';

const LIGHTSPEED_PAGE_SIZE = 100;

const SYNC_JOB_CONFIG = [
  { queueSyncType: 'customers', label: 'customers', estimatedRows: 10000 },
  { queueSyncType: 'orders', label: 'sales', estimatedRows: 50000 },
  { queueSyncType: 'products', label: 'products', estimatedRows: 5000 },
] as const;

function getJobId(payload: unknown) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidate = record.id ?? record.jobId ?? record.job_id;
    return typeof candidate === 'string' ? candidate : null;
  }

  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('[LIGHTSPEED-FULL-SYNC] Starting full sync via job queue...');

    // Get user and tenant info
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { data: userData, error: tenantError } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (tenantError || !userData?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const tenantId = userData.tenant_id;
    console.log(`[LIGHTSPEED-FULL-SYNC] Tenant: ${tenantId}`);

    const queuedJobs: Array<{
      id: string;
      sync_type: string;
      label: string;
      estimated_rows: number;
      total_pages_est: number;
    }> = [];
    const enqueueErrors: string[] = [];

    for (const syncJob of SYNC_JOB_CONFIG) {
      console.log(`[LIGHTSPEED-FULL-SYNC] Enqueuing ${syncJob.label} sync job...`);

      const { data: enqueueResult, error: enqueueError } = await supabaseClient.rpc('enqueue_pos_sync_job', {
        p_tenant_id: tenantId,
        p_provider: 'lightspeed',
        p_sync_type: syncJob.queueSyncType,
        p_estimated_rows: syncJob.estimatedRows,
        p_triggered_by: 'full_sync',
      });

      if (enqueueError) {
        console.error(`[LIGHTSPEED-FULL-SYNC] Failed to enqueue ${syncJob.label}:`, enqueueError.message);
        enqueueErrors.push(`${syncJob.label}: ${enqueueError.message}`);
        continue;
      }

      const jobId = getJobId(enqueueResult);
      if (!jobId) {
        console.error(`[LIGHTSPEED-FULL-SYNC] Missing job id for ${syncJob.label}:`, enqueueResult);
        enqueueErrors.push(`${syncJob.label}: missing job id`);
        continue;
      }

      const totalPagesEstimate = Math.max(1, Math.ceil(syncJob.estimatedRows / LIGHTSPEED_PAGE_SIZE));
      const now = new Date().toISOString();

      const { error: progressInitError } = await supabaseClient
        .from('pos_sync_jobs_v2')
        .update({
          current_page: 0,
          total_pages_est: totalPagesEstimate,
          total_batches: totalPagesEstimate,
          fetched_rows: 0,
          inserted_rows: 0,
          skipped_rows: 0,
          failed_rows: 0,
          progress_message: `Queued ${syncJob.label} sync`,
          last_progress_at: now,
          provider_job_id: null,
          updated_at: now,
        })
        .eq('id', jobId);

      if (progressInitError) {
        console.error(`[LIGHTSPEED-FULL-SYNC] Failed to initialize progress for ${syncJob.label}:`, progressInitError.message);
      }

      queuedJobs.push({
        id: jobId,
        sync_type: syncJob.queueSyncType,
        label: syncJob.label,
        estimated_rows: syncJob.estimatedRows,
        total_pages_est: totalPagesEstimate,
      });
      console.log(`[LIGHTSPEED-FULL-SYNC] ${syncJob.label} job enqueued: ${jobId}`);
    }

    if (queuedJobs.length === 0) {
      throw new Error(enqueueErrors[0] ?? 'No Lightspeed sync jobs could be enqueued.');
    }

    // Kick off the worker to start processing
    console.log('[LIGHTSPEED-FULL-SYNC] Starting pos-sync-worker...');
    const { error: workerError } = await supabaseClient.functions.invoke('pos-sync-worker', {
      body: { provider: 'lightspeed' },
    });

    if (workerError) {
      console.error('[LIGHTSPEED-FULL-SYNC] Worker invoke error:', workerError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs: queuedJobs,
        errors: enqueueErrors,
        workerStarted: !workerError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[LIGHTSPEED-FULL-SYNC] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
