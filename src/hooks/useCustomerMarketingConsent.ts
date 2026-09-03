import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";

export type MarketingChannel = "email" | "sms";
export type ConsentBasis = "express" | "implied";

export interface SetCustomerMarketingConsentInput {
  customerId: string;
  tenantId: string;
  customerLabel: string;
  channel: MarketingChannel;
  optedIn: boolean;
  source: string;
  consentBasis?: ConsentBasis;
  evidence?: string;
}

interface ConsentMutationResult {
  customerId: string;
  tenantId: string;
  channel: MarketingChannel;
  optedIn: boolean;
  statusChanged: boolean;
  source: string;
  consentBasis: ConsentBasis | "revoked";
  recordedAt: string;
  cancelledQueuedMessages: number;
}

export function useCustomerMarketingConsent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SetCustomerMarketingConsentInput) => {
      const { data, error } = await supabase.rpc(
        "set_customer_marketing_consent",
        {
          p_customer_id: input.customerId,
          p_channel: input.channel,
          p_opt_in: input.optedIn,
          p_source: input.source,
          p_consent_basis: input.optedIn
            ? (input.consentBasis ?? null)
            : null,
          p_evidence: input.evidence?.trim() || null,
          p_ip_address: null,
          p_user_agent:
            typeof navigator === "undefined" ? null : navigator.userAgent,
        },
      );

      if (error) throw error;
      return data as unknown as ConsentMutationResult;
    },
    onSuccess: async (result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({
          queryKey: ["customer-360", input.customerId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-consent-history", input.customerId],
        }),
        queryClient.invalidateQueries({ queryKey: ["customer-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["sms-dashboard-stats"] }),
      ]);

      void logActivity({
        tenantId: input.tenantId,
        customerId: input.customerId,
        actorType: "user",
        source: "ui",
        activityType: "customer.consent_updated",
        status: "success",
        title: `${input.channel.toUpperCase()} consent ${input.optedIn ? "documented" : "revoked"}`,
        description: {
          parts: [
            {
              type: "text",
              text: `${input.customerLabel}: ${input.channel.toUpperCase()} marketing ${input.optedIn ? "opt-in" : "opt-out"}.`,
            },
          ],
        },
        metadata: {
          channel: input.channel,
          opted_in: input.optedIn,
          source: result.source,
          consent_basis: result.consentBasis,
          status_changed: result.statusChanged,
          cancelled_queued_messages: result.cancelledQueuedMessages,
        },
        relatedEntities: { customer_id: input.customerId },
      });

      toast({
        title: `${input.channel.toUpperCase()} consent saved`,
        description: input.optedIn
          ? "Documented consent is active and its evidence is in the audit history."
          : `${input.channel.toUpperCase()} marketing is suppressed immediately${result.cancelledQueuedMessages ? `; ${result.cancelledQueuedMessages} queued message(s) were cancelled` : ""}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Consent was not changed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
