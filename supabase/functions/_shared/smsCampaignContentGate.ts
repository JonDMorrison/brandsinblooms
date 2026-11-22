import { checkConnectedContentFreshness, type ContentFreshnessResult } from "./connectedContentFreshness.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type SmsCampaignContent = {
  id: string;
  tenant_id: string | null;
  status: string;
  audience_confirmed?: boolean;
  connected_content_sources?: unknown;
  metrics?: unknown;
};

function savedContentHold(metrics: unknown): ContentFreshnessResult | null {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;
  const saved = metrics as Record<string, unknown>;
  if (typeof saved.replacement_campaign_id === "string" && saved.replacement_campaign_id.length > 0) {
    return {decision: "review_required", reason: "This campaign was replaced. Open the replacement draft; the original cannot send again."};
  }
  const review = saved.content_review;
  if (review && typeof review === "object" && !Array.isArray(review) && (review as Record<string, unknown>).decision === "review_required") {
    return {decision: "review_required", reason: "Website content needs an explicit review and a new draft before sending."};
  }
  return null;
}

/** Source checks never silently rewrite the owner's copy or source snapshot. */
export async function checkSmsCampaignContent(
  db: SupabaseClient,
  campaign: SmsCampaignContent,
  fetcher: typeof fetch = fetch,
): Promise<ContentFreshnessResult> {
  const hold = savedContentHold(campaign.metrics);
  if (hold) return hold;
  if (campaign.audience_confirmed === false) {
    return {decision: "review_required", reason: "Choose an audience in the text draft before launching."};
  }
  const manifest = campaign.connected_content_sources;
  const sources = manifest === undefined ? [] : Array.isArray(manifest) ? manifest : [null];
  if (sources.length > 0 && !["draft", "scheduled", "queued", "sending", "paused"].includes(campaign.status)) {
    return {decision: "review_required", reason: "This campaign is no longer active. Create a new draft to promote updated content."};
  }
  const result = await checkConnectedContentFreshness(db as unknown as Parameters<typeof checkConnectedContentFreshness>[0], campaign.tenant_id ?? "", sources, fetcher);
  if (result.decision !== "fresh") {
    const {data, error} = await db.rpc("record_sms_content_review", {
      p_tenant_id: campaign.tenant_id, p_campaign_id: campaign.id,
      p_expected_status: campaign.status, p_decision: result.decision,
      p_reason: result.reason,
    });
    if (error || data !== true) return {decision: "retry", reason: "Unable to record the website review. Delivery will retry before sending."};
  }
  return result;
}

/** The provider path also covers legacy queued messages carrying a campaign ID. */
export async function checkSmsMessageCampaignContent(
  db: SupabaseClient,
  campaignId: string | null,
  tenantId: string | null,
  fetcher: typeof fetch = fetch,
): Promise<ContentFreshnessResult> {
  if (!campaignId) return {decision: "fresh", reason: null};
  if (!tenantId) return {decision: "review_required", reason: "The message has no business context."};
  const {data, error} = await db.from("crm_sms_campaigns")
    .select("id,tenant_id,status,audience_confirmed,connected_content_sources,metrics")
    .eq("id", campaignId).eq("tenant_id", tenantId).maybeSingle();
  if (error) return {decision: "retry", reason: "Campaign content could not be checked."};
  const hold = savedContentHold(data?.metrics);
  if (hold) return hold;
  if (data && Array.isArray(data.connected_content_sources) && data.connected_content_sources.length === 0 && data.audience_confirmed !== false) {
    return {decision: "fresh", reason: null};
  }
  if (!data || !["queued", "sending"].includes(data.status)) {
    return {decision: "review_required", reason: "This campaign is not approved for delivery. Review it before resuming."};
  }
  return checkSmsCampaignContent(db, data, fetcher);
}
