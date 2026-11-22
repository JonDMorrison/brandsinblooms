import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { StudioBlock } from "@/types/studioBlocks";
import { connectedContentRequest, refreshConnectedContentBlock, type ConnectedContentResponse } from "@/lib/connectedContent";
import { normalizeContentBlocks, type RenderableContentBlock } from "../../../supabase/functions/_shared/campaignEmailSource";
import { renderDraftPreviewHtml } from "@/lib/crm/campaignDraftPersistence";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];
export type ConnectedEmailReview = {
  campaign: CampaignRow;
  original: StudioBlock[];
  refreshed: StudioBlock[];
  warnings: string[];
  replacementId: string | null;
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function connectedEmailBlocks(value: unknown): StudioBlock[] {
  if (!Array.isArray(value) || value.some(block => typeof record(block).type !== "string" || typeof record(block).id !== "string")) {
    throw new Error("This newsletter's editable blocks could not be loaded.");
  }
  return value as StudioBlock[];
}
export async function refreshConnectedEmailBlocks(original: StudioBlock[]): Promise<{refreshed: StudioBlock[]; warnings: string[]}> {
  const linked = original.filter(block => block.visible !== false && block.connectedContent);
  if (!linked.length || linked.length > 50) throw new Error("This newsletter needs between 1 and 50 linked website blocks to refresh.");
  const kinds = {event: "events", page: "pages", product: "products", blog: "blogs", fundraiser: "fundraisers"} as const;
  const warnings: string[] = [];
  const refreshed = await Promise.all(original.map(async block => {
    if (block.visible === false || !block.connectedContent) return block;
    const source = block.connectedContent;
    const response = await connectedContentRequest<ConnectedContentResponse>({action: "catalog", type: kinds[source.type], siteId: source.siteId, itemId: source.itemId, limit: 1});
    if (response.errors?.length || response.sources?.some(entry => entry.error)) throw new Error("A linked website could not be checked. Try the review again shortly.");
    const item = response.items?.find(entry => entry.id === source.itemId && entry.siteId === source.siteId && entry.type === source.type);
    if (!item) throw new Error(`${source.sourceTitle || "Linked content"} is no longer available on the website.`);
    if (item.capacityCheckRequired) warnings.push(`${item.title}: confirm ticket availability on the website before sending.`);
    return refreshConnectedContentBlock(block, item);
  }));
  return {refreshed, warnings};
}
export async function loadConnectedEmailReview(tenantId: string, campaignId: string): Promise<ConnectedEmailReview> {
  const {data: campaign, error} = await supabase.from("crm_campaigns").select("*").eq("tenant_id", tenantId).eq("id", campaignId).single();
  if (error || !campaign || campaign.status !== "paused" || campaign.send_blocked_reason !== "connected_content_review") throw new Error("This campaign is unavailable or no longer needs website review.");
  const metadata = record(campaign.metadata);
  const replacementId = typeof metadata.contentReviewReplacementId === "string" ? metadata.contentReviewReplacementId : null;
  if (replacementId) return {campaign, original: [], refreshed: [], warnings: [], replacementId};
  // Match delivery precedence: authoritative block rows, then metadata only
  // after a successful empty lookup. A database failure must never select stale copy.
  const {data, error: blocksError} = await supabase.from("campaign_blocks").select("*").eq("campaign_id", campaignId).order("order_index", {ascending: true});
  if (blocksError || !Array.isArray(data)) throw new Error("The newsletter blocks could not be loaded. Try again.");
  const original = selectConnectedEmailReviewBlocks(data, metadata.contentBlocks);
  return {campaign, original, ...await refreshConnectedEmailBlocks(original), replacementId};
}
export async function replaceConnectedEmailDraft(tenantId: string, review: ConnectedEmailReview): Promise<string> {
  if (review.campaign.tenant_id !== tenantId) throw new Error("The selected business changed. Open the review again.");
  const client = supabase as unknown as {rpc(name: "replace_connected_email_draft", args: {
    p_tenant_id: string; p_campaign_id: string; p_expected_updated_at: string | null; p_blocks: Json; p_content: string;
  }): PromiseLike<{data: string | null; error: {message: string} | null}>};
  const {data, error} = await client.rpc("replace_connected_email_draft", {
    p_tenant_id: tenantId, p_campaign_id: review.campaign.id, p_expected_updated_at: review.campaign.updated_at,
    p_blocks: JSON.parse(JSON.stringify(review.refreshed)) as Json,
    p_content: renderDraftPreviewHtml(review.refreshed, review.campaign.subject_line || "", review.campaign.preheader_text || ""),
  });
  if (error || !data) throw new Error(error?.message || "Could not create the reviewed draft.");
  return data;
}

export function selectConnectedEmailReviewBlocks(databaseBlocks: Record<string, unknown>[], metadataBlocks: unknown): StudioBlock[] {
  return databaseBlocks.length > 0
    ? normalizeContentBlocks(databaseBlocks as RenderableContentBlock[])
    : connectedEmailBlocks(metadataBlocks);
}
