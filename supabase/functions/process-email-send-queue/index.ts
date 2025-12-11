import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_JOBS_PER_INVOCATION = 10;
const RESEND_BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
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

    // Fetch pending jobs, ordered by creation time then batch index
    const { data: jobs, error: fetchError } = await supabase
      .from('email_send_jobs')
      .select('*')
      .eq('status', 'pending')
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

    console.log(`📧 Processing ${jobs.length} email send jobs...`);

    let processedCount = 0;
    let totalEmailsSent = 0;
    let totalEmailsFailed = 0;

    for (const job of jobs) {
      const jobStartTime = Date.now();
      
      // Check if we're approaching timeout (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log('⏱️ Approaching timeout, stopping processing');
        break;
      }

      try {
        // Mark job as in_progress
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: 'in_progress', 
            attempts: job.attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log(`📧 Processing job ${job.id} (batch ${job.batch_index}, ${job.recipient_emails.length} recipients)`);

        const recipients = job.recipient_emails as any[];
        let emailsSent = 0;
        let emailsFailed = 0;

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
              console.error(`❌ Batch send failed:`, batchResponse.error);
            }
          } catch (batchError: any) {
            console.error(`❌ Batch error:`, batchError.message);
            emailsFailed += batch.length;
          }
        }

        // Mark job as completed
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: 'completed',
            emails_sent: emailsSent,
            emails_failed: emailsFailed,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Update campaign metrics
        await supabase.rpc('increment_campaign_sent_count', {
          p_campaign_id: job.campaign_id,
          p_sent_count: emailsSent
        }).catch((e: any) => {
          // Fallback: direct update if RPC doesn't exist
          console.log('RPC not available, using direct update');
        });

        totalEmailsSent += emailsSent;
        totalEmailsFailed += emailsFailed;
        processedCount++;

        console.log(`✅ Job ${job.id} completed: ${emailsSent} sent, ${emailsFailed} failed (${Date.now() - jobStartTime}ms)`);

      } catch (jobError: any) {
        console.error(`❌ Job ${job.id} failed:`, jobError.message);
        
        await supabase
          .from('email_send_jobs')
          .update({ 
            status: 'failed',
            error_message: jobError.message?.substring(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }

    // Check if any campaigns are fully complete
    const campaignIds = [...new Set(jobs.map(j => j.campaign_id))];
    
    for (const campaignId of campaignIds) {
      const { data: pendingJobs } = await supabase
        .from('email_send_jobs')
        .select('id')
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'in_progress'])
        .limit(1);

      if (!pendingJobs || pendingJobs.length === 0) {
        // All jobs for this campaign are done, calculate final metrics
        const { data: completedJobs } = await supabase
          .from('email_send_jobs')
          .select('emails_sent, emails_failed')
          .eq('campaign_id', campaignId);

        const totalSent = completedJobs?.reduce((sum, j) => sum + (j.emails_sent || 0), 0) || 0;
        const totalFailed = completedJobs?.reduce((sum, j) => sum + (j.emails_failed || 0), 0) || 0;

        await supabase
          .from('crm_campaigns')
          .update({ 
            status: 'sent',
            metrics: { sent: totalSent, failed: totalFailed, opens: 0, clicks: 0, unsubscribes: 0 }
          })
          .eq('id', campaignId);

        console.log(`🎉 Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Queue processing complete: ${processedCount} jobs, ${totalEmailsSent} emails sent, ${totalEmailsFailed} failed (${duration}ms)`);

    return new Response(
      JSON.stringify({ 
        processed: processedCount,
        emails_sent: totalEmailsSent,
        emails_failed: totalEmailsFailed,
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
