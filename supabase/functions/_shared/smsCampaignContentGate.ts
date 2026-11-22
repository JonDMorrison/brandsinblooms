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

/** Source checks never silently rewrite the owner's copy or source snapshot. */
export async function checkSmsCampaignContent(
  db: SupabaseClient,
  campaign: SmsCampaignContent,
  fetcher: typeof fetch = fetch,
): Promise<ContentFreshnessResult> {
  if (campaign.audience_confirmed === false) {
    return {decision: "review_required", reason: "Choose an audience in the text draft before launching."};
  }
  const manifest = campaign.connected_content_sources;
  const sources = manifest === undefined ? [] : Array.isArray(manifest) ? manifest : [null];
  const result = await checkConnectedContentFreshness(db as unknown as Parameters<typeof checkConnectedContentFreshness>[0], campaign.tenant_id ?? "", sources, fetcher);
  if (result.decision !== "fresh") {
    const metrics = campaign.metrics && typeof campaign.metrics === "object" && !Array.isArray(campaign.metrics)
      ? campaign.metrics as Record<string, unknown> : {};
    const {error} = await db.from("crm_sms_campaigns").update({
      ...(result.decision === "review_required" ? {status: "paused"} : {}),
      metrics: {...metrics, content_review: {decision: result.decision, reason: result.reason, checked_at: new Date().toISOString()}},
    }).eq("id", campaign.id).eq("tenant_id", campaign.tenant_id).eq("status", campaign.status);
    if (error) return {decision: "retry", reason: "Unable to record the website review. Delivery will retry before sending."};
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
  if (data && Array.isArray(data.connected_content_sources) && data.connected_content_sources.length === 0 && data.audience_confirmed !== false) {
    return {decision: "fresh", reason: null};
  }
  if (!data || !["queued", "sending"].includes(data.status)) {
    return {decision: "review_required", reason: "This campaign is not approved for delivery. Review it before resuming."};
  }
  return checkSmsCampaignContent(db, data, fetcher);
}
