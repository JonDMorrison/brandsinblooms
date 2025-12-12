import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_JOBS_PER_INVOCATION = 10;
const RESEND_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_DELAY_MS = 500;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const batchDelayMs = parseInt(Deno.env.get('EMAIL_BATCH_DELAY_MS') || String(DEFAULT_BATCH_DELAY_MS), 10);
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Fetch pending jobs that haven't exceeded max attempts, ordered by creation time
    const { data: jobs, error: fetchError } = await supabase
      .from('email_send_jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .order('batch_index', { ascending: true })
      .limit(MAX_JOBS_PER_INVOCATION);

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ No pending jobs to process');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending jobs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Processing ${jobs.length} email send jobs (batch delay: ${batchDelayMs}ms)...`);

    let processedCount = 0;
    let totalEmailsSent = 0;
    let totalEmailsFailed = 0;
    const failedCampaigns = new Set<string>();

    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      const job = jobs[jobIndex];
      const jobStartTime = Date.now();
      
      // Check if we're approaching timeout (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log('⏱️ Approaching timeout, stopping processing');
        break;
      }

      try {
        // Mark job as in_progress
        const newAttempts = job.attempts + 1;
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: 'in_progress', 
            attempts: newAttempts,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log(`📧 Processing job ${job.id} (batch ${job.batch_index}, attempt ${newAttempts}/${MAX_ATTEMPTS}, ${job.recipient_emails.length} recipients)`);

        const recipients = job.recipient_emails as any[];
        let emailsSent = 0;
        let emailsFailed = 0;
        let lastError: string | null = null;

        // Process in sub-batches of RESEND_BATCH_SIZE
        for (let i = 0; i < recipients.length; i += RESEND_BATCH_SIZE) {
          const batch = recipients.slice(i, i + RESEND_BATCH_SIZE);
          
          try {
            // Each recipient object contains the full email payload
            const emailPayloads = batch.map((r: any) => r.payload);
            
            const batchResponse = await resend.batch.send(emailPayloads);
            
            if (batchResponse?.data) {
              const successCount = Array.isArray(batchResponse.data) 
                ? batchResponse.data.filter((r: any) => r?.id).length 
                : 1;
              emailsSent += successCount;
              emailsFailed += batch.length - successCount;
            } else if (batchResponse?.error) {
              emailsFailed += batch.length;
              lastError = batchResponse.error?.message || 'Batch send failed';
              console.error(`❌ Batch send failed:`, batchResponse.error);
            }
          } catch (batchError: any) {
            lastError = batchError.message || 'Unknown batch error';
            console.error(`❌ Batch error:`, batchError.message);
            emailsFailed += batch.length;
          }

          // Rate limiting: add delay between sub-batches
          if (i + RESEND_BATCH_SIZE < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
          }
        }

        // Mark job as completed
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: 'completed',
            emails_sent: emailsSent,
            emails_failed: emailsFailed,
            error_message: emailsFailed > 0 ? lastError : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        totalEmailsSent += emailsSent;
        totalEmailsFailed += emailsFailed;
        processedCount++;

        console.log(`✅ Job ${job.id} completed: ${emailsSent} sent, ${emailsFailed} failed (${Date.now() - jobStartTime}ms)`);

      } catch (jobError: any) {
        console.error(`❌ Job ${job.id} failed:`, jobError.message);
        
        const newAttempts = job.attempts + 1;
        const isFinalAttempt = newAttempts >= MAX_ATTEMPTS;
        
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: isFinalAttempt ? 'failed' : 'pending',
            error_message: jobError.message?.substring(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (isFinalAttempt) {
          failedCampaigns.add(job.campaign_id);
          console.error(`❌ Job ${job.id} permanently failed after ${MAX_ATTEMPTS} attempts`);
        }
      }

      // Rate limiting: add delay between jobs
      if (jobIndex < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    // Mark permanently failed jobs and update campaign error status
    const { data: permanentlyFailedJobs } = await supabase
      .from('email_send_jobs')
      .select('campaign_id')
      .eq('status', 'pending')
      .gte('attempts', MAX_ATTEMPTS);

    if (permanentlyFailedJobs && permanentlyFailedJobs.length > 0) {
      // Mark these as failed
      await supabase
        .from('email_send_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('status', 'pending')
        .gte('attempts', MAX_ATTEMPTS);

      permanentlyFailedJobs.forEach(j => failedCampaigns.add(j.campaign_id));
    }

    // Check campaign completion status
    const campaignIds = [...new Set(jobs.map(j => j.campaign_id))];
    
    for (const campaignId of campaignIds) {
      const { data: pendingJobs } = await supabase
        .from('email_send_jobs')
        .select('id')
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'in_progress'])
        .limit(1);

      if (!pendingJobs || pendingJobs.length === 0) {
        // All jobs for this campaign are done
        const { data: completedJobs } = await supabase
          .from('email_send_jobs')
          .select('emails_sent, emails_failed, status, error_message')
          .eq('campaign_id', campaignId);

        const totalSent = completedJobs?.reduce((sum, j) => sum + (j.emails_sent || 0), 0) || 0;
        const totalFailed = completedJobs?.reduce((sum, j) => sum + (j.emails_failed || 0), 0) || 0;
        const failedJobs = completedJobs?.filter(j => j.status === 'failed') || [];
        const hasErrors = failedJobs.length > 0;

        const updateData: any = {
          status: hasErrors ? 'sent_with_errors' : 'sent',
          total_sent: totalSent,
          sent_at: new Date().toISOString(),
          metrics: { 
            sent: totalSent, 
            failed: totalFailed, 
            opens: 0, 
            clicks: 0, 
            unsubscribes: 0,
            failed_batches: failedJobs.length
          }
        };

        if (hasErrors) {
          updateData.send_blocked_reason = `${failedJobs.length} batch(es) failed after ${MAX_ATTEMPTS} attempts`;
        }

        await supabase
          .from('crm_campaigns')
          .update(updateData)
          .eq('id', campaignId);

        console.log(`🎉 Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed${hasErrors ? ' (with errors)' : ''}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Queue processing complete: ${processedCount} jobs, ${totalEmailsSent} emails sent, ${totalEmailsFailed} failed (${duration}ms)`);

    return new Response(
      JSON.stringify({ 
        processed: processedCount,
        emails_sent: totalEmailsSent,
        emails_failed: totalEmailsFailed,
        failed_campaigns: failedCampaigns.size,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Critical error in queue processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
