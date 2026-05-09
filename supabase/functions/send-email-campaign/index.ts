import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  extractLinks,
  getUniqueUrls,
  hasPII,
} from "../_shared/linkRewriter.ts";
import {
  serializeSupabaseError,
  isUuidLike,
} from "../_shared/campaignHelpers.ts";
import { canSendEmailBatch, logSkippedSends } from "../_shared/canSendEmail.ts";
import {
  analyzeCampaignListHygiene,
  persistCampaignHygieneReport,
} from "../_shared/listHygieneAnalyzer.ts";
import { getEmailGovernanceRuntimeConfig } from "../_shared/emailGovernanceConfig.ts";
import {
  renderEmailForRecipient,
  type CompanyProfileShape,
  type CustomerShape,
} from "../_shared/emailRenderer.ts";
import { resolveCampaignEmailSource } from "../_shared/campaignEmailContent.ts";
import { COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT } from "../_shared/resolveDesignSystem.ts";
import { resolveCampaignSenderDisplayName } from "../_shared/campaignFromHeader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

const DEFAULT_BATCH_SIZE_PER_JOB = 50;

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
  suppression_bypass_automation_mode:
    | "campaign_only"
    | "campaign_and_automation";
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
    return {
      suppression_bypass_active: false,
      suppression_bypass_automation_mode: "campaign_only",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const mode =
    String(
      row?.suppression_bypass_automation_mode || "campaign_only",
    ).toLowerCase() === "campaign_and_automation"
      ? "campaign_and_automation"
      : "campaign_only";

  return {
    suppression_bypass_active: Boolean(row?.suppression_bypass_active),
    suppression_bypass_automation_mode: mode,
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
      "⚠️ Failed to fetch campaign intervention state, defaulting to no override:",
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
      : DEFAULT_BATCH_SIZE_PER_JOB,
    send_pacing_multiplier: Number.isFinite(Number(row?.send_pacing_multiplier))
      ? Number(row.send_pacing_multiplier)
      : 1,
  };
}

function getAdaptiveBatchSizePerJob(
  totalRecipients: number,
  policyBatchSize: number,
  maxBatchSizePerJob: number,
): number {
  let adaptiveBatchSize = DEFAULT_BATCH_SIZE_PER_JOB;

  if (totalRecipients > 50000) {
    adaptiveBatchSize = 250;
  } else if (totalRecipients > 10000) {
    adaptiveBatchSize = 200;
  } else if (totalRecipients > 1000) {
    adaptiveBatchSize = 100;
  }

  return Math.max(
    1,
    Math.min(adaptiveBatchSize, policyBatchSize, maxBatchSizePerJob),
  );
}

function getInitialMessageInsertChunkSize(totalRecipients: number): number {
  if (totalRecipients > 10000) {
    return 500;
  }

  if (totalRecipients > 1000) {
    return 250;
  }

  return 200;
}

function getQueueAvailabilityPlan(params: {
  totalRecipients: number;
  totalBatches: number;
  batchSizePerJob: number;
  sendPacingMultiplier: number;
  batchDelayMinSeconds: number;
  batchDelayMaxSeconds: number;
}) {
  const configuredDelaySeconds = Math.max(
    1,
    Math.round((params.batchDelayMinSeconds + params.batchDelayMaxSeconds) / 2),
  );
  const configuredEmailsPerMinute = Math.floor(
    (60 / configuredDelaySeconds) * params.batchSizePerJob,
  );
  const scaledHeadroomPerMinute = Math.max(
    params.batchSizePerJob * 2,
    Math.floor(1500 / Math.max(1, params.sendPacingMultiplier)),
  );
  const estimatedEmailsPerMinute = Math.max(
    configuredEmailsPerMinute,
    scaledHeadroomPerMinute,
  );
  const jobsPerMinute = Math.max(
    2,
    Math.floor(estimatedEmailsPerMinute / Math.max(1, params.batchSizePerJob)),
  );
  const immediateJobCount = Math.min(6, params.totalBatches, jobsPerMinute);

  return {
    estimatedEmailsPerMinute,
    jobsPerMinute,
    immediateJobCount,
  };
}

function stripHtml(input: string): string {
  return String(input || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeHeuristicSpamScore(
  subject: string,
  htmlContent: string,
): { score: number; issues: string[] } {
  const issues: string[] = [];
  const text = stripHtml(htmlContent);
  const normalizedSubject = String(subject || "").trim();

  let score = 0;

  if (!normalizedSubject) {
    score += 3;
    issues.push("Missing subject line");
  }

  if (!text) {
    score += 3;
    issues.push("Missing email body content");
  }

  const spamWords = [
    "FREE",
    "URGENT",
    "ACT NOW",
    "LIMITED TIME",
    "CLICK HERE",
    "BUY NOW",
  ];
  const subjectUpper = normalizedSubject.toUpperCase();
  const foundSpamWords = spamWords.filter((word) =>
    subjectUpper.includes(word),
  );
  if (foundSpamWords.length > 0) {
    score += Math.min(4, foundSpamWords.length * 1.2);
    issues.push(`Spam-trigger words in subject: ${foundSpamWords.join(", ")}`);
  }

  if ((normalizedSubject.match(/[!?]{2,}/g) || []).length > 0) {
    score += 1.5;
    issues.push("Excessive punctuation in subject");
  }

  if (
    normalizedSubject.length > 10 &&
    normalizedSubject === normalizedSubject.toUpperCase()
  ) {
    score += 2;
    issues.push("Subject appears to be ALL CAPS");
  }

  const imageCount = (String(htmlContent || "").match(/<img\b/gi) || []).length;
  const linkCount = (String(htmlContent || "").match(/<a\s+href/gi) || [])
    .length;
  if (linkCount > 10) {
    score += linkCount > 20 ? 2 : 1;
    issues.push(`High link density (${linkCount} links)`);
  }

  if (imageCount > 0) {
    const textToImageRatio = text.length / imageCount;
    if (textToImageRatio < 100) {
      score += 1.5;
      issues.push("Low text-to-image ratio");
    }
  }

  return {
    score: Math.min(10, Math.max(0, Number(score.toFixed(1)))),
    issues,
  };
}

function hasPhysicalAddress(companyProfile: any): boolean {
  const hasStreetLike = Boolean(
    String(
      companyProfile?.street_address || companyProfile?.location_info || "",
    ).trim(),
  );
  const hasLocality = Boolean(
    String(companyProfile?.city || "").trim() ||
    String(companyProfile?.state_province || "").trim() ||
    String(companyProfile?.postal_code || "").trim() ||
    String(companyProfile?.country || "").trim(),
  );
  return hasStreetLike && hasLocality;
}

function isFromNameValid(fromName: string): boolean {
  const normalized = String(fromName || "").trim();
  if (normalized.length < 2) return false;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return false;
  if (/^(no\s?-?reply|noreply|test|admin)$/i.test(normalized)) return false;
  return true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, includeSuppressed = false } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `📧 Send campaign request: campaignId=${campaignId}, includeSuppressed=${includeSuppressed}`,
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requesterJwt = (() => {
      const authHeader =
        req.headers.get("authorization") || req.headers.get("Authorization");
      if (!authHeader) return null;
      const trimmed = authHeader.trim();
      if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
      return trimmed.slice(7).trim() || null;
    })();

    const getRequesterUserId = async (): Promise<string | null> => {
      if (!requesterJwt) return null;
      try {
        const { data, error } = await supabase.auth.getUser(requesterJwt);
        if (error) return null;
        return data?.user?.id || null;
      } catch {
        return null;
      }
    };

    const pauseCampaignSafely = async (params: {
      campaignId: string;
      blockReason: string;
      errorMessage: string;
    }) => {
      const { campaignId, blockReason, errorMessage } = params;

      const { error: pauseError } = await supabase.rpc(
        "system_pause_email_campaign_sending",
        {
          p_campaign_id: campaignId,
          p_block_reason: blockReason,
          p_error_message: errorMessage,
        },
      );

      if (!pauseError) return;

      console.error(
        "❌ Failed to pause campaign via RPC; falling back to direct update:",
        {
          campaignId,
          blockReason,
          err: serializeSupabaseError(pauseError),
        },
      );

      const { error: directUpdateError } = await supabase
        .from("crm_campaigns")
        .update({
          status: "paused",
          send_blocked_reason: blockReason,
          send_error: errorMessage,
          sending_started_at: null,
          send_started_at: null,
          claim_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      if (directUpdateError) {
        console.error("❌ Failed to pause campaign via direct update:", {
          campaignId,
          err: serializeSupabaseError(directUpdateError),
        });
      }

      // Best-effort: also pause jobs/messages directly so the worker stops sending.
      // This mirrors the system RPC behavior and prevents continued delivery if the RPC is missing.
      const nowIso = new Date().toISOString();

      const { error: jobsPauseError } = await supabase
        .from("email_send_jobs")
        .update({
          status: "paused",
          error_message: null,
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: nowIso,
        })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "in_progress"]);

      if (jobsPauseError) {
        console.error("❌ Failed to pause send jobs via direct update:", {
          campaignId,
          err: serializeSupabaseError(jobsPauseError),
        });
      }

      const { error: messagesPauseError } = await supabase
        .from("email_messages")
        .update({
          status: "paused",
          error_message: null,
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: nowIso,
        })
        .eq("campaign_id", campaignId)
        .is("resend_id", null)
        .in("status", ["queued", "sending"]);

      if (messagesPauseError) {
        console.error("❌ Failed to pause messages via direct update:", {
          campaignId,
          err: serializeSupabaseError(messagesPauseError),
        });
      }
    };

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`📧 Starting email campaign send for campaign: ${campaignId}`);

    // Idempotent gate
    const { data: gate, error: gateError } = await supabase.rpc(
      "ensure_campaign_sending",
      {
        p_campaign_id: campaignId,
      },
    );

    if (gateError) {
      console.error("❌ Failed to gate campaign send:", gateError);
      return new Response(
        JSON.stringify({ error: "Failed to start campaign send" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gateRow = Array.isArray(gate) ? gate[0] : gate;
    if (!gateRow?.success) {
      return new Response(
        JSON.stringify({
          error: gateRow?.error_message || "Campaign cannot be sent",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("crm_campaigns")
      .select(`*, crm_segments (id, name)`)
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignError);
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterUserId = await getRequesterUserId();

    const logCampaignGovernanceDecision = async (params: {
      decision: "allow" | "block" | "warn" | "log";
      actionType: string;
      reason?: string;
      policyName?: string;
      policyVersion?: string;
      domainId?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        await supabase.from("email_governance_audit_logs").insert({
          tenant_id: campaign.tenant_id,
          actor_type: requesterUserId ? "user" : "system",
          actor_id: requesterUserId,
          action_type: params.actionType,
          decision: params.decision,
          reason: params.reason || null,
          policy_name: params.policyName || null,
          policy_version: params.policyVersion || null,
          campaign_id: campaignId,
          domain_id:
            typeof params.domainId === "string"
              ? params.domainId
              : campaign.from_email_domain_id || null,
          metadata: params.metadata || {},
          occurred_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn(
          "⚠️ Failed to write governance audit log (non-fatal):",
          error,
        );
      }
    };

    const governanceConfig = await getEmailGovernanceRuntimeConfig(
      supabase,
      campaign.tenant_id,
    );
    const campaignIntervention = await getCampaignInterventionState(
      supabase,
      campaignId,
    );

    if (
      campaignIntervention.force_stopped ||
      campaignIntervention.admin_paused
    ) {
      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: campaignIntervention.force_stopped
          ? "force_stopped"
          : "admin_paused",
        metadata: {
          force_stopped: campaignIntervention.force_stopped,
          admin_paused: campaignIntervention.admin_paused,
        },
      });
      return new Response(JSON.stringify({ error: "Campaign is paused." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reputationPolicy = await getCampaignReputationPolicy(
      supabase,
      campaignId,
    );
    if (
      reputationPolicy.action === "pause" &&
      !campaignIntervention.autopause_override_final
    ) {
      const pauseMessage = `Campaign auto-paused: tenant reputation score ${reputationPolicy.score} is below 60.`;
      await pauseCampaignSafely({
        campaignId,
        blockReason: "reputation_critical_autopause",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "reputation_critical_autopause",
        policyName: "campaign_reputation_policy",
        metadata: {
          message: pauseMessage,
          reputation: reputationPolicy,
          autopause_override_final:
            campaignIntervention.autopause_override_final,
        },
      });

      return new Response(
        JSON.stringify({
          error: pauseMessage,
          reason: "reputation_critical_autopause",
          reputation: reputationPolicy,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (reputationPolicy.action === "restrict") {
      const blockMessage = `Campaign blocked: tenant reputation score ${reputationPolicy.score} is in restricted tier (60-74).`;
      await supabase
        .from("crm_campaigns")
        .update({
          send_blocked_reason: "reputation_restricted",
          send_error: blockMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "reputation_restricted",
        policyName: "campaign_reputation_policy",
        metadata: {
          message: blockMessage,
          reputation: reputationPolicy,
        },
      });

      return new Response(
        JSON.stringify({
          error: blockMessage,
          reputation: reputationPolicy,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const maxBatchSizePerJob = governanceConfig.batch.max_batch_size;
    const batchDelayMinSeconds = governanceConfig.batch.delay_min_seconds;
    const batchDelayMaxSeconds = governanceConfig.batch.delay_max_seconds;
    const highVolumeThreshold =
      governanceConfig.compliance.high_volume_threshold;
    const spamScoreThreshold = governanceConfig.compliance.spam_score_threshold;

    // Get company profile
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select(COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT)
      .eq("user_id", campaign.user_id)
      .single();

    // Get customers based on targeting (segments + personas)
    let customers: any[] = [];

    // 1) Segment targeting
    const segmentIds: string[] = [];
    if (campaign.segment_id) segmentIds.push(campaign.segment_id);

    if (segmentIds.length === 0) {
      const { data: campaignSegments, error: campaignSegmentsError } =
        await supabase
          .from("campaign_segments")
          .select("segment_id")
          .eq("campaign_id", campaignId);

      if (campaignSegmentsError) {
        console.error(
          "Error fetching campaign_segments:",
          campaignSegmentsError,
        );
        return new Response(
          JSON.stringify({ error: "Failed to fetch campaign segments" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      (campaignSegments || []).forEach((cs: any) => {
        if (cs?.segment_id) segmentIds.push(cs.segment_id);
      });
    }

    // 2) Persona targeting
    const personaIds = new Set<string>();
    if (Array.isArray(campaign.persona_ids)) {
      for (const pid of campaign.persona_ids) {
        if (typeof pid === "string" && pid.trim()) personaIds.add(pid.trim());
      }
    }

    const { data: campaignPersonas, error: campaignPersonasError } =
      await supabase
        .from("campaign_personas")
        .select("persona_id")
        .eq("campaign_id", campaignId);

    if (campaignPersonasError) {
      console.error("Error fetching campaign_personas:", campaignPersonasError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaign personas" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    (campaignPersonas || []).forEach((cp: any) => {
      if (cp?.persona_id) personaIds.add(String(cp.persona_id));
    });

    const personaIdList = Array.from(personaIds);
    const personaUuidIds = personaIdList.filter(isUuidLike);
    const personaPredefinedIds = personaIdList.filter((x) => !isUuidLike(x));

    console.log(
      `📧 Audience targeting: segments=${segmentIds.length}, personas=${personaIdList.length}`,
    );

    // 3) Resolve customer IDs
    let allowedCustomerIds: string[] | null = null;

    if (segmentIds.length > 0) {
      const PAGE_SIZE = 1000;
      const segmentCustomerIds = new Set<string>();
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data: segmentCustomers, error: segErr } = await supabase
          .from("customer_segments")
          .select("customer_id")
          .in("segment_id", segmentIds)
          .range(from, to);

        if (segErr) {
          console.error("Error fetching customer_segments:", segErr);
          return new Response(
            JSON.stringify({ error: "Failed to fetch segment audience" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        (segmentCustomers || []).forEach((r: any) => {
          if (typeof r?.customer_id === "string" && isUuidLike(r.customer_id)) {
            segmentCustomerIds.add(r.customer_id);
          }
        });

        if (!segmentCustomers || segmentCustomers.length < PAGE_SIZE) break;
      }

      const ids = Array.from(segmentCustomerIds);
      console.log(`📧 Segment audience resolved: ${ids.length} customers`);
      allowedCustomerIds = ids;
    }

    if (personaIdList.length > 0) {
      const personaCustomerIds = new Set<string>();

      if (personaUuidIds.length > 0) {
        const PAGE_SIZE = 1000;

        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: cpRows, error: cpErr } = await supabase
            .from("customer_personas")
            .select("customer_id")
            .in("persona_id", personaUuidIds)
            .range(from, to);

          if (cpErr) {
            console.error(
              "Error fetching customer_personas by persona_id:",
              cpErr,
            );
            return new Response(
              JSON.stringify({ error: "Failed to fetch persona audience" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          (cpRows || []).forEach((r: any) => {
            if (
              typeof r?.customer_id === "string" &&
              isUuidLike(r.customer_id)
            ) {
              personaCustomerIds.add(r.customer_id);
            }
          });

          if (!cpRows || cpRows.length < PAGE_SIZE) break;
        }

        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: directPersonaCustomers, error: directErr } =
            await supabase
              .from("crm_customers")
              .select("id")
              .eq("tenant_id", campaign.tenant_id)
              .in("persona_id", personaUuidIds)
              .range(from, to);

          if (directErr) {
            console.error(
              "Error fetching crm_customers by persona_id:",
              directErr,
            );
            return new Response(
              JSON.stringify({ error: "Failed to fetch persona audience" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          (directPersonaCustomers || []).forEach((r: any) => {
            if (typeof r?.id === "string" && isUuidLike(r.id))
              personaCustomerIds.add(r.id);
          });

          if (
            !directPersonaCustomers ||
            directPersonaCustomers.length < PAGE_SIZE
          )
            break;
        }
      }

      if (personaPredefinedIds.length > 0) {
        const PAGE_SIZE = 1000;
        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data: cpRows, error: cpErr } = await supabase
            .from("customer_personas")
            .select("customer_id")
            .in("predefined_persona_id", personaPredefinedIds)
            .range(from, to);

          if (cpErr) {
            console.error(
              "Error fetching customer_personas by predefined_persona_id:",
              cpErr,
            );
            return new Response(
              JSON.stringify({ error: "Failed to fetch persona audience" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          (cpRows || []).forEach((r: any) => {
            if (
              typeof r?.customer_id === "string" &&
              isUuidLike(r.customer_id)
            ) {
              personaCustomerIds.add(r.customer_id);
            }
          });

          if (!cpRows || cpRows.length < PAGE_SIZE) break;
        }
      }

      const ids = Array.from(personaCustomerIds);
      console.log(`📧 Persona audience resolved: ${ids.length} customers`);

      if (allowedCustomerIds === null) {
        allowedCustomerIds = ids;
      } else {
        const segSet = new Set(allowedCustomerIds);
        allowedCustomerIds = ids.filter((id) => segSet.has(id));
      }
    }

    // FIX: [issue #6] - Filter out customers who have not opted in to email (CAN-SPAM/CASL compliance)
    const buildCustomersQuery = () =>
      supabase
        .from("crm_customers")
        .select(
          "id, first_name, last_name, email, email_opt_in, suppressed, suppressed_reason, created_at, last_open_at, last_email_clicked_at",
        )
        .eq("tenant_id", campaign.tenant_id)
        .not("email", "is", null)
        .not("email_opt_in", "is", false);

    if (allowedCustomerIds) {
      console.log(
        `📧 Final audience after targeting: ${allowedCustomerIds.length} customers`,
      );
      if (allowedCustomerIds.length === 0) {
        customers = [];
      } else {
        const IN_CHUNK = 100;
        const filteredIds = allowedCustomerIds.filter(
          (id) => typeof id === "string" && isUuidLike(id),
        );
        const fetched: any[] = [];
        for (let i = 0; i < filteredIds.length; i += IN_CHUNK) {
          const chunk = filteredIds.slice(i, i + IN_CHUNK);
          const { data, error } = await buildCustomersQuery().in("id", chunk);
          if (error) {
            console.error("Error fetching targeted crm_customers:", error);
            return new Response(
              JSON.stringify({ error: "Failed to fetch customers" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          fetched.push(...(data || []));
        }
        customers = fetched;
      }
    } else {
      const PAGE_SIZE = 1000;
      const fetched: any[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await buildCustomersQuery().range(from, to);
        if (error) {
          console.error("Error fetching all crm_customers:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch customers" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        fetched.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      customers = fetched;
    }

    const hygieneAnalysis = await analyzeCampaignListHygiene(supabase, {
      tenantId: campaign.tenant_id,
      domainId: campaign.from_email_domain_id || null,
      recipients: (customers || []).map((c: any) => ({
        customerId: c?.id,
        email: c?.email,
        createdAt: c?.created_at,
        lastOpenAt: c?.last_open_at,
        lastEmailClickedAt: c?.last_email_clicked_at,
      })),
    });

    await persistCampaignHygieneReport(supabase, {
      tenantId: campaign.tenant_id,
      campaignId,
      analysis: hygieneAnalysis,
    });

    if (hygieneAnalysis.blocked) {
      const pauseMessage = `Campaign blocked: invalid email ratio ${hygieneAnalysis.invalidEmailsPct.toFixed(2)}% exceeds 5%.`;
      await pauseCampaignSafely({
        campaignId,
        blockReason:
          hygieneAnalysis.blockReason || "list_hygiene_invalid_ratio",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: hygieneAnalysis.blockReason || "list_hygiene_invalid_ratio",
        policyName: "list_hygiene",
        metadata: {
          message: pauseMessage,
          invalid_emails_pct: hygieneAnalysis.invalidEmailsPct,
          invalid_emails_count: hygieneAnalysis.invalidEmailsCount,
          audience_total: hygieneAnalysis.audienceTotal,
          warnings: hygieneAnalysis.warnings,
        },
      });

      return new Response(
        JSON.stringify({
          error: pauseMessage,
          hygiene: {
            blocked: true,
            block_reason: hygieneAnalysis.blockReason,
            invalid_emails_pct: hygieneAnalysis.invalidEmailsPct,
            invalid_emails_count: hygieneAnalysis.invalidEmailsCount,
            audience_total: hygieneAnalysis.audienceTotal,
            warnings: hygieneAnalysis.warnings,
          },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (hygieneAnalysis.warnings.length > 0) {
      console.warn("⚠️ List hygiene warnings detected:", {
        campaignId,
        warnings: hygieneAnalysis.warnings,
      });
    }

    // FIX: [FP1] - Skip volume_spike check for new tenants with fewer than 500 historical sends
    // New tenants have sparse send history, making the 3x-14d-average spike detector trigger false positives.
    // We pass a skip flag so the abuse RPC can bypass the volume_spike_3x_14d_avg heuristic.
    let skipVolumeSpikeCheck = false;
    {
      const { data: sendCountData, error: sendCountErr } = await supabase
        .from("email_governance_email_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", campaign.tenant_id)
        .eq("event_type", "sent");
      if (
        !sendCountErr && typeof sendCountData === "number"
          ? sendCountData < 500
          : (sendCountData as any)?.length < 500
      ) {
        skipVolumeSpikeCheck = true;
        console.log(
          `ℹ️ New tenant grace period: skipping volume spike check (< 500 historical sends)`,
        );
      }
    }

    const { data: abuseEnforcementResult, error: abuseEnforcementError } =
      await supabase.rpc("maybe_enforce_tenant_abuse_under_review", {
        p_campaign_id: campaignId,
        p_source: "send_email_campaign",
        ...(skipVolumeSpikeCheck ? { p_skip_volume_spike: true } : {}),
      });

    if (abuseEnforcementError) {
      console.error(
        "❌ Failed to evaluate abuse risk before send:",
        abuseEnforcementError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to evaluate abuse risk before send" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const abuseRow = Array.isArray(abuseEnforcementResult)
      ? abuseEnforcementResult[0]
      : abuseEnforcementResult;

    if (abuseRow?.was_blocked) {
      const abusePauseMessage =
        abuseRow?.message ||
        "Campaign blocked pending manual review due to abuse detection signals.";

      await pauseCampaignSafely({
        campaignId,
        blockReason: "abuse_detection_under_review",
        errorMessage: abusePauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "abuse_detection_under_review",
        policyName: "abuse_detection",
        metadata: {
          message: abusePauseMessage,
          risk_level: abuseRow?.risk_level || "high",
          reasons: abuseRow?.reasons || [],
          monitoring_severity: abuseRow?.monitoring_severity || "critical",
          manual_review_required: true,
        },
      });

      return new Response(
        JSON.stringify({
          error: abusePauseMessage,
          abuse_risk: {
            risk_level: abuseRow?.risk_level || "high",
            reasons: abuseRow?.reasons || [],
            monitoring_severity: abuseRow?.monitoring_severity || "critical",
            details: abuseRow?.details || {},
            manual_review_required: true,
          },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    customers = (customers || []).filter((c: any) => {
      const email = c?.email?.trim();
      if (!email) return false;
      if (email.toLowerCase().endsWith("@noemail.local")) return false;
      return true;
    });

    // Filter out suppressed recipients (Milestone 5: suppression_list is canonical)
    // includeSuppressed bypass is intentionally ignored.
    const totalBeforeSuppression = customers.length;
    let suppressedCount = 0;

    if (customers.length > 0) {
      const suppressionBypassState = await getTenantSuppressionBypassState(
        supabase,
        campaign.tenant_id,
      );

      const bypassSuppressionTypes =
        suppressionBypassState.suppression_bypass_active
          ? ["bounced", "hard_bounce", "complaint", "complained"]
          : [];

      const eligibility = await canSendEmailBatch(
        supabase,
        {
          tenantId: campaign.tenant_id,
          recipients: customers
            .filter((c: any) => typeof c?.email === "string" && c.email.trim())
            .map((c: any) => ({ customerId: c.id, email: c.email })),
        },
        {
          bypassSuppressionTypes,
        },
      );

      const skips: Array<{
        tenantId: string;
        campaignId?: string;
        customerId?: string;
        email: string;
        reason: any;
      }> = [];

      customers = customers.filter((c: any) => {
        const email = String(c?.email || "")
          .toLowerCase()
          .trim();
        const result = eligibility.get(email);
        if (!result || result.allowed) return true;
        suppressedCount++;
        skips.push({
          tenantId: campaign.tenant_id,
          campaignId,
          customerId: c?.id,
          email: String(c.email),
          reason: result.reason || "unsubscribed",
        });
        return false;
      });

      if (suppressedCount > 0) {
        console.log(
          `📧 Excluded ${suppressedCount} suppressed contacts (${totalBeforeSuppression} → ${customers.length} active)`,
        );
        await logSkippedSends(supabase, skips as any);
      }
    }

    let recipientCount = customers.length;
    const recipientCap = reputationPolicy.recipient_cap ?? null;
    if (
      recipientCap !== null &&
      recipientCap >= 0 &&
      recipientCount > recipientCap
    ) {
      customers = customers.slice(0, recipientCap);
      recipientCount = customers.length;
      console.log(
        `📧 Reputation tier cap applied (${reputationPolicy.tier}): limited recipients to ${recipientCap}`,
      );
    }

    const policyBatchSize = Math.max(
      1,
      Number(reputationPolicy.job_batch_size || DEFAULT_BATCH_SIZE_PER_JOB),
    );
    const batchSizePerJob = getAdaptiveBatchSizePerJob(
      recipientCount,
      policyBatchSize,
      maxBatchSizePerJob,
    );
    // Warmup/throttling removed: no partial-send truncation.
    console.log(
      `📧 Found ${recipientCount} customers (job batch size: ${batchSizePerJob})`,
    );

    // Milestone 7: Campaigns must declare an explicit sending domain.
    // If missing, attempt to auto-select the tenant's most recent operational domain.
    let domainIdToUse: string | null = campaign.from_email_domain_id;
    if (!domainIdToUse) {
      // Prefer tenant-level default sending domain when configured.
      const { data: tenantRow, error: tenantRowError } = await supabase
        .from("tenants")
        .select("default_from_email_domain_id")
        .eq("id", campaign.tenant_id)
        .maybeSingle();

      if (tenantRowError) {
        console.warn(
          "⚠️ Failed to fetch tenant default sending domain:",
          serializeSupabaseError(tenantRowError),
        );
      }

      const tenantDefaultDomainId = (tenantRow as any)
        ?.default_from_email_domain_id as string | null | undefined;
      if (tenantDefaultDomainId) {
        const { data: defaultDomain, error: defaultDomainError } =
          await supabase
            .from("email_domains")
            .select("id, domain, status")
            .eq("id", tenantDefaultDomainId)
            .eq("tenant_id", campaign.tenant_id)
            .in("status", ["active", "warming_up"])
            .maybeSingle();

        if (defaultDomainError) {
          console.warn(
            "⚠️ Failed to validate tenant default sending domain:",
            serializeSupabaseError(defaultDomainError),
          );
        }

        if (defaultDomain?.id) {
          domainIdToUse = defaultDomain.id;
          console.log(
            `📧 Using tenant default sending domain: ${defaultDomain.domain} (${domainIdToUse})`,
          );

          const { error: persistDomainError } = await supabase
            .from("crm_campaigns")
            .update({
              from_email_domain_id: domainIdToUse,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          if (persistDomainError) {
            console.warn(
              "⚠️ Failed to persist tenant default domain on campaign; continuing anyway:",
              {
                campaignId,
                domainIdToUse,
                err: serializeSupabaseError(persistDomainError),
              },
            );
          }
        }
      }

      if (!domainIdToUse) {
        const { data: operationalDomains, error: operationalDomainsError } =
          await supabase
            .from("email_domains")
            .select("id, domain, status")
            .eq("tenant_id", campaign.tenant_id)
            .in("status", ["active", "warming_up"])
            .order("created_at", { ascending: false })
            .limit(2);

        if (operationalDomainsError) {
          console.error(
            "❌ Failed to look up operational sending domains:",
            serializeSupabaseError(operationalDomainsError),
          );
        }

        if (
          Array.isArray(operationalDomains) &&
          operationalDomains.length === 1
        ) {
          domainIdToUse = operationalDomains[0].id;
          console.log(
            `📧 Auto-selected sending domain: ${operationalDomains[0].domain} (${domainIdToUse})`,
          );

          const { error: persistDomainError } = await supabase
            .from("crm_campaigns")
            .update({
              from_email_domain_id: domainIdToUse,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          if (persistDomainError) {
            console.warn(
              "⚠️ Failed to persist auto-selected domain on campaign; continuing anyway:",
              {
                campaignId,
                domainIdToUse,
                err: serializeSupabaseError(persistDomainError),
              },
            );
          }
        } else {
          const pauseMessage =
            Array.isArray(operationalDomains) && operationalDomains.length > 1
              ? "Multiple sending domains are configured. Please select a sending domain for this campaign."
              : "Campaign sending requires a configured custom domain sender.";

          await pauseCampaignSafely({
            campaignId,
            blockReason: "sender_domain_required",
            errorMessage: pauseMessage,
          });

          return new Response(
            JSON.stringify({
              error: pauseMessage,
              reason: "sender_domain_required",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (!domainIdToUse) {
      const pauseMessage =
        "Campaign sending requires a configured custom domain sender.";
      await pauseCampaignSafely({
        campaignId,
        blockReason: "sender_domain_required",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "sender_domain_required",
        metadata: {
          message: pauseMessage,
          recipient_count: recipientCount,
        },
      });
      return new Response(
        JSON.stringify({
          error: pauseMessage,
          reason: "sender_domain_required",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Quota check
    const { data: quotaCheck, error: quotaError } = await supabase.rpc(
      "check_send_quota",
      {
        p_tenant_id: campaign.tenant_id,
        p_domain_id: domainIdToUse,
        p_recipient_count: recipientCount,
      },
    );

    if (quotaError) {
      console.error("Error checking quota:", quotaError);
      return new Response(
        JSON.stringify({ error: "Failed to check sending quota" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Warmup/limits removed: quota RPC no longer returns limits.

    if (!quotaCheck?.allowed) {
      const pauseMessage =
        quotaCheck?.message ||
        "Email sending requires an operational sending domain.";
      console.warn(`📧 Cannot send campaign; pausing instead: ${pauseMessage}`);

      await pauseCampaignSafely({
        campaignId,
        blockReason: quotaCheck?.reason || "sender_domain_required",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: quotaCheck?.reason || "sender_domain_required",
        policyName: "send_quota",
        domainId: domainIdToUse,
        metadata: {
          message: pauseMessage,
          recipient_count: recipientCount,
          compliance: quotaCheck?.compliance || null,
          warnings: quotaCheck?.warnings || [],
        },
      });

      return new Response(
        JSON.stringify({
          error: pauseMessage,
          reason: quotaCheck?.reason || "sender_domain_required",
          compliance: quotaCheck?.compliance || null,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const complianceWarnings: string[] = [];
    if (Array.isArray(quotaCheck?.warnings)) {
      complianceWarnings.push(
        ...quotaCheck.warnings.filter(
          (warning: unknown) => typeof warning === "string",
        ),
      );
    }

    // Determine sender
    const companyName = companyProfile?.company_name || "Your Garden Center";
    let activeDomainId: string | null = null;

    const domainName = quotaCheck.domain?.domain;
    const configuredEmail = quotaCheck.sender?.from_email;

    if (!domainName) {
      const pauseMessage = "No operational sending domain configured.";
      await pauseCampaignSafely({
        campaignId,
        blockReason: "sender_domain_required",
        errorMessage: pauseMessage,
      });
      return new Response(
        JSON.stringify({
          error: pauseMessage,
          reason: "sender_domain_required",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const senderEmail = configuredEmail || `mail@${domainName}`;
    if (senderEmail === "noreply@bloomsuite.app") {
      const pauseMessage =
        "Campaign sending requires a verified custom domain. Shared sender is disabled.";
      await pauseCampaignSafely({
        campaignId,
        blockReason: "shared_sender_disabled",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "shared_sender_disabled",
        metadata: {
          message: pauseMessage,
          recipient_count: recipientCount,
        },
      });
      return new Response(JSON.stringify({ error: pauseMessage }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // From-header display name resolution lives in _shared/campaignFromHeader
    // so the test-send path and the live-send path produce identical From
    // headers from identical inputs.
    const senderDisplayName = resolveCampaignSenderDisplayName({
      campaignSenderName: campaign.sender_name,
      domainFromName: quotaCheck.sender?.from_name,
      companyProfileName: companyProfile?.company_name,
      finalFallback: companyName,
    });
    const deliveryMethod = "custom_domain";
    const usesVerifiedDomain = true;
    activeDomainId = quotaCheck.domain?.id || null;

    const isHighVolume = recipientCount > highVolumeThreshold;
    const campaignEmailSource = await resolveCampaignEmailSource(
      supabase,
      campaign,
    );
    if (campaignEmailSource.warning) {
      console.warn(`⚠️ ${campaignEmailSource.warning}`, {
        campaignId,
        source: campaignEmailSource.source,
      });
    }

    const representativeCustomer =
      (customers || []).find((customer: any) => {
        return (
          typeof customer?.email === "string" &&
          customer.email.trim().length > 0
        );
      }) || null;

    const preflightRender = renderEmailForRecipient({
      tenantId: campaign.tenant_id,
      campaignId,
      subject: campaign.subject_line || campaign.subject || "",
      previewText: campaign.preheader_text || campaign.preheader || "",
      html: campaignEmailSource.html,
      contentBlocks: campaignEmailSource.contentBlocks,
      customer: representativeCustomer
        ? ({
            id: representativeCustomer.id,
            email: representativeCustomer.email,
            first_name: representativeCustomer.first_name ?? null,
            last_name: representativeCustomer.last_name ?? null,
          } satisfies CustomerShape)
        : null,
      companyProfile: companyProfile as CompanyProfileShape,
      mode: "send",
      includeFooter: true,
      enableLinkTracking: false,
    });

    const spamAssessment = computeHeuristicSpamScore(
      campaign.subject_line || campaign.subject || "",
      preflightRender.renderedHtml,
    );
    const unsubscribePresent = true; // Send pipeline always injects footer with unsubscribe links in send mode.
    const physicalAddressPresent = hasPhysicalAddress(companyProfile);
    const fromNameValid = isFromNameValid(senderDisplayName);

    const complianceFailures: string[] = [];
    if (!unsubscribePresent) {
      complianceFailures.push("Unsubscribe link is missing");
    }
    if (!physicalAddressPresent) {
      complianceFailures.push("Physical business address is missing");
    }
    if (!fromNameValid) {
      complianceFailures.push("From-name is invalid");
    }
    if (spamAssessment.score >= spamScoreThreshold) {
      complianceFailures.push(
        `AI spam score threshold exceeded (${spamAssessment.score}/10)`,
      );
    }

    if (isHighVolume && complianceFailures.length > 0) {
      const pauseMessage =
        "High-volume sending blocked: campaign compliance requirements are not met.";
      await pauseCampaignSafely({
        campaignId,
        blockReason: "compliance_not_met_for_scale",
        errorMessage: pauseMessage,
      });

      await logCampaignGovernanceDecision({
        decision: "block",
        actionType: "campaign_send_preflight",
        reason: "compliance_not_met_for_scale",
        policyName: "high_volume_compliance",
        domainId: activeDomainId,
        metadata: {
          message: pauseMessage,
          recipient_count: recipientCount,
          high_volume_threshold: highVolumeThreshold,
          failures: complianceFailures,
          warnings: complianceWarnings,
          spam_score: spamAssessment.score,
          spam_score_threshold: spamScoreThreshold,
        },
      });

      return new Response(
        JSON.stringify({
          error: pauseMessage,
          reason: "compliance_not_met_for_scale",
          compliance: {
            high_volume: true,
            high_volume_threshold: highVolumeThreshold,
            checks: {
              unsubscribe_present: unsubscribePresent,
              physical_address_present: physicalAddressPresent,
              from_name_valid: fromNameValid,
              spam_score: spamAssessment.score,
              spam_score_threshold: spamScoreThreshold,
              spam_issues: spamAssessment.issues,
            },
            failures: complianceFailures,
            warnings: complianceWarnings,
          },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!isHighVolume && complianceFailures.length > 0) {
      complianceWarnings.push(
        ...complianceFailures.map(
          (failure) => `Low-volume only warning: ${failure}`,
        ),
      );
    }

    // Queue recipients
    const piiWarningSet = new Set<string>();

    // Link tracking setup
    const campaignContent = preflightRender.renderedHtml;
    const extractedLinks = extractLinks(campaignContent);
    const uniqueUrls = getUniqueUrls(extractedLinks);

    console.log(`🔗 Found ${uniqueUrls.length} unique URLs to track`);
    for (const url of uniqueUrls) {
      if (hasPII(url)) {
        piiWarningSet.add(url);
        console.warn(
          `⚠️ PII detected in URL, will skip tracking: ${url.substring(0, 80)}...`,
        );
      }
    }

    const urlsToTrack = uniqueUrls.filter((url) => !hasPII(url));
    if (urlsToTrack.length > 0) {
      const trackedLinkInserts = urlsToTrack.map((url) => ({
        tenant_id: campaign.tenant_id,
        campaign_id: campaignId,
        url,
      }));

      const { data: insertedLinks, error: linksError } = await supabase
        .from("tracked_links")
        .upsert(trackedLinkInserts, {
          onConflict: "tenant_id,campaign_id,url",
          ignoreDuplicates: false,
        })
        .select("id");

      if (linksError) {
        console.warn(
          "⚠️ Error creating tracked links (non-fatal):",
          linksError,
        );
      } else {
        console.log(
          `🔗 Created/updated ${insertedLinks?.length || 0} tracked links`,
        );
      }
    }

    const sendPacingMultiplier = Math.max(
      1,
      Number(reputationPolicy.send_pacing_multiplier || 1),
    );
    const totalBatches = Math.ceil(recipientCount / batchSizePerJob);
    const skippedRecipientCount =
      suppressedCount +
      hygieneAnalysis.invalidEmailsCount +
      hygieneAnalysis.duplicateEmailsCount;
    const queueAvailabilityPlan = getQueueAvailabilityPlan({
      totalRecipients: recipientCount,
      totalBatches,
      batchSizePerJob,
      sendPacingMultiplier,
      batchDelayMinSeconds,
      batchDelayMaxSeconds,
    });

    const { count: existingMessageCount, error: existingMessagesError } =
      await supabase
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);

    if (existingMessagesError) {
      console.error("❌ Failed to inspect existing campaign queue state:", {
        campaignId,
        err: serializeSupabaseError(existingMessagesError),
      });
      return new Response(
        JSON.stringify({ error: "Failed to inspect campaign queue state" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isResumeRun = Number(existingMessageCount || 0) > 0;
    const queueInitializedAt = new Date().toISOString();
    const queueStartedAt =
      typeof campaign.queue_started_at === "string" && campaign.queue_started_at
        ? campaign.queue_started_at
        : queueInitializedAt;
    const queuedAt =
      typeof campaign.queued_at === "string" && campaign.queued_at
        ? campaign.queued_at
        : queueInitializedAt;
    const queueProgressMetrics = {
      ...(campaign.metrics || {}),
      queued: 0,
      skipped_suppressed: suppressedCount,
      links_tracked: urlsToTrack.length,
      pii_warnings: piiWarningSet.size,
      render_source: campaignEmailSource.source,
      queue: {
        resumed: isResumeRun,
        existing_message_count: Number(existingMessageCount || 0),
        jobs_per_minute_target: queueAvailabilityPlan.jobsPerMinute,
        immediate_job_count: queueAvailabilityPlan.immediateJobCount,
        estimated_emails_per_minute:
          queueAvailabilityPlan.estimatedEmailsPerMinute,
      },
      compliance: {
        high_volume: isHighVolume,
        high_volume_threshold: highVolumeThreshold,
        warnings: complianceWarnings,
        spam_score: spamAssessment.score,
        spam_score_threshold: spamScoreThreshold,
        spam_issues: spamAssessment.issues,
        checks: {
          unsubscribe_present: unsubscribePresent,
          physical_address_present: physicalAddressPresent,
          from_name_valid: fromNameValid,
        },
        domain: quotaCheck?.compliance || null,
      },
      reputation_policy: {
        score: reputationPolicy.score,
        tier: reputationPolicy.tier,
        action: reputationPolicy.action,
        recipient_cap: recipientCap,
        job_batch_size: batchSizePerJob,
        send_pacing_multiplier: reputationPolicy.send_pacing_multiplier,
      },
      list_hygiene: {
        audience_total: hygieneAnalysis.audienceTotal,
        duplicate_emails_count: hygieneAnalysis.duplicateEmailsCount,
        invalid_emails_count: hygieneAnalysis.invalidEmailsCount,
        invalid_emails_pct: hygieneAnalysis.invalidEmailsPct,
        suppressed_count: hygieneAnalysis.suppressedCount,
        inactive_count: hygieneAnalysis.inactiveCount,
        inactive_pct: hygieneAnalysis.inactivePct,
        warnings: hygieneAnalysis.warnings,
        blocked: false,
      },
    };

    const { error: queueInitError } = await supabase
      .from("crm_campaigns")
      .update({
        delivery_method: deliveryMethod,
        sender_display_name: senderDisplayName,
        actual_sender_email: senderEmail,
        from_email_domain_id: activeDomainId,
        status: "partially_queued",
        queued_at: queuedAt,
        queue_started_at: queueStartedAt,
        queue_completed_at: null,
        send_started_at: null,
        send_completed_at: null,
        sent_at: null,
        worker_heartbeat_at: null,
        estimated_completion_at: null,
        total_recipients: recipientCount,
        total_batches: totalBatches,
        messages_sent: 0,
        messages_failed: 0,
        messages_skipped: skippedRecipientCount,
        send_blocked_reason: null,
        send_error: null,
        metrics: queueProgressMetrics,
      })
      .eq("id", campaignId);

    if (queueInitError) {
      console.error("❌ Failed to mark campaign partially queued:", {
        campaignId,
        error: serializeSupabaseError(queueInitError),
      });
      return new Response(
        JSON.stringify({ error: "Failed to initialize campaign queue" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `📧 Queuing ${recipientCount} recipients in batches of ${batchSizePerJob} ` +
        `(resume: ${isResumeRun}, jobs/min target: ${queueAvailabilityPlan.jobsPerMinute})...`,
    );

    let queuedRecipientCount = 0;
    let attemptedQueuedRecipientCount = 0;
    let dbChunkSize = getInitialMessageInsertChunkSize(recipientCount);
    for (
      let batchStart = 0;
      batchStart < customers.length;
      batchStart += batchSizePerJob
    ) {
      const batchIndex = Math.floor(batchStart / batchSizePerJob);
      const batchCustomers = customers.slice(
        batchStart,
        batchStart + batchSizePerJob,
      );
      const batchMessageUpserts: any[] = [];

      for (const customer of batchCustomers) {
        if (!customer?.id || !customer?.email) continue;

        batchMessageUpserts.push({
          tenant_id: campaign.tenant_id,
          campaign_id: campaignId,
          customer_id: customer.id,
          domain_id: activeDomainId,
          email: customer.email,
          payload: {},
          status: "queued",
          resend_id: null,
          claimed_at: null,
          claimed_by: null,
          claim_token: null,
          dead_lettered_at: null,
          error_message: null,
        });
      }

      if (batchMessageUpserts.length === 0) continue;

      attemptedQueuedRecipientCount += batchMessageUpserts.length;
      let actualInsertedThisBatch = 0;

      for (let offset = 0; offset < batchMessageUpserts.length; ) {
        const chunk = batchMessageUpserts.slice(offset, offset + dbChunkSize);
        try {
          const resp = await supabase
            .from("email_messages")
            .upsert(chunk, {
              onConflict: "campaign_id,customer_id,retry_sequence",
              ignoreDuplicates: true,
            })
            .select("id");

          if (resp.error) {
            const code = (resp.error as any)?.code;
            const msg = (resp.error as any)?.message;
            if (
              (code === "57014" ||
                String(msg || "").includes("statement timeout")) &&
              dbChunkSize > 50
            ) {
              dbChunkSize = Math.max(50, Math.floor(dbChunkSize / 2));
              console.warn(
                `⚠️ email_messages write timed out; reducing chunk size to ${dbChunkSize} and retrying (batch ${batchIndex})`,
              );
              continue;
            }

            console.error("❌ Failed to persist email_messages batch chunk:", {
              status: resp.status,
              statusText: resp.statusText,
              err: serializeSupabaseError(resp.error),
              batchIndex,
              chunkSize: chunk.length,
            });
            return new Response(
              JSON.stringify({
                error: "Failed to persist recipients",
                status: resp.status,
                statusText: resp.statusText,
                details: serializeSupabaseError(resp.error),
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          offset += chunk.length;
          const insertedCount = resp.data?.length ?? 0;
          queuedRecipientCount += insertedCount;
          actualInsertedThisBatch += insertedCount;
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (
            (msg.includes("statement timeout") || msg.includes("57014")) &&
            dbChunkSize > 50
          ) {
            dbChunkSize = Math.max(50, Math.floor(dbChunkSize / 2));
            console.warn(
              `⚠️ email_messages write exception timed out; reducing chunk size to ${dbChunkSize} and retrying (batch ${batchIndex})`,
            );
            continue;
          }
          console.error("❌ Exception while persisting email_messages chunk:", {
            err: serializeSupabaseError(e),
            batchIndex,
            chunkSize: chunk.length,
          });
          return new Response(
            JSON.stringify({
              error: "Failed to persist recipients (exception)",
              details: serializeSupabaseError(e),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      console.log(
        `📧 Queue write: batch ${
          batchIndex + 1
        }/${totalBatches} — attempted ${batchMessageUpserts.length}, inserted ${actualInsertedThisBatch} (resume: ${isResumeRun})`,
      );

      if ((batchIndex + 1) % 10 === 0 || batchIndex + 1 === totalBatches) {
        console.log(
          `📧 Queued batch ${
            batchIndex + 1
          }/${totalBatches} (queued so far: ${queuedRecipientCount})`,
        );
      }
    }

    if (!campaign?.tenant_id) {
      console.error("❌ Campaign tenant_id missing, cannot queue recipients", {
        campaignId,
      });
      return new Response(
        JSON.stringify({ error: "Campaign missing tenant_id" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: ensureJobsData, error: ensureJobsError } = await supabase.rpc(
      "ensure_jobs_for_queued_email_messages",
      {
        p_campaign_id: campaignId,
        p_batch_size: batchSizePerJob,
        p_jobs_per_minute: queueAvailabilityPlan.jobsPerMinute,
        p_immediate_job_count: queueAvailabilityPlan.immediateJobCount,
        p_activate_sending: false,
      },
    );

    if (ensureJobsError) {
      console.error("❌ Failed to create send jobs for queued messages:", {
        campaignId,
        err: serializeSupabaseError(ensureJobsError),
      });
      return new Response(
        JSON.stringify({
          error: "Failed to build send jobs for campaign queue",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ensureJobsRow = Array.isArray(ensureJobsData)
      ? ensureJobsData[0]
      : ensureJobsData;
    const { count: totalJobCount, error: totalJobCountError } = await supabase
      .from("email_send_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if (totalJobCountError) {
      console.error("❌ Failed to count queued send jobs:", {
        campaignId,
        err: serializeSupabaseError(totalJobCountError),
      });
      return new Response(
        JSON.stringify({ error: "Failed to inspect queued send jobs" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const finalSkippedRecipientCount =
      skippedRecipientCount +
      Math.max(recipientCount - attemptedQueuedRecipientCount, 0);
    const actualTotalBatches = Math.max(Number(totalJobCount || 0), 0);
    const campaignRecipientCount = recipientCount;
    let queueResultMessage =
      queuedRecipientCount > 0
        ? `Campaign queued for sending to ${queuedRecipientCount} recipients`
        : "No new recipients were queued for sending";

    if (queuedRecipientCount > 0 && actualTotalBatches === 0) {
      console.error(
        "❌ Queue build created no send jobs for a non-empty campaign queue",
        {
          campaignId,
          queuedRecipientCount,
        },
      );
      return new Response(
        JSON.stringify({
          error: "Failed to schedule queued recipients for sending",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (queuedRecipientCount === 0) {
      if (isResumeRun) {
        console.info(
          "ℹ️ Resume run: all recipients already queued and jobbed, nothing new to schedule",
          {
            campaignId,
            existingMessageCount: Number(existingMessageCount || 0),
            actualTotalBatches,
          },
        );
        queueResultMessage =
          actualTotalBatches > 0
            ? `Campaign already queued with ${actualTotalBatches} batch jobs; nothing new to schedule`
            : "Resume run found no new recipients to schedule";
      } else {
        console.warn(
          "⚠️ Queue build produced no new queued recipients for a non-resume run; returning success with no work scheduled",
          {
            campaignId,
            recipientCount,
            actualTotalBatches,
          },
        );
      }
    }

    // Queue acceptance is distinct from final delivery completion.
    const campaignStatus = "queued";
    const queueCompletedAt = new Date().toISOString();
    const { error: queueCampaignError } = await supabase
      .from("crm_campaigns")
      .update({
        status: campaignStatus,
        queued_at: queuedAt,
        queue_completed_at: queueCompletedAt,
        total_recipients: campaignRecipientCount,
        total_batches: actualTotalBatches,
        messages_sent: 0,
        messages_failed: 0,
        messages_skipped: finalSkippedRecipientCount,
        sent_at: null,
        send_started_at: null,
        send_completed_at: null,
        worker_heartbeat_at: null,
        estimated_completion_at: null,
        send_blocked_reason: null,
        metrics: {
          ...queueProgressMetrics,
          queued: campaignRecipientCount,
          skipped_suppressed: suppressedCount,
          links_tracked: urlsToTrack.length,
          pii_warnings: piiWarningSet.size,
          queue: {
            ...(queueProgressMetrics.queue || {}),
            resumed: isResumeRun,
            jobs_created: Number(ensureJobsRow?.jobs_created || 0),
            jobs_total: actualTotalBatches,
            jobs_per_minute_target: queueAvailabilityPlan.jobsPerMinute,
            immediate_job_count: queueAvailabilityPlan.immediateJobCount,
            estimated_emails_per_minute:
              queueAvailabilityPlan.estimatedEmailsPerMinute,
            final_db_chunk_size: dbChunkSize,
          },
          compliance: {
            high_volume: isHighVolume,
            high_volume_threshold: highVolumeThreshold,
            warnings: complianceWarnings,
            spam_score: spamAssessment.score,
            spam_score_threshold: spamScoreThreshold,
            spam_issues: spamAssessment.issues,
            checks: {
              unsubscribe_present: unsubscribePresent,
              physical_address_present: physicalAddressPresent,
              from_name_valid: fromNameValid,
            },
            domain: quotaCheck?.compliance || null,
          },
          reputation_policy: {
            score: reputationPolicy.score,
            tier: reputationPolicy.tier,
            action: reputationPolicy.action,
            recipient_cap: recipientCap,
            job_batch_size: batchSizePerJob,
            send_pacing_multiplier: reputationPolicy.send_pacing_multiplier,
          },
          list_hygiene: {
            audience_total: hygieneAnalysis.audienceTotal,
            duplicate_emails_count: hygieneAnalysis.duplicateEmailsCount,
            invalid_emails_count: hygieneAnalysis.invalidEmailsCount,
            invalid_emails_pct: hygieneAnalysis.invalidEmailsPct,
            suppressed_count: hygieneAnalysis.suppressedCount,
            inactive_count: hygieneAnalysis.inactiveCount,
            inactive_pct: hygieneAnalysis.inactivePct,
            warnings: hygieneAnalysis.warnings,
            blocked: false,
          },
        },
      })
      .eq("id", campaignId);

    if (queueCampaignError) {
      console.error("❌ Failed to mark campaign queued", {
        campaignId,
        error: queueCampaignError,
      });
      throw queueCampaignError;
    }

    console.log(
      `📧 Campaign ${campaignId} queued with ${actualTotalBatches} batch jobs`,
    );

    await logCampaignGovernanceDecision({
      decision:
        complianceWarnings.length > 0 || hygieneAnalysis.warnings.length > 0
          ? "warn"
          : "allow",
      actionType: "campaign_send_queued",
      reason:
        complianceWarnings.length > 0 || hygieneAnalysis.warnings.length > 0
          ? "preflight_warnings"
          : "preflight_ok",
      policyName: "send_pipeline",
      domainId: activeDomainId,
      metadata: {
        recipient_count: recipientCount,
        queued_recipient_count: queuedRecipientCount,
        suppressed_count: suppressedCount,
        resumed: isResumeRun,
        existing_message_count: Number(existingMessageCount || 0),
        jobs_created: Number(ensureJobsRow?.jobs_created || 0),
        jobs_total: actualTotalBatches,
        compliance_warnings: complianceWarnings,
        hygiene_warnings: hygieneAnalysis.warnings,
        reputation: {
          score: reputationPolicy.score,
          tier: reputationPolicy.tier,
          action: reputationPolicy.action,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode: "queued",
        campaign_id: campaignId,
        queued_at: queuedAt,
        queue_completed_at: queueCompletedAt,
        resumed: isResumeRun,
        total_recipients: campaignRecipientCount,
        total_batches: actualTotalBatches,
        message: queueResultMessage,
        reputation: {
          score: reputationPolicy.score,
          tier: reputationPolicy.tier,
          action: reputationPolicy.action,
          recipient_cap: recipientCap,
          job_batch_size: batchSizePerJob,
          send_pacing_multiplier: reputationPolicy.send_pacing_multiplier,
        },
        hygiene: {
          blocked: false,
          warnings: hygieneAnalysis.warnings,
          summary: {
            audience_total: hygieneAnalysis.audienceTotal,
            duplicate_emails_count: hygieneAnalysis.duplicateEmailsCount,
            invalid_emails_count: hygieneAnalysis.invalidEmailsCount,
            invalid_emails_pct: hygieneAnalysis.invalidEmailsPct,
            suppressed_count: hygieneAnalysis.suppressedCount,
            inactive_count: hygieneAnalysis.inactiveCount,
            inactive_pct: hygieneAnalysis.inactivePct,
          },
        },
        warnings: complianceWarnings,
        compliance: {
          high_volume: isHighVolume,
          high_volume_threshold: highVolumeThreshold,
          checks: {
            unsubscribe_present: unsubscribePresent,
            physical_address_present: physicalAddressPresent,
            from_name_valid: fromNameValid,
            spam_score: spamAssessment.score,
            spam_score_threshold: spamScoreThreshold,
            spam_issues: spamAssessment.issues,
          },
          domain: quotaCheck?.compliance || null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    // Stack is logged to function logs (server-side) but not returned to
    // the API caller, to avoid leaking internal paths in error responses.
    console.error("❌ CRITICAL ERROR:", error);
    console.error("❌ STACK:", error?.stack);

    let userMessage = "Internal server error";
    let statusCode = 500;

    if (error.message?.includes("JWT")) {
      userMessage = "Authentication error";
      statusCode = 401;
    } else if (
      error.message?.includes("permission") ||
      error.message?.includes("RLS")
    ) {
      userMessage = "Permission denied";
      statusCode = 403;
    } else if (error.message?.includes("timeout")) {
      userMessage = "Request timed out";
      statusCode = 504;
    }

    return new Response(
      JSON.stringify({ error: userMessage, details: error.message }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
