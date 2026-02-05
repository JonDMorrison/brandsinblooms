import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_JOBS_PER_INVOCATION = 10;
const SEND_CONCURRENCY = 10;
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_DELAY_MS = 500;
const DEFAULT_MESSAGE_STALE_MINUTES = 15;

function truncateError(message: string, maxLength: number = 500): string {
  if (!message) return '';
  return message.length > maxLength ? message.slice(0, maxLength) : message;
}

async function resendSendEmail(
  apiKey: string,
  payload: any,
  idempotencyKey: string,
): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.message || json?.error || res.statusText || 'Resend API error';
      return { error: truncateError(String(msg)) };
    }

    const id = json?.id || json?.data?.id;
    if (!id) return { error: 'Resend returned no message id' };
    return { id };
  } catch (e: any) {
    return { error: truncateError(e?.message || 'Network error calling Resend') };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const batchDelayMs = parseInt(Deno.env.get('EMAIL_BATCH_DELAY_MS') || String(DEFAULT_BATCH_DELAY_MS), 10);
  const sendConcurrency = parseInt(Deno.env.get('EMAIL_SEND_CONCURRENCY') || String(SEND_CONCURRENCY), 10);
  const messageStaleMinutes = parseInt(Deno.env.get('EMAIL_MESSAGE_STALE_MINUTES') || String(DEFAULT_MESSAGE_STALE_MINUTES), 10);
  const workerId = Deno.env.get('WORKER_ID') || `email-queue-worker-${crypto.randomUUID()}`;
  const claimToken = crypto.randomUUID();

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

    // Atomically claim jobs (prevents concurrent workers from processing the same job)
    const { data: jobs, error: claimError } = await supabase.rpc('claim_email_send_jobs', {
      batch_size: MAX_JOBS_PER_INVOCATION,
      worker_id: workerId,
      p_claim_token: claimToken,
      stale_after_minutes: 10,
    });

    if (claimError) {
      console.error('❌ Error claiming jobs:', claimError);
      return new Response(
        JSON.stringify({ error: 'Failed to claim jobs' }),
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

    console.log(`📧 Processing ${jobs.length} claimed email send jobs (batch delay: ${batchDelayMs}ms)...`);

    let processedCount = 0;
    let totalEmailsSent = 0;
    let totalEmailsFailed = 0;
    const failedCampaigns = new Set<string>();

    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      const job = jobs[jobIndex] as any;
      const jobStartTime = Date.now();

      // Check if we're approaching timeout (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log('⏱️ Approaching timeout, stopping processing');
        break;
      }

      try {
        const messageIds: string[] = Array.isArray(job.recipient_message_ids) ? job.recipient_message_ids : [];
        console.log(`📧 Processing job ${job.id} (batch ${job.batch_index}, ${messageIds.length} messages)`);

        if (messageIds.length === 0) {
          await supabase
            .from('email_send_jobs')
            .update({
              status: 'completed',
              emails_sent: 0,
              emails_failed: 0,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
            .eq('claim_token', claimToken);
          processedCount++;
          continue;
        }

        // Load messages for this job
        const { data: messages, error: msgFetchError } = await supabase
          .from('email_messages')
          .select('id, tenant_id, campaign_id, customer_id, domain_id, email, payload, status, resend_id, attempts, dead_lettered_at, claimed_at')
          .in('id', messageIds);

        if (msgFetchError) {
          const errMsg = truncateError(msgFetchError.message);
          console.error(`❌ Failed to load email_messages for job ${job.id}:`, msgFetchError);
          await supabase
            .from('email_send_jobs')
            .update({
              status: 'pending',
              error_message: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
            .eq('claim_token', claimToken);
          continue;
        }

        const nowIso = new Date().toISOString();
        let emailsSent = 0;
        let emailsFailed = 0;
        let lastError: string | null = null;

        const staleThresholdIso = new Date(Date.now() - messageStaleMinutes * 60 * 1000).toISOString();

        const sendable = (messages || []).filter((m: any) => {
          if (m.dead_lettered_at) return false;
          if (m.status === 'queued') {
            // ok
          } else if (m.status === 'sending') {
            if (!m.claimed_at) return false;
            if (new Date(m.claimed_at).toISOString() >= staleThresholdIso) return false;
          } else {
            return false;
          }
          if (m.resend_id) return false;
          return true;
        });

        // Claim messages (idempotency + concurrency guard)
        const claimedForSend: any[] = [];
        for (const m of sendable) {
          // Increment attempts and mark as sending only if still queued and unsent
          let claimQuery = supabase
            .from('email_messages')
            .update({
              status: 'sending',
              attempts: (m.attempts || 0) + 1,
              last_attempt_at: nowIso,
              claimed_at: nowIso,
              claimed_by: workerId,
              claim_token: claimToken,
              updated_at: nowIso,
            })
            .eq('id', m.id)
            .is('resend_id', null);

          // Reclaim stale in-flight messages safely (send uses per-message idempotency key).
          if (m.status === 'sending') {
            claimQuery = claimQuery.eq('status', 'sending').lt('claimed_at', staleThresholdIso);
          } else {
            claimQuery = claimQuery.eq('status', 'queued');
          }

          const { data: claimed, error: claimMsgErr } = await claimQuery
            .select('id, payload, attempts, tenant_id, domain_id')
            .maybeSingle();

          if (claimMsgErr) {
            console.warn(`⚠️ Failed to claim message ${m.id}:`, claimMsgErr.message);
            continue;
          }
          if (!claimed) continue;

          // Hard daily quota reservation (DB-enforced). If no capacity remains, release and stop.
          const { data: quotaOk, error: quotaErr } = await supabase.rpc('reserve_email_daily_capacity', {
            p_tenant_id: claimed.tenant_id,
            p_domain_id: claimed.domain_id || null,
            p_tokens: 1,
            p_default_tenant_limit: 5000,
          });

          if (quotaErr) {
            console.warn('⚠️ Daily quota reservation failed (allowing send):', quotaErr.message);
            claimedForSend.push(claimed);
            continue;
          }

          if (quotaOk !== true) {
            console.log(`⏸️ Daily quota exhausted; deferring remaining messages for job ${job.id}`);
            lastError = 'Daily sending limit reached';
            // Release the message back to queued so it can be resumed tomorrow.
            await supabase
              .from('email_messages')
              .update({
                status: 'queued',
                error_message: 'Daily sending limit reached',
                claim_token: null,
                claimed_at: null,
                claimed_by: null,
                updated_at: nowIso,
              })
              .eq('id', claimed.id)
              .eq('claim_token', claimToken)
              .is('resend_id', null);
            break;
          }

          claimedForSend.push(claimed);
        }

        // Send claimed messages with per-message idempotency.
        for (let i = 0; i < claimedForSend.length; i += sendConcurrency) {
          const chunk = claimedForSend.slice(i, i + sendConcurrency);
          console.log(`📧 Sending ${chunk.length} emails (concurrency ${sendConcurrency})...`);

          const results = await Promise.all(
            chunk.map(async (msg: any) => {
              const r = await resendSendEmail(resendApiKey, msg.payload, msg.id);
              return { msgId: msg.id, attempts: msg.attempts || 1, resendId: r.id, error: r.error };
            })
          );

          for (const r of results) {
            if (r.resendId) {
              emailsSent++;
              await supabase
                .from('email_messages')
                .update({
                  status: 'sent',
                  resend_id: r.resendId,
                  sent_at: nowIso,
                  error_message: null,
                  updated_at: nowIso,
                  claim_token: null,
                  claimed_at: null,
                  claimed_by: null,
                })
                .eq('id', r.msgId)
                .eq('claim_token', claimToken);
            } else {
              emailsFailed++;
              const errMsg = truncateError(r.error || 'Send failed');
              lastError = errMsg;

              const terminal = (r.attempts || 1) >= MAX_ATTEMPTS;
              await supabase
                .from('email_messages')
                .update({
                  status: terminal ? 'failed' : 'queued',
                  error_message: errMsg,
                  updated_at: nowIso,
                  claim_token: null,
                  claimed_at: null,
                  claimed_by: null,
                })
                .eq('id', r.msgId)
                .eq('claim_token', claimToken)
                .is('resend_id', null);
            }
          }

          if (i + sendConcurrency < claimedForSend.length) {
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
          }
        }

        // If any messages remain queued/sending, keep job pending for retry; otherwise complete.
        const { data: remainingRows } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .in('status', ['queued', 'sending'])
          .limit(1);

        const hasRemaining = (remainingRows || []).length > 0;

        // Durable job stats (derived from the source-of-truth ledger)
        const { data: sentCountRows } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .eq('status', 'sent');

        const { data: failedCountRows } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .eq('status', 'failed');

        const durableSent = (sentCountRows || []).length;
        const durableFailed = (failedCountRows || []).length;

        await supabase
          .from('email_send_jobs')
          .update({
            status: hasRemaining ? 'pending' : 'completed',
            emails_sent: durableSent,
            emails_failed: durableFailed,
            error_message: durableFailed > 0 ? lastError : null,
            updated_at: nowIso,
          })
          .eq('id', job.id)
          .eq('claim_token', claimToken);

        totalEmailsSent += emailsSent;
        totalEmailsFailed += emailsFailed;
        processedCount++;

        console.log(`✅ Job ${job.id} completed: ${emailsSent} sent, ${emailsFailed} failed (${Date.now() - jobStartTime}ms)`);

      } catch (jobError: any) {
        console.error(`❌ Job ${job.id} failed:`, jobError.message);
        await supabase
          .from('email_send_jobs')
          .update({
            status: 'pending',
            error_message: truncateError(jobError.message),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .eq('claim_token', claimToken);
      }

      // Rate limiting: add delay between jobs
      if (jobIndex < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    // Campaign completion is based on the persisted email_messages ledger.
    const campaignIds = [...new Set((jobs || []).map((j: any) => j.campaign_id))];
    for (const campaignId of campaignIds) {
      // If any queued/sending messages remain, campaign is still in progress.
      const { data: remaining } = await supabase
        .from('email_messages')
        .select('id')
        .eq('campaign_id', campaignId)
        .in('status', ['queued', 'sending'])
        .limit(1);

      if (remaining && remaining.length > 0) {
        continue;
      }

      // Compute final metrics from email_messages
      const { data: sentRows } = await supabase
        .from('email_messages')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'sent');

      const { data: failedRows } = await supabase
        .from('email_messages')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');

      const totalSent = (sentRows || []).length;
      const totalFailed = (failedRows || []).length;
      const hasErrors = totalFailed > 0;

      await supabase
        .from('crm_campaigns')
        .update({
          status: hasErrors ? 'sent_with_errors' : 'sent',
          total_sent: totalSent,
          sent_at: new Date().toISOString(),
          metrics: {
            sent: totalSent,
            failed: totalFailed,
            opens: 0,
            clicks: 0,
            unsubscribes: 0,
          },
          send_blocked_reason: hasErrors ? `${totalFailed} recipient(s) failed after ${MAX_ATTEMPTS} attempts` : null,
        })
        .eq('id', campaignId);

      console.log(`🎉 Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed${hasErrors ? ' (with errors)' : ''}`);
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
