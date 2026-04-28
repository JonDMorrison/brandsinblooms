import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { convertEmailBlockToContentBlock } from "@/utils/blockFieldMapping";
import { logDevError, logSupabaseError } from "@/utils/devErrorLogger";
import { ContentBlock } from "@/types/emailBuilder";
import {
  CAMPAIGN_STATUS,
  getCampaignStatusLabel,
  isLockedCampaignStatus,
} from "@/constants/campaignStatuses";
import { persistCampaignRecord } from "@/lib/crm/campaignDraftPersistence";

// FIX: [issue #62] - TODO: Replace console.log statements with a proper logging service for production

export interface CampaignData {
  id?: string; // Optional - if provided, will UPDATE instead of INSERT
  name: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  from_email_domain_id?: string | null;
  content: string;
  preheader?: string;
  segments: Array<{
    id: string;
    name: string;
    customer_count: number;
  }>;
  schedule: {
    type: "immediate" | "scheduled" | "optimal";
    send_at?: string;
  };
  source_content_id?: string;
  source_metadata?: any;
  content_blocks?: any[];
  // Enhanced for newsletter sync
  newsletter_sync?: {
    source_task_id?: string;
    sync_status?: "synced" | "modified" | "out-of-sync";
    theme?: string;
    reading_time?: string;
    persona_tags?: string[];
    original_blocks_count?: number;
  };
}

export interface CampaignBlock {
  block_type: "header" | "text" | "image" | "button" | "divider";
  content: Record<string, any>;
  image_url?: string;
  cta_url?: string;
  cta_text?: string;
  source?: string;
  persona_tag?: string;
  order_index: number;
}

export const saveCampaignAsDraft = async (campaignData: CampaignData) => {
  try {
    const contentBlocks = (campaignData.content_blocks ?? []).flatMap(
      (block) => {
        if (!block || typeof block !== "object") {
          return [] as ContentBlock[];
        }

        const candidate = block as Record<string, unknown>;
        if (typeof candidate.type === "string") {
          return [candidate as ContentBlock];
        }

        if (typeof candidate.block_type === "string") {
          return [
            convertEmailBlockToContentBlock(candidate as unknown as EmailBlock),
          ];
        }

        return [] as ContentBlock[];
      },
    );

    const persisted = await persistCampaignRecord({
      campaignId: campaignData.id ?? null,
      campaignType: "email",
      legacyContentHtml: campaignData.content,
      status: "draft",
      name: campaignData.name,
      subjectLine: campaignData.subject,
      preheaderText: campaignData.preheader ?? "",
      senderName: campaignData.sender_name,
      senderEmail: campaignData.sender_email,
      fromEmailDomainId: campaignData.from_email_domain_id ?? null,
      replyTo: campaignData.sender_email,
      contentBlocks,
      smsMessage: "",
      sendImmediately: campaignData.schedule.type === "immediate",
      sendAt: campaignData.schedule.send_at ?? null,
      sourceContentTaskId: campaignData.source_content_id ?? null,
      segmentIds: campaignData.segments.map((segment) => segment.id),
      personaIds: [],
      metadata: campaignData.source_metadata,
    });

    const campaign = persisted.campaign;

    // Handle segment linking
    // If updating, clear old segment links first
    if (campaignData.id) {
      await supabase
        .from("campaign_segments")
        .delete()
        .eq("campaign_id", campaign.id);

      // Also clear single segment_id
      await supabase
        .from("crm_campaigns")
        .update({ segment_id: null })
        .eq("id", campaign.id);
    }

    // Handle segment linking - single segment vs multiple segments
    if (campaignData.segments.length === 1) {
      // Single segment - store directly on campaign
      const { error: updateError } = await supabase
        .from("crm_campaigns")
        .update({ segment_id: campaignData.segments[0].id })
        .eq("id", campaign.id);

      if (updateError) {
        console.error("Error setting single segment:", updateError);
      }
    } else if (campaignData.segments.length > 1) {
      // Multiple segments - use campaign_segments table
      const segmentLinks = campaignData.segments.map((segment) => ({
        campaign_id: campaign.id,
        segment_id: segment.id,
      }));

      const { error: segmentError } = await supabase
        .from("campaign_segments")
        .insert(segmentLinks);

      if (segmentError) {
        console.error("Error linking segments:", segmentError);
      }
    }

    return campaign;
  } catch (error) {
    console.error("Error saving campaign:", error);
    throw error;
  }
};

/**
 * Atomically claims a campaign for sending to prevent double-sends.
 * Uses a Postgres RPC with FOR UPDATE to ensure only one caller can claim.
 */
export const claimCampaignForSend = async (
  campaignId: string,
): Promise<{
  success: boolean;
  previousStatus?: string;
  errorMessage?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc("claim_campaign_for_send", {
      campaign_id: campaignId,
    });

    if (error) {
      console.error("RPC claim error:", error);
      return { success: false, errorMessage: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        errorMessage: "No response from claim function",
      };
    }

    const result = data[0];
    return {
      success: result.success,
      previousStatus: result.previous_status,
      errorMessage: result.error_message,
    };
  } catch (err: any) {
    console.error("Claim campaign error:", err);
    return { success: false, errorMessage: err.message };
  }
};

const recoverPersistedQueueState = async (campaignId: string) => {
  const { data: campaignState, error } = await supabase
    .from("crm_campaigns")
    .select("status, total_recipients")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    console.error("Failed to inspect persisted campaign queue state:", error);
    return {
      handled: false,
      queuedRecipients: 0,
      status: null as string | null,
    };
  }

  const status = campaignState?.status || null;
  if (
    status === CAMPAIGN_STATUS.QUEUED ||
    status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
  ) {
    return {
      handled: true,
      queuedRecipients: Number(campaignState?.total_recipients || 0),
      status,
    };
  }

  return { handled: false, queuedRecipients: 0, status };
};

export const sendCampaign = async (campaignData: CampaignData) => {
  try {
    // First save as draft
    const campaign = await saveCampaignAsDraft(campaignData);

    // For immediate sends, use atomic claim then send
    if (campaignData.schedule.type === "immediate") {
      // Step 1: Atomically claim the campaign (prevents double-sends)
      const claimResult = await claimCampaignForSend(campaign.id);

      if (!claimResult.success) {
        const errorMsg = claimResult.errorMessage || "Failed to claim campaign";
        console.error("❌ Claim failed:", errorMsg);
        throw new Error(errorMsg);
      }

      const { data: sendResult, error: sendError } =
        await supabase.functions.invoke("send-email-campaign", {
          body: { campaignId: campaign.id },
        });

      if (sendError) {
        console.error("Edge function send error:", sendError);
        const recovered = await recoverPersistedQueueState(campaign.id);
        if (recovered.handled) {
          const message =
            recovered.status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
              ? "Campaign queue build partially completed. The queue will resume automatically."
              : `Campaign queued - sending to ${recovered.queuedRecipients} recipients`;
          toast.warning(message);
          return campaign;
        }
        // Mark as failed since we already claimed it
        await supabase
          .from("crm_campaigns")
          .update({
            status: "failed",
            send_error: sendError.message,
          })
          .eq("id", campaign.id);
        throw new Error(
          sendError.message || "Failed to send campaign via email service",
        );
      }

      if (sendResult?.error) {
        console.error("Send result error:", sendResult.error);
        const recovered = await recoverPersistedQueueState(campaign.id);
        if (recovered.handled) {
          const message =
            recovered.status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
              ? "Campaign queue build partially completed. The queue will resume automatically."
              : `Campaign queued - sending to ${recovered.queuedRecipients} recipients`;
          toast.warning(message);
          return campaign;
        }
        await supabase
          .from("crm_campaigns")
          .update({
            status: "failed",
            send_error: sendResult.error,
          })
          .eq("id", campaign.id);
        throw new Error(sendResult.error);
      }

      const queuedRecipients = Number(sendResult?.total_recipients || 0);
      toast.success(
        `Campaign queued - sending to ${queuedRecipients} recipients`,
      );
      return campaign;
    }

    // For scheduled campaigns, just update the status
    let status = "scheduled";
    let scheduled_at = null;

    if (
      campaignData.schedule.type === "scheduled" &&
      campaignData.schedule.send_at
    ) {
      scheduled_at = campaignData.schedule.send_at;
    } else if (campaignData.schedule.type === "optimal") {
      // Set optimal time (e.g., next Tuesday at 10 AM)
      const optimalTime = new Date();
      optimalTime.setDate(
        optimalTime.getDate() + ((2 - optimalTime.getDay() + 7) % 7),
      );
      optimalTime.setHours(10, 0, 0, 0);
      scheduled_at = optimalTime.toISOString();
    }

    // Update campaign status for scheduled sends
    const { error: updateError } = await supabase
      .from("crm_campaigns")
      .update({
        status,
        scheduled_at,
      })
      .eq("id", campaign.id);

    if (updateError) throw updateError;

    // Track campaign creation analytics
    await trackCampaignAnalytics(campaign.id, "created", {
      source: campaignData.source_content_id ? "newsletter_import" : "manual",
      segment_count: campaignData.segments.length,
      has_source_content: !!campaignData.source_content_id,
    });

    toast.success(`Campaign "${campaignData.name}" scheduled successfully!`);
    return campaign;
  } catch (error: any) {
    console.error("Error sending campaign:", error);
    toast.error(`Failed to send campaign: ${error.message}`);
    throw error;
  }
};

const trackCampaignAnalytics = async (
  campaignId: string,
  action: string,
  metadata: any,
) => {
  try {
    await supabase.functions.invoke("track-campaign-analytics", {
      body: {
        campaign_id: campaignId,
        action,
        metadata,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to track analytics:", error);
    // Don't fail the main operation for analytics
  }
};

export const regenerateCampaignContent = async (
  campaignId: string,
  originalContent: string,
  options: {
    tone?: "professional" | "friendly" | "urgent" | "casual";
    focus?: "seasonal" | "promotional" | "educational" | "community";
    personaTag?: string;
  } = {},
) => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "regenerate-crm-content",
      {
        body: {
          campaign_id: campaignId,
          original_content: originalContent,
          regeneration_options: options,
          timestamp: new Date().toISOString(),
        },
      },
    );

    if (error) throw error;

    toast.success("Content regenerated successfully");
    return data.regenerated_content;
  } catch (error) {
    console.error("Error regenerating content:", error);
    toast.error("Failed to regenerate content");
    throw error;
  }
};

// =====================================================
// SCHEDULED CAMPAIGN MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Update a campaign's scheduled time
 */
export const updateCampaignSchedule = async (
  campaignId: string,
  scheduledAt: string,
  timezone?: string,
  options?: { silent?: boolean; onFailureMessage?: (message: string) => void },
): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const mapScheduleFailureToUserMessage = (reason?: string | null) => {
      const r = String(reason || "").toLowerCase();
      if (!r) return "We couldn't save your schedule. Please try again.";
      if (r.includes("not authenticated"))
        return "Please sign in again to schedule this campaign.";
      if (r.includes("not allowed"))
        return "You don't have access to schedule this campaign.";
      if (r.includes("campaign not found"))
        return "Campaign not found. Please refresh and try again.";
      if (r.includes("locked"))
        return "This campaign is locked (already sending or sent).";
      return "We couldn't save your schedule. Please try again.";
    };

    const isTerminalRpcFailure = (reason?: string | null) => {
      const r = String(reason || "").toLowerCase();
      return r.includes("not authenticated") || r.includes("locked");
    };

    // Preferred path: server-side SECURITY DEFINER RPC.
    // This avoids client-side RLS drift causing silent 0-row updates.
    try {
      const { data, error } = await supabase.rpc(
        "set_campaign_schedule" as any,
        {
          p_campaign_id: campaignId,
          p_scheduled_at: scheduledAt,
          p_timezone: timezone ?? null,
        } as any,
      );

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.success === true) {
          if (!options?.silent) toast.success("Schedule updated successfully");
          return true;
        }

        const userMessage = mapScheduleFailureToUserMessage(row?.error_message);

        // Allow callers to present a friendly message even when we suppress service toasts.
        options?.onFailureMessage?.(userMessage);

        // If the RPC failure is terminal (auth/locked), stop here.
        // Otherwise, fall back to direct table update to preserve compatibility with older RLS policies.
        if (isTerminalRpcFailure(row?.error_message)) {
          if (!options?.silent) toast.error(userMessage);
          return false;
        }
      }

      // If RPC doesn't exist/visible yet, fall back.
      const msg = String((error as any)?.message || "");
      const looksLikeMissingRpc =
        msg.toLowerCase().includes("could not find the function") ||
        msg.toLowerCase().includes("schema cache");

      if (!looksLikeMissingRpc) {
        // Fall back to direct table update below.
      }
    } catch {}

    // Best-effort status check. In some environments, SELECT can be blocked by RLS
    // even when UPDATE is permitted (e.g. owner-only UPDATE fallback). We should
    // not fail early in that case.
    try {
      const { data: rows, error: fetchError } = await supabase
        .from("crm_campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const campaign = rows ?? null;

      if (campaign?.status === CAMPAIGN_STATUS.SENDING) {
        if (!options?.silent) {
          toast.error("Cannot reschedule a campaign that is currently sending");
        }
        return false;
      }

      if (campaign?.status === CAMPAIGN_STATUS.SENT) {
        if (!options?.silent) {
          toast.error(
            "Cannot reschedule a campaign that has already been sent",
          );
        }
        return false;
      }
    } catch {}

    const baseUpdate = {
      scheduled_at: scheduledAt,
      status: CAMPAIGN_STATUS.SCHEDULED,
      // Reset any previous send attempt state so the scheduler can try again
      send_started_at: null,
      send_error: null,
      updated_at: new Date().toISOString(),
      metadata: timezone ? { scheduled_timezone: timezone } : undefined,
    };

    // Absolute-minimum update payload that should work even if newer columns
    // (like metadata/send_error) haven't been deployed yet.
    const minimalUpdate = {
      scheduled_at: scheduledAt,
      status: CAMPAIGN_STATUS.SCHEDULED,
      updated_at: new Date().toISOString(),
    };

    // Some production environments may include legacy claim columns used by old scheduler logic.
    // Other environments won't have them; if we include unknown columns PostgREST will error.
    const extendedUpdate = {
      ...baseUpdate,
      claim_token: null,
      sending_started_at: null,
      send_attempts: 0,
      failure_reason: null,
    } as any;

    const attemptUpdate = async (payload: Record<string, any>) => {
      return await supabase
        .from("crm_campaigns")
        .update(payload)
        .eq("id", campaignId)
        // Also guard at the DB update level to prevent rescheduling while sending/sent
        // even if we couldn't read status due to RLS.
        .neq("status", CAMPAIGN_STATUS.SENDING)
        .neq("status", CAMPAIGN_STATUS.SENT)
        // IMPORTANT: do not use (maybe)Single() here.
        // If 0 rows are updated (RLS denial or locked status), PostgREST will throw:
        // "JSON object requested, multiple (or no) rows returned".
        // We want to treat 0 rows as a normal "false" outcome.
        .select("id");
    };

    const attempts: Array<{ label: string; payload: Record<string, any> }> = [
      { label: "extended", payload: extendedUpdate },
      { label: "base", payload: baseUpdate },
      { label: "minimal", payload: minimalUpdate },
    ];

    let lastError: any = null;
    for (const attempt of attempts) {
      const { data, error } = await attemptUpdate(attempt.payload);
      if (!error) {
        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 1 && (rows[0] as any)?.id) {
          lastError = null;
          break;

          const userMessage =
            "We couldn't save your schedule. Please try again.";
          options?.onFailureMessage?.(userMessage);
          if (!options?.silent) toast.error(userMessage);
          return false;
        }

        lastError = error;
        const msg = String((error as any)?.message || "");
        const looksLikeMissingColumn =
          msg.toLowerCase().includes("does not exist") &&
          msg.toLowerCase().includes("column");

        continue;
      }

      throw error;
    }

    if (lastError) throw lastError;

    if (!options?.silent) toast.success("Schedule updated successfully");
    return true;
  } catch (error: any) {
    console.error("Error updating campaign schedule:", error);
    if (!options?.silent) {
      // Avoid surfacing internal PostgREST/schema-cache/RLS messages to end users.
      const msg = String(error?.message || "").toLowerCase();
      if (
        msg.includes("jwt") ||
        msg.includes("auth") ||
        msg.includes("permission")
      ) {
        toast.error("Please sign in again to update the schedule.");
      } else {
        toast.error("We couldn't save your schedule. Please try again.");
      }
    }

    // Also inform silent callers with a user-friendly message.
    if (options?.onFailureMessage) {
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("jwt") || msg.includes("auth")) {
        options.onFailureMessage(
          "Please sign in again to schedule this campaign.",
        );
      } else if (
        msg.includes("sending") ||
        msg.includes("sent") ||
        msg.includes("locked")
      ) {
        options.onFailureMessage(
          "This campaign is locked (already sending or sent).",
        );
      } else {
        options.onFailureMessage(
          "We couldn't save your schedule. Please try again.",
        );
      }
    }
    return false;
  }
};

/**
 * Unschedule a campaign - revert to draft status
 */
export const unscheduleCampaign = async (
  campaignId: string,
  options?: { silent?: boolean; onFailureMessage?: (message: string) => void },
): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const mapUnscheduleFailureToUserMessage = (reason?: string | null) => {
      const r = String(reason || "").toLowerCase();
      if (!r) return "We couldn't remove the schedule. Please try again.";
      if (r.includes("not authenticated"))
        return "Please sign in again to update this campaign.";
      if (r.includes("not allowed"))
        return "You don't have access to update this campaign.";
      if (r.includes("campaign not found"))
        return "Campaign not found. Please refresh and try again.";
      if (r.includes("locked"))
        return "This campaign is locked (already sending or sent).";
      return "We couldn't remove the schedule. Please try again.";
    };

    const isTerminalRpcFailure = (reason?: string | null) => {
      const r = String(reason || "").toLowerCase();
      return r.includes("not authenticated") || r.includes("locked");
    };

    // Preferred path: server-side SECURITY DEFINER RPC.
    try {
      const { data, error } = await supabase.rpc(
        "clear_campaign_schedule" as any,
        { p_campaign_id: campaignId } as any,
      );

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.success === true) {
          if (!options?.silent)
            toast.success("Campaign unscheduled - returned to draft");
          return true;
        }

        const userMessage = mapUnscheduleFailureToUserMessage(
          row?.error_message,
        );

        options?.onFailureMessage?.(userMessage);

        if (isTerminalRpcFailure(row?.error_message)) {
          if (!options?.silent) toast.error(userMessage);
          return false;
        }
      }

      const msg = String((error as any)?.message || "");
      const looksLikeMissingRpc =
        msg.toLowerCase().includes("could not find the function") ||
        msg.toLowerCase().includes("schema cache");

      if (!looksLikeMissingRpc) {
        // Fall back to direct table update below.
      }
    } catch {}

    // Best-effort status check. Don't fail early if SELECT is blocked by RLS.
    try {
      const { data: rows, error: fetchError } = await supabase
        .from("crm_campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const campaign = rows ?? null;

      if (campaign?.status === CAMPAIGN_STATUS.SENDING) {
        if (!options?.silent) {
          toast.error("Cannot unschedule a campaign that is currently sending");
        }
        return false;
      }

      if (campaign?.status === CAMPAIGN_STATUS.SENT) {
        if (!options?.silent) {
          toast.error(
            "Cannot unschedule a campaign that has already been sent",
          );
        }
        return false;
      }
    } catch {}

    const baseUpdate = {
      scheduled_at: null,
      status: CAMPAIGN_STATUS.DRAFT,
      send_started_at: null,
      send_error: null,
      updated_at: new Date().toISOString(),
    };

    const minimalUpdate = {
      scheduled_at: null,
      status: CAMPAIGN_STATUS.DRAFT,
      updated_at: new Date().toISOString(),
    };

    const extendedUpdate = {
      ...baseUpdate,
      claim_token: null,
      sending_started_at: null,
      send_attempts: 0,
      failure_reason: null,
    } as any;

    const attemptUpdate = async (payload: Record<string, any>) => {
      return await supabase
        .from("crm_campaigns")
        .update(payload)
        .eq("id", campaignId)
        .neq("status", CAMPAIGN_STATUS.SENDING)
        .neq("status", CAMPAIGN_STATUS.SENT)
        .select("id");
    };

    const attempts: Array<{ label: string; payload: Record<string, any> }> = [
      { label: "extended", payload: extendedUpdate },
      { label: "base", payload: baseUpdate },
      { label: "minimal", payload: minimalUpdate },
    ];

    let lastError: any = null;
    for (const attempt of attempts) {
      const { data, error } = await attemptUpdate(attempt.payload);
      if (!error) {
        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 1 && (rows[0] as any)?.id) {
          lastError = null;
          break;
          return false;
        }

        lastError = error;
        const msg = String((error as any)?.message || "");
        const looksLikeMissingColumn =
          msg.toLowerCase().includes("does not exist") &&
          msg.toLowerCase().includes("column");

        continue;
      }

      throw error;
    }

    if (lastError) throw lastError;

    if (!options?.silent)
      toast.success("Campaign unscheduled - returned to draft");
    return true;
  } catch (error: any) {
    console.error("Error unscheduling campaign:", error);
    if (!options?.silent) {
      const msg = String(error?.message || "").toLowerCase();
      if (
        msg.includes("jwt") ||
        msg.includes("auth") ||
        msg.includes("permission")
      ) {
        toast.error("Please sign in again to update this campaign.");
      } else {
        toast.error("We couldn't remove the schedule. Please try again.");
      }
    }

    if (options?.onFailureMessage) {
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("jwt") || msg.includes("auth")) {
        options.onFailureMessage(
          "Please sign in again to update this campaign.",
        );
      } else if (
        msg.includes("sending") ||
        msg.includes("sent") ||
        msg.includes("locked")
      ) {
        options.onFailureMessage(
          "This campaign is locked (already sending or sent).",
        );
      } else {
        options.onFailureMessage(
          "We couldn't remove the schedule. Please try again.",
        );
      }
    }
    return false;
  }
};

/**
 * Send a scheduled campaign immediately
 * Uses atomic claim to prevent double-sends
 */
export const sendScheduledCampaignNow = async (
  campaignId: string,
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Step 1: Atomically claim the campaign
    const claimResult = await claimCampaignForSend(campaignId);

    if (!claimResult.success) {
      const errorMsg = claimResult.errorMessage || "Failed to claim campaign";
      console.error("❌ Claim failed:", errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Step 2: Clear scheduled_at since we're sending now
    await supabase
      .from("crm_campaigns")
      .update({ scheduled_at: null })
      .eq("id", campaignId);

    const { data: sendResult, error: sendError } =
      await supabase.functions.invoke("send-email-campaign", {
        body: { campaignId },
      });

    if (sendError) {
      console.error("Edge function send error:", sendError);
      const recovered = await recoverPersistedQueueState(campaignId);
      if (recovered.handled) {
        const message =
          recovered.status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
            ? "Campaign queue build partially completed. The queue will resume automatically."
            : `Campaign queued - sending to ${recovered.queuedRecipients} recipients`;
        toast.warning(message);
        return { success: true };
      }
      await supabase
        .from("crm_campaigns")
        .update({
          status: CAMPAIGN_STATUS.FAILED,
          send_error: sendError.message,
        })
        .eq("id", campaignId);
      toast.error(`Send failed: ${sendError.message}`);
      return { success: false, error: sendError.message };
    }

    if (sendResult?.error) {
      console.error("Send result error:", sendResult.error);
      const recovered = await recoverPersistedQueueState(campaignId);
      if (recovered.handled) {
        const message =
          recovered.status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
            ? "Campaign queue build partially completed. The queue will resume automatically."
            : `Campaign queued - sending to ${recovered.queuedRecipients} recipients`;
        toast.warning(message);
        return { success: true };
      }
      await supabase
        .from("crm_campaigns")
        .update({
          status: CAMPAIGN_STATUS.FAILED,
          send_error: sendResult.error,
        })
        .eq("id", campaignId);
      toast.error(`Send failed: ${sendResult.error}`);
      return { success: false, error: sendResult.error };
    }

    const queuedRecipients = Number(sendResult?.total_recipients || 0);
    toast.success(
      `Campaign queued - sending to ${queuedRecipients} recipients`,
    );

    return { success: true };
  } catch (error: any) {
    console.error("Error sending campaign now:", error);
    toast.error(`Failed to send: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Get campaign status info for display
 */
export const getCampaignStatusInfo = (
  status: string,
  scheduledAt?: string | null,
  sendError?: string | null,
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  isPastDue: boolean;
  isLocked: boolean;
} => {
  const isPastDue =
    status === CAMPAIGN_STATUS.SCHEDULED &&
    scheduledAt &&
    new Date(scheduledAt) < new Date();
  const isLocked = isLockedCampaignStatus(status);

  switch (status) {
    case CAMPAIGN_STATUS.DRAFT:
      return {
        label: getCampaignStatusLabel(status),
        variant: "secondary",
        isPastDue: false,
        isLocked: false,
      };
    case CAMPAIGN_STATUS.SCHEDULED:
      return {
        label: getCampaignStatusLabel(status),
        variant: "default",
        isPastDue,
        isLocked: true,
      };
    case CAMPAIGN_STATUS.QUEUED:
    case CAMPAIGN_STATUS.PARTIALLY_QUEUED:
    case CAMPAIGN_STATUS.SENDING:
      return {
        label: getCampaignStatusLabel(status),
        variant: "default",
        isPastDue: false,
        isLocked: true,
      };
    case CAMPAIGN_STATUS.PAUSED:
      return {
        label: getCampaignStatusLabel(status),
        variant: "outline",
        isPastDue: false,
        isLocked: true,
      };
    case CAMPAIGN_STATUS.SENT:
      return {
        label: getCampaignStatusLabel(status),
        variant: "outline",
        isPastDue: false,
        isLocked: true,
      };
    case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
    case CAMPAIGN_STATUS.FAILED:
      return {
        label: getCampaignStatusLabel(status),
        variant: "destructive",
        isPastDue: false,
        isLocked,
      };
    default:
      return {
        label: getCampaignStatusLabel(status),
        variant: "secondary",
        isPastDue: false,
        isLocked,
      };
  }
};
