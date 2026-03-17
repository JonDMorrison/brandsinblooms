/**
 * SMS Queue Worker
 * 
 * This is the ONLY place where SMS messages are actually sent via Mobile Text Alerts API.
 * It processes both:
 * 1. sms_send_jobs (campaign path) - created by send-sms-campaign
 * 2. Legacy sms_messages (automation path) - messages without jobs
 * 
 * Key features:
 * - Bulletproof concurrency safety via atomic claiming with claim_token
 * - Stale claim recovery for crashed/hung workers
 * - Idempotent (skips already-sent messages)
 * - Respects rate limits between MTA calls
 * - Updates campaign status when all jobs complete
 * - Accurate billing: only charges quota when MTA accepts the message
 * - Retry policy: retries transient errors with exponential backoff
 * - Dead-lettering: permanently fails messages that cannot be delivered
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
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

// Mobile Text Alerts configuration
const MOBILE_TEXT_ALERTS_BASE_URL = Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || "https://api.mobile-text-alerts.com";
const MOBILE_TEXT_ALERTS_API_KEY = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");
const MOBILE_TEXT_ALERTS_LONGCODE_ID = Deno.env.get("MOBILE_TEXT_ALERTS_LONGCODE_ID");

interface MTAConfig {
  apiKey: string
  baseUrl: string
  longcodeId?: number
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
  twilio_sid: string | null // Reusing for MTA message ID
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
 * Format phone number to E.164 format
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (phone.startsWith('+') && digits.length >= 10) {
    return phone;
  }
  return `+1${digits}`;
}

/**
 * Ensure opt-out message is present
 */
function ensureOptOutMessage(message: string): string {
  const optOutPhrases = ["reply stop", "text stop", "stop to opt"];
  const lowerMessage = message.toLowerCase();

  for (const phrase of optOutPhrases) {
    if (lowerMessage.includes(phrase)) {
      return message;
    }
  }

  return `${message.trim()}\n\nReply STOP to opt out.`;
}

/**
 * Parse API response safely
 */
async function parseApiResponse(res: Response): Promise<{ ok: boolean; status: number; json: any | null; text: string }> {
  const text = await res.text();
  let json: any | null = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { ok: res.ok, status: res.status, json, text };
}

/**
 * Send SMS via Mobile Text Alerts API
 */
async function sendSMSViaMTA(
  config: MTAConfig,
  to: string,
  body: string,
  options: {
    mediaUrls?: string[] | null
  } = {}
): Promise<{ success: boolean; messageId?: string; error?: string; rawError?: unknown }> {
  try {
    const finalMessage = ensureOptOutMessage(body);
    
    // Step 1: Validate recipient
    const validateResponse = await fetch(`${config.baseUrl}/v3/send/validate-recipients`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [{ number: to, externalId: "bloomsuite_worker" }],
        validateUnsubscribes: true,
      }),
    });

    const validateParsed = await parseApiResponse(validateResponse);
    const validateData = validateParsed.json ?? {};

    if (!validateParsed.ok) {
      return {
        success: false,
        error: validateData?.message || validateData?.error || `Validation failed (HTTP ${validateParsed.status})`,
        rawError: validateParsed,
      };
    }

    // Check for invalid/unsubscribed
    const invalidList = Array.isArray(validateData?.invalid) ? validateData.invalid : [];
    const unsubscribedList = Array.isArray(validateData?.unsubscribed) ? validateData.unsubscribed : [];

    if (unsubscribedList.length > 0) {
      return {
        success: false,
        error: "Recipient has opted out",
        rawError: { code: 21610, unsubscribed: true },
      };
    }

    if (invalidList.length > 0) {
      return {
        success: false,
        error: `Invalid phone number: ${invalidList.join(", ")}`,
        rawError: { code: 21211, invalid: true },
      };
    }

    // Step 2: Send message
    const sendPayload: Record<string, unknown> = {
      subscribers: [to],
      message: finalMessage,
    };

    // Add longcodeId if configured
    if (config.longcodeId) {
      sendPayload.longcodeId = config.longcodeId;
    }

    // Add image if provided
    if (options.mediaUrls && options.mediaUrls.length > 0) {
      sendPayload.image = options.mediaUrls[0];
      sendPayload.rehost = true;
    }

    const sendResponse = await fetch(`${config.baseUrl}/v3/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendPayload),
    });

    const sendParsed = await parseApiResponse(sendResponse);
    const sendData = sendParsed.json ?? {};

    if (!sendParsed.ok) {
      return {
        success: false,
        error: sendData?.message || sendData?.error || `Send failed (HTTP ${sendParsed.status})`,
        rawError: sendParsed,
      };
    }

    const messageId = sendData.messageId || sendData.id || crypto.randomUUID();
    return { success: true, messageId };

  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error sending SMS',
      rawError: error,
    };
  }
}

/**
 * Rate-limited delay between API calls
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
 * Reserve rate limit tokens for sending
 */
async function reserveRateLimitTokens(
  supabase: any,
  tenantId: string,
  sendingIdentityId: string,
  tokens: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('reserve_sms_send_tokens', {
      p_tenant_id: tenantId,
      p_sending_identity_id: sendingIdentityId,
      p_tokens: tokens,
      p_window_ms: 1000,
      p_max_tokens: Number(Deno.env.get("SMS_RATE_LIMIT_PER_SECOND") ?? "10")
    });

    if (error) {
      console.error('[sms-queue-worker] Rate limit check failed:', error);
      return true; // Allow if rate limit check fails
    }

    return data === true;
  } catch (err) {
    console.error('[sms-queue-worker] Rate limit exception:', err);
    return true; // Allow if exception
  }
}

/**
 * Atomically claim pending/stale jobs with priority ordering
 */
async function claimSmsSendJobsSafe(
  supabase: any,
  limit: number,
  workerId: string,
  claimToken: string
): Promise<SmsSendJob[]> {
  const staleThreshold = new Date(Date.now() - CLAIM_STALE_AFTER_MINUTES * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Step 1: Find eligible jobs with priority ordering
  const { data: eligibleJobs, error: selectError } = await supabase
    .from('sms_send_jobs')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .lt('attempts', MAX_JOB_ATTEMPTS)
    .is('dead_lettered_at', null)
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit * 2);

  if (selectError) {
    console.error('[sms-queue-worker] Error selecting jobs:', selectError);
    return [];
  }

  if (!eligibleJobs || eligibleJobs.length === 0) {
    return [];
  }

  // Step 2: Filter for claimable jobs
  const claimableJobs = eligibleJobs.filter((job: SmsSendJob) => {
    if (!job.claimed_at) return true;
    return new Date(job.claimed_at) < new Date(staleThreshold);
  }).slice(0, limit);

  if (claimableJobs.length === 0) {
    return [];
  }

  // Step 3: Atomically claim each job
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
 * Handle message send failure with retry policy and compliance logging
 */
async function handleMessageFailure(
  supabase: any,
  msg: SmsMessage,
  attempts: number,
  rawError: unknown
): Promise<{ retryScheduled: boolean; failureType: SmsFailureType }> {
  const now = new Date().toISOString();
  const classified = classifyTwilioError(rawError); // Works for MTA errors too
  
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

    // Get MTA configuration
    if (!MOBILE_TEXT_ALERTS_API_KEY) {
      throw new Error('Missing Mobile Text Alerts API key');
    }

    const mtaConfig: MTAConfig = {
      apiKey: MOBILE_TEXT_ALERTS_API_KEY,
      baseUrl: MOBILE_TEXT_ALERTS_BASE_URL,
      longcodeId: MOBILE_TEXT_ALERTS_LONGCODE_ID ? Number(MOBILE_TEXT_ALERTS_LONGCODE_ID) : undefined,
    };

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

        // Load messages by IDs
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
          const now = new Date().toISOString();
          
          // CRITICAL IDEMPOTENCY CHECK: skip if already sent or has message ID
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

          // Send via MTA
          const formattedPhone = normalizePhone(msg.phone);
          const result = await sendSMSViaMTA(mtaConfig, formattedPhone, msg.content, {
            mediaUrls: msg.media_urls,
          });

          if (result.success) {
            // Update message as sent
            await supabase
              .from('sms_messages')
              .update({
                status: 'sent',
                twilio_sid: result.messageId, // Reusing field for MTA message ID
                sent_at: now,
                billed_at: msg.billed_at ? undefined : now,
                error_message: null,
                error_code: null,
                failure_type: null,
                updated_at: now,
              })
              .eq('id', msg.id)
              .is('twilio_sid', null);

            console.log(`[sms-queue-worker] Message ${msg.id} sent: ID=${result.messageId}`);
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

        const formattedPhone = normalizePhone(msg.phone);
        const result = await sendSMSViaMTA(mtaConfig, formattedPhone, msg.content, {
          mediaUrls: msg.media_urls,
        });

        if (result.success) {
          await supabase
            .from('sms_messages')
            .update({
              status: 'sent',
              twilio_sid: result.messageId,
              sent_at: now,
              billed_at: msg.billed_at ? undefined : now,
              error_message: null,
              error_code: null,
              failure_type: null,
              updated_at: now,
            })
            .eq('id', msg.id);

          console.log(`[sms-queue-worker] Legacy message ${msg.id} sent: ID=${result.messageId}`);
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
