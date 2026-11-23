import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StudioBlock } from "@/types/studioBlocks";

export interface CampaignToCopy {
  id: string;
  name: string;
  subjectLine: string;
  status: "sent" | "draft";
  /** Sent date for sent campaigns, last edit for drafts. */
  date: string | null;
  blocks: StudioBlock[];
  thumbnailUrl: string | null;
}

const IMAGE_FIELDS = ["imageUrl", "backgroundImageUrl", "logoUrl"] as const;

function firstImage(blocks: StudioBlock[]) {
  for (const block of blocks) {
    if (block.type === "footer" || block.visible === false) continue;
    const record = block as unknown as Record<string, unknown>;
    for (const field of IMAGE_FIELDS) {
      const value = record[field];
      if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
    }
  }
  return null;
}

/** The tenant's 10 most recent sent or draft email campaigns, newest first. */
export function useRecentCampaignsToCopy(
  tenantId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["recent-campaigns-to-copy", tenantId],
    enabled: Boolean(tenantId) && options.enabled !== false,
    staleTime: 60_000,
    queryFn: async (): Promise<CampaignToCopy[]> => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select("id, name, subject_line, status, sent_at, updated_at, metadata")
        .eq("tenant_id", tenantId as string)
        .in("status", ["sent", "draft"])
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? [])
        .filter((row) => {
          const metadata = (row.metadata ?? {}) as Record<string, unknown>;
          return String(metadata.campaignType ?? "email").toLowerCase() !== "sms";
        })
        .map((row) => {
          const metadata = (row.metadata ?? {}) as Record<string, unknown>;
          const blocks = Array.isArray(metadata.contentBlocks)
            ? (metadata.contentBlocks as StudioBlock[])
            : [];
          const status = row.status === "sent" ? "sent" : "draft";
          return {
            id: row.id,
            name: row.name,
            subjectLine: row.subject_line ?? "",
            status,
            date: status === "sent" ? (row.sent_at ?? row.updated_at) : row.updated_at,
            blocks,
            thumbnailUrl: firstImage(blocks),
          } satisfies CampaignToCopy;
        })
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 10);
    },
  });
}
