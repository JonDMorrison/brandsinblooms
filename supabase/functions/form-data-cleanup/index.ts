import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Form Data Cleanup Job
 * 
 * Scheduled to run daily via pg_cron. Cleans up:
 * 1. form_rate_limits: Records older than 24 hours (configurable)
 * 2. form_submissions: Records older than retention period (optional, disabled by default)
 * 
 * Environment variables:
 * - RATE_LIMIT_RETENTION_HOURS: Hours to keep rate limit records (default: 24)
 * - SUBMISSION_RETENTION_MONTHS: Months to keep submissions (default: 0 = disabled)
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: [E33] - Add service-role-or-JWT authentication
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: corsHeaders });
  }
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  }

  const startTime = Date.now();
  console.log('[form-data-cleanup] Starting scheduled cleanup job');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Configuration (with defaults)
    const rateLimitRetentionHours = parseInt(Deno.env.get('RATE_LIMIT_RETENTION_HOURS') || '24', 10);
    const submissionRetentionMonths = parseInt(Deno.env.get('SUBMISSION_RETENTION_MONTHS') || '0', 10);

    const results = {
      rate_limits_deleted: 0,
      submissions_deleted: 0,
      submissions_skipped: submissionRetentionMonths === 0,
      errors: [] as string[],
    };

    // ─── 1. Clean up form_rate_limits ─────────────────────────────────────────
    const rateLimitCutoff = new Date();
    rateLimitCutoff.setHours(rateLimitCutoff.getHours() - rateLimitRetentionHours);
    
    console.log(`[form-data-cleanup] Deleting rate limits older than ${rateLimitCutoff.toISOString()}`);

    const { error: rateLimitError, count: rateLimitCount } = await supabase
      .from('form_rate_limits')
      .delete()
      .lt('window_start', rateLimitCutoff.toISOString())
      .select('*', { count: 'exact', head: true });

    if (rateLimitError) {
      console.error('[form-data-cleanup] Error cleaning rate limits:', rateLimitError);
      results.errors.push(`rate_limits: ${rateLimitError.message}`);
    } else {
      // Since delete doesn't return count directly, we need to do it differently
      const { data: oldLimits, error: countError } = await supabase
        .from('form_rate_limits')
        .select('id', { count: 'exact' })
        .lt('window_start', rateLimitCutoff.toISOString());

      if (!countError && oldLimits) {
        const deleteCount = oldLimits.length;
        if (deleteCount > 0) {
          const { error: delError } = await supabase
            .from('form_rate_limits')
            .delete()
            .lt('window_start', rateLimitCutoff.toISOString());
          
          if (!delError) {
            results.rate_limits_deleted = deleteCount;
            console.log(`[form-data-cleanup] Deleted ${deleteCount} expired rate limit records`);
          }
        }
      }
    }

    // ─── 2. Clean up form_submissions (if retention enabled) ──────────────────
    if (submissionRetentionMonths > 0) {
      const submissionCutoff = new Date();
      submissionCutoff.setMonth(submissionCutoff.getMonth() - submissionRetentionMonths);

      console.log(`[form-data-cleanup] Deleting submissions older than ${submissionCutoff.toISOString()} (${submissionRetentionMonths} months)`);

      // Count first
      const { data: oldSubmissions, error: subCountError } = await supabase
        .from('form_submissions')
        .select('id', { count: 'exact' })
        .lt('submitted_at', submissionCutoff.toISOString());

      if (subCountError) {
        console.error('[form-data-cleanup] Error counting old submissions:', subCountError);
        results.errors.push(`submissions_count: ${subCountError.message}`);
      } else if (oldSubmissions && oldSubmissions.length > 0) {
        // Delete in batches to avoid timeouts
        const BATCH_SIZE = 1000;
        let totalDeleted = 0;

        while (true) {
          const { data: batch } = await supabase
            .from('form_submissions')
            .select('id')
            .lt('submitted_at', submissionCutoff.toISOString())
            .limit(BATCH_SIZE);

          if (!batch || batch.length === 0) break;

          const { error: delError } = await supabase
            .from('form_submissions')
            .delete()
            .in('id', batch.map(s => s.id));

          if (delError) {
            results.errors.push(`submissions_delete: ${delError.message}`);
            break;
          }

          totalDeleted += batch.length;
          
          if (batch.length < BATCH_SIZE) break;
        }

        results.submissions_deleted = totalDeleted;
        console.log(`[form-data-cleanup] Deleted ${totalDeleted} old submission records`);
      }
    } else {
      console.log('[form-data-cleanup] Submission retention disabled (SUBMISSION_RETENTION_MONTHS=0)');
    }

    const duration = Date.now() - startTime;
    console.log(`[form-data-cleanup] Completed in ${duration}ms`, results);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        ...results,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: results.errors.length === 0 ? 200 : 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err) {
    console.error('[form-data-cleanup] Fatal error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
