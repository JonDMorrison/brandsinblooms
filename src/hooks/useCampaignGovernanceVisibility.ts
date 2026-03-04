import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignGovernanceVisibility {
  campaign_id: string;
  tenant_id: string;
  sent_count: number;
  delivered_count: number;
  hard_bounce_count: number;
  soft_bounce_count: number;
  complaint_count: number;
  unsubscribed_count: number;
  failed_count: number;
  delivery_rate: number;
  hard_bounce_rate: number;
  soft_bounce_rate: number;
  complaint_rate: number;
  unsubscribe_rate: number;
  failed_delivery_rate: number;
  risk_indicator: "green" | "yellow" | "red";
  threshold_exceeded: string[];
  threshold_details: Record<string, unknown>;
  reputation_score: number;
  reputation_tier: string;
  reputation_action: string;
  policy_recipient_cap: number | null;
  policy_job_batch_size: number;
  policy_send_pacing_multiplier: number;
  is_throttled: boolean;
  throttle_reasons: string[];
  reputation_impact: "none" | "policy_only" | "throttle_only" | "policy_and_throttle";
}

let governanceVisibilityRpcMissing: boolean | null = null;

function isMissingRpcFunction(error: any) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "pgrst202" ||
    code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

export const useCampaignGovernanceVisibility = (campaignId: string | null | undefined) => {
  return useQuery({
    queryKey: ["campaign-governance-visibility", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<CampaignGovernanceVisibility | null> => {
      if (!campaignId) return null;

      // If this project is deployed against an older DB without the RPC,
      // don't keep spamming failing calls.
      if (governanceVisibilityRpcMissing === true) return null;

      const asOf = new Date().toISOString();

      // NOTE: PostgREST RPC matching requires ALL parameters to be present
      // even if the SQL function defines defaults.
      const primary = await supabase.rpc(
        "get_campaign_governance_visibility_tenant_safe" as never,
        {
          p_campaign_id: campaignId,
          p_as_of: asOf,
        } as never,
      );

      let data = primary.data as any;
      let error = primary.error as any;

      if (error && isMissingRpcFunction(error)) {
        // Fall back to non-tenant-safe function (if granted) for older schemas.
        const fallback = await supabase.rpc(
          "get_campaign_governance_visibility" as never,
          {
            p_campaign_id: campaignId,
            p_as_of: asOf,
          } as never,
        );
        data = fallback.data as any;
        error = fallback.error as any;
      }

      if (error) {
        if (isMissingRpcFunction(error)) {
          governanceVisibilityRpcMissing = true;
          return null;
        }
        throw error;
      }

      if (!data) return null;

      const row = (Array.isArray(data) ? data[0] : data) as
        | CampaignGovernanceVisibility
        | null;

      return row || null;
    },
  });
};
