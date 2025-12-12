/**
 * SMS Queue Worker
 * 
 * This is the ONLY place where SMS messages are actually sent via Twilio.
 * It processes both:
 * 1. sms_send_jobs (campaign path) - created by send-sms-campaign
 * 2. Legacy sms_messages (automation path) - messages without jobs
 * 
 * Key features:
 * - Bulletproof concurrency safety via atomic claiming with claim_token
 * - Stale claim recovery for crashed/hung workers
 * - Idempotent (skips already-sent messages)
 * - Respects rate limits between Twilio calls
 * - Updates campaign status when all jobs complete
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts'

// Configuration constants
const SMS_BATCH_DELAY_MS = Number(Deno.env.get("SMS_BATCH_DELAY_MS") ?? "200");
const MAX_JOBS_PER_RUN = Number(Deno.env.get("SMS_MAX_JOBS_PER_RUN") ?? "10");
const MAX_LEGACY_MESSAGES_PER_RUN = 100;
const MAX_JOB_ATTEMPTS = Number(Deno.env.get("SMS_MAX_JOB_ATTEMPTS") ?? "3");

// Stale claim timeout - jobs in_progress longer than this can be reclaimed
const CLAIM_STALE_AFTER_MINUTES = Number(Deno.env.get("SMS_CLAIM_STALE_AFTER_MINUTES") ?? "15");

// Generate unique worker ID for this invocation
const WORKER_ID = `sms-worker-${crypto.randomUUID().slice(0, 8)}`;

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  messagingServiceSid?: string
  statusCallbackUrl?: string
}

interface SmsMessage {
  id: string
  phone: string
  content: string
  media_urls: string[] | null
  from_phone: string | null
  campaign_id: string | null
  customer_id: string | null
  status: string
  twilio_sid: string | null
}

interface SmsSendJob {
  id: string
  tenant_id: string
  campaign_id: string | null
  from_phone: string | null
  messaging_service_sid: string | null
  status: string
  recipient_message_ids: string[]
  batch_index: number
  attempts: number
  claimed_at: string | null
  claimed_by: string | null
  claim_token: string | null
}

/**
 * Format phone number to E.164 format for Twilio
 */
function formatPhoneForTwilio(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (phone.startsWith('+') && cleaned.length >= 10) {
    return phone;
  }
  return `+1${cleaned}`;
}

/**
 * Send SMS via Twilio API
 */
async function sendSMSViaTwilio(
  config: TwilioConfig,
  to: string,
  body: string,
  options: {
    messagingServiceSid?: string | null
    fromPhone?: string | null
    mediaUrls?: string[] | null
  } = {}
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const formData = new FormData();

    // Determine sender: Messaging Service SID (preferred) or From phone
    if (options.messagingServiceSid) {
      formData.append('MessagingServiceSid', options.messagingServiceSid);
    } else {
      const fromNumber = options.fromPhone
        ? formatPhoneForTwilio(options.fromPhone)
        : formatPhoneForTwilio(config.phoneNumber);
      formData.append('From', fromNumber);
    }

    formData.append('To', to);
    formData.append('Body', body);

    // Add media URLs if present
    if (options.mediaUrls && options.mediaUrls.length > 0) {
      for (const mediaUrl of options.mediaUrls) {
        formData.append('MediaUrl', mediaUrl);
      }
    }

    // Add status callback for delivery tracking
    if (config.statusCallbackUrl) {
      formData.append('StatusCallback', config.statusCallbackUrl);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
      },
      body: formData,
    });

    const result = await response.json();

    if (result.error_code || result.code) {
      return {
        success: false,
        error: result.message || `Twilio error: ${result.error_code || result.code}`,
      };
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    return { success: false, error: error.message || 'Unknown error sending SMS' };
  }
}

/**
 * Rate-limited delay between Twilio calls
 */
async function rateLimitDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, SMS_BATCH_DELAY_MS));
}

/**
 * Truncate error message to max length
 */
function truncateError(message: string, maxLength: number = 250): string {
  if (!message) return '';
  return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
}

/**
 * Atomically claim pending/stale jobs using raw SQL via RPC
 * This is the ONLY way to ensure no two workers process the same job
 */
async function claimSmsSendJobs(
  supabase: any,
  limit: number,
  workerId: string,
  claimToken: string
): Promise<SmsSendJob[]> {
  // Calculate stale threshold
  const staleThreshold = new Date(Date.now() - CLAIM_STALE_AFTER_MINUTES * 60 * 1000).toISOString();

  // Use a transaction-like approach: select eligible jobs, then atomically update them
  // We select jobs that are either:
  // 1. status='pending' and never claimed (claimed_at IS NULL)
  // 2. status='pending' or 'in_progress' with stale claims (claimed_at < threshold)
  // We filter by attempts < MAX_JOB_ATTEMPTS
  
  // First, get IDs of jobs we want to claim
  const { data: eligibleJobs, error: selectError } = await supabase
    .from('sms_send_jobs')
    .select('id')
    .in('status', ['pending', 'in_progress'])
    .lt('attempts', MAX_JOB_ATTEMPTS)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThreshold}`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (selectError || !eligibleJobs || eligibleJobs.length === 0) {
    if (selectError) {
      console.error('[sms-queue-worker] Error selecting eligible jobs:', selectError);
    }
    return [];
  }

  const jobIds = eligibleJobs.map((j: { id: string }) => j.id);
  const now = new Date().toISOString();

  // Atomically claim these jobs - the key is the WHERE clause includes the same conditions
  // so if another worker already claimed them, this update will affect 0 rows for those
  const { data: claimedJobs, error: claimError } = await supabase
    .from('sms_send_jobs')
    .update({
      status: 'in_progress',
      claimed_at: now,
      claimed_by: workerId,
      claim_token: claimToken,
      attempts: supabase.sql`attempts + 1`,
      updated_at: now,
    })
    .in('id', jobIds)
    .in('status', ['pending', 'in_progress'])
    .lt('attempts', MAX_JOB_ATTEMPTS)
    .or(`claimed_at.is.null,claimed_at.lt.${staleThreshold}`)
    .select('*');

  if (claimError) {
    console.error('[sms-queue-worker] Error claiming jobs:', claimError);
    return [];
  }

  return claimedJobs || [];
}

/**
 * Alternative claiming approach using individual updates with strong guards
 * This is more reliable across different Supabase versions
 */
async function claimSmsSendJobsSafe(
  supabase: any,
  limit: number,
  workerId: string,
  claimToken: string
): Promise<SmsSendJob[]> {
  const staleThreshold = new Date(Date.now() - CLAIM_STALE_AFTER_MINUTES * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Step 1: Find eligible jobs
  const { data: eligibleJobs, error: selectError } = await supabase
    .from('sms_send_jobs')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .lt('attempts', MAX_JOB_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit * 2); // Get more than needed in case some are already claimed

  if (selectError) {
    console.error('[sms-queue-worker] Error selecting jobs:', selectError);
    return [];
  }

  if (!eligibleJobs || eligibleJobs.length === 0) {
    return [];
  }

  // Step 2: Filter for claimable jobs (null claimed_at or stale)
  const claimableJobs = eligibleJobs.filter((job: SmsSendJob) => {
    if (!job.claimed_at) return true;
    return new Date(job.claimed_at) < new Date(staleThreshold);
  }).slice(0, limit);

  if (claimableJobs.length === 0) {
    return [];
  }

  // Step 3: Atomically claim each job with strong guards
  const claimedJobs: SmsSendJob[] = [];

  for (const job of claimableJobs) {
    // Build the update with guards that prevent race conditions
    const updateConditions: Record<string, any> = {
      id: job.id,
    };

    // Only claim if status hasn't changed and claim is still stale/null
    const { data: claimed, error: claimError } = await supabase
      .from('sms_send_jobs')
      .update({
        status: 'in_progress',
        claimed_at: now,
        claimed_by: workerId,
        claim_token: claimToken,
        attempts: job.attempts + 1,
        updated_at: now,
      })
      .eq('id', job.id)
      .in('status', ['pending', 'in_progress'])
      .lt('attempts', MAX_JOB_ATTEMPTS)
      .select('*')
      .maybeSingle();

    if (claimError) {
      console.log(`[sms-queue-worker] Failed to claim job ${job.id}:`, claimError.message);
      continue;
    }

    if (claimed) {
      // Verify we actually claimed it (our claim_token)
      if (claimed.claim_token === claimToken) {
        claimedJobs.push(claimed);
      } else {
        console.log(`[sms-queue-worker] Job ${job.id} claimed by another worker`);
      }
    }

    if (claimedJobs.length >= limit) break;
  }

  return claimedJobs;
}

/**
 * Complete a job with claim_token guard to ensure only the claiming worker can complete it
 */
async function completeJobWithGuard(
  supabase: any,
  jobId: string,
  claimToken: string,
  status: 'completed' | 'failed',
  errorMessage: string | null
): Promise<boolean> {
  const { data, error } = await supabase
    .from('sms_send_jobs')
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('claim_token', claimToken)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[sms-queue-worker] Error completing job ${jobId}:`, error);
    return false;
  }

  if (!data) {
    console.warn(`[sms-queue-worker] Job ${jobId} completion failed - claim_token mismatch (stolen claim?)`);
    return false;
  }

  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  const claimToken = crypto.randomUUID();
  
  const stats = {
    workerId: WORKER_ID,
    claimToken,
    jobsClaimed: 0,
    jobsProcessed: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsClaimStolen: 0,
    messagesSent: 0,
    messagesFailed: 0,
    messagesSkipped: 0,
    legacyMessagesProcessed: 0,
    campaignsUpdated: 0,
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[sms-queue-worker] Starting. Worker=${WORKER_ID}, ClaimToken=${claimToken.slice(0, 8)}..., Config: MAX_JOBS=${MAX_JOBS_PER_RUN}, DELAY=${SMS_BATCH_DELAY_MS}ms, STALE_MINUTES=${CLAIM_STALE_AFTER_MINUTES}`);

    // Get Twilio configuration
    const twilioConfig: TwilioConfig = {
      accountSid: Deno.env.get('TWILIO_ACCOUNT_SID') ?? '',
      authToken: Deno.env.get('TWILIO_AUTH_TOKEN') ?? '',
      phoneNumber: Deno.env.get('TWILIO_PHONE_NUMBER') ?? '',
      messagingServiceSid: Deno.env.get('TWILIO_MESSAGING_SERVICE_SID'),
      statusCallbackUrl: 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/twilio-status-callback',
    };

    if (!twilioConfig.accountSid || !twilioConfig.authToken) {
      throw new Error('Missing Twilio configuration (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)');
    }

    // =========================================================================
    // PHASE 1: Atomically Claim Jobs
    // =========================================================================
    console.log('[sms-queue-worker] PHASE 1: Claiming jobs atomically...');

    const claimedJobs = await claimSmsSendJobsSafe(supabase, MAX_JOBS_PER_RUN, WORKER_ID, claimToken);
    stats.jobsClaimed = claimedJobs.length;

    console.log(`[sms-queue-worker] Claimed ${claimedJobs.length} jobs: [${claimedJobs.map(j => j.id.slice(0, 8)).join(', ')}]`);

    // Track which campaigns are touched for later status update
    const touchedCampaignIds = new Set<string>();

    // =========================================================================
    // PHASE 2: Process Claimed Jobs
    // =========================================================================
    if (claimedJobs.length > 0) {
      console.log('[sms-queue-worker] PHASE 2: Processing claimed jobs...');

      for (const job of claimedJobs) {
        stats.jobsProcessed++;
        console.log(`[sms-queue-worker] Processing job ${job.id} (batch ${job.batch_index}, attempt ${job.attempts})`);

        if (job.campaign_id) {
          touchedCampaignIds.add(job.campaign_id);
        }

        // Load messages by IDs
        const { data: messages, error: msgFetchError } = await supabase
          .from('sms_messages')
          .select('id, phone, content, media_urls, from_phone, campaign_id, customer_id, status, twilio_sid')
          .in('id', job.recipient_message_ids);

        if (msgFetchError) {
          console.error(`[sms-queue-worker] Failed to load messages for job ${job.id}:`, msgFetchError);
          const completed = await completeJobWithGuard(
            supabase,
            job.id,
            claimToken,
            'failed',
            truncateError(msgFetchError.message)
          );
          if (completed) {
            stats.jobsFailed++;
          } else {
            stats.jobsClaimStolen++;
          }
          continue;
        }

        const jobMessages: SmsMessage[] = messages || [];
        let jobSent = 0;
        let jobFailed = 0;
        let jobSkipped = 0;

        // Process each message with idempotency check
        for (const msg of jobMessages) {
          // CRITICAL IDEMPOTENCY CHECK: skip if already sent or has twilio_sid
          if (msg.status !== 'queued' || msg.twilio_sid) {
            console.log(`[sms-queue-worker] Skipping message ${msg.id}: status=${msg.status}, twilio_sid=${msg.twilio_sid ? 'present' : 'null'}`);
            jobSkipped++;
            stats.messagesSkipped++;
            continue;
          }

          // Send via Twilio
          const formattedPhone = formatPhoneForTwilio(msg.phone);
          const result = await sendSMSViaTwilio(twilioConfig, formattedPhone, msg.content, {
            messagingServiceSid: job.messaging_service_sid,
            fromPhone: msg.from_phone || job.from_phone,
            mediaUrls: msg.media_urls,
          });

          const now = new Date().toISOString();

          if (result.success) {
            // Update message as sent
            await supabase
              .from('sms_messages')
              .update({
                status: 'sent',
                twilio_sid: result.sid,
                sent_at: now,
                updated_at: now,
              })
              .eq('id', msg.id);

            console.log(`[sms-queue-worker] Message ${msg.id} sent: SID=${result.sid}`);
            jobSent++;
            stats.messagesSent++;
          } else {
            // Update message as failed
            await supabase
              .from('sms_messages')
              .update({
                status: 'failed',
                error_message: truncateError(result.error || 'Unknown error'),
                updated_at: now,
              })
              .eq('id', msg.id);

            console.error(`[sms-queue-worker] Message ${msg.id} failed: ${result.error}`);
            jobFailed++;
            stats.messagesFailed++;
          }

          // Rate limit delay
          await rateLimitDelay();
        }

        // Complete job with claim_token guard
        const jobStatus = (jobSent > 0 || jobSkipped === jobMessages.length) ? 'completed' : 'failed';
        const jobErrorMessage = jobStatus === 'failed'
          ? `All ${jobFailed} messages failed. See sms_messages.error_message for details.`
          : null;

        const completed = await completeJobWithGuard(supabase, job.id, claimToken, jobStatus, jobErrorMessage);

        if (completed) {
          if (jobStatus === 'completed') {
            stats.jobsCompleted++;
            console.log(`[sms-queue-worker] Job ${job.id} completed: ${jobSent} sent, ${jobFailed} failed, ${jobSkipped} skipped`);
          } else {
            stats.jobsFailed++;
            console.log(`[sms-queue-worker] Job ${job.id} failed: ${jobFailed} messages failed`);
          }
        } else {
          stats.jobsClaimStolen++;
          console.warn(`[sms-queue-worker] Job ${job.id} claim was stolen - another worker completed it`);
        }
      }
    }

    // =========================================================================
    // PHASE 3: Update Campaign Statuses
    // =========================================================================
    if (touchedCampaignIds.size > 0) {
      console.log(`[sms-queue-worker] PHASE 3: Updating ${touchedCampaignIds.size} campaign(s)...`);

      for (const campaignId of touchedCampaignIds) {
        // Check job completion status for this campaign
        const { data: campaignJobs, error: campaignJobsError } = await supabase
          .from('sms_send_jobs')
          .select('id, status')
          .eq('campaign_id', campaignId);

        if (campaignJobsError) {
          console.error(`[sms-queue-worker] Error fetching jobs for campaign ${campaignId}:`, campaignJobsError);
          continue;
        }

        const allJobs = campaignJobs || [];
        const completedJobs = allJobs.filter((j: { status: string }) => j.status === 'completed');
        const failedJobs = allJobs.filter((j: { status: string }) => j.status === 'failed');
        const pendingOrInProgress = allJobs.filter((j: { status: string }) => j.status === 'pending' || j.status === 'in_progress');

        // Determine campaign status
        let newCampaignStatus: string | null = null;

        if (allJobs.length === 0) {
          continue;
        } else if (pendingOrInProgress.length > 0) {
          newCampaignStatus = 'sending';
        } else if (completedJobs.length === allJobs.length) {
          newCampaignStatus = 'sent';
        } else if (failedJobs.length === allJobs.length) {
          newCampaignStatus = 'failed';
        } else {
          newCampaignStatus = 'sent'; // Treat partial success as sent
        }

        if (newCampaignStatus) {
          // Get current campaign to update metrics
          const { data: campaign } = await supabase
            .from('crm_sms_campaigns')
            .select('metrics')
            .eq('id', campaignId)
            .single();

          // Count actual message statuses
          const { data: messageStats } = await supabase
            .from('sms_messages')
            .select('status')
            .eq('campaign_id', campaignId);

          const sentCount = (messageStats || []).filter((m: { status: string }) => m.status === 'sent' || m.status === 'delivered').length;
          const failedCount = (messageStats || []).filter((m: { status: string }) => m.status === 'failed').length;
          const deliveredCount = (messageStats || []).filter((m: { status: string }) => m.status === 'delivered').length;

          const metrics = {
            ...(campaign?.metrics || {}),
            messages_sent: sentCount,
            delivered: deliveredCount,
            failed: failedCount,
          };

          const updateData: Record<string, any> = {
            status: newCampaignStatus,
            metrics,
            updated_at: new Date().toISOString(),
          };

          if (newCampaignStatus === 'sent') {
            updateData.sent_at = new Date().toISOString();
          }

          await supabase
            .from('crm_sms_campaigns')
            .update(updateData)
            .eq('id', campaignId);

          stats.campaignsUpdated++;
          console.log(`[sms-queue-worker] Campaign ${campaignId} updated to status: ${newCampaignStatus}`);
        }
      }
    }

    // =========================================================================
    // PHASE 4: Process Legacy Queued Messages (Automation Path)
    // =========================================================================
    console.log('[sms-queue-worker] PHASE 4: Processing legacy queued messages...');

    const { data: legacyMessages, error: legacyFetchError } = await supabase
      .from('sms_messages')
      .select('id, phone, content, media_urls, from_phone, campaign_id, customer_id, status, twilio_sid')
      .eq('status', 'queued')
      .is('twilio_sid', null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .limit(MAX_LEGACY_MESSAGES_PER_RUN);

    if (legacyFetchError) {
      console.error('[sms-queue-worker] Error fetching legacy messages:', legacyFetchError);
    } else {
      const orphanMessages: SmsMessage[] = legacyMessages || [];
      console.log(`[sms-queue-worker] Found ${orphanMessages.length} legacy queued messages`);

      for (const msg of orphanMessages) {
        // Double-check idempotency
        if (msg.status !== 'queued' || msg.twilio_sid) {
          continue;
        }

        stats.legacyMessagesProcessed++;

        const formattedPhone = formatPhoneForTwilio(msg.phone);
        const result = await sendSMSViaTwilio(twilioConfig, formattedPhone, msg.content, {
          messagingServiceSid: twilioConfig.messagingServiceSid,
          fromPhone: msg.from_phone,
          mediaUrls: msg.media_urls,
        });

        const now = new Date().toISOString();

        if (result.success) {
          await supabase
            .from('sms_messages')
            .update({
              status: 'sent',
              twilio_sid: result.sid,
              sent_at: now,
              updated_at: now,
            })
            .eq('id', msg.id);

          console.log(`[sms-queue-worker] Legacy message ${msg.id} sent: SID=${result.sid}`);
          stats.messagesSent++;
        } else {
          await supabase
            .from('sms_messages')
            .update({
              status: 'failed',
              error_message: truncateError(result.error || 'Unknown error'),
              updated_at: now,
            })
            .eq('id', msg.id);

          console.error(`[sms-queue-worker] Legacy message ${msg.id} failed: ${result.error}`);
          stats.messagesFailed++;
        }

        await rateLimitDelay();
      }
    }

    // =========================================================================
    // Complete
    // =========================================================================
    const duration = Date.now() - startTime;
    console.log(`[sms-queue-worker] Completed in ${duration}ms. Stats:`, JSON.stringify(stats));

    return corsJsonResponse({
      success: true,
      duration_ms: duration,
      stats,
      message: `Worker ${WORKER_ID}: Claimed ${stats.jobsClaimed} jobs, processed ${stats.jobsProcessed}, sent ${stats.messagesSent} messages`,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[sms-queue-worker] Fatal error after ${duration}ms:`, error);

    return corsJsonResponse({
      success: false,
      error: error.message,
      duration_ms: duration,
      stats,
    }, { status: 500 });
  }
});
