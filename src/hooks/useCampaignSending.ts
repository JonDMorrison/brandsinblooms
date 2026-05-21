import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { saveCampaignAsDraft, CampaignData } from "@/utils/crmCampaignService";
import {
  validateBeforeSend,
  parseEdgeFunctionError,
  SendError,
} from "@/utils/campaignSendingErrors";

export interface SendingState {
  status: "idle" | "saving" | "sending" | "success" | "error";
  progress?: number;
  message?: string;
  error?: SendError;
  campaignId?: string;
  recipientCount?: number;
  skippedCount?: number;
  sendingMode?: "ready" | "protected" | "review";
  warnings?: string[];
}

export interface UseCampaignSendingOptions {
  onSuccess?: (campaignId: string, recipientCount: number) => void;
  onError?: (error: SendError) => void;
  navigateOnSuccess?: boolean;
  suppressToasts?: boolean;
}

export type CampaignSendResult =
  | {
      success: true;
      campaignId: string;
      recipientCount: number;
      skippedCount: number;
      sendingMode: "ready" | "protected" | "review";
      complianceWarnings: string[];
      hygieneWarnings: string[];
      sendSummary: string;
    }
  | {
      success: false;
      error: SendError;
      campaignId?: string;
    };

export interface CampaignSendAcknowledgedWarning {
  id: string;
  label: string;
  detail?: string | null;
  warning?: string | null;
}

export interface CampaignSendInvocationOptions {
  forceBypassConsent?: boolean;
  forceBypassSoftSuppression?: boolean;
  acknowledgedWarnings?: CampaignSendAcknowledgedWarning[];
}

function normalizeWarningList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (typeof record.message === "string") return record.message;
        if (typeof record.label === "string") return record.label;
      }
      return "";
    })
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveSendingMode(sendResult: any): "ready" | "protected" | "review" {
  const action = String(sendResult?.reputation?.action || "").toLowerCase();
  const tier = String(sendResult?.reputation?.tier || "").toLowerCase();
  const pacing = Number(sendResult?.reputation?.send_pacing_multiplier || 1);
  const warningsCount =
    normalizeWarningList(sendResult?.warnings).length +
    normalizeWarningList(sendResult?.hygiene?.warnings).length;

  if (action === "throttle" || tier === "restricted" || pacing > 1) {
    return "protected";
  }

  if (warningsCount > 0) {
    return "review";
  }

  return "ready";
}

function buildSendSummary(params: {
  recipientCount: number;
  skippedCount: number;
  sendingMode: "ready" | "protected" | "review";
  warningCount: number;
}) {
  const { recipientCount, skippedCount, sendingMode, warningCount } = params;
  const recipientLabel = `${recipientCount.toLocaleString()} eligible recipient${recipientCount === 1 ? "" : "s"}`;
  const skippedLabel = skippedCount > 0
    ? ` ${skippedCount.toLocaleString()} contact${skippedCount === 1 ? " was" : "s were"} skipped to protect deliverability.`
    : "";
  const warningLabel = warningCount > 0
    ? ` ${warningCount} deliverability warning${warningCount === 1 ? "" : "s"} found.`
    : "";

  if (sendingMode === "protected") {
    return `Protected Send is active. Sending to ${recipientLabel} with safer pacing.${skippedLabel}${warningLabel}`;
  }

  if (sendingMode === "review") {
    return `Campaign queued for ${recipientLabel}.${skippedLabel}${warningLabel}`;
  }

  return `Campaign queued for ${recipientLabel}.${skippedLabel}`;
}

export function useCampaignSending(options: UseCampaignSendingOptions = {}) {
  const {
    navigateOnSuccess = true,
    suppressToasts = false,
    onError,
    onSuccess,
  } = options;
  const [state, setState] = useState<SendingState>({ status: "idle" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const resetState = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const sendCampaign = useCallback(
    async (params: {
      campaignId?: string; // Optional - if provided, will UPDATE instead of creating duplicate
      campaignName: string;
      subjectLine: string;
      preheaderText: string;
      senderName: string;
      senderEmail: string;
      content: string;
      blocks: any[];
      segments: Array<{ id: string; name: string; customer_count: number }>;
      forceBypassConsent?: boolean;
      forceBypassSoftSuppression?: boolean;
      acknowledgedWarnings?: CampaignSendAcknowledgedWarning[];
    }): Promise<CampaignSendResult> => {
      const {
        campaignId: existingCampaignId,
        campaignName,
        subjectLine,
        preheaderText,
        senderName,
        senderEmail,
        content,
        blocks,
        segments,
        forceBypassConsent = false,
        forceBypassSoftSuppression = false,
        acknowledgedWarnings = [],
      } = params;

      // Step 1: Pre-send validation
      const validation = validateBeforeSend({
        campaignName,
        subjectLine,
        segments,
        blocks,
        content,
      });

      if (!validation.valid && validation.error) {
        setState({ status: "error", error: validation.error });
        if (!suppressToasts) {
          toast({
            title: validation.error.title,
            description: validation.error.description,
            variant: "destructive",
          });
        }
        onError?.(validation.error);
        return { success: false, error: validation.error };
      }

      // Step 2: Save campaign as draft
      setState({ status: "saving", message: "Saving campaign..." });

      let campaign: any;
      try {
        const campaignData: CampaignData = {
          id: existingCampaignId, // Pass existing ID to UPDATE instead of INSERT
          name: campaignName,
          subject: subjectLine,
          sender_name: senderName,
          sender_email: senderEmail,
          content: content,
          preheader: preheaderText,
          segments: segments,
          schedule: { type: "immediate" },
          content_blocks: blocks,
        };

        campaign = await saveCampaignAsDraft(campaignData);

        if (!campaign?.id) {
          throw new Error("Campaign save returned no ID");
        }
      } catch (saveError: any) {
        console.error("❌ Campaign save failed:", saveError);
        const error: SendError = {
          code: "CAMPAIGN_SAVE_FAILED",
          title: "Failed to save campaign",
          description:
            saveError.message || "Could not save your campaign before sending.",
          recoverable: true,
        };
        setState({ status: "error", error });
        if (!suppressToasts) {
          toast({
            title: error.title,
            description: error.description,
            variant: "destructive",
          });
        }
        onError?.(error);
        return { success: false, error };
      }

      // Step 3: Send via edge function
      setState({
        status: "sending",
        message: "Queueing campaign...",
        campaignId: campaign.id,
      });

      try {
        const { data: sendResult, error: sendError } =
          await supabase.functions.invoke("send-email-campaign", {
            body: {
              campaignId: campaign.id,
              forceBypassConsent,
              forceBypassSoftSuppression,
              acknowledgedWarnings,
            },
          });

        if (sendError) {
          console.error("❌ Edge function error:", sendError);

          const contextBody = (sendError as any)?.context?.body;
          let parsedBody: any = undefined;

          if (typeof contextBody === "string" && contextBody.length > 0) {
            try {
              parsedBody = JSON.parse(contextBody);
            } catch {
              parsedBody = { error: contextBody };
            }
          } else if (contextBody && typeof contextBody === "object") {
            parsedBody = contextBody;
          }

          const extractedMessage =
            typeof parsedBody?.error === "string"
              ? parsedBody.error
              : typeof parsedBody?.message === "string"
                ? parsedBody.message
                : "";

          const error = parseEdgeFunctionError(
            extractedMessage ? { message: extractedMessage } : sendError,
            parsedBody,
          );

          setState({ status: "error", error, campaignId: campaign.id });
          if (!suppressToasts) {
            toast({
              title: error.title,
              description: error.description,
              variant: "destructive",
            });
          }
          onError?.(error);
          return { success: false, error, campaignId: campaign.id };
        }

        // Check for error in response body
        if (sendResult?.error) {
          console.error("❌ Send result error:", sendResult.error);

          const error = parseEdgeFunctionError(
            { message: sendResult.error },
            sendResult,
          );
          setState({ status: "error", error, campaignId: campaign.id });
          if (!suppressToasts) {
            toast({
              title: error.title,
              description: error.description,
              variant: "destructive",
            });
          }
          onError?.(error);
          return { success: false, error, campaignId: campaign.id };
        }

        const recipientCount = Number(sendResult?.total_recipients || 0);
        const hygieneSummary = sendResult?.hygiene?.summary || {};
        const skippedCount =
          Number(hygieneSummary?.invalid_emails_count || 0) +
          Number(hygieneSummary?.duplicate_emails_count || 0) +
          Number(hygieneSummary?.suppressed_count || 0);
        const complianceWarnings = normalizeWarningList(sendResult?.warnings);
        const hygieneWarnings = normalizeWarningList(sendResult?.hygiene?.warnings);
        const allWarnings = [...complianceWarnings, ...hygieneWarnings];
        const sendingMode = resolveSendingMode(sendResult);
        const sendSummary = buildSendSummary({
          recipientCount,
          skippedCount,
          sendingMode,
          warningCount: allWarnings.length,
        });

        setState({
          status: "success",
          campaignId: campaign.id,
          recipientCount,
          skippedCount,
          sendingMode,
          warnings: allWarnings,
          message: sendSummary,
        });

        if (!suppressToasts) {
          toast({
            title: sendingMode === "protected" ? "Protected Send active" : "Campaign queued",
            description: sendSummary,
          });
        }

        if (!suppressToasts && allWarnings.length > 0) {
          toast({
            title: "Deliverability note",
            description: allWarnings[0],
          });
        }

        onSuccess?.(campaign.id, recipientCount);

        if (navigateOnSuccess) {
          navigate(`/crm/campaigns/${campaign.id}/report`);
        }

        return {
          success: true,
          campaignId: campaign.id,
          recipientCount,
          skippedCount,
          sendingMode,
          complianceWarnings,
          hygieneWarnings,
          sendSummary,
        };
      } catch (sendError: any) {
        console.error("❌ Send failed:", sendError);

        const error = parseEdgeFunctionError(sendError);
        setState({ status: "error", error, campaignId: campaign.id });

        if (!suppressToasts) {
          toast({
            title: error.title,
            description: error.description,
            variant: "destructive",
          });
        }

        onError?.(error);
        return { success: false, error, campaignId: campaign.id };
      }
    },
    [navigate, navigateOnSuccess, onError, onSuccess, suppressToasts, toast],
  );

  return {
    state,
    sendCampaign,
    resetState,
    isSending: state.status === "saving" || state.status === "sending",
    isError: state.status === "error",
    isSuccess: state.status === "success",
    isWarmupLimit: false,
    warmupDetails: undefined,
  };
}