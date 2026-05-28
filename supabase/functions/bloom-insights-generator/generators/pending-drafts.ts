import type { GeneratedInsight, ServiceClient } from "../types.ts";
import {
  buildExpiresAt,
  DEFAULT_INSIGHT_EXPIRY_DAYS,
  pluralize,
} from "../utils.ts";

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now = new Date(),
): Promise<GeneratedInsight[]> {
  const [draftCampaigns, draftProducts] = await Promise.all([
    serviceClient
      .from("crm_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
    serviceClient
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
  ]);

  if (draftCampaigns.error) {
    throw draftCampaigns.error;
  }
  if (draftProducts.error) {
    throw draftProducts.error;
  }

  const campaignCount = draftCampaigns.count ?? 0;
  const productCount = draftProducts.count ?? 0;
  const totalCount = campaignCount + productCount;

  if (totalCount === 0) {
    return [];
  }

  return [
    {
      insightType: "pending_drafts",
      title: `${totalCount} ${pluralize(totalCount, "item")} waiting for review (${campaignCount} ${pluralize(campaignCount, "campaign")}, ${productCount} ${pluralize(productCount, "product")})`,
      description:
        "Draft campaigns and products are waiting for review before they can go live.",
      actionPrompt:
        "Show me all draft campaigns and products that need attention",
      entityType: null,
      entityId: null,
      severity: "info",
      expiresAt: buildExpiresAt(DEFAULT_INSIGHT_EXPIRY_DAYS, now),
    },
  ];
}
