import { ContentFreshnessHold } from "./connectedContentFreshness.ts";

export function emailCampaignReviewReason(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown> : {};
  if (typeof metadata.contentReviewReplacementId === "string" && metadata.contentReviewReplacementId.trim()) {
    return "This campaign was replaced after website review. Open the reviewed draft instead.";
  }
  return row.send_blocked_reason === "connected_content_review"
    ? "Review the website changes and create a reviewed draft before sending." : null;
}

type CampaignReviewClient = {
  from(table: "crm_campaigns"): {select(columns: string): {
    eq(column: string, value: string): {eq(column: string, value: string): {
      maybeSingle(): PromiseLike<{data: unknown; error: unknown}>;
    }};
  }};
};

/** Read again before every provider attempt; queued payloads and caches can predate a review. */
export async function assertEmailCampaignReviewAllowsDelivery(db: CampaignReviewClient, tenantId: string, campaignId: string) {
  if (!campaignId) return;
  const {data, error} = await db.from("crm_campaigns")
    .select("metadata,send_blocked_reason").eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) throw new ContentFreshnessHold("retry", "The campaign's review status could not be verified.");
  const reason = emailCampaignReviewReason(data);
  if (reason) throw new ContentFreshnessHold("review_required", reason);
}
