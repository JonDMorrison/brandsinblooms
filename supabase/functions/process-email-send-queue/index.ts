import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "../_shared/mergeTagEngine.ts";
import { extractLinks, getUniqueUrls, rewriteLinksSync, hasPII } from "../_shared/linkRewriter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_JOBS_PER_INVOCATION = 10;
const SEND_CONCURRENCY = 10;
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_DELAY_MS = 500;
const DEFAULT_MESSAGE_STALE_MINUTES = 15;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitErrorMessage(message: string | null | undefined): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('too many requests') || m.includes('rate limit') || m.includes('429');
}

function createFixedWindowRateLimiter(requestsPerSecond: number) {
  // Enforces a minimum spacing between requests across concurrent async tasks.
  // Not perfectly fair, but good enough to avoid hammering provider rate limits.
  const rps = Math.max(0.1, Number.isFinite(requestsPerSecond) ? requestsPerSecond : 2);
  const minIntervalMs = Math.ceil(1000 / rps);
  let nextAt = Date.now();
  let chain: Promise<void> = Promise.resolve();

  return {
    async acquire() {
      const start = chain;
      let release: (() => void) | null = null;
      chain = new Promise<void>((resolve) => {
        release = resolve;
      });
      await start;

      const now = Date.now();
      const waitMs = Math.max(0, nextAt - now);
      nextAt = Math.max(nextAt, now) + minIntervalMs;
      if (waitMs > 0) await sleep(waitMs);
      release?.();
    },
    minIntervalMs,
  };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Strip ALL existing footer HTML from content to prevent double footers.
 * Kept in-sync with send-email-campaign.
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;

  const footerWrapperPattern = /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  if (footerWrapperPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(footerWrapperPattern, '');
  }

  const unsubscribeFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (unsubscribeFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, '');
  }

  const socialIconsFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (socialIconsFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(socialIconsFooterPattern, '');
  }

  const legacyGreenFooterPattern = /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (legacyGreenFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(legacyGreenFooterPattern, '');
  }

  const finalCleanupPattern = /<div[^>]*style="[^"]*background-color[^\"]*width:\s*100%[^\"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/div>)*\s*(<\/body>|<\/html>|$))/gi;
  strippedHtml = strippedHtml.replace(finalCleanupPattern, '');

  return strippedHtml;
}

function buildEmailPayloadOptimized(
  customer: any,
  campaign: any,
  companyProfile: any,
  profileData: CompanyProfileData,
  fromAddress: string,
  senderEmail: string,
  usesVerifiedDomain: boolean,
  activeDomainId: string | null,
  sharedFooterTemplate: string,
  replyToEmail?: string,
): any {
  const companyName = companyProfile?.company_name || 'Your Garden Center';

  const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
  const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;
  const preferencesLink = unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences');

  const customerFooter = sharedFooterTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeLink)
    .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesLink);

  const mergeTagData: MergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: companyName,
    address: companyProfile?.location_info,
    website_url: companyProfile?.custom_sender_email?.split('@')[1],
  });

  mergeTagData.system = {
    unsubscribe_url: unsubscribeLink,
    preferences_url: preferencesLink,
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString(),
  };

  let emailContent = convertLegacyTags(campaign.content || '');
  let emailSubject = convertLegacyTags(campaign.subject_line || 'Newsletter from your Garden Center');

  emailContent = renderMergeTags(emailContent, mergeTagData);
  emailSubject = renderMergeTags(emailSubject, mergeTagData);

  emailContent = stripExistingFooter(emailContent);
  if (emailContent.includes('</body>')) {
    emailContent = emailContent.replace('</body>', `${customerFooter}</body>`);
  } else if (emailContent.includes('</html>')) {
    emailContent = emailContent.replace('</html>', `${customerFooter}</html>`);
  } else {
    emailContent += customerFooter;
  }

  const emailPayload: any = {
    from: fromAddress,
    to: [customer.email],
    subject: emailSubject,
    html: emailContent,
    headers: {
      'X-Campaign-ID': campaign.id,
      'X-Campaign-Type': 'bulk',
      'X-Tenant-ID': campaign.tenant_id,
      'X-Domain-ID': activeDomainId || 'fallback',
    },
    tags: [
      { name: 'campaign_id', value: campaign.id },
      { name: 'type', value: 'bulk' },
      { name: 'tenant_id', value: campaign.tenant_id },
    ],
  };

  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.app') {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

function truncateError(message: string, maxLength: number = 500): string {
  if (!message) return '';
  return message.length > maxLength ? message.slice(0, maxLength) : message;
}

async function resendSendEmail(
  apiKey: string,
  payload: any,
  idempotencyKey: string,
  limiter?: { acquire: () => Promise<void> },
): Promise<{ id?: string; error?: string; status?: number }> {
  try {
    const maxRateLimitRetries = 3;
    let lastError: string | undefined;
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt < maxRateLimitRetries; attempt++) {
      if (limiter) await limiter.acquire();

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      lastStatus = res.status;

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message || json?.error || res.statusText || 'Resend API error';
        lastError = truncateError(String(msg));

        // Rate limit: backoff and retry (do not consume message attempts aggressively)
        if (res.status === 429 || isRateLimitErrorMessage(lastError)) {
          const retryAfterHeader = res.headers.get('retry-after');
          const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
          const backoffMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(250, retryAfterSeconds * 1000)
            : 750 * (attempt + 1);
          await sleep(backoffMs);
          continue;
        }

        return { error: lastError, status: lastStatus };
      }

      const id = json?.id || json?.data?.id;
      if (!id) return { error: 'Resend returned no message id', status: lastStatus };
      return { id, status: lastStatus };
    }

    return { error: lastError || 'Rate limited', status: lastStatus };
  } catch (e: any) {
    return { error: truncateError(e?.message || 'Network error calling Resend') };
  }
}

async function sha256Base64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  const b64 = btoa(String.fromCharCode(...arr));
  // base64url
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function resendSendBatch(
  apiKey: string,
  payloads: any[],
  batchIdempotencyKeySeed: string,
  limiter?: { acquire: () => Promise<void> },
): Promise<{ ids?: Array<{ id: string }>; error?: string; status?: number }> {
  try {
    const maxRateLimitRetries = 3;
    let lastError: string | undefined;
    let lastStatus: number | undefined;

    // Idempotency key is per API request (batch), not per email.
    const idem = await sha256Base64Url(batchIdempotencyKeySeed);
    const idempotencyKey = `batch_${idem}`.slice(0, 256);

    for (let attempt = 0; attempt < maxRateLimitRetries; attempt++) {
      if (limiter) await limiter.acquire();

      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payloads),
      });

      lastStatus = res.status;
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || json?.error || res.statusText || 'Resend API error';
        lastError = truncateError(String(msg));

        if (res.status === 429 || isRateLimitErrorMessage(lastError)) {
          const retryAfterHeader = res.headers.get('retry-after');
          const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
          const backoffMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(250, retryAfterSeconds * 1000)
            : 750 * (attempt + 1);
          await sleep(backoffMs);
          continue;
        }

        return { error: lastError, status: lastStatus };
      }

      const data = json?.data;
      if (!Array.isArray(data)) {
        return { error: 'Resend batch response missing data array', status: lastStatus };
      }

      return { ids: data as Array<{ id: string }>, status: lastStatus };
    }

    return { error: lastError || 'Rate limited', status: lastStatus };
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
  const resendRps = parseFloat(Deno.env.get('RESEND_RATE_LIMIT_RPS') || '2');
  const resendLimiter = createFixedWindowRateLimiter(resendRps);
  const resendBatchSize = Math.max(1, Math.min(100, parseInt(Deno.env.get('RESEND_BATCH_SIZE') || '50', 10) || 50));
  const workerId = Deno.env.get('WORKER_ID') || `email-queue-worker-${crypto.randomUUID()}`;
  const claimToken = crypto.randomUUID();

  console.log(
    `⚙️ Resend settings: batch_size=${resendBatchSize} (env RESEND_BATCH_SIZE), rps=${resendRps} (env RESEND_RATE_LIMIT_RPS), min_interval_ms=${resendLimiter.minIntervalMs}`
  );
  console.log(
    `⚙️ Worker settings: send_concurrency=${sendConcurrency} (env EMAIL_SEND_CONCURRENCY), batch_delay_ms=${batchDelayMs} (env EMAIL_BATCH_DELAY_MS), stale_minutes=${messageStaleMinutes}`
  );

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
      // Before returning, check for stuck campaigns (status='sending' but all jobs completed)
      const { data: stuckCampaigns } = await supabase
        .from('crm_campaigns')
        .select('id')
        .eq('status', 'sending')
        .lt('sending_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .limit(5);

      let finalized = 0;
      for (const sc of stuckCampaigns || []) {
        const { data: pendingJobs } = await supabase
          .from('email_send_jobs')
          .select('id')
          .eq('campaign_id', sc.id)
          .in('status', ['pending', 'processing'])
          .limit(1);

        if (pendingJobs && pendingJobs.length > 0) continue;

        const { data: allJobs } = await supabase
          .from('email_send_jobs')
          .select('emails_sent, emails_failed')
          .eq('campaign_id', sc.id);

        const totalSent = (allJobs || []).reduce((s: number, j: any) => s + (j.emails_sent || 0), 0);
        const totalFailed = (allJobs || []).reduce((s: number, j: any) => s + (j.emails_failed || 0), 0);

        await supabase
          .from('crm_campaigns')
          .update({
            status: totalFailed > 0 ? 'sent_with_errors' : 'sent',
            total_sent: totalSent,
            sent_at: new Date().toISOString(),
            sending_started_at: null,
            claim_token: null,
            metrics: { sent: totalSent, failed: totalFailed, opens: 0, clicks: 0, unsubscribes: 0 },
          })
          .eq('id', sc.id);

        console.log(`🔧 Auto-finalized stuck campaign ${sc.id}: ${totalSent} sent, ${totalFailed} failed`);
        finalized++;
      }

      console.log(`✅ No pending jobs to process${finalized > 0 ? ` (finalized ${finalized} stuck campaigns)` : ''}`);
      return new Response(
        JSON.stringify({ processed: 0, finalized, message: 'No pending jobs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Processing ${jobs.length} claimed email send jobs (batch delay: ${batchDelayMs}ms)...`);

    let processedCount = 0;
    let totalEmailsSent = 0;
    let totalEmailsFailed = 0;
    const failedCampaigns = new Set<string>();

    const campaignCache = new Map<string, any>();
    const companyProfileCache = new Map<string, any>();
    const profileDataCache = new Map<string, CompanyProfileData>();
    const footerTemplateCache = new Map<string, string>();
    const trackedLinkMapCache = new Map<string, Map<string, string>>();
    const replyToCache = new Map<string, string | undefined>();

    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      const job = jobs[jobIndex] as any;
      const jobStartTime = Date.now();

      // Check if we're approaching timeout (leave 10s buffer)
      if (Date.now() - startTime > 50000) {
        console.log('⏱️ Approaching timeout, stopping processing');
        break;
      }

      try {
        let messageIds: string[] = Array.isArray(job.recipient_message_ids) ? job.recipient_message_ids : [];

        // Backfill message IDs when jobs were queued with recipient_emails only.
        if (messageIds.length === 0) {
          const recipientEmails: any[] = Array.isArray(job.recipient_emails) ? job.recipient_emails : [];
          const uuidLike = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

          const customerIds = recipientEmails
            .map((r: any) => r?.customerId)
            .filter((v: any) => typeof v === 'string' && uuidLike(v));

          if (customerIds.length > 0) {
            const ids: string[] = [];
            const IN_CHUNK = 200;
            for (let i = 0; i < customerIds.length; i += IN_CHUNK) {
              const chunk = customerIds.slice(i, i + IN_CHUNK);
              const { data: rows, error: fetchErr } = await supabase
                .from('email_messages')
                .select('id')
                .eq('campaign_id', job.campaign_id)
                .in('customer_id', chunk);

              if (fetchErr) {
                console.warn(`⚠️ Failed to resolve message ids for job ${job.id}:`, fetchErr.message);
                break;
              }
              (rows || []).forEach((r: any) => {
                if (typeof r?.id === 'string') ids.push(r.id);
              });
            }

            messageIds = ids;

            // Cache resolved ids back on the job to avoid repeating this work.
            if (messageIds.length > 0) {
              await supabase
                .from('email_send_jobs')
                .update({ recipient_message_ids: messageIds, updated_at: new Date().toISOString() })
                .eq('id', job.id)
                .eq('claim_token', claimToken);
            }
          }
        }

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
          if (m.status === 'queued' || m.status === 'paused') {
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
            claimQuery = claimQuery.eq('status', m.status === 'paused' ? 'paused' : 'queued');
          }

          const { data: claimed, error: claimMsgErr } = await claimQuery
            .select('id, payload, attempts, tenant_id, domain_id, campaign_id, customer_id, email')
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

        const needsPayloadBuild = claimedForSend.some((m: any) => {
          const payload = m?.payload;
          return !payload || typeof payload !== 'object' || !payload?.html || !payload?.subject || !payload?.to;
        });

        // Preload campaign + company profile + tracked links once per campaign to build payloads when needed.
        const campaignId: string = String(job.campaign_id || claimedForSend[0]?.campaign_id || messages?.[0]?.campaign_id || '');

        let campaign: any = null;
        let companyProfile: any = null;
        let profileData: CompanyProfileData | null = null;
        let sharedFooterTemplate: string | null = null;
        let senderEmail: string = 'noreply@bloomsuite.app';
        let senderDisplayName: string = 'Your Garden Center';
        let usesVerifiedDomain = false;
        let activeDomainId: string | null = null;
        let replyToEmail: string | undefined;
        let urlToLinkIdMap: Map<string, string> | null = null;

        const customersById = new Map<string, any>();

        if (needsPayloadBuild && campaignId) {
          if (!campaignCache.has(campaignId)) {
            const { data: cRow, error: cErr } = await supabase
              .from('crm_campaigns')
              .select('id, tenant_id, user_id, content, subject_line, from_email_domain_id, actual_sender_email, sender_display_name, delivery_method')
              .eq('id', campaignId)
              .maybeSingle();
            if (cErr) console.warn('⚠️ Failed to load campaign for payload build:', cErr.message);
            if (cRow) campaignCache.set(campaignId, cRow);
          }

          campaign = campaignCache.get(campaignId) || null;

          if (campaign?.user_id) {
            const userId = String(campaign.user_id);
            if (!companyProfileCache.has(userId)) {
              const { data: pRow, error: pErr } = await supabase
                .from('company_profiles')
                .select(`
                  email_auth_status, custom_sender_email, company_name, location_info,
                  street_address, city, state_province, postal_code, country,
                  website_url, company_email, company_phone,
                  facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
                  footer_legal_text, brand_primary_color, brand_text_color, feature_flags
                `)
                .eq('user_id', userId)
                .maybeSingle();
              if (pErr) console.warn('⚠️ Failed to load company profile for payload build:', pErr.message);
              if (pRow) companyProfileCache.set(userId, pRow);
            }
            companyProfile = companyProfileCache.get(userId) || null;
          }

          if (campaign && companyProfile) {
            if (!profileDataCache.has(campaignId)) {
              const pd: CompanyProfileData = {
                company_name: companyProfile?.company_name,
                company_email: companyProfile?.company_email,
                company_phone: companyProfile?.company_phone,
                website_url: companyProfile?.website_url,
                street_address: companyProfile?.street_address,
                city: companyProfile?.city,
                state_province: companyProfile?.state_province,
                postal_code: companyProfile?.postal_code,
                country: companyProfile?.country,
                facebook_url: companyProfile?.facebook_url,
                instagram_url: companyProfile?.instagram_url,
                tiktok_url: companyProfile?.tiktok_url,
                pinterest_url: companyProfile?.pinterest_url,
                youtube_url: companyProfile?.youtube_url,
                linkedin_url: companyProfile?.linkedin_url,
                footer_legal_text: companyProfile?.footer_legal_text,
                brand_primary_color: companyProfile?.brand_primary_color,
                brand_text_color: companyProfile?.brand_text_color,
                feature_flags: companyProfile?.feature_flags,
              };
              profileDataCache.set(campaignId, pd);
            }
            profileData = profileDataCache.get(campaignId) || null;

            if (!footerTemplateCache.has(campaignId) && profileData) {
              const footerTemplate = generateServerFooterHtml(profileData, '{{UNSUBSCRIBE_URL}}', '{{PREFERENCES_URL}}');
              footerTemplateCache.set(campaignId, footerTemplate);
            }
            sharedFooterTemplate = footerTemplateCache.get(campaignId) || null;

            senderEmail = campaign.actual_sender_email || 'noreply@bloomsuite.app';
            senderDisplayName = campaign.sender_display_name || companyProfile?.company_name || 'Your Garden Center';
            usesVerifiedDomain = campaign.delivery_method === 'custom_domain' && senderEmail !== 'noreply@bloomsuite.app';

            activeDomainId = campaign.from_email_domain_id || messages?.[0]?.domain_id || null;
            if (activeDomainId && !replyToCache.has(activeDomainId)) {
              const { data: dRow, error: dErr } = await supabase
                .from('email_domains')
                .select('default_reply_to')
                .eq('id', activeDomainId)
                .maybeSingle();
              if (dErr) console.warn('⚠️ Failed to load domain reply-to:', dErr.message);
              replyToCache.set(activeDomainId, dRow?.default_reply_to || undefined);
            }
            if (activeDomainId) replyToEmail = replyToCache.get(activeDomainId);

            if (!trackedLinkMapCache.has(campaignId)) {
              const map = new Map<string, string>();
              const { data: existingLinks, error: linksErr } = await supabase
                .from('tracked_links')
                .select('id, url')
                .eq('campaign_id', campaignId)
                .eq('tenant_id', campaign.tenant_id);
              if (linksErr) {
                console.warn('⚠️ Failed to load tracked_links:', linksErr.message);
              }
              (existingLinks || []).forEach((l: any) => {
                if (typeof l?.url === 'string' && typeof l?.id === 'string') map.set(l.url, l.id);
              });

              if (map.size === 0) {
                const extracted = extractLinks(campaign.content || '');
                const uniqueUrls = getUniqueUrls(extracted);
                const urlsToTrack = uniqueUrls.filter((u) => !hasPII(u));
                if (urlsToTrack.length > 0) {
                  const inserts = urlsToTrack.map((url) => ({ tenant_id: campaign.tenant_id, campaign_id: campaignId, url }));
                  const { data: inserted, error: upErr } = await supabase
                    .from('tracked_links')
                    .upsert(inserts, { onConflict: 'tenant_id,campaign_id,url', ignoreDuplicates: false })
                    .select('id, url');
                  if (upErr) {
                    console.warn('⚠️ Failed to upsert tracked_links:', upErr.message);
                  }
                  (inserted || []).forEach((l: any) => {
                    if (typeof l?.url === 'string' && typeof l?.id === 'string') map.set(l.url, l.id);
                  });
                }
              }

              trackedLinkMapCache.set(campaignId, map);
            }
            urlToLinkIdMap = trackedLinkMapCache.get(campaignId) || null;
          }
        }

        // Preload customer records for merge tags (only for messages we might send).
        if (needsPayloadBuild) {
          const customerIdsForJob = Array.from(new Set((sendable || []).map((m: any) => m?.customer_id)))
            .filter((v: any) => typeof v === 'string' && isUuidLike(v));
          if (customerIdsForJob.length > 0) {
            const tenantId = messages?.[0]?.tenant_id;
            const IN_CHUNK = 200;
            for (let i = 0; i < customerIdsForJob.length; i += IN_CHUNK) {
              const chunk = customerIdsForJob.slice(i, i + IN_CHUNK);
              let q = supabase
                .from('crm_customers')
                .select('id, email, first_name, last_name, phone, lifetime_value, total_spent, first_purchase_date, last_purchase_date, custom_fields');
              if (tenantId) q = q.eq('tenant_id', tenantId);
              const { data: custRows, error: custErr } = await q.in('id', chunk);
              if (custErr) {
                console.warn('⚠️ Failed to load crm_customers for payload build:', custErr.message);
                break;
              }
              (custRows || []).forEach((c: any) => {
                if (typeof c?.id === 'string') customersById.set(c.id, c);
              });
            }
          }
        }

        // Send claimed messages using Resend batch endpoint (up to 100 emails per request).
        // This avoids per-request rate limits (e.g. 2 req/sec) while still sending high volume.
        for (let i = 0; i < claimedForSend.length; i += resendBatchSize) {
          const batchMsgs = claimedForSend.slice(i, i + resendBatchSize);
          console.log(`📧 Sending ${batchMsgs.length} emails (batch request, size ${resendBatchSize})...`);

          // Build payloads (can be CPU-heavy; but we only do it for this batch)
          const payloads: any[] = [];
          const msgIds: string[] = [];
          const attemptsByMsgId = new Map<string, number>();
          const missingPayloadErrors: Array<{ msgId: string; attempts: number; error: string }> = [];

          for (const msg of batchMsgs) {
            let payload = msg.payload;
            const missing = !payload || typeof payload !== 'object' || !payload?.html || !payload?.subject || !payload?.to;

            if (missing && campaign && companyProfile && profileData && sharedFooterTemplate) {
              const fromAddress = `${senderDisplayName} <${senderEmail}>`;
              const customer = customersById.get(msg.customer_id) || { id: msg.customer_id, email: msg.email };
              payload = buildEmailPayloadOptimized(
                customer,
                campaign,
                companyProfile,
                profileData,
                fromAddress,
                senderEmail,
                usesVerifiedDomain,
                activeDomainId,
                sharedFooterTemplate,
                replyToEmail,
              );

              if (urlToLinkIdMap && urlToLinkIdMap.size > 0 && payload?.html) {
                const rewriteResult = rewriteLinksSync(
                  payload.html,
                  urlToLinkIdMap,
                  campaign.id,
                  customer.id,
                  campaign.tenant_id,
                  customer.email,
                );
                payload.html = rewriteResult.html;
              }
            }

            if (!payload || typeof payload !== 'object' || !payload?.html || !payload?.subject || !payload?.to) {
              missingPayloadErrors.push({ msgId: msg.id, attempts: msg.attempts || 1, error: 'Missing email payload and unable to build it' });
              continue;
            }

            payloads.push(payload);
            msgIds.push(msg.id);
            attemptsByMsgId.set(msg.id, msg.attempts || 1);
          }

          // If everything in the batch is missing payload, just treat as failures.
          const results: Array<{ msgId: string; attempts: number; resendId?: string; error?: string; status?: number }> = [];
          for (const m of missingPayloadErrors) {
            results.push({ msgId: m.msgId, attempts: m.attempts, error: m.error });
          }

          if (payloads.length > 0) {
            const idemSeed = `${job.id}:${campaignId}:${msgIds.join(',')}`;
            const batchResp = await resendSendBatch(resendApiKey, payloads, idemSeed, resendLimiter);

            if (batchResp.ids && batchResp.ids.length === payloads.length) {
              for (let k = 0; k < batchResp.ids.length; k++) {
                const msgId = msgIds[k];
                const resendId = batchResp.ids[k]?.id;
                results.push({
                  msgId,
                  attempts: attemptsByMsgId.get(msgId) || 1,
                  resendId,
                  error: resendId ? undefined : 'Resend batch returned missing id',
                  status: batchResp.status,
                });
              }
            } else {
              const err = batchResp.error || 'Resend batch failed';
              // Batch failure applies to all payloads in this request.
              for (const msgId of msgIds) {
                results.push({
                  msgId,
                  attempts: attemptsByMsgId.get(msgId) || 1,
                  error: err,
                  status: batchResp.status,
                });
              }
            }
          }

          // Apply results in bulk to avoid 1 PostgREST update per message (very slow at scale).
          const rpcResults = results.map((r) => {
            const errMsg = r.resendId ? null : truncateError(r.error || 'Send failed');
            const isRateLimited = !r.resendId && (r.status === 429 || isRateLimitErrorMessage(errMsg || ''));
            return {
              msg_id: r.msgId,
              resend_id: r.resendId || null,
              error_message: errMsg,
              attempts: r.attempts || 1,
              is_rate_limited: isRateLimited,
            };
          });

          const { data: applied, error: applyErr } = await supabase.rpc('apply_email_send_results', {
            p_claim_token: claimToken,
            p_results: rpcResults,
            p_max_attempts: MAX_ATTEMPTS,
          });

          if (applyErr) {
            console.warn('⚠️ Failed to apply send results in bulk:', applyErr.message);
            // Fallback: keep going, but counts will be best-effort.
          }

          const appliedRow = Array.isArray(applied) ? applied[0] : applied;
          const appliedSent = Number(appliedRow?.updated_sent || 0);
          const appliedFailed = Number(appliedRow?.updated_failed || 0);
          const appliedQueued = Number(appliedRow?.updated_queued || 0);
          emailsSent += appliedSent;
          emailsFailed += appliedFailed + appliedQueued;
          if (appliedFailed + appliedQueued > 0) {
            const last = results.find((r) => !r.resendId && r.error)?.error;
            lastError = truncateError(last || lastError || 'Send failed');
          }

          if (i + resendBatchSize < claimedForSend.length) {
            await sleep(batchDelayMs);
          }
        }

        // If any messages remain queued/sending, keep job pending for retry; otherwise complete.
        // IMPORTANT: never treat a query error as "no remaining" (that can incorrectly complete jobs).
        const { data: remainingRows, error: remainingErr } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .in('status', ['queued', 'paused', 'sending'])
          .limit(1);

        let hasRemaining = true;
        if (remainingErr) {
          console.warn(`⚠️ Remaining-message check failed for job ${job.id}:`, remainingErr.message);
          lastError = truncateError(lastError || `Remaining check failed: ${remainingErr.message}`);
          hasRemaining = true;
        } else {
          hasRemaining = (remainingRows || []).length > 0;
        }

        // Durable job stats (derived from the source-of-truth ledger)
        // Fall back to the existing job counters if the query fails (avoid clobbering with zeros).
        let durableSent = Number(job?.emails_sent || 0);
        let durableFailed = Number(job?.emails_failed || 0);

        const { data: sentCountRows, error: sentCountErr } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .eq('status', 'sent');

        if (sentCountErr) {
          console.warn(`⚠️ Durable sent-count query failed for job ${job.id}:`, sentCountErr.message);
          lastError = truncateError(lastError || `Sent count failed: ${sentCountErr.message}`);
        } else {
          durableSent = (sentCountRows || []).length;
        }

        const { data: failedCountRows, error: failedCountErr } = await supabase
          .from('email_messages')
          .select('id')
          .in('id', messageIds)
          .eq('status', 'failed');

        if (failedCountErr) {
          console.warn(`⚠️ Durable failed-count query failed for job ${job.id}:`, failedCountErr.message);
          lastError = truncateError(lastError || `Failed count failed: ${failedCountErr.message}`);
        } else {
          durableFailed = (failedCountRows || []).length;
        }

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
