import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  extractLinks,
  getUniqueUrls,
  hasPII,
} from "../_shared/linkRewriter.ts";
import { canSendEmailBatch, logSkippedSends } from "../_shared/canSendEmail.ts";
import { systemPauseEmailCampaignSending } from "../_shared/systemPauseCampaign.ts";
import {
  renderEmailForRecipient,
  type CompanyProfileShape,
  type CustomerShape,
} from "../_shared/emailRenderer.ts";
import {
  resolveCampaignEmailSource,
  type CampaignEmailSource,
} from "../_shared/campaignEmailSource.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_JOBS_PER_INVOCATION = 25;
const MAX_PARALLEL_JOBS = 3;
const SEND_CONCURRENCY = 10;
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_DELAY_MS = 500;
const DEFAULT_MESSAGE_STALE_MINUTES = 15;

const DEFAULT_RESEND_BATCH_SIZE = 100;
const MAX_RESEND_BATCH_SIZE = 100;
const RESEND_MIN_INTERVAL_MS = 500;

type CampaignReputationPolicy = {
  score: number;
  tier: "normal" | "throttled" | "restricted" | "critical";
  action: "allow" | "throttle" | "restrict" | "pause";
  recipient_cap: number | null;
  job_batch_size: number | null;
  send_pacing_multiplier: number | null;
};

type TenantSuppressionBypassState = {
  suppression_bypass_active: boolean;
};

type CampaignInterventionState = {
  admin_paused: boolean;
  force_stopped: boolean;
  autopause_override_enabled: boolean;
  autopause_override_precedence: "final_override" | "automation_allowed";
  autopause_override_final: boolean;
};

async function getTenantSuppressionBypassState(
  supabase: any,
  tenantId: string,
): Promise<TenantSuppressionBypassState> {
  const { data, error } = await supabase.rpc(
    "get_tenant_suppression_bypass_state",
    {
      p_tenant_id: tenantId,
    },
  );

  if (error) {
    console.warn(
      "⚠️ Failed to fetch tenant suppression bypass state, defaulting to disabled:",
      error.message,
    );
    return { suppression_bypass_active: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    suppression_bypass_active: Boolean(row?.suppression_bypass_active),
  };
}

async function getCampaignReputationPolicy(
  supabase: any,
  campaignId: string,
): Promise<CampaignReputationPolicy> {
  const { data, error } = await supabase.rpc("get_campaign_reputation_policy", {
    p_campaign_id: campaignId,
  });

  if (error) {
    // FIX: [GH1] - Fail closed: reputation policy RPC failure must stop the campaign, not allow it
    // Security decision: a DB error during governance checks should halt sending, not bypass governance
    throw new Error(
      `Reputation policy check failed: ${error.message}. Campaign halted for safety.`,
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const rawRecipientCap = Number(row?.recipient_cap);
  const normalizedRecipientCap =
    Number.isFinite(rawRecipientCap) && rawRecipientCap > 0
      ? rawRecipientCap
      : null;
  return {
    score: Number(row?.score ?? 100),
    tier: (row?.tier || "normal") as CampaignReputationPolicy["tier"],
    action: (row?.action || "allow") as CampaignReputationPolicy["action"],
    recipient_cap: normalizedRecipientCap,
    job_batch_size: Number.isFinite(Number(row?.job_batch_size))
      ? Number(row.job_batch_size)
      : null,
    send_pacing_multiplier: Number.isFinite(Number(row?.send_pacing_multiplier))
      ? Number(row.send_pacing_multiplier)
      : 1,
  };
}

async function getCampaignInterventionState(
  supabase: any,
  campaignId: string,
): Promise<CampaignInterventionState> {
  const { data, error } = await supabase.rpc(
    "get_campaign_intervention_state",
    {
      p_campaign_id: campaignId,
    },
  );

  if (error) {
    console.warn(
      `⚠️ Failed to fetch campaign intervention state for ${campaignId}; defaulting to no override:`,
      error.message,
    );
    return {
      admin_paused: false,
      force_stopped: false,
      autopause_override_enabled: false,
      autopause_override_precedence: "automation_allowed",
      autopause_override_final: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const precedence =
    String(
      row?.autopause_override_precedence || "automation_allowed",
    ).toLowerCase() === "final_override"
      ? "final_override"
      : "automation_allowed";

  return {
    admin_paused: Boolean(row?.admin_paused),
    force_stopped: Boolean(row?.force_stopped),
    autopause_override_enabled: Boolean(row?.autopause_override_enabled),
    autopause_override_precedence: precedence,
    autopause_override_final: Boolean(row?.autopause_override_final),
  };
}

addEventListener("beforeunload", (ev) => {
  console.log(
    "[process-email-send-queue] Function shutdown due to:",
    (ev as any).detail?.reason,
  );
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitErrorMessage(message: string | null | undefined): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("429")
  );
}

function createDbBackedProviderLimiter(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  minIntervalMs: number,
): { acquire: () => Promise<void> } {
  return {
    async acquire() {
      const { data, error } = await supabase.rpc("acquire_provider_send_slot", {
        p_provider: provider,
        p_min_interval_ms: minIntervalMs,
      });

      if (error) {
        console.warn(
          `⚠️ Provider limiter RPC failed for ${provider}; falling back to local sleep:`,
          error.message,
        );
        await sleep(minIntervalMs);
        return;
      }

      const waitMs = Math.max(0, Number(data || 0));
      if (waitMs > 0) await sleep(waitMs);
    },
  };
}

function createFixedWindowRateLimiter(requestsPerSecond: number) {
  // Enforces a minimum spacing between requests across concurrent async tasks.
  // Not perfectly fair, but good enough to avoid hammering provider rate limits.
  const rps = Math.max(
    0.1,
    Number.isFinite(requestsPerSecond) ? requestsPerSecond : 2,
  );
  const minIntervalMs = Math.ceil(1000 / rps);
  let nextAt = Date.now();
  let chain: Promise<void> = Promise.resolve();

  return {
    async acquire() {
      const pending = chain.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, nextAt - now);
        nextAt = Math.max(nextAt, now) + minIntervalMs;
        if (waitMs > 0) await sleep(waitMs);
      });

      chain = pending.catch(() => undefined);
      await pending;
    },
    minIntervalMs,
  };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toCustomerShape(customer: any): CustomerShape {
  return {
    id: customer?.id,
    email: String(customer?.email || ""),
    first_name: customer?.first_name ?? null,
    last_name: customer?.last_name ?? null,
    phone: customer?.phone ?? null,
    lifetime_value: customer?.lifetime_value ?? customer?.total_spent ?? null,
    total_spent: customer?.total_spent ?? null,
    first_purchase_date: customer?.first_purchase_date ?? null,
    last_purchase_date: customer?.last_purchase_date ?? null,
    custom_fields:
      customer?.custom_fields && typeof customer.custom_fields === "object"
        ? customer.custom_fields
        : undefined,
  };
}

function buildEmailPayloadOptimized(
  customer: any,
  campaign: any,
  companyProfile: CompanyProfileShape | null,
  campaignSource: CampaignEmailSource,
  fromAddress: string,
  senderEmail: string,
  usesVerifiedDomain: boolean,
  activeDomainId: string | null,
  trackedLinkMap: Map<string, string> | null,
  replyToEmail?: string,
): any {
  const rendered = renderEmailForRecipient({
    tenantId: campaign.tenant_id,
    campaignId: campaign.id,
    subject: campaign.subject_line || "Newsletter from your Garden Center",
    html: campaignSource.html,
    contentBlocks: campaignSource.contentBlocks,
    customer: toCustomerShape(customer),
    companyProfile,
    mode: "send",
    includeFooter: true,
    enableLinkTracking: true,
    trackedLinkMap,
  });

  const emailPayload: any = {
    from: fromAddress,
    to: [customer.email],
    subject: rendered.renderedSubject,
    html: rendered.renderedHtml,
    headers: {
      "X-Campaign-ID": campaign.id,
      "X-Campaign-Type": "bulk",
      "X-Tenant-ID": campaign.tenant_id,
      "X-Domain-ID": activeDomainId || "none",
    },
    tags: [
      { name: "campaign_id", value: campaign.id },
      { name: "type", value: "bulk" },
      { name: "tenant_id", value: campaign.tenant_id },
    ],
  };

  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail) {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

function truncateError(message: string, maxLength: number = 500): string {
  if (!message) return "";
  return message.length > maxLength ? message.slice(0, maxLength) : message;
}

async function evaluateCampaignBatchSafety(
  supabase: any,
  campaignId: string,
): Promise<{ shouldPause: boolean; pauseReason?: string }> {
  try {
    const { data, error } = await supabase.rpc(
      "evaluate_campaign_batch_safety",
      {
        p_campaign_id: campaignId,
      },
    );

    if (error) {
      // FIX: [GH2] - Fail closed: batch safety check failure should pause campaign, not continue sending
      console.warn(
        `⚠️ Failed to evaluate campaign batch safety for ${campaignId}:`,
        error.message,
      );
      return {
        shouldPause: true,
        pauseReason: `safety_check_failed: ${error.message}`,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      shouldPause: Boolean(row?.should_pause),
      pauseReason: row?.pause_reason ? String(row.pause_reason) : undefined,
    };
  } catch (error: any) {
    // FIX: [GH2] - Fail closed: batch safety check failure should pause campaign, not continue sending
    console.warn(
      `⚠️ Batch safety evaluation exception for ${campaignId}:`,
      error?.message || error,
    );
    return { shouldPause: true, pauseReason: "safety_check_failed" };
  }
}

async function evaluateCampaignWarningThrottle(
  supabase: any,
  campaignId: string,
): Promise<{ throttled: boolean; changed: boolean; reasons: string[] }> {
  try {
    const { data, error } = await supabase.rpc(
      "maybe_update_campaign_throttle_state",
      {
        p_campaign_id: campaignId,
        p_source: "queue_worker",
        p_as_of: new Date().toISOString(),
      },
    );

    if (error) {
      console.warn(
        `⚠️ Failed to evaluate campaign warning throttle for ${campaignId}:`,
        error.message,
      );
      return { throttled: false, changed: false, reasons: [] };
    }

    const row = Array.isArray(data) ? data[0] : data;
    const reasons = Array.isArray(row?.reasons)
      ? row.reasons.map((x: unknown) => String(x))
      : [];

    return {
      throttled: Boolean(row?.throttled),
      changed: Boolean(row?.changed),
      reasons,
    };
  } catch (error) {
    console.warn(
      `⚠️ Exception evaluating campaign warning throttle for ${campaignId}:`,
      error,
    );
    return { throttled: false, changed: false, reasons: [] };
  }
}

async function dispatchTenantHardStopNotifications(
  supabase: any,
  resendApiKey: string,
  workerId: string,
  limit: number = 20,
): Promise<{ claimed: number; sent: number; failed: number }> {
  const { data, error } = await supabase.rpc(
    "claim_tenant_hard_stop_notifications",
    {
      p_limit: limit,
      p_worker_id: workerId,
      p_stale_after_minutes: 10,
    },
  );

  if (error) {
    console.warn("⚠️ Failed to claim hard-stop notifications:", error.message);
    return { claimed: 0, sent: 0, failed: 0 };
  }

  const notifications = Array.isArray(data) ? data : [];
  if (notifications.length === 0) {
    return { claimed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const notificationId = String(notification?.id || "");
    const to = String(notification?.recipient_email || "").trim();
    const subject = String(
      notification?.subject || "Sending paused: tenant under review",
    );
    const bodyText = String(
      notification?.body_text ||
        "Your tenant is under review and campaign sending is paused.",
    );

    if (!notificationId || !to) {
      failed++;
      continue;
    }

    try {
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BloomSuite Deliverability <noreply@brandsinblooms.com>",
          to: [to],
          subject,
          text: bodyText,
        }),
      });

      if (!resendResp.ok) {
        const errText = await resendResp.text();
        throw new Error(
          `Resend ${resendResp.status}: ${truncateError(errText || "unknown error")}`,
        );
      }

      await supabase
        .from("email_governance_tenant_hard_stop_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (notification?.enforcement_action_id) {
        await supabase
          .from("email_governance_tenant_enforcement_actions")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", notification.enforcement_action_id)
          .is("notified_at", null);
      }

      sent++;
    } catch (sendError: any) {
      await supabase
        .from("email_governance_tenant_hard_stop_notifications")
        .update({
          status: "pending",
          error_message: truncateError(
            sendError?.message || "Failed to send hard-stop notification",
          ),
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId);
      failed++;
    }
  }

  return {
    claimed: notifications.length,
    sent,
    failed,
  };
}

async function dispatchDomainCrisisNotifications(
  supabase: any,
  resendApiKey: string,
  workerId: string,
  limit: number = 20,
): Promise<{ claimed: number; sent: number; failed: number }> {
  const { data, error } = await supabase.rpc(
    "claim_domain_crisis_notifications",
    {
      p_limit: limit,
      p_worker_id: workerId,
      p_stale_after_minutes: 10,
    },
  );

  if (error) {
    console.warn(
      "⚠️ Failed to claim domain crisis notifications:",
      error.message,
    );
    return { claimed: 0, sent: 0, failed: 0 };
  }

  const notifications = Array.isArray(data) ? data : [];
  if (notifications.length === 0) {
    return { claimed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const notificationId = String(notification?.id || "");
    const to = String(notification?.recipient_email || "").trim();
    const subject = String(
      notification?.subject || "Sending halted: domain under investigation",
    );
    const bodyText = String(
      notification?.body_text ||
        "A sending domain is under investigation and sending has been halted.",
    );

    if (!notificationId || !to) {
      failed++;
      continue;
    }

    try {
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BloomSuite Deliverability <noreply@brandsinblooms.com>",
          to: [to],
          subject,
          text: bodyText,
        }),
      });

      if (!resendResp.ok) {
        const errText = await resendResp.text();
        throw new Error(
          `Resend ${resendResp.status}: ${truncateError(errText || "unknown error")}`,
        );
      }

      await supabase
        .from("email_governance_domain_crisis_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      sent++;
    } catch (sendError: any) {
      await supabase
        .from("email_governance_domain_crisis_notifications")
        .update({
          status: "pending",
          error_message: truncateError(
            sendError?.message || "Failed to send domain crisis notification",
          ),
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notificationId);
      failed++;
    }
  }

  return {
    claimed: notifications.length,
    sent,
    failed,
  };
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

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      lastStatus = res.status;

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json?.message || json?.error || res.statusText || "Resend API error";
        lastError = truncateError(String(msg));

        // Rate limit: backoff and retry (do not consume message attempts aggressively)
        if (res.status === 429 || isRateLimitErrorMessage(lastError)) {
          const retryAfterHeader = res.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader
            ? Number.parseInt(retryAfterHeader, 10)
            : NaN;
          const backoffMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(250, retryAfterSeconds * 1000)
            : 750 * (attempt + 1);
          await sleep(backoffMs);
          continue;
        }

        return { error: lastError, status: lastStatus };
      }

      const id = json?.id || json?.data?.id;
      if (!id)
        return { error: "Resend returned no message id", status: lastStatus };
      return { id, status: lastStatus };
    }

    return { error: lastError || "Rate limited", status: lastStatus };
  } catch (e: any) {
    return {
      error: truncateError(e?.message || "Network error calling Resend"),
    };
  }
}

async function sha256Base64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  const b64 = btoa(String.fromCharCode(...arr));
  // base64url
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function resendSendBatch(
  apiKey: string,
  payloads: any[],
  batchIdempotencyKeySeed: string,
  limiter?: { acquire: () => Promise<void> },
): Promise<{
  ids?: Array<{ id: string }>;
  error?: string;
  status?: number;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
}> {
  try {
    const serverErrorBackoffMs = [1000, 4000, 16000];
    let lastError: string | undefined;
    let lastStatus: number | undefined;

    // Idempotency key is per API request (batch), not per email.
    const idem = await sha256Base64Url(batchIdempotencyKeySeed);
    const idempotencyKey = `batch_${idem}`.slice(0, 256);

    for (let attempt = 0; attempt <= serverErrorBackoffMs.length; attempt++) {
      if (limiter) await limiter.acquire();

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payloads),
      });

      lastStatus = res.status;
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.message || json?.error || res.statusText || "Resend API error";
        lastError = truncateError(String(msg));

        if (res.status === 429 || isRateLimitErrorMessage(lastError)) {
          const retryAfterHeader = res.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader
            ? Number.parseInt(retryAfterHeader, 10)
            : NaN;
          return {
            error: lastError,
            status: lastStatus,
            rateLimited: true,
            retryAfterSeconds: Number.isFinite(retryAfterSeconds)
              ? Math.max(1, retryAfterSeconds)
              : 30,
          };
        }

        if (
          res.status >= 500 &&
          res.status < 600 &&
          attempt < serverErrorBackoffMs.length
        ) {
          await sleep(serverErrorBackoffMs[attempt]);
          continue;
        }

        return { error: lastError, status: lastStatus };
      }

      const data = json?.data;
      if (!Array.isArray(data)) {
        return {
          error: "Resend batch response missing data array",
          status: lastStatus,
        };
      }

      return { ids: data as Array<{ id: string }>, status: lastStatus };
    }

    return { error: lastError || "Rate limited", status: lastStatus };
  } catch (e: any) {
    return {
      error: truncateError(e?.message || "Network error calling Resend"),
    };
  }
}

serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);

  console.log(
    `[process-email-send-queue][${runId}] request received: method=${req.method}`,
  );

  // Respond immediately so cron/net.http_post callers don't time out.
  // Actual queue processing continues in the background via EdgeRuntime.waitUntil.
  const acceptedResponse = new Response(
    JSON.stringify({ accepted: true, runId }),
    {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

  console.log(
    `[process-email-send-queue][${runId}] scheduling background run via waitUntil`,
  );

  EdgeRuntime.waitUntil(
    (async () => {
      console.log(
        `[process-email-send-queue][${runId}] background run started`,
      );
      const startTime = Date.now();
      const batchDelayMs = parseInt(
        Deno.env.get("EMAIL_BATCH_DELAY_MS") || String(DEFAULT_BATCH_DELAY_MS),
        10,
      );
      const sendConcurrency = parseInt(
        Deno.env.get("EMAIL_SEND_CONCURRENCY") || String(SEND_CONCURRENCY),
        10,
      );
      const messageStaleMinutes = parseInt(
        Deno.env.get("EMAIL_MESSAGE_STALE_MINUTES") ||
          String(DEFAULT_MESSAGE_STALE_MINUTES),
        10,
      );
      const resendBatchSizeEnv = parseInt(
        Deno.env.get("RESEND_BATCH_SIZE") || String(DEFAULT_RESEND_BATCH_SIZE),
        10,
      );
      const resendBatchSize = Math.max(
        1,
        Math.min(
          MAX_RESEND_BATCH_SIZE,
          Number.isFinite(resendBatchSizeEnv)
            ? resendBatchSizeEnv
            : DEFAULT_RESEND_BATCH_SIZE,
        ),
      );
      const workerId =
        Deno.env.get("WORKER_ID") ||
        `email-queue-worker-${crypto.randomUUID()}`;
      const claimToken = crypto.randomUUID();

      // Global request pacing is enforced by the DB-backed limiter at RESEND_MIN_INTERVAL_MS.
      // If the user-configured batchDelayMs is higher than the global minimum, we add only the
      // extra delay so we don't accidentally double-throttle.
      const additionalBatchDelayMs = Math.max(
        0,
        batchDelayMs - RESEND_MIN_INTERVAL_MS,
      );

      console.log(
        `[process-email-send-queue][${runId}] ⚙️ Resend settings: batch_size=${resendBatchSize} (env RESEND_BATCH_SIZE, max ${MAX_RESEND_BATCH_SIZE}), min_interval_ms=${RESEND_MIN_INTERVAL_MS} (fixed, global)`,
      );
      console.log(
        `[process-email-send-queue][${runId}] ⚙️ Worker settings: send_concurrency=${sendConcurrency} (env EMAIL_SEND_CONCURRENCY), batch_delay_ms=${batchDelayMs} (env EMAIL_BATCH_DELAY_MS), stale_minutes=${messageStaleMinutes}`,
      );

      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const resendGlobalLimiter = createDbBackedProviderLimiter(
          supabase,
          "resend",
          RESEND_MIN_INTERVAL_MS,
        );

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
          console.error(
            `[process-email-send-queue][${runId}] ❌ Missing RESEND_API_KEY`,
          );
          return;
        }

        let dynamicResendBatchSize = resendBatchSize;
        let consecutiveSuccessfulBatchRequests = 0;
        let consecutiveRateLimitResponses = 0;
        const rateLimitedCampaigns = new Map<string, number>();

        const lowerDynamicResendBatchSize = () => {
          consecutiveSuccessfulBatchRequests = 0;
          consecutiveRateLimitResponses += 1;
          dynamicResendBatchSize =
            consecutiveRateLimitResponses >= 2
              ? 25
              : dynamicResendBatchSize > 50
                ? 50
                : 25;
        };

        const maybeRaiseDynamicResendBatchSize = () => {
          consecutiveRateLimitResponses = 0;
          consecutiveSuccessfulBatchRequests += 1;

          if (consecutiveSuccessfulBatchRequests < 3) {
            return;
          }

          consecutiveSuccessfulBatchRequests = 0;
          if (dynamicResendBatchSize < 50) {
            dynamicResendBatchSize = 50;
          } else if (dynamicResendBatchSize < MAX_RESEND_BATCH_SIZE) {
            dynamicResendBatchSize = MAX_RESEND_BATCH_SIZE;
          }
        };

        const recordCampaignProgress = async (
          campaignId: string,
          sentDelta: number,
          failedDelta: number,
          skippedDelta = 0,
        ) => {
          if (!campaignId) return;

          const { error } = await supabase.rpc(
            "record_campaign_send_progress",
            {
              p_campaign_id: campaignId,
              p_sent_delta: Math.max(0, sentDelta),
              p_failed_delta: Math.max(0, failedDelta),
              p_skipped_delta: Math.max(0, skippedDelta),
              p_worker_heartbeat_at: new Date().toISOString(),
            },
          );

          if (error) {
            console.warn(
              `⚠️ Failed to record campaign progress for ${campaignId}:`,
              error.message,
            );
          }
        };

        const touchCampaignHeartbeats = async (campaignIds: string[]) => {
          const uniqueIds = [...new Set(campaignIds.filter(Boolean))];
          if (uniqueIds.length === 0) return;

          const { error } = await supabase
            .from("crm_campaigns")
            .update({ worker_heartbeat_at: new Date().toISOString() })
            .in("id", uniqueIds);

          if (error) {
            console.warn(
              "⚠️ Failed to update worker heartbeat checkpoint:",
              error.message,
            );
          }
        };

        const logCampaignHealthEvent = async (
          campaignId: string,
          tenantId: string | null | undefined,
          eventType: string,
          message: string,
          metadata: Record<string, unknown>,
        ) => {
          if (!campaignId) return;

          const { error } = await supabase
            .from("campaign_health_events")
            .insert({
              campaign_id: campaignId,
              tenant_id: tenantId || null,
              event_type: eventType,
              message,
              metadata,
            });

          if (error) {
            console.warn(
              `⚠️ Failed to log campaign health event for ${campaignId}:`,
              error.message,
            );
          }
        };

        const deferCampaignForRateLimit = async (
          campaignId: string,
          tenantId: string | null | undefined,
          retryAfterSeconds: number,
          statusCode?: number,
        ) => {
          const retrySeconds = Math.max(1, retryAfterSeconds || 30);
          const availableAtIso = new Date(
            Date.now() + retrySeconds * 1000,
          ).toISOString();

          rateLimitedCampaigns.set(
            campaignId,
            Date.now() + retrySeconds * 1000,
          );

          const { error: deferError } = await supabase
            .from("email_send_jobs")
            .update({
              available_at: availableAtIso,
              updated_at: new Date().toISOString(),
            })
            .eq("campaign_id", campaignId)
            .eq("status", "pending")
            .is("claim_token", null);

          if (deferError) {
            console.warn(
              `⚠️ Failed to defer pending jobs for rate-limited campaign ${campaignId}:`,
              deferError.message,
            );
          }

          await logCampaignHealthEvent(
            campaignId,
            tenantId,
            "provider_rate_limited",
            "Resend returned a rate limit response. Pending jobs were deferred.",
            {
              retry_after_seconds: retrySeconds,
              provider: "resend",
              status_code: statusCode || 429,
            },
          );
        };

        // Atomically claim jobs (prevents concurrent workers from processing the same job)
        // Prefer the lightweight claim_email_send_job_ids RPC, but fall back to claim_email_send_jobs
        // if the migration hasn't been applied / schema cache hasn't refreshed yet.
        const claimOnce = async (batchSize: number) => {
          const primary = await supabase.rpc("claim_email_send_job_ids", {
            batch_size: batchSize,
            worker_id: workerId,
            p_claim_token: claimToken,
            stale_after_minutes: 10,
          });

          if (!primary.error) return primary;

          const code = String((primary.error as any)?.code || "");
          const msg = String((primary.error as any)?.message || primary.error);
          const looksMissing =
            code === "PGRST202" ||
            msg
              .toLowerCase()
              .includes(
                "could not find the function public.claim_email_send_job_ids",
              );
          if (!looksMissing) return primary;

          console.warn(
            "⚠️ claim_email_send_job_ids missing; falling back to claim_email_send_jobs",
          );
          const fallback = await supabase.rpc("claim_email_send_jobs", {
            batch_size: batchSize,
            worker_id: workerId,
            p_claim_token: claimToken,
            stale_after_minutes: 10,
          });

          if (fallback.error) return fallback as any;

          // Normalize to the same shape as claim_email_send_job_ids
          const idsOnly = (fallback.data || []).map((r: any) => ({
            id: r?.id,
          }));
          return { data: idsOnly, error: null } as any;
        };

        let claimedJobIds: string[] = [];
        {
          const { data, error } = await claimOnce(MAX_JOBS_PER_INVOCATION);

          if (error) {
            const msg = String((error as any)?.message || error);
            console.error("❌ Error claiming jobs:", {
              message: msg,
              details: (error as any)?.details,
              hint: (error as any)?.hint,
              code: (error as any)?.code,
            });

            const looksLikeTimeout = msg.toLowerCase().includes("timeout");
            if (looksLikeTimeout && MAX_JOBS_PER_INVOCATION > 1) {
              console.log(
                "🔁 Retrying job claim with smaller batch_size=1 due to timeout",
              );
              const retry = await claimOnce(1);
              if (retry.error) {
                console.error("❌ Error claiming jobs (retry):", {
                  message: String((retry.error as any)?.message || retry.error),
                  details: (retry.error as any)?.details,
                  hint: (retry.error as any)?.hint,
                  code: (retry.error as any)?.code,
                });
                return;
              }
              claimedJobIds = (retry.data || [])
                .map((r: any) => String(r?.id))
                .filter(Boolean);
            } else {
              return;
            }
          } else {
            claimedJobIds = (data || [])
              .map((r: any) => String(r?.id))
              .filter(Boolean);
          }
        }

        if (claimedJobIds.length === 0) {
          // Before returning, check for stuck campaigns (status='sending' but all jobs completed)
          const { data: stuckCampaigns } = await supabase
            .from("crm_campaigns")
            .select("id")
            .eq("status", "sending")
            .lt(
              "send_started_at",
              new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            )
            .limit(5);

          let finalized = 0;
          for (const sc of stuckCampaigns || []) {
            const { data: pendingJobs } = await supabase
              .from("email_send_jobs")
              .select("id")
              .eq("campaign_id", sc.id)
              .in("status", ["pending", "in_progress", "paused"])
              .limit(1);

            if (pendingJobs && pendingJobs.length > 0) continue;

            const { data: allJobs } = await supabase
              .from("email_send_jobs")
              .select("emails_sent, emails_failed")
              .eq("campaign_id", sc.id);

            const totalSent = (allJobs || []).reduce(
              (s: number, j: any) => s + (j.emails_sent || 0),
              0,
            );
            const totalFailed = (allJobs || []).reduce(
              (s: number, j: any) => s + (j.emails_failed || 0),
              0,
            );

            await supabase
              .from("crm_campaigns")
              .update({
                status: totalFailed > 0 ? "sent_with_errors" : "sent",
                total_sent: totalSent,
                sent_at: new Date().toISOString(),
                send_completed_at: new Date().toISOString(),
                worker_heartbeat_at: new Date().toISOString(),
                claim_token: null,
                metrics: {
                  sent: totalSent,
                  failed: totalFailed,
                  opens: 0,
                  clicks: 0,
                  unsubscribes: 0,
                },
              })
              .eq("id", sc.id);

            console.log(
              `🔧 Auto-finalized stuck campaign ${sc.id}: ${totalSent} sent, ${totalFailed} failed`,
            );
            finalized++;
          }

          const hardStopNotifications =
            await dispatchTenantHardStopNotifications(
              supabase,
              resendApiKey,
              workerId,
              10,
            );

          const domainCrisisNotifications =
            await dispatchDomainCrisisNotifications(
              supabase,
              resendApiKey,
              workerId,
              10,
            );

          if (hardStopNotifications.claimed > 0) {
            console.log(
              `📣 Hard-stop notifications processed: claimed=${hardStopNotifications.claimed}, sent=${hardStopNotifications.sent}, failed=${hardStopNotifications.failed}`,
            );
          }

          if (domainCrisisNotifications.claimed > 0) {
            console.log(
              `📣 Domain crisis notifications processed: claimed=${domainCrisisNotifications.claimed}, sent=${domainCrisisNotifications.sent}, failed=${domainCrisisNotifications.failed}`,
            );
          }

          console.log(
            `✅ No pending jobs to process${finalized > 0 ? ` (finalized ${finalized} stuck campaigns)` : ""}`,
          );
          return;
        }

        const { data: jobs, error: jobsFetchError } = await supabase
          .from("email_send_jobs")
          .select(
            "id, campaign_id, tenant_id, domain_id, status, batch_index, recipient_message_ids",
          )
          .in("id", claimedJobIds);

        if (jobsFetchError) {
          console.error("❌ Error fetching claimed jobs:", {
            message: jobsFetchError.message,
            details: (jobsFetchError as any)?.details,
            hint: (jobsFetchError as any)?.hint,
            code: (jobsFetchError as any)?.code,
          });
          return;
        }

        const jobsNeedingEmails = (jobs || []).filter(
          (j: any) =>
            !Array.isArray(j?.recipient_message_ids) ||
            j.recipient_message_ids.length === 0,
        );

        if (jobsNeedingEmails.length > 0) {
          const idsNeedingEmails = jobsNeedingEmails.map((j: any) => j.id);
          const { data: jobEmailRows, error: jobEmailErr } = await supabase
            .from("email_send_jobs")
            .select("id, recipient_emails")
            .in("id", idsNeedingEmails);

          if (jobEmailErr) {
            console.warn("⚠️ Failed to fetch recipient_emails for some jobs:", {
              message: jobEmailErr.message,
              code: (jobEmailErr as any)?.code,
            });
          } else {
            const byId = new Map<string, any>();
            (jobEmailRows || []).forEach((r: any) =>
              byId.set(String(r?.id), r),
            );
            (jobs || []).forEach((j: any) => {
              const extra = byId.get(String(j?.id));
              if (extra && !j.recipient_emails)
                j.recipient_emails = extra.recipient_emails;
            });
          }
        }

        console.log(
          `📧 Processing ${jobs.length} claimed email send jobs (batch delay: ${batchDelayMs}ms)...`,
        );

        let processedCount = 0;
        let totalEmailsSent = 0;
        let totalEmailsFailed = 0;
        const failedCampaigns = new Set<string>();

        const campaignCache = new Map<string, any>();
        const campaignSourceCache = new Map<string, CampaignEmailSource>();
        const companyProfileCache = new Map<string, any>();
        const trackedLinkMapCache = new Map<string, Map<string, string>>();
        const replyToCache = new Map<string, string | undefined>();
        const domainInvestigationCache = new Map<string, boolean>();

        const processClaimedJob = async (job: any, _jobIndex: number) => {
          const jobStartTime = Date.now();

          do {
            // Check if we're approaching timeout (leave 10s buffer)
            if (Date.now() - startTime > 50000) {
              console.log("⏱️ Approaching timeout, stopping processing");
              break;
            }

            try {
              const nowIso = new Date().toISOString();

              const pauseJob = async (errorMessage: string | null) => {
                await supabase
                  .from("email_send_jobs")
                  .update({
                    status: "paused",
                    error_message: errorMessage,
                    claim_token: null,
                    claimed_at: null,
                    claimed_by: null,
                    updated_at: nowIso,
                  })
                  .eq("id", job.id)
                  .eq("claim_token", claimToken);
              };

              const campaignIdForJob: string = String(job.campaign_id || "");
              const rateLimitedUntilMs = campaignIdForJob
                ? rateLimitedCampaigns.get(campaignIdForJob)
                : undefined;
              if (
                campaignIdForJob &&
                rateLimitedUntilMs &&
                rateLimitedUntilMs > Date.now()
              ) {
                await supabase
                  .from("email_send_jobs")
                  .update({
                    status: "pending",
                    available_at: new Date(rateLimitedUntilMs).toISOString(),
                    error_message: "Deferred after provider rate limit",
                    claim_token: null,
                    claimed_at: null,
                    claimed_by: null,
                    updated_at: nowIso,
                  })
                  .eq("id", job.id)
                  .eq("claim_token", claimToken);
                processedCount++;
                continue;
              }

              let campaignPolicy: CampaignReputationPolicy | null = null;
              let campaignIntervention: CampaignInterventionState | null = null;
              let jobResendLimiter = resendGlobalLimiter;
              if (campaignIdForJob) {
                await recordCampaignProgress(campaignIdForJob, 0, 0, 0);
                campaignIntervention = await getCampaignInterventionState(
                  supabase,
                  campaignIdForJob,
                );

                if (
                  campaignIntervention.force_stopped ||
                  campaignIntervention.admin_paused
                ) {
                  await pauseJob("Campaign is paused.");
                  processedCount++;
                  continue;
                }

                campaignPolicy = await getCampaignReputationPolicy(
                  supabase,
                  campaignIdForJob,
                );

                if (
                  campaignPolicy.action === "pause" &&
                  !campaignIntervention.autopause_override_final
                ) {
                  const pauseMessage = `Campaign auto-paused: tenant reputation score ${campaignPolicy.score} is below 60.`;
                  await systemPauseEmailCampaignSending(supabase, {
                    campaignId: campaignIdForJob,
                    blockReason: "reputation_critical_autopause",
                    errorMessage: pauseMessage,
                  });
                  await pauseJob(pauseMessage);
                  processedCount++;
                  continue;
                }

                if (campaignPolicy.action === "restrict") {
                  const blockMessage = `Campaign blocked: tenant reputation score ${campaignPolicy.score} is in restricted tier (60-74).`;
                  await supabase
                    .from("crm_campaigns")
                    .update({
                      send_blocked_reason: "reputation_restricted",
                      send_error: blockMessage,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", campaignIdForJob);
                  await pauseJob(blockMessage);
                  processedCount++;
                  continue;
                }

                const pacingMultiplier = Math.max(
                  1,
                  Number(campaignPolicy.send_pacing_multiplier || 1),
                );
                const effectiveMinIntervalMs = Math.max(
                  RESEND_MIN_INTERVAL_MS,
                  Math.round(RESEND_MIN_INTERVAL_MS * pacingMultiplier),
                );
                if (effectiveMinIntervalMs > RESEND_MIN_INTERVAL_MS) {
                  jobResendLimiter = createDbBackedProviderLimiter(
                    supabase,
                    "resend",
                    effectiveMinIntervalMs,
                  );
                }

                const { data: campaignState, error: campaignStateErr } =
                  await supabase
                    .from("crm_campaigns")
                    .select(
                      "id, status, delivery_method, actual_sender_email, from_email_domain_id",
                    )
                    .eq("id", campaignIdForJob)
                    .maybeSingle();

                if (campaignStateErr) {
                  console.warn(
                    `⚠️ Failed to load campaign state for job ${job.id}:`,
                    campaignStateErr.message,
                  );
                } else if (campaignState?.status === "paused") {
                  await pauseJob(null);
                  processedCount++;
                  continue;
                } else {
                  const deliveryMethod = String(
                    campaignState?.delivery_method || "",
                  );
                  const senderEmail = String(
                    campaignState?.actual_sender_email || "",
                  );
                  const domainId = campaignState?.from_email_domain_id
                    ? String(campaignState.from_email_domain_id)
                    : "";

                  if (domainId && !domainInvestigationCache.has(domainId)) {
                    const { data: domainState, error: domainStateErr } =
                      await supabase
                        .from("email_domains")
                        .select("investigation_mode")
                        .eq("id", domainId)
                        .maybeSingle();

                    if (domainStateErr) {
                      console.warn(
                        `⚠️ Failed to load domain crisis state for ${domainId}:`,
                        domainStateErr.message,
                      );
                      domainInvestigationCache.set(domainId, false);
                    } else {
                      domainInvestigationCache.set(
                        domainId,
                        Boolean(domainState?.investigation_mode),
                      );
                    }
                  }

                  if (
                    domainId &&
                    domainInvestigationCache.get(domainId) === true
                  ) {
                    const pauseMessage =
                      "Campaign paused: sending domain is under investigation mode.";
                    await systemPauseEmailCampaignSending(supabase, {
                      campaignId: campaignIdForJob,
                      blockReason: "domain_under_investigation",
                      errorMessage: pauseMessage,
                    });
                    await pauseJob(pauseMessage);
                    processedCount++;
                    continue;
                  }

                  const isSharedSenderConfigured =
                    deliveryMethod && deliveryMethod !== "custom_domain";
                  const isLegacySharedSenderEmail =
                    senderEmail === "noreply@bloomsuite.app";
                  const missingSenderConfig = !domainId || !senderEmail;

                  if (
                    isSharedSenderConfigured ||
                    isLegacySharedSenderEmail ||
                    missingSenderConfig
                  ) {
                    const isSharedSender =
                      isSharedSenderConfigured || isLegacySharedSenderEmail;
                    const pauseMessage = isSharedSender
                      ? "Shared sender is disabled. Configure a custom domain to send campaigns."
                      : "Campaign sending requires a configured custom domain sender.";

                    await systemPauseEmailCampaignSending(supabase, {
                      campaignId: campaignIdForJob,
                      blockReason: isSharedSender
                        ? "shared_sender_disabled"
                        : "sender_domain_required",
                      errorMessage: pauseMessage,
                    });

                    await pauseJob(pauseMessage);
                    processedCount++;
                    continue;
                  }
                }
              }

              let messageIds: string[] = Array.isArray(
                job.recipient_message_ids,
              )
                ? job.recipient_message_ids
                : [];

              // Backfill message IDs when jobs were queued with recipient_emails only.
              if (messageIds.length === 0) {
                const recipientEmails: any[] = Array.isArray(
                  job.recipient_emails,
                )
                  ? job.recipient_emails
                  : [];
                const uuidLike = (v: string) =>
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    v,
                  );

                const customerIds = recipientEmails
                  .map((r: any) => r?.customerId)
                  .filter((v: any) => typeof v === "string" && uuidLike(v));

                if (customerIds.length > 0) {
                  const ids: string[] = [];
                  const IN_CHUNK = 200;
                  for (let i = 0; i < customerIds.length; i += IN_CHUNK) {
                    const chunk = customerIds.slice(i, i + IN_CHUNK);
                    const { data: rows, error: fetchErr } = await supabase
                      .from("email_messages")
                      .select("id")
                      .eq("campaign_id", job.campaign_id)
                      .in("customer_id", chunk);

                    if (fetchErr) {
                      console.warn(
                        `⚠️ Failed to resolve message ids for job ${job.id}:`,
                        fetchErr.message,
                      );
                      break;
                    }
                    (rows || []).forEach((r: any) => {
                      if (typeof r?.id === "string") ids.push(r.id);
                    });
                  }

                  messageIds = ids;

                  // Cache resolved ids back on the job to avoid repeating this work.
                  if (messageIds.length > 0) {
                    await supabase
                      .from("email_send_jobs")
                      .update({
                        recipient_message_ids: messageIds,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", job.id)
                      .eq("claim_token", claimToken);
                  }
                }
              }

              console.log(
                `📧 Processing job ${job.id} (batch ${job.batch_index}, ${messageIds.length} messages)`,
              );

              if (messageIds.length === 0) {
                await supabase
                  .from("email_send_jobs")
                  .update({
                    status: "completed",
                    emails_sent: 0,
                    emails_failed: 0,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id)
                  .eq("claim_token", claimToken);
                processedCount++;
                continue;
              }

              // Load messages for this job
              const { data: messages, error: msgFetchError } = await supabase
                .from("email_messages")
                .select(
                  "id, tenant_id, campaign_id, customer_id, domain_id, email, payload, status, resend_id, attempts, dead_lettered_at, claimed_at",
                )
                .in("id", messageIds);

              if (msgFetchError) {
                const errMsg = truncateError(msgFetchError.message);
                console.error(
                  `❌ Failed to load email_messages for job ${job.id}:`,
                  msgFetchError,
                );
                await supabase
                  .from("email_send_jobs")
                  .update({
                    status: "pending",
                    error_message: errMsg,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id)
                  .eq("claim_token", claimToken);
                continue;
              }

              let emailsSent = 0;
              let emailsFailed = 0;
              let lastError: string | null = null;
              let jobWasPaused = false;
              let jobDeferredForRateLimit = false;

              const staleThresholdIso = new Date(
                Date.now() - messageStaleMinutes * 60 * 1000,
              ).toISOString();

              const sendable = (messages || []).filter((m: any) => {
                if (m.dead_lettered_at) return false;
                if (m.status === "queued") {
                  // ok
                } else if (m.status === "sending") {
                  if (!m.claimed_at) return false;
                  if (new Date(m.claimed_at).toISOString() >= staleThresholdIso)
                    return false;
                } else {
                  return false;
                }
                if (m.resend_id) return false;
                return true;
              });

              // Claim messages (idempotency + concurrency guard)
              let claimedForSend: any[] = [];
              for (const m of sendable) {
                // Increment attempts and mark as sending only if still queued and unsent
                let claimQuery = supabase
                  .from("email_messages")
                  .update({
                    status: "sending",
                    attempts: (m.attempts || 0) + 1,
                    last_attempt_at: nowIso,
                    claimed_at: nowIso,
                    claimed_by: workerId,
                    claim_token: claimToken,
                    updated_at: nowIso,
                  })
                  .eq("id", m.id)
                  .is("resend_id", null);

                // Reclaim stale in-flight messages safely (send uses per-message idempotency key).
                if (m.status === "sending") {
                  claimQuery = claimQuery
                    .eq("status", "sending")
                    .lt("claimed_at", staleThresholdIso);
                } else {
                  claimQuery = claimQuery.eq("status", "queued");
                }

                const { data: claimed, error: claimMsgErr } = await claimQuery
                  .select(
                    "id, payload, attempts, tenant_id, domain_id, campaign_id, customer_id, email",
                  )
                  .maybeSingle();

                if (claimMsgErr) {
                  console.warn(
                    `⚠️ Failed to claim message ${m.id}:`,
                    claimMsgErr.message,
                  );
                  continue;
                }
                if (!claimed) continue;

                claimedForSend.push(claimed);
              }

              // Re-check suppression at send-time (Milestone 5: suppression_list is canonical).
              // This prevents sending to recipients who unsubscribe/bounce/complain after queuing.
              if (claimedForSend.length > 0) {
                const tenantIdForJob = String(
                  claimedForSend[0]?.tenant_id ||
                    messages?.[0]?.tenant_id ||
                    "",
                );

                if (tenantIdForJob) {
                  const suppressionBypassState =
                    await getTenantSuppressionBypassState(
                      supabase,
                      tenantIdForJob,
                    );

                  const bypassSuppressionTypes =
                    suppressionBypassState.suppression_bypass_active
                      ? ["bounced", "hard_bounce", "complaint", "complained"]
                      : [];

                  const eligibility = await canSendEmailBatch(
                    supabase,
                    {
                      tenantId: tenantIdForJob,
                      recipients: claimedForSend
                        .filter(
                          (m: any) =>
                            typeof m?.email === "string" && m.email.trim(),
                        )
                        .map((m: any) => ({
                          customerId: m.customer_id,
                          email: m.email,
                        })),
                    },
                    {
                      bypassSuppressionTypes,
                    },
                  );

                  const suppressedMsgIds: string[] = [];
                  const skipLogs: Array<{
                    tenantId: string;
                    campaignId?: string;
                    customerId?: string;
                    email: string;
                    reason: any;
                  }> = [];

                  const remaining: any[] = [];
                  for (const msg of claimedForSend) {
                    const email = String(msg?.email || "")
                      .toLowerCase()
                      .trim();
                    const result = eligibility.get(email);
                    if (result && result.allowed === false) {
                      suppressedMsgIds.push(String(msg.id));
                      skipLogs.push({
                        tenantId: tenantIdForJob,
                        campaignId: msg.campaign_id,
                        customerId: msg.customer_id,
                        email: String(msg.email || email),
                        reason: result.reason || "unsubscribed",
                      });
                      continue;
                    }
                    remaining.push(msg);
                  }

                  if (suppressedMsgIds.length > 0) {
                    await supabase
                      .from("email_messages")
                      .update({
                        status: "skipped",
                        error_message: "suppressed",
                        claim_token: null,
                        claimed_at: null,
                        claimed_by: null,
                        updated_at: new Date().toISOString(),
                      })
                      .in("id", suppressedMsgIds)
                      .eq("claim_token", claimToken)
                      .is("resend_id", null);

                    await logSkippedSends(supabase, skipLogs as any);
                    await recordCampaignProgress(
                      campaignIdForJob,
                      0,
                      0,
                      suppressedMsgIds.length,
                    );

                    console.log(
                      `📧 Skipped ${suppressedMsgIds.length} messages due to suppression_list`,
                    );
                  }

                  claimedForSend = remaining;
                }
              }

              const needsPayloadBuild = claimedForSend.some((m: any) => {
                const payload = m?.payload;
                return (
                  !payload ||
                  typeof payload !== "object" ||
                  !payload?.html ||
                  !payload?.subject ||
                  !payload?.to
                );
              });

              // Preload campaign + company profile + tracked links once per campaign to build payloads when needed.
              const campaignId: string = String(
                job.campaign_id ||
                  claimedForSend[0]?.campaign_id ||
                  messages?.[0]?.campaign_id ||
                  "",
              );

              let campaign: any = null;
              let companyProfile: any = null;
              let campaignSource: CampaignEmailSource | null = null;
              let senderEmail: string = "";
              let senderDisplayName: string = "Your Garden Center";
              let usesVerifiedDomain = false;
              let activeDomainId: string | null = null;
              let replyToEmail: string | undefined;
              let urlToLinkIdMap: Map<string, string> | null = null;

              const customersById = new Map<string, any>();

              if (needsPayloadBuild && campaignId) {
                if (!campaignCache.has(campaignId)) {
                  const { data: cRow, error: cErr } = await supabase
                    .from("crm_campaigns")
                    .select(
                      "id, tenant_id, user_id, status, content, metadata, subject_line, from_email_domain_id, actual_sender_email, sender_display_name, delivery_method",
                    )
                    .eq("id", campaignId)
                    .maybeSingle();
                  if (cErr)
                    console.warn(
                      "⚠️ Failed to load campaign for payload build:",
                      cErr.message,
                    );
                  if (cRow) campaignCache.set(campaignId, cRow);
                }

                campaign = campaignCache.get(campaignId) || null;

                if (campaign?.user_id) {
                  const userId = String(campaign.user_id);
                  if (!companyProfileCache.has(userId)) {
                    const { data: pRow, error: pErr } = await supabase
                      .from("company_profiles")
                      .select(
                        `
                  email_auth_status, custom_sender_email, company_name, location_info,
                  street_address, city, state_province, postal_code, country,
                  website_url, company_email, company_phone,
                  facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
                  footer_legal_text, brand_primary_color, brand_text_color, feature_flags
                `,
                      )
                      .eq("user_id", userId)
                      .maybeSingle();
                    if (pErr)
                      console.warn(
                        "⚠️ Failed to load company profile for payload build:",
                        pErr.message,
                      );
                    if (pRow) companyProfileCache.set(userId, pRow);
                  }
                  companyProfile = companyProfileCache.get(userId) || null;
                }

                if (campaign) {
                  if (!campaignSourceCache.has(campaignId)) {
                    const resolvedSource = await resolveCampaignEmailSource(
                      supabase,
                      campaign,
                    );
                    if (resolvedSource.warning) {
                      console.warn(`⚠️ ${resolvedSource.warning}`, {
                        campaignId,
                        source: resolvedSource.source,
                      });
                    }
                    campaignSourceCache.set(campaignId, resolvedSource);
                  }
                  campaignSource = campaignSourceCache.get(campaignId) || null;

                  senderEmail = campaign.actual_sender_email || "";
                  senderDisplayName =
                    campaign.sender_display_name ||
                    companyProfile?.company_name ||
                    "Your Garden Center";
                  usesVerifiedDomain =
                    campaign.delivery_method === "custom_domain" &&
                    !!senderEmail;

                  activeDomainId =
                    campaign.from_email_domain_id ||
                    messages?.[0]?.domain_id ||
                    null;
                  if (activeDomainId && !replyToCache.has(activeDomainId)) {
                    const { data: dRow, error: dErr } = await supabase
                      .from("email_domains")
                      .select("default_reply_to")
                      .eq("id", activeDomainId)
                      .maybeSingle();
                    if (dErr)
                      console.warn(
                        "⚠️ Failed to load domain reply-to:",
                        dErr.message,
                      );
                    replyToCache.set(
                      activeDomainId,
                      dRow?.default_reply_to || undefined,
                    );
                  }
                  if (activeDomainId)
                    replyToEmail = replyToCache.get(activeDomainId);
                }
              }

              // Preload customer records for merge tags (only for messages we might send).
              if (needsPayloadBuild) {
                const customerIdsForJob = Array.from(
                  new Set((sendable || []).map((m: any) => m?.customer_id)),
                ).filter((v: any) => typeof v === "string" && isUuidLike(v));
                if (customerIdsForJob.length > 0) {
                  const tenantId = messages?.[0]?.tenant_id;
                  const IN_CHUNK = 200;
                  for (let i = 0; i < customerIdsForJob.length; i += IN_CHUNK) {
                    const chunk = customerIdsForJob.slice(i, i + IN_CHUNK);
                    let q = supabase
                      .from("crm_customers")
                      .select(
                        "id, email, first_name, last_name, phone, lifetime_value, total_spent, first_purchase_date, last_purchase_date, custom_fields",
                      );
                    if (tenantId) q = q.eq("tenant_id", tenantId);
                    const { data: custRows, error: custErr } = await q.in(
                      "id",
                      chunk,
                    );
                    if (custErr) {
                      console.warn(
                        "⚠️ Failed to load crm_customers for payload build:",
                        custErr.message,
                      );
                      break;
                    }
                    (custRows || []).forEach((c: any) => {
                      if (typeof c?.id === "string") customersById.set(c.id, c);
                    });
                  }
                }
              }

              if (needsPayloadBuild && campaign && campaignSource) {
                if (!trackedLinkMapCache.has(campaignId)) {
                  const map = new Map<string, string>();
                  const { data: existingLinks, error: linksErr } =
                    await supabase
                      .from("tracked_links")
                      .select("id, url")
                      .eq("campaign_id", campaignId)
                      .eq("tenant_id", campaign.tenant_id);
                  if (linksErr) {
                    console.warn(
                      "⚠️ Failed to load tracked_links:",
                      linksErr.message,
                    );
                  }
                  (existingLinks || []).forEach((link: any) => {
                    if (
                      typeof link?.url === "string" &&
                      typeof link?.id === "string"
                    ) {
                      map.set(link.url, link.id);
                    }
                  });

                  if (map.size === 0) {
                    const representativeCustomer =
                      Array.from(customersById.values())[0] ||
                      (sendable[0]
                        ? {
                            id: sendable[0].customer_id,
                            email: sendable[0].email,
                          }
                        : null);

                    const preflightRender = renderEmailForRecipient({
                      tenantId: campaign.tenant_id,
                      campaignId,
                      subject:
                        campaign.subject_line ||
                        "Newsletter from your Garden Center",
                      html: campaignSource.html,
                      contentBlocks: campaignSource.contentBlocks,
                      customer: representativeCustomer
                        ? toCustomerShape(representativeCustomer)
                        : null,
                      companyProfile: companyProfile as CompanyProfileShape,
                      mode: "send",
                      includeFooter: true,
                      enableLinkTracking: false,
                    });

                    const uniqueUrls = getUniqueUrls(
                      extractLinks(preflightRender.renderedHtml),
                    );
                    const urlsToTrack = uniqueUrls.filter(
                      (url) => !hasPII(url),
                    );
                    if (urlsToTrack.length > 0) {
                      const inserts = urlsToTrack.map((url) => ({
                        tenant_id: campaign.tenant_id,
                        campaign_id: campaignId,
                        url,
                      }));
                      const { data: inserted, error: upErr } = await supabase
                        .from("tracked_links")
                        .upsert(inserts, {
                          onConflict: "tenant_id,campaign_id,url",
                          ignoreDuplicates: false,
                        })
                        .select("id, url");
                      if (upErr) {
                        console.warn(
                          "⚠️ Failed to upsert tracked_links:",
                          upErr.message,
                        );
                      }
                      (inserted || []).forEach((link: any) => {
                        if (
                          typeof link?.url === "string" &&
                          typeof link?.id === "string"
                        ) {
                          map.set(link.url, link.id);
                        }
                      });
                    }
                  }

                  trackedLinkMapCache.set(campaignId, map);
                }
                urlToLinkIdMap = trackedLinkMapCache.get(campaignId) || null;
              }

              // Send claimed messages using Resend batch endpoint.
              // Batch size adapts downward on provider rate limits and recovers upward after sustained success.
              for (let i = 0; i < claimedForSend.length; ) {
                const currentResendBatchSize = Math.max(
                  1,
                  Math.min(MAX_RESEND_BATCH_SIZE, dynamicResendBatchSize),
                );

                // FIX: [GH3] - Run batch safety check BEFORE each batch to gate whether sending should continue
                if (campaignId && i > 0) {
                  const preBatchSafety = await evaluateCampaignBatchSafety(
                    supabase,
                    campaignId,
                  );
                  if (preBatchSafety.shouldPause) {
                    console.warn(
                      `🛑 Pre-batch safety check paused campaign ${campaignId}: ${preBatchSafety.pauseReason || "threshold exceeded"}`,
                    );
                    await pauseJob(
                      preBatchSafety.pauseReason ||
                        "Campaign paused by pre-batch safety check",
                    );
                    jobWasPaused = true;

                    // FIX: [GM3] - Log batch safety pause to audit trail for admin visibility
                    await supabase
                      .from("email_governance_audit_logs")
                      .insert({
                        tenant_id: job.tenant_id || messages?.[0]?.tenant_id,
                        actor_type: "system",
                        action_type: "campaign_paused",
                        decision: "block",
                        reason: `Pre-batch safety triggered: ${preBatchSafety.pauseReason || "threshold exceeded"}`,
                        policy_name: "batch_safety",
                        campaign_id: campaignId,
                        metadata: {
                          metrics: preBatchSafety,
                          phase: "pre_batch",
                        },
                      })
                      .catch((e: any) =>
                        console.warn("Audit log write failed:", e),
                      );

                    break;
                  }
                }

                const batchMsgs = claimedForSend.slice(
                  i,
                  i + currentResendBatchSize,
                );
                console.log(
                  `📧 Sending ${batchMsgs.length} emails (batch request, size ${currentResendBatchSize})...`,
                );

                if (campaignId) {
                  const liveIntervention = await getCampaignInterventionState(
                    supabase,
                    campaignId,
                  );
                  if (
                    liveIntervention.force_stopped ||
                    liveIntervention.admin_paused
                  ) {
                    await pauseJob("Campaign is paused.");
                    jobWasPaused = true;
                    break;
                  }

                  const livePolicy = await getCampaignReputationPolicy(
                    supabase,
                    campaignId,
                  );
                  if (
                    livePolicy.action === "pause" &&
                    !liveIntervention.autopause_override_final
                  ) {
                    const pauseMessage = `Campaign auto-paused mid-send: tenant reputation score ${livePolicy.score} is below 60.`;
                    await systemPauseEmailCampaignSending(supabase, {
                      campaignId,
                      blockReason: "reputation_critical_autopause",
                      errorMessage: pauseMessage,
                    });

                    await pauseJob(pauseMessage);
                    jobWasPaused = true;
                    break;
                  }

                  const { data: state, error: stErr } = await supabase
                    .from("crm_campaigns")
                    .select("status")
                    .eq("id", campaignId)
                    .maybeSingle();

                  if (stErr) {
                    console.warn(
                      "⚠️ Failed to check campaign pause state (continuing):",
                      stErr.message,
                    );
                  } else if (state?.status === "paused") {
                    const remainingMsgIds = claimedForSend
                      .slice(i)
                      .map((m: any) => m?.id)
                      .filter(
                        (id: any) => typeof id === "string" && id.length > 0,
                      );

                    if (remainingMsgIds.length > 0) {
                      await supabase
                        .from("email_messages")
                        .update({
                          status: "paused",
                          error_message: null,
                          claim_token: null,
                          claimed_at: null,
                          claimed_by: null,
                          updated_at: new Date().toISOString(),
                        })
                        .in("id", remainingMsgIds)
                        .eq("claim_token", claimToken)
                        .is("resend_id", null);
                    }

                    await pauseJob(null);
                    jobWasPaused = true;
                    break;
                  }
                }

                // Build payloads (can be CPU-heavy; but we only do it for this batch)
                const payloads: any[] = [];
                const msgIds: string[] = [];
                const attemptsByMsgId = new Map<string, number>();
                const missingPayloadErrors: Array<{
                  msgId: string;
                  attempts: number;
                  error: string;
                }> = [];
                const snapshotUpdates: Array<{ msgId: string; payload: any }> =
                  [];

                for (const msg of batchMsgs) {
                  let payload = msg.payload;
                  const missing =
                    !payload ||
                    typeof payload !== "object" ||
                    !payload?.html ||
                    !payload?.subject ||
                    !payload?.to;

                  if (missing && campaign && campaignSource) {
                    const fromAddress = `${senderDisplayName} <${senderEmail}>`;
                    const customer = customersById.get(msg.customer_id) || {
                      id: msg.customer_id,
                      email: msg.email,
                    };
                    payload = buildEmailPayloadOptimized(
                      customer,
                      campaign,
                      companyProfile as CompanyProfileShape,
                      campaignSource,
                      fromAddress,
                      senderEmail,
                      usesVerifiedDomain,
                      activeDomainId,
                      urlToLinkIdMap,
                      replyToEmail,
                    );

                    snapshotUpdates.push({ msgId: msg.id, payload });
                  }

                  if (
                    !payload ||
                    typeof payload !== "object" ||
                    !payload?.html ||
                    !payload?.subject ||
                    !payload?.to
                  ) {
                    missingPayloadErrors.push({
                      msgId: msg.id,
                      attempts: msg.attempts || 1,
                      error: "Missing email payload and unable to build it",
                    });
                    continue;
                  }

                  payloads.push(payload);
                  msgIds.push(msg.id);
                  attemptsByMsgId.set(msg.id, msg.attempts || 1);
                }

                if (snapshotUpdates.length > 0) {
                  await Promise.all(
                    snapshotUpdates.map(async ({ msgId, payload }) => {
                      const { error: snapshotErr } = await supabase
                        .from("email_messages")
                        .update({
                          payload,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", msgId)
                        .eq("claim_token", claimToken)
                        .is("resend_id", null);

                      if (snapshotErr) {
                        console.warn(
                          `⚠️ Failed to persist payload snapshot for message ${msgId}:`,
                          snapshotErr.message,
                        );
                      }
                    }),
                  );
                }

                // If everything in the batch is missing payload, just treat as failures.
                const results: Array<{
                  msgId: string;
                  attempts: number;
                  resendId?: string;
                  error?: string;
                  status?: number;
                }> = [];
                for (const m of missingPayloadErrors) {
                  results.push({
                    msgId: m.msgId,
                    attempts: m.attempts,
                    error: m.error,
                  });
                }

                let batchWasRateLimited = false;
                let retryAfterSeconds = 0;

                if (payloads.length > 0) {
                  const idemSeed = `${job.id}:${campaignId}:${msgIds.join(",")}`;
                  const batchResp = await resendSendBatch(
                    resendApiKey,
                    payloads,
                    idemSeed,
                    jobResendLimiter,
                  );

                  if (batchResp.rateLimited) {
                    lowerDynamicResendBatchSize();
                    batchWasRateLimited = true;
                    retryAfterSeconds = Math.max(
                      1,
                      batchResp.retryAfterSeconds || 30,
                    );
                    for (const msgId of msgIds) {
                      results.push({
                        msgId,
                        attempts: attemptsByMsgId.get(msgId) || 1,
                        error: batchResp.error || "Provider rate limited",
                        status: batchResp.status,
                      });
                    }
                  } else if (
                    batchResp.ids &&
                    batchResp.ids.length === payloads.length
                  ) {
                    maybeRaiseDynamicResendBatchSize();
                    for (let k = 0; k < batchResp.ids.length; k++) {
                      const msgId = msgIds[k];
                      const resendId = batchResp.ids[k]?.id;
                      results.push({
                        msgId,
                        attempts: attemptsByMsgId.get(msgId) || 1,
                        resendId,
                        error: resendId
                          ? undefined
                          : "Resend batch returned missing id",
                        status: batchResp.status,
                      });
                    }
                  } else {
                    consecutiveSuccessfulBatchRequests = 0;
                    const err = batchResp.error || "Resend batch failed";
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
                  const errMsg = r.resendId
                    ? null
                    : truncateError(r.error || "Send failed");
                  const isRateLimited =
                    !r.resendId &&
                    (r.status === 429 || isRateLimitErrorMessage(errMsg || ""));
                  return {
                    msg_id: r.msgId,
                    resend_id: r.resendId || null,
                    error_message: errMsg,
                    attempts: r.attempts || 1,
                    is_rate_limited: isRateLimited,
                  };
                });

                const { data: applied, error: applyErr } = await supabase.rpc(
                  "apply_email_send_results",
                  {
                    p_claim_token: claimToken,
                    p_results: rpcResults,
                    p_max_attempts: MAX_ATTEMPTS,
                  },
                );

                if (applyErr) {
                  console.warn(
                    "⚠️ Failed to apply send results in bulk:",
                    applyErr.message,
                  );
                  // Fallback: keep going, but counts will be best-effort.
                }

                const appliedRow = Array.isArray(applied)
                  ? applied[0]
                  : applied;
                const appliedSent = Number(appliedRow?.updated_sent || 0);
                const appliedFailed = Number(appliedRow?.updated_failed || 0);
                const appliedQueued = Number(appliedRow?.updated_queued || 0);
                emailsSent += appliedSent;
                emailsFailed += appliedFailed;
                if (campaignId) {
                  await recordCampaignProgress(
                    campaignId,
                    appliedSent,
                    appliedFailed,
                    0,
                  );
                }
                if (appliedFailed > 0 || appliedQueued > 0) {
                  const last = results.find(
                    (r) => !r.resendId && r.error,
                  )?.error;
                  lastError = truncateError(last || lastError || "Send failed");
                }

                if (batchWasRateLimited) {
                  const deferredUntilIso = new Date(
                    Date.now() + retryAfterSeconds * 1000,
                  ).toISOString();
                  const unattemptedMessageIds = claimedForSend
                    .slice(i + batchMsgs.length)
                    .map((m: any) => m?.id)
                    .filter(
                      (id: any) => typeof id === "string" && id.length > 0,
                    );

                  if (unattemptedMessageIds.length > 0) {
                    await supabase
                      .from("email_messages")
                      .update({
                        status: "queued",
                        error_message: "rate_limited",
                        claim_token: null,
                        claimed_at: null,
                        claimed_by: null,
                        updated_at: new Date().toISOString(),
                      })
                      .in("id", unattemptedMessageIds)
                      .eq("claim_token", claimToken)
                      .is("resend_id", null);
                  }

                  if (campaignId) {
                    await deferCampaignForRateLimit(
                      campaignId,
                      job.tenant_id || messages?.[0]?.tenant_id,
                      retryAfterSeconds,
                      results.find((r) => r.status === 429)?.status,
                    );
                  }

                  await supabase
                    .from("email_send_jobs")
                    .update({
                      status: "pending",
                      available_at: deferredUntilIso,
                      error_message:
                        lastError || "Deferred after provider rate limit",
                      claim_token: null,
                      claimed_at: null,
                      claimed_by: null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", job.id)
                    .eq("claim_token", claimToken);

                  jobDeferredForRateLimit = true;
                  break;
                }

                // Spacing between Resend requests is enforced globally by resendGlobalLimiter.
                // Add only the extra delay beyond the global minimum.
                const hasAnotherBatch =
                  i + batchMsgs.length < claimedForSend.length;
                i += batchMsgs.length;
                if (hasAnotherBatch && additionalBatchDelayMs > 0) {
                  await sleep(additionalBatchDelayMs);
                }
              }

              if (jobWasPaused || jobDeferredForRateLimit) {
                processedCount++;
                if (processedCount % 5 === 0) {
                  await touchCampaignHeartbeats([campaignId]);
                }
                continue;
              }

              // If any messages remain queued/sending, keep job pending for retry; otherwise complete.
              // IMPORTANT: never treat a query error as "no remaining" (that can incorrectly complete jobs).
              const { data: remainingRows, error: remainingErr } =
                await supabase
                  .from("email_messages")
                  .select("id")
                  .in("id", messageIds)
                  .in("status", ["queued", "paused", "sending"])
                  .limit(1);

              let hasRemaining = true;
              if (remainingErr) {
                console.warn(
                  `⚠️ Remaining-message check failed for job ${job.id}:`,
                  remainingErr.message,
                );
                lastError = truncateError(
                  lastError ||
                    `Remaining check failed: ${remainingErr.message}`,
                );
                hasRemaining = true;
              } else {
                hasRemaining = (remainingRows || []).length > 0;
              }

              // Durable job stats (derived from the source-of-truth ledger)
              // Fall back to the existing job counters if the query fails (avoid clobbering with zeros).
              let durableSent = Number(job?.emails_sent || 0);
              let durableFailed = Number(job?.emails_failed || 0);

              const { data: sentCountRows, error: sentCountErr } =
                await supabase
                  .from("email_messages")
                  .select("id")
                  .in("id", messageIds)
                  .eq("status", "sent");

              if (sentCountErr) {
                console.warn(
                  `⚠️ Durable sent-count query failed for job ${job.id}:`,
                  sentCountErr.message,
                );
                lastError = truncateError(
                  lastError || `Sent count failed: ${sentCountErr.message}`,
                );
              } else {
                durableSent = (sentCountRows || []).length;
              }

              const { data: failedCountRows, error: failedCountErr } =
                await supabase
                  .from("email_messages")
                  .select("id")
                  .in("id", messageIds)
                  .eq("status", "failed");

              if (failedCountErr) {
                console.warn(
                  `⚠️ Durable failed-count query failed for job ${job.id}:`,
                  failedCountErr.message,
                );
                lastError = truncateError(
                  lastError || `Failed count failed: ${failedCountErr.message}`,
                );
              } else {
                durableFailed = (failedCountRows || []).length;
              }

              await supabase
                .from("email_send_jobs")
                .update({
                  status: hasRemaining ? "pending" : "completed",
                  emails_sent: durableSent,
                  emails_failed: durableFailed,
                  error_message: durableFailed > 0 ? lastError : null,
                  updated_at: nowIso,
                })
                .eq("id", job.id)
                .eq("claim_token", claimToken);

              const jobCampaignId = String(job?.campaign_id || "");
              if (jobCampaignId) {
                const safety = await evaluateCampaignBatchSafety(
                  supabase,
                  jobCampaignId,
                );

                const throttle = await evaluateCampaignWarningThrottle(
                  supabase,
                  jobCampaignId,
                );
                if (throttle.changed) {
                  if (throttle.throttled) {
                    console.warn(
                      `⚠️ Campaign ${jobCampaignId} throttling activated: ${throttle.reasons.join(", ") || "warning thresholds exceeded"}`,
                    );
                  } else {
                    console.log(
                      `✅ Campaign ${jobCampaignId} throttling cleared after metrics improved.`,
                    );
                  }

                  // FIX: [GM4] - Log throttle activation/clearing to audit trail
                  await supabase
                    .from("email_governance_audit_logs")
                    .insert({
                      tenant_id: job.tenant_id || messages?.[0]?.tenant_id,
                      actor_type: "system",
                      action_type: throttle.throttled
                        ? "throttle_activated"
                        : "throttle_cleared",
                      decision: throttle.throttled ? "warn" : "log",
                      reason: throttle.throttled
                        ? `Throttling activated: ${throttle.reasons.join(", ") || "warning thresholds exceeded"}`
                        : "Throttling cleared after metrics improved",
                      policy_name: "warning_throttle",
                      campaign_id: jobCampaignId,
                      metadata: {
                        throttled: throttle.throttled,
                        reasons: throttle.reasons,
                      },
                    })
                    .catch((e: any) =>
                      console.warn("Audit log write failed:", e),
                    );
                }

                if (safety.shouldPause) {
                  await supabase
                    .from("email_send_jobs")
                    .update({
                      status: "paused",
                      error_message:
                        safety.pauseReason ||
                        "Campaign paused by safety controller",
                      claim_token: null,
                      claimed_at: null,
                      claimed_by: null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", job.id);
                  processedCount++;
                  if (processedCount % 5 === 0) {
                    await touchCampaignHeartbeats([jobCampaignId]);
                  }
                  console.warn(
                    `🛑 Campaign ${jobCampaignId} paused by batch safety controller: ${safety.pauseReason || "threshold exceeded"}`,
                  );

                  // FIX: [GM3] - Log batch safety pause to audit trail for admin visibility
                  await supabase
                    .from("email_governance_audit_logs")
                    .insert({
                      tenant_id: job.tenant_id || messages?.[0]?.tenant_id,
                      actor_type: "system",
                      action_type: "campaign_paused",
                      decision: "block",
                      reason: `Batch safety triggered: ${safety.pauseReason || "threshold exceeded"}`,
                      policy_name: "batch_safety",
                      campaign_id: jobCampaignId,
                      metadata: { metrics: safety, phase: "post_job" },
                    })
                    .catch((e: any) =>
                      console.warn("Audit log write failed:", e),
                    );

                  continue;
                }
              }

              totalEmailsSent += emailsSent;
              totalEmailsFailed += emailsFailed;
              processedCount++;
              if (processedCount % 5 === 0) {
                await touchCampaignHeartbeats([jobCampaignId]);
              }

              console.log(
                `✅ Job ${job.id} completed: ${emailsSent} sent, ${emailsFailed} failed (${Date.now() - jobStartTime}ms)`,
              );
            } catch (jobError: any) {
              console.error(`❌ Job ${job.id} failed:`, jobError.message);
              await supabase
                .from("email_send_jobs")
                .update({
                  status: "pending",
                  error_message: truncateError(jobError.message),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", job.id)
                .eq("claim_token", claimToken);
            }
          } while (false);
        };

        for (
          let jobIndex = 0;
          jobIndex < jobs.length;
          jobIndex += MAX_PARALLEL_JOBS
        ) {
          if (Date.now() - startTime > 50000) {
            console.log("⏱️ Approaching timeout, stopping processing");
            break;
          }

          const jobChunk = jobs.slice(jobIndex, jobIndex + MAX_PARALLEL_JOBS);
          await Promise.allSettled(
            jobChunk.map((job: any, offset: number) =>
              processClaimedJob(job, jobIndex + offset),
            ),
          );

          if (
            jobIndex + MAX_PARALLEL_JOBS < jobs.length &&
            additionalBatchDelayMs > 0
          ) {
            await sleep(additionalBatchDelayMs);
          }
        }

        // Campaign completion is based on the persisted email_messages ledger.
        const campaignIds = [
          ...new Set((jobs || []).map((j: any) => j.campaign_id)),
        ];
        for (const campaignId of campaignIds) {
          const { data: campaignRow } = await supabase
            .from("crm_campaigns")
            .select("status")
            .eq("id", campaignId)
            .maybeSingle();

          if (campaignRow?.status === "paused") {
            continue;
          }

          // If any queued/sending messages remain, campaign is still in progress.
          const { data: remaining } = await supabase
            .from("email_messages")
            .select("id")
            .eq("campaign_id", campaignId)
            .in("status", ["queued", "sending", "paused"])
            .limit(1);

          if (remaining && remaining.length > 0) {
            continue;
          }

          // Compute final metrics from email_messages
          const { data: sentRows } = await supabase
            .from("email_messages")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("status", "sent");

          const { data: failedRows } = await supabase
            .from("email_messages")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("status", "failed");

          const totalSent = (sentRows || []).length;
          const totalFailed = (failedRows || []).length;
          const hasErrors = totalFailed > 0;

          const completedAt = new Date().toISOString();
          const { error: finalizeCampaignError } = await supabase
            .from("crm_campaigns")
            .update({
              status: hasErrors ? "sent_with_errors" : "sent",
              total_sent: totalSent,
              sent_at: completedAt,
              send_completed_at: completedAt,
              worker_heartbeat_at: completedAt,
              estimated_completion_at: completedAt,
              messages_sent: totalSent,
              messages_failed: totalFailed,
              metrics: {
                sent: totalSent,
                failed: totalFailed,
                opens: 0,
                clicks: 0,
                unsubscribes: 0,
              },
              send_blocked_reason: hasErrors
                ? `${totalFailed} recipient(s) failed after ${MAX_ATTEMPTS} attempts`
                : null,
            })
            .eq("id", campaignId);

          if (finalizeCampaignError) {
            console.error("❌ Failed to finalize campaign status", {
              campaignId,
              error: finalizeCampaignError,
            });
            continue;
          }

          console.log(
            `🎉 Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed${hasErrors ? " (with errors)" : ""}`,
          );
        }

        const hardStopNotifications = await dispatchTenantHardStopNotifications(
          supabase,
          resendApiKey,
          workerId,
          25,
        );

        const domainCrisisNotifications =
          await dispatchDomainCrisisNotifications(
            supabase,
            resendApiKey,
            workerId,
            25,
          );

        if (hardStopNotifications.claimed > 0) {
          console.log(
            `📣 Hard-stop notifications processed: claimed=${hardStopNotifications.claimed}, sent=${hardStopNotifications.sent}, failed=${hardStopNotifications.failed}`,
          );
        }

        if (domainCrisisNotifications.claimed > 0) {
          console.log(
            `📣 Domain crisis notifications processed: claimed=${domainCrisisNotifications.claimed}, sent=${domainCrisisNotifications.sent}, failed=${domainCrisisNotifications.failed}`,
          );
        }

        const duration = Date.now() - startTime;
        console.log(
          `✅ Queue processing complete: ${processedCount} jobs, ${totalEmailsSent} emails sent, ${totalEmailsFailed} failed (${duration}ms)`,
        );
      } catch (error: any) {
        console.error(
          `[process-email-send-queue][${runId}] ❌ Critical error in queue processor:`,
          error,
        );
        return;
      }
    })(),
  );

  return acceptedResponse;
});
