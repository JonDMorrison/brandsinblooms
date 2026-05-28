import type { GeneratedInsight, ServiceClient } from "../types.ts";
import {
  buildExpiresAt,
  DEFAULT_INSIGHT_EXPIRY_DAYS,
  formatPercentValue,
  toFiniteNumber,
} from "../utils.ts";

interface CampaignPerformanceRow {
  id: string;
  name: string;
  open_rate: number | null;
}

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now = new Date(),
): Promise<GeneratedInsight[]> {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data, error } = await serviceClient
    .from("crm_campaigns")
    .select("id, name, open_rate")
    .eq("tenant_id", tenantId)
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .gte("sent_at", cutoff)
    .not("open_rate", "is", null)
    .order("sent_at", { ascending: false });

  if (error) {
    throw error;
  }

  const campaigns = (data ?? []) as CampaignPerformanceRow[];
  if (campaigns.length < 2) {
    return [];
  }

  const averageOpenRate =
    campaigns.reduce(
      (sum, campaign) => sum + toFiniteNumber(campaign.open_rate),
      0,
    ) / campaigns.length;

  if (averageOpenRate <= 0) {
    return [];
  }

  return campaigns.flatMap((campaign) => {
    const openRate = toFiniteNumber(campaign.open_rate);
    if (openRate > averageOpenRate * 1.5) {
      return [
        {
          insightType: "campaign_performance_anomaly",
          title: `Campaign '${campaign.name}' performed above average — ${formatPercentValue(openRate)}% open rate vs ${formatPercentValue(averageOpenRate)}% average`,
          description:
            "Bloom compared sent campaigns from the last 30 days and found a standout performer.",
          actionPrompt: `Analyze what made '${campaign.name}' succeed and suggest improvements`,
          entityType: "campaign",
          entityId: campaign.id,
          severity: "info",
          expiresAt: buildExpiresAt(DEFAULT_INSIGHT_EXPIRY_DAYS, now),
        },
      ];
    }

    if (openRate < averageOpenRate * 0.5) {
      return [
        {
          insightType: "campaign_performance_anomaly",
          title: `Campaign '${campaign.name}' performed below average — ${formatPercentValue(openRate)}% open rate vs ${formatPercentValue(averageOpenRate)}% average`,
          description:
            "Bloom compared sent campaigns from the last 30 days and found a campaign that is trailing your baseline.",
          actionPrompt: `Analyze what made '${campaign.name}' underperform and suggest improvements`,
          entityType: "campaign",
          entityId: campaign.id,
          severity: "warning",
          expiresAt: buildExpiresAt(DEFAULT_INSIGHT_EXPIRY_DAYS, now),
        },
      ];
    }

    return [];
  });
}
