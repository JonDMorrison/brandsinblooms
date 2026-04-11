import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { saveCampaignAsDraft, CampaignData } from "@/utils/crmCampaignService";
import {
  validateBeforeSend,
  parseEdgeFunctionError,
  SendError,
  SendErrorCode,
} from "@/utils/campaignSendingErrors";

export interface SendingState {
  status: "idle" | "saving" | "sending" | "success" | "error";
  progress?: number;
  message?: string;
  error?: SendError;
  campaignId?: string;
  sentCount?: number;
}

export interface UseCampaignSendingOptions {
  onSuccess?: (campaignId: string, sentCount: number) => void;
  onError?: (error: SendError) => void;
  navigateOnSuccess?: boolean;
}

export function useCampaignSending(options: UseCampaignSendingOptions = {}) {
  const { navigateOnSuccess = true } = options;
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
    }) => {
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
        toast({
          title: validation.error.title,
          description: validation.error.description,
          variant: "destructive",
        });
        options.onError?.(validation.error);
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
        toast({
          title: error.title,
          description: error.description,
          variant: "destructive",
        });
        options.onError?.(error);
        return { success: false, error };
      }

      // Step 3: Send via edge function
      setState({
        status: "sending",
        message: "Sending emails...",
        campaignId: campaign.id,
      });

      try {
        const { data: sendResult, error: sendError } =
          await supabase.functions.invoke("send-email-campaign", {
            body: { campaignId: campaign.id },
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
          toast({
            title: error.title,
            description: error.description,
            variant: "destructive",
          });
          options.onError?.(error);
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
          toast({
            title: error.title,
            description: error.description,
            variant: "destructive",
          });
          options.onError?.(error);
          return { success: false, error, campaignId: campaign.id };
        }

        const sentCount = sendResult?.metrics?.sent || 0;
        const complianceWarnings = Array.isArray(sendResult?.warnings)
          ? sendResult.warnings.filter((w: unknown) => typeof w === "string")
          : [];

        setState({
          status: "success",
          campaignId: campaign.id,
          sentCount,
          message: `Sent to ${sentCount} recipients`,
        });

        toast({
          title: "Campaign sent!",
          description: `Your campaign "${campaignName}" has been sent to ${sentCount} customers.`,
        });

        if (complianceWarnings.length > 0) {
          toast({
            title: "Compliance warning",
            description: complianceWarnings[0],
          });
        }

        options.onSuccess?.(campaign.id, sentCount);

        if (navigateOnSuccess) {
          navigate(`/crm/campaigns/${campaign.id}/analytics`);
        }

        return { success: true, campaignId: campaign.id, sentCount };
      } catch (sendError: any) {
        console.error("❌ Send failed:", sendError);

        const error = parseEdgeFunctionError(sendError);
        setState({ status: "error", error, campaignId: campaign.id });

        toast({
          title: error.title,
          description: error.description,
          variant: "destructive",
        });

        options.onError?.(error);
        return { success: false, error, campaignId: campaign.id };
      }
    },
    [navigate, toast, options],
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
