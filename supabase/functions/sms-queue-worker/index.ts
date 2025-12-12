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
 * - Accurate billing: only charges quota when Twilio accepts the message
 * - Retry policy: retries transient errors with exponential backoff
 * - Dead-lettering: permanently fails messages that cannot be delivered
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts'
import { classifyTwilioError, calculateRetryDelay, type SmsFailureType } from '../_shared/smsErrorPolicy.ts'
import { logComplianceEvent, classifyErrorToComplianceType } from '../_shared/smsComplianceLogger.ts'

// Configuration constants
const SMS_BATCH_DELAY_MS = Number(Deno.env.get("SMS_BATCH_DELAY_MS") ?? "200");
const MAX_JOBS_PER_RUN = Number(Deno.env.get("SMS_MAX_JOBS_PER_RUN") ?? "10");
const MAX_LEGACY_MESSAGES_PER_RUN = 100;
const MAX_JOB_ATTEMPTS = Number(Deno.env.get("SMS_MAX_JOB_ATTEMPTS") ?? "3");
const MAX_MESSAGE_ATTEMPTS = Number(Deno.env.get("SMS_MAX_MESSAGE_ATTEMPTS") ?? "3");
const RETRY_BASE_DELAY_MS = Number(Deno.env.get("SMS_RETRY_BASE_DELAY_MS") ?? "2000");

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
  tenant_id: string
  phone: string
  content: string
  media_urls: string[] | null
  from_phone: string | null
  campaign_id: string | null
  customer_id: string | null
  status: string
  twilio_sid: string | null
  billable_units: number | null
  billed_at: string | null
  attempts: number
  scheduled_at: string | null
  dead_lettered_at: string | null
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
): Promise<{ success: boolean; sid?: string; error?: string; rawError?: unknown }> {
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
        rawError: result,
      };
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error sending SMS',
      rawError: error,
    };
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
 * Atomically claim pending/stale jobs
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
    .is('dead_lettered_at', null)
    .order('created_at', { ascending: true })
    .limit(limit * 2);

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
      .is('dead_lettered_at', null)
      .select('*')
      .maybeSingle();

    if (claimError) {
      console.log(`[sms-queue-worker] Failed to claim job ${job.id}:`, claimError.message);
      continue;
    }

    if (claimed) {
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
 * Complete or reset a job with claim_token guard
 */
async function updateJobWithGuard(
  supabase: any,
  jobId: string,
  claimToken: string,
  update: {
    status: 'completed' | 'failed' | 'pending'
    errorMessage?: string | null
    clearClaim?: boolean
  }
): Promise<boolean> {
  const updateData: Record<string, any> = {
    status: update.status,
    error_message: update.errorMessage ?? null,
    updated_at: new Date().toISOString(),
  };

  if (update.clearClaim) {
    updateData.claimed_at = null;
    updateData.claimed_by = null;
    updateData.claim_token = null;
  }

  const { data, error } = await supabase
    .from('sms_send_jobs')
    .update(updateData)
    .eq('id', jobId)
    .eq('claim_token', claimToken)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[sms-queue-worker] Error updating job ${jobId}:`, error);
    return false;
  }

  if (!data) {
    console.warn(`[sms-queue-worker] Job ${jobId} update failed - claim_token mismatch`);
    return false;
  }

  return true;
}

/**
 * Bill a message atomically using the database function
 */
async function billMessage(
  supabase: any,
  tenantId: string,
  messageId: string,
  billableUnits: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('bill_sms_message', {
      p_tenant_id: tenantId,
      p_message_id: messageId,
      p_billable_units: billableUnits
    });

    if (error) {
      console.error(`[sms-queue-worker] Billing RPC failed for message ${messageId}:`, error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error(`[sms-queue-worker] Billing exception for message ${messageId}:`, err);
    return false;
  }
}

/**
 * Increment attempts and check if message should be processed
 */
async function prepareMessageForSend(
  supabase: any,
  messageId: string
): Promise<{ shouldSend: boolean; attempts: number }> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('sms_messages')
    .update({
      attempts: supabase.rpc ? undefined : undefined, // Will use raw SQL
      last_attempt_at: now,
      updated_at: now,
    })
    .eq('id', messageId)
    .eq('status', 'queued')
    .is('dead_lettered_at', null)
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .select('id, attempts')
    .maybeSingle();

  if (error || !data) {
    return { shouldSend: false, attempts: 0 };
  }

  // Increment attempts via a separate update
  await supabase
    .from('sms_messages')
    .update({ attempts: data.attempts + 1 })
    .eq('id', messageId);

  return { shouldSend: true, attempts: data.attempts + 1 };
}

/**
 * Handle message send failure with retry policy and compliance logging
 */
async function handleMessageFailure(
  supabase: any,
  msg: SmsMessage,
  attempts: number,
  rawError: unknown
): Promise<{ retryScheduled: boolean; failureType: SmsFailureType }> {
  const now = new Date().toISOString();
  const classified = classifyTwilioError(rawError);
  
  console.log(`[sms-queue-worker] Message ${msg.id} error classified:`, {
    failureType: classified.failureType,
    retryable: classified.retryable,
    code: classified.code,
    attempts,
    maxAttempts: MAX_MESSAGE_ATTEMPTS,
  });

  // Log compliance events for specific error types
  const complianceEventType = classifyErrorToComplianceType(classified.code);
  if (complianceEventType) {
    await logComplianceEvent(supabase, {
      tenantId: msg.tenant_id,
      customerId: msg.customer_id || undefined,
      phone: msg.phone,
      eventType: complianceEventType,
      messageContent: msg.content,
      source: 'worker',
      errorCode: classified.code || undefined,
      errorMessage: classified.message,
      metadata: {
        campaign_id: msg.campaign_id,
        message_id: msg.id,
        attempts,
      },
    });
  }

  // Determine if we should retry
  const shouldRetry = classified.retryable && attempts < MAX_MESSAGE_ATTEMPTS;

  if (shouldRetry) {
    // Schedule retry with exponential backoff
    const backoffMs = calculateRetryDelay(attempts, RETRY_BASE_DELAY_MS);
    const scheduledAt = new Date(Date.now() + backoffMs).toISOString();
    
    await supabase
      .from('sms_messages')
      .update({
        status: 'queued',
        scheduled_at: scheduledAt,
        error_message: truncateError(classified.message),
        error_code: classified.code,
        failure_type: classified.failureType,
        updated_at: now,
      })
      .eq('id', msg.id);

    console.log(`[sms-queue-worker] Message ${msg.id} scheduled for retry at ${scheduledAt}`);
    return { retryScheduled: true, failureType: classified.failureType };
  } else {
    // Permanent failure - dead letter
    await supabase
      .from('sms_messages')
      .update({
        status: 'failed',
        error_message: truncateError(classified.message),
        error_code: classified.code,
        failure_type: classified.failureType,
        dead_lettered_at: now,
        updated_at: now,
      })
      .eq('id', msg.id);

    console.log(`[sms-queue-worker] Message ${msg.id} dead-lettered: ${classified.failureType}`);
    return { retryScheduled: false, failureType: classified.failureType };
  }
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
    jobsRequeued: 0,
    jobsClaimStolen: 0,
    messagesSent: 0,
    messagesFailed: 0,
    messagesSkipped: 0,
    messagesRetryScheduled: 0,
    messagesDeadLettered: 0,
    messagesBilled: 0,
    totalBilledUnits: 0,
    legacyMessagesProcessed: 0,
    campaignsUpdated: 0,
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[sms-queue-worker] Starting. Worker=${WORKER_ID}, ClaimToken=${claimToken.slice(0, 8)}...`);

    // Get Twilio configuration
    const twilioConfig: TwilioConfig = {
      accountSid: Deno.env.get('TWILIO_ACCOUNT_SID') ?? '',
      authToken: Deno.env.get('TWILIO_AUTH_TOKEN') ?? '',
      phoneNumber: Deno.env.get('TWILIO_PHONE_NUMBER') ?? '',
      messagingServiceSid: Deno.env.get('TWILIO_MESSAGING_SERVICE_SID'),
      statusCallbackUrl: 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/twilio-status-callback',
    };

    if (!twilioConfig.accountSid || !twilioConfig.authToken) {
      throw new Error('Missing Twilio configuration');
    }

    // =========================================================================
    // PHASE 1: Atomically Claim Jobs
    // =========================================================================
    console.log('[sms-queue-worker] PHASE 1: Claiming jobs atomically...');

    const claimedJobs = await claimSmsSendJobsSafe(supabase, MAX_JOBS_PER_RUN, WORKER_ID, claimToken);
    stats.jobsClaimed = claimedJobs.length;

    console.log(`[sms-queue-worker] Claimed ${claimedJobs.length} jobs`);

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

        // Load messages by IDs - include billing and retry fields
        const { data: messages, error: msgFetchError } = await supabase
          .from('sms_messages')
          .select('id, tenant_id, phone, content, media_urls, from_phone, campaign_id, customer_id, status, twilio_sid, billable_units, billed_at, attempts, scheduled_at, dead_lettered_at')
          .in('id', job.recipient_message_ids);

        if (msgFetchError) {
          console.error(`[sms-queue-worker] Failed to load messages for job ${job.id}:`, msgFetchError);
          const updated = await updateJobWithGuard(supabase, job.id, claimToken, {
            status: 'failed',
            errorMessage: truncateError(msgFetchError.message),
          });
          if (updated) {
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
        let jobRetryScheduled = 0;

        // Process each message with idempotency check
        for (const msg of jobMessages) {
          // Check if message should be skipped
          const now = new Date().toISOString();
          
          // CRITICAL IDEMPOTENCY CHECK: skip if already sent or has twilio_sid
          if (msg.status !== 'queued' || msg.twilio_sid) {
            console.log(`[sms-queue-worker] Skipping message ${msg.id}: status=${msg.status}, sid=${msg.twilio_sid ? 'present' : 'null'}`);
            jobSkipped++;
            stats.messagesSkipped++;
            continue;
          }

          // Skip if dead-lettered
          if (msg.dead_lettered_at) {
            console.log(`[sms-queue-worker] Skipping dead-lettered message ${msg.id}`);
            jobSkipped++;
            stats.messagesSkipped++;
            continue;
          }

          // Skip if scheduled for later
          if (msg.scheduled_at && new Date(msg.scheduled_at) > new Date()) {
            console.log(`[sms-queue-worker] Skipping scheduled message ${msg.id}, scheduled for ${msg.scheduled_at}`);
            jobRetryScheduled++;
            stats.messagesRetryScheduled++;
            continue;
          }

          // Increment attempts
          const currentAttempts = (msg.attempts || 0) + 1;
          await supabase
            .from('sms_messages')
            .update({
              attempts: currentAttempts,
              last_attempt_at: now,
              updated_at: now,
            })
            .eq('id', msg.id);

          // Send via Twilio
          const formattedPhone = formatPhoneForTwilio(msg.phone);
          const result = await sendSMSViaTwilio(twilioConfig, formattedPhone, msg.content, {
            messagingServiceSid: job.messaging_service_sid,
            fromPhone: msg.from_phone || job.from_phone,
            mediaUrls: msg.media_urls,
          });

          if (result.success) {
            // Update message as sent (with idempotent billed_at)
            await supabase
              .from('sms_messages')
              .update({
                status: 'sent',
                twilio_sid: result.sid,
                sent_at: now,
                billed_at: msg.billed_at ? undefined : now,
                error_message: null,
                error_code: null,
                failure_type: null,
                updated_at: now,
              })
              .eq('id', msg.id)
              .is('twilio_sid', null);

            console.log(`[sms-queue-worker] Message ${msg.id} sent: SID=${result.sid}`);
            jobSent++;
            stats.messagesSent++;

            // Bill the message if not already billed
            if (!msg.billed_at) {
              const billableUnits = msg.billable_units || 1;
              const tenantId = msg.tenant_id || job.tenant_id;
              
              if (tenantId) {
                const billed = await billMessage(supabase, tenantId, msg.id, billableUnits);
                if (billed) {
                  stats.messagesBilled++;
                  stats.totalBilledUnits += billableUnits;
                  console.log(`[sms-queue-worker] Billed message ${msg.id}: ${billableUnits} units`);
                }
              }
            }
          } else {
            // Handle failure with retry policy and compliance logging
            const failureResult = await handleMessageFailure(
              supabase,
              msg,
              currentAttempts,
              result.rawError || result.error
            );

            if (failureResult.retryScheduled) {
              jobRetryScheduled++;
              stats.messagesRetryScheduled++;
            } else {
              jobFailed++;
              stats.messagesFailed++;
              stats.messagesDeadLettered++;
            }
          }

          // Rate limit delay
          await rateLimitDelay();
        }

        // Determine job status
        // If any messages are scheduled for retry, put job back to pending
        if (jobRetryScheduled > 0) {
          const updated = await updateJobWithGuard(supabase, job.id, claimToken, {
            status: 'pending',
            errorMessage: null,
            clearClaim: true,
          });

          if (updated) {
            stats.jobsRequeued++;
            console.log(`[sms-queue-worker] Job ${job.id} requeued: ${jobRetryScheduled} messages scheduled for retry`);
          } else {
            stats.jobsClaimStolen++;
          }
        } else {
          // All messages are in terminal state
          const jobStatus = (jobSent > 0 || jobSkipped === jobMessages.length) ? 'completed' : 'failed';
          const jobErrorMessage = jobStatus === 'failed'
            ? `All ${jobFailed} messages failed.`
            : null;

          const updated = await updateJobWithGuard(supabase, job.id, claimToken, {
            status: jobStatus,
            errorMessage: jobErrorMessage,
          });

          if (updated) {
            if (jobStatus === 'completed') {
              stats.jobsCompleted++;
              console.log(`[sms-queue-worker] Job ${job.id} completed: ${jobSent} sent, ${jobFailed} failed, ${jobSkipped} skipped`);
            } else {
              stats.jobsFailed++;
            }
          } else {
            stats.jobsClaimStolen++;
          }
        }
      }
    }

    // =========================================================================
    // PHASE 3: Update Campaign Statuses
    // =========================================================================
    if (touchedCampaignIds.size > 0) {
      console.log(`[sms-queue-worker] PHASE 3: Updating ${touchedCampaignIds.size} campaign(s)...`);

      for (const campaignId of touchedCampaignIds) {
        const { data: campaignJobs } = await supabase
          .from('sms_send_jobs')
          .select('id, status')
          .eq('campaign_id', campaignId);

        const allJobs = campaignJobs || [];
        const completedJobs = allJobs.filter((j: { status: string }) => j.status === 'completed');
        const failedJobs = allJobs.filter((j: { status: string }) => j.status === 'failed');
        const pendingOrInProgress = allJobs.filter((j: { status: string }) => j.status === 'pending' || j.status === 'in_progress');

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
          newCampaignStatus = 'sent';
        }

        if (newCampaignStatus) {
          const { data: campaign } = await supabase
            .from('crm_sms_campaigns')
            .select('metrics')
            .eq('id', campaignId)
            .single();

          const { data: messageStats } = await supabase
            .from('sms_messages')
            .select('status, billable_units')
            .eq('campaign_id', campaignId);

          const msgs = messageStats || [];
          const sentCount = msgs.filter((m: { status: string }) => m.status === 'sent' || m.status === 'delivered').length;
          const failedCount = msgs.filter((m: { status: string }) => m.status === 'failed').length;
          const deliveredCount = msgs.filter((m: { status: string }) => m.status === 'delivered').length;
          const totalBilledUnits = msgs.reduce((sum: number, m: { billable_units: number | null }) => 
            sum + (m.billable_units || 1), 0
          );

          const metrics = {
            ...(campaign?.metrics || {}),
            messages_sent: sentCount,
            delivered: deliveredCount,
            failed: failedCount,
            total_billed_units: totalBilledUnits,
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
          console.log(`[sms-queue-worker] Campaign ${campaignId} updated to: ${newCampaignStatus}`);
        }
      }
    }

    // =========================================================================
    // PHASE 4: Process Legacy Queued Messages (Automation Path)
    // =========================================================================
    console.log('[sms-queue-worker] PHASE 4: Processing legacy queued messages...');

    const now = new Date().toISOString();
    const { data: legacyMessages, error: legacyFetchError } = await supabase
      .from('sms_messages')
      .select('id, tenant_id, phone, content, media_urls, from_phone, campaign_id, customer_id, status, twilio_sid, billable_units, billed_at, attempts, scheduled_at, dead_lettered_at')
      .eq('status', 'queued')
      .is('twilio_sid', null)
      .is('dead_lettered_at', null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .limit(MAX_LEGACY_MESSAGES_PER_RUN);

    if (legacyFetchError) {
      console.error('[sms-queue-worker] Error fetching legacy messages:', legacyFetchError);
    } else {
      const orphanMessages: SmsMessage[] = legacyMessages || [];
      console.log(`[sms-queue-worker] Found ${orphanMessages.length} legacy queued messages`);

      for (const msg of orphanMessages) {
        if (msg.status !== 'queued' || msg.twilio_sid) {
          continue;
        }

        stats.legacyMessagesProcessed++;

        // Increment attempts
        const currentAttempts = (msg.attempts || 0) + 1;
        await supabase
          .from('sms_messages')
          .update({
            attempts: currentAttempts,
            last_attempt_at: now,
            updated_at: now,
          })
          .eq('id', msg.id);

        const formattedPhone = formatPhoneForTwilio(msg.phone);
        const result = await sendSMSViaTwilio(twilioConfig, formattedPhone, msg.content, {
          messagingServiceSid: twilioConfig.messagingServiceSid,
          fromPhone: msg.from_phone,
          mediaUrls: msg.media_urls,
        });

        if (result.success) {
          await supabase
            .from('sms_messages')
            .update({
              status: 'sent',
              twilio_sid: result.sid,
              sent_at: now,
              billed_at: msg.billed_at ? undefined : now,
              error_message: null,
              error_code: null,
              failure_type: null,
              updated_at: now,
            })
            .eq('id', msg.id);

          console.log(`[sms-queue-worker] Legacy message ${msg.id} sent: SID=${result.sid}`);
          stats.messagesSent++;

          // Bill legacy messages too
          if (!msg.billed_at && msg.tenant_id) {
            const billableUnits = msg.billable_units || 1;
            const billed = await billMessage(supabase, msg.tenant_id, msg.id, billableUnits);
            if (billed) {
              stats.messagesBilled++;
              stats.totalBilledUnits += billableUnits;
            }
          }
        } else {
          // Handle failure with retry policy and compliance logging
          const failureResult = await handleMessageFailure(
            supabase,
            msg,
            currentAttempts,
            result.rawError || result.error
          );

          if (failureResult.retryScheduled) {
            stats.messagesRetryScheduled++;
          } else {
            stats.messagesFailed++;
            stats.messagesDeadLettered++;
          }
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
      message: `Worker ${WORKER_ID}: Sent ${stats.messagesSent}, retries ${stats.messagesRetryScheduled}, dead-lettered ${stats.messagesDeadLettered}, billed ${stats.totalBilledUnits} units`,
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
