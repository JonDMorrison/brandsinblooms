import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  renderMergeTags,
  convertLegacyTags,
  createMergeTagDataFromCustomer,
} from "../_shared/mergeTagEngine.ts";
import {
  getSmsWarmupInfoByPhoneOrMessagingService,
  ensureSmsWarmupRowForMessagingServiceIfNeeded,
} from "../_shared/smsWarmup.ts";
import {
  countSmsSegments,
  calculateBillableUnits,
} from "../_shared/smsSegmentCounter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const DEFAULT_MMS_UNIT_COST = 3;

/**
 * Format phone number to E.164 format
 */
function formatPhoneForTwilio(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (phone.startsWith("+") && cleaned.length >= 10) {
    return phone;
  }
  return `+1${cleaned}`;
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // FIX: [issue #5] - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authToken = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isInternalRequest = authToken === supabaseServiceKey;
  const authClient = createClient(supabaseUrl, supabaseServiceKey);
  let authUserId: string | null = null;

  if (!isInternalRequest) {
    const {
      data: { user: authUser },
      error: authError,
    } = await authClient.auth.getUser(authToken);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    authUserId = authUser.id;
  }

  try {
    const { campaignId, segmentId, systemSegmentType } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(
      `[send-sms-campaign] Starting scalable enqueue for campaign: ${campaignId}`,
    );
    console.log(
      `[send-sms-campaign] segmentId: ${segmentId}, systemSegmentType: ${systemSegmentType}`,
    );

    // Step A: Load campaign and check status
    const { data: campaign, error: campaignError } = await supabase
      .from("crm_sms_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("[send-sms-campaign] Campaign not found:", campaignError);
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isInternalRequest) {
      const { data: caller, error: callerError } = await supabase
        .from("users")
        .select("tenant_id, role")
        .eq("id", authUserId)
        .maybeSingle();

      const { data: isMasterAdmin } = await supabase.rpc("is_master_admin", {
        _user_id: authUserId,
      });
      const canSendCampaign =
        Boolean(isMasterAdmin) ||
        (caller?.tenant_id === campaign.tenant_id &&
          ["owner", "admin", "team", "marketing"].includes(caller?.role || ""));

      if (callerError || !canSendCampaign) {
        return new Response(
          JSON.stringify({
            error: "You do not have permission to send this campaign",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Overlap protection: check if already enqueuing or enqueued
    if (campaign.enqueue_status === "enqueued" || campaign.enqueued) {
      console.log(
        `[send-sms-campaign] Campaign ${campaignId} already enqueued`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          alreadyEnqueued: true,
          message: "SMS campaign is already queued for sending.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (campaign.enqueue_status === "enqueuing") {
      // Check if claim is stale (15 minutes)
      const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
      if (
        campaign.enqueue_claimed_at &&
        new Date(campaign.enqueue_claimed_at) > staleThreshold
      ) {
        console.log(
          `[send-sms-campaign] Campaign ${campaignId} is already being prepared`,
        );
        return new Response(
          JSON.stringify({
            success: false,
            message: "Campaign is already being prepared for sending.",
            enqueueStatus: campaign.enqueue_status,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Determine effective segment - from campaign record or request params.
    // An absent segment is valid for explicitly saved all-subscriber campaigns.
    const effectiveSegmentId = campaign.segment_id || segmentId;
    const isSystemSegment = !!systemSegmentType;
    const isPersonaAudience =
      Array.isArray(campaign.targeting_persona_ids) &&
      campaign.targeting_persona_ids.length > 0;

    // Step B: Resolve sending identity and get warmup info for quota check
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const twilioMessagingServiceSid = Deno.env.get(
      "TWILIO_MESSAGING_SERVICE_SID",
    );

    const fromPhone = campaign.from_phone
      ? formatPhoneForTwilio(campaign.from_phone)
      : twilioPhoneNumber
        ? formatPhoneForTwilio(twilioPhoneNumber)
        : null;

    const messagingServiceSid = twilioMessagingServiceSid || null;

    // Get warmup info for daily limit check
    let warmupInfo;
    try {
      if (messagingServiceSid) {
        warmupInfo = await ensureSmsWarmupRowForMessagingServiceIfNeeded(
          supabase,
          messagingServiceSid,
          campaign.tenant_id,
        );
      } else if (fromPhone) {
        warmupInfo = await getSmsWarmupInfoByPhoneOrMessagingService(supabase, {
          fromPhone,
        });
      } else {
        throw new Error(
          "No sending identity configured (from_phone or messaging_service_sid)",
        );
      }
    } catch (warmupError) {
      console.error("[send-sms-campaign] Warmup lookup failed:", warmupError);
      return new Response(
        JSON.stringify({
          error: "SMS sending identity not configured",
          details: warmupError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step C: Count the exact consent-safe audience using the same saved
    // campaign targeting used by scheduled sends and enqueue workers.
    const segmentMetrics = {
      ...(campaign.metrics || {}),
      segment_filter: {
        type: isSystemSegment
          ? "system"
          : effectiveSegmentId
            ? "custom"
            : isPersonaAudience
              ? "persona"
              : "all",
        system_segment_type: isSystemSegment ? systemSegmentType : null,
        segment_id: effectiveSegmentId || null,
      },
    };

    const { error: targetSaveError } = await supabase
      .from("crm_sms_campaigns")
      .update({ metrics: segmentMetrics })
      .eq("id", campaignId);

    if (targetSaveError) {
      console.error(
        "[send-sms-campaign] Failed to persist audience targeting:",
        targetSaveError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to persist campaign audience" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: eligibleCount, error: countError } = await supabase.rpc(
      "count_sms_campaign_recipients",
      { p_campaign_id: campaignId },
    );

    if (countError) {
      console.error(
        "[send-sms-campaign] Error counting customers:",
        countError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to count eligible recipients" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const estimatedRecipients = Number(eligibleCount || 0);
    console.log(
      `[send-sms-campaign] Estimated ${estimatedRecipients} eligible recipients`,
    );

    if (estimatedRecipients === 0) {
      await supabase
        .from("crm_sms_campaigns")
        .update({
          status: "failed",
          enqueue_status: "failed",
          metrics: {
            messages_sent: 0,
            delivered: 0,
            failed: 0,
            opt_outs: 0,
            error: "No eligible recipients",
          },
        })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ error: "No SMS-eligible customers found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step D: Log sending info (warmup limits removed - no limit check)
    console.log(
      `[send-sms-campaign] Sending to ${estimatedRecipients} recipients (warmup limits disabled)`,
    );

    // Step E: Set campaign to enqueue and trigger enqueue worker
    // Store segment info in metrics for the enqueue worker
    const { error: updateError } = await supabase
      .from("crm_sms_campaigns")
      .update({
        enqueue_status: "not_started",
        enqueue_started_at: null,
        enqueue_completed_at: null,
        enqueue_cursor_customer_id: null,
        total_recipients_estimate: estimatedRecipients,
        total_enqueued: 0,
        sending_identity_id: warmupInfo.sendingIdentityId,
        enqueued: false,
        status: "queued",
        segment_id: effectiveSegmentId, // Set segment_id for custom segments
        metrics: segmentMetrics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (updateError) {
      console.error(
        "[send-sms-campaign] Failed to update campaign:",
        updateError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to prepare campaign" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step F: Trigger the enqueue worker (fire and forget for first batch)
    try {
      await supabase.functions.invoke("sms-campaign-enqueue-worker", {
        body: { campaignId },
      });
    } catch (enqueueError) {
      console.error(
        "[send-sms-campaign] Failed to trigger enqueue worker:",
        enqueueError,
      );
      // Don't fail - the worker can be triggered manually or by cron
    }

    console.log(
      `[send-sms-campaign] Campaign ${campaignId} initiated for scalable enqueueing: ~${estimatedRecipients} recipients`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        initiated: true,
        estimatedRecipients,
        message: `SMS campaign is being prepared. Approximately ${estimatedRecipients} messages will be sent.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[send-sms-campaign] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

Deno.serve(handler);
