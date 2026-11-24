import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveCampaignStats,
  type CampaignStats,
} from "@/lib/crm/campaignStats";

export const emailCampaignStatsQueryKey = (campaignId: string) =>
  ["email-campaign-stats", campaignId] as const;

export async function fetchEmailCampaignStats(
  campaignId: string,
): Promise<CampaignStats> {
  const { data, error } = await supabase.rpc(
    "get_email_campaign_reporting_snapshot",
    { p_campaign_id: campaignId },
  );
  if (error) throw error;
  const stats = resolveCampaignStats(data);
  if (!stats) throw new Error("Campaign reporting snapshot is invalid");
  return stats;
}

export interface EmailCampaignStatsResult {
  stats: Map<string, CampaignStats>;
  pending: Set<string>;
  failed: Set<string>;
}

/**
 * The shared rollup (recipients, delivered, opens, clicks) for each sent
 * email campaign, from get_email_campaign_reporting_snapshot: the same source
 * as the report, dashboard and Reports > Overview.
 */
export function useEmailCampaignStats(
  campaignIds: readonly string[],
): EmailCampaignStatsResult {
  return useQueries({
    queries: campaignIds.map((campaignId) => ({
      queryKey: emailCampaignStatsQueryKey(campaignId),
      queryFn: () => fetchEmailCampaignStats(campaignId),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    })),
    combine: (results: UseQueryResult<CampaignStats>[]) => {
      const stats = new Map<string, CampaignStats>();
      const pending = new Set<string>();
      const failed = new Set<string>();
      results.forEach((result, index) => {
        const campaignId = campaignIds[index];
        if (result.data) stats.set(campaignId, result.data);
        else if (result.isError) failed.add(campaignId);
        else pending.add(campaignId);
      });
      return { stats, pending, failed };
    },
  });
}
