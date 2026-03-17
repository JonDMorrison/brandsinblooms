import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * POS Sync Status Endpoint
 * 
 * Returns real-time queue status including:
 * - Global concurrency limit and current usage
 * - Pending, delayed, failed job counts
 * - Per-provider breakdown
 * - Recent job history
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get global queue status from database function
    const { data: queueStatus, error: statusError } = await supabase.rpc('get_sync_queue_status');
    
    if (statusError) {
      console.error('[POS-SYNC-STATUS] Error fetching queue status:', statusError);
      return new Response(
        JSON.stringify({ success: false, error: statusError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get per-provider breakdown
    const { data: providerBreakdown, error: breakdownError } = await supabase
      .from('pos_sync_jobs_v2')
      .select('provider, status')
      .in('status', ['pending', 'in_progress', 'delayed']);

    const byProvider: Record<string, { pending: number; in_progress: number; delayed: number }> = {};
    
    if (!breakdownError && providerBreakdown) {
      for (const job of providerBreakdown) {
        if (!byProvider[job.provider]) {
          byProvider[job.provider] = { pending: 0, in_progress: 0, delayed: 0 };
        }
        byProvider[job.provider][job.status as keyof typeof byProvider[typeof job.provider]]++;
      }
    }

    // Get recent jobs (last 10 completed/failed)
    const { data: recentJobs, error: recentError } = await supabase
      .from('pos_sync_jobs_v2')
      .select('id, provider, sync_type, status, started_at, completed_at, customers_synced, last_error')
      .in('status', ['completed', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(10);

    // Clean up stale jobs while we're here
    const { data: cleanedCount } = await supabase.rpc('cleanup_stale_sync_jobs');
    if (cleanedCount && cleanedCount > 0) {
      console.log(`[POS-SYNC-STATUS] Cleaned up ${cleanedCount} stale jobs`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        global: {
          max_concurrent: queueStatus?.max_concurrent || 4,
          in_progress: queueStatus?.in_progress || 0,
          slots_available: queueStatus?.slots_available || 4,
          queue_full: queueStatus?.queue_full || false,
        },
        queued: {
          pending: queueStatus?.pending || 0,
          delayed: queueStatus?.delayed || 0,
          total: (queueStatus?.pending || 0) + (queueStatus?.delayed || 0),
        },
        stats_24h: {
          completed: queueStatus?.completed_24h || 0,
          failed: queueStatus?.failed_24h || 0,
        },
        by_provider: byProvider,
        recent_jobs: recentJobs || [],
        stale_jobs_cleaned: cleanedCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[POS-SYNC-STATUS] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
