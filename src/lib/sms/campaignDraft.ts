import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
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
