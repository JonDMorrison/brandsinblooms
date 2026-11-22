import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {buildConnectedContentSms, connectedContentRequest, type ConnectedContentResponse} from "@/lib/connectedContent";
import type { StudioBlock } from "@/types/studioBlocks";

export type ConnectedSmsSource = NonNullable<StudioBlock["connectedContent"]>;
export type SmsCampaignDraft = Database["public"]["Tables"]["crm_sms_campaigns"]["Row"] & {
  connected_content_sources: ConnectedSmsSource[];
  audience_confirmed: boolean;
};
export type SmsDraftAudience = { type: "all" | "segment" | "persona"; id?: string; name?: string };
export interface SaveConnectedSmsDraft {
  tenantId: string;
  id?: string;
  expectedUpdatedAt?: string;
  name: string;
  message: string;
  mediaUrls?: string[];
  sources?: ConnectedSmsSource[];
  audience?: SmsDraftAudience | null;
  launch?: boolean;
  scheduledAt?: string | null;
}

export async function loadConnectedSmsDraft(tenantId: string, id: string): Promise<SmsCampaignDraft> {
  const { data, error } = await supabase.from("crm_sms_campaigns").select("*")
    .eq("tenant_id", tenantId).eq("id", id).eq("status", "draft").eq("source", "connected_content").maybeSingle();
  if (error || !data) throw new Error("This text draft is unavailable in the selected business, or has already been launched.");
  const metrics = data.metrics && typeof data.metrics === "object" && !Array.isArray(data.metrics) ? data.metrics : {};
  const review = metrics.content_review;
  if (metrics.replacement_campaign_id || (review && typeof review === "object" && !Array.isArray(review) && review.decision === "review_required")) {
    throw new Error("This text campaign needs review or has been replaced. Open its campaign details.");
  }
  return data as SmsCampaignDraft;
}

export async function saveConnectedSmsDraft(input: SaveConnectedSmsDraft): Promise<SmsCampaignDraft> {
  // Explicit contract for the additive migration, pending the next generated schema snapshot.
  const client = supabase as unknown as { rpc(name: "save_connected_sms_draft", args: {
    p_tenant_id: string; p_campaign_id: string | null; p_expected_updated_at: string | null;
    p_name: string; p_message: string; p_media_urls: Json; p_sources: Json;
    p_audience: Json; p_launch: boolean; p_scheduled_at: string | null;
  }): PromiseLike<{ data: SmsCampaignDraft | null; error: {message: string} | null }> };
  const {data, error} = await client.rpc("save_connected_sms_draft", {
    p_tenant_id: input.tenantId, p_campaign_id: input.id ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_name: input.name.trim(), p_message: input.message.trim(),
    p_media_urls: input.mediaUrls ?? [],
    p_sources: JSON.parse(JSON.stringify(input.sources ?? [])) as Json,
    p_audience: input.audience ? {...input.audience} : null,
    p_launch: input.launch ?? false, p_scheduled_at: input.scheduledAt ?? null,
  });
  if (error || !data) throw new Error(error?.message || "Unable to save this text draft.");
  return data;
}


export async function previewRefreshedSmsDraft(manifest: unknown): Promise<{message: string; sources: ConnectedSmsSource[]}> {
  if (!Array.isArray(manifest) || manifest.length === 0 || manifest.length > 50) {
    throw new Error("The source details are incomplete. Start again from Connected websites.");
  }
  const kinds = {event: "events", page: "pages", product: "products", blog: "blogs", fundraiser: "fundraisers"};
  const refreshed = [];
  for (const entry of manifest) {
    if (!entry || typeof entry !== "object" || typeof entry.siteId !== "string" || typeof entry.itemId !== "string" || !Object.hasOwn(kinds, entry.type)) {
      throw new Error("The source details are incomplete. Start again from Connected websites.");
    }
    const response = await connectedContentRequest<ConnectedContentResponse>({action: "catalog", siteId: entry.siteId, itemId: entry.itemId, type: kinds[entry.type as keyof typeof kinds], limit: 1});
    if (response.errors?.length || response.sources?.some(source => source.error)) throw new Error("The website could not be checked. Try again before creating a new draft.");
    const item = response.items.find(item => item.siteId === entry.siteId && item.id === entry.itemId && item.type === entry.type);
    if (!item) throw new Error("This content is no longer published. Choose published content in Connected websites.");
    refreshed.push(buildConnectedContentSms(item));
  }
  const message = refreshed.map(item => item.smsMessage).join("\n\n");
  if (message.length > 10000) throw new Error("Too much content for one text draft. Choose fewer website items.");
  return {message, sources: refreshed.map(item => item.source)};
}

export async function replaceConnectedSmsDraft(input: {
  tenantId: string; campaignId: string; expectedUpdatedAt: string;
  name: string; message: string; sources: ConnectedSmsSource[];
}): Promise<SmsCampaignDraft> {
  const client = supabase as unknown as {rpc(name: "replace_connected_sms_draft", args: {
    p_tenant_id: string; p_campaign_id: string; p_expected_updated_at: string;
    p_name: string; p_message: string; p_sources: Json;
  }): PromiseLike<{data: SmsCampaignDraft | null; error: {message: string} | null}>};
  const {data, error} = await client.rpc("replace_connected_sms_draft", {
    p_tenant_id: input.tenantId, p_campaign_id: input.campaignId,
    p_expected_updated_at: input.expectedUpdatedAt, p_name: input.name,
    p_message: input.message, p_sources: JSON.parse(JSON.stringify(input.sources)) as Json,
  });
  if (error || !data) throw new Error(error?.message || "Unable to create the updated draft.");
  return data;
}
