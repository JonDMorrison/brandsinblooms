import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StudioBlock } from "@/types/studioBlocks";
import { deriveCampaignDisplayName } from "@/lib/crm/campaignDisplayName";
import { hasContentBlocks } from "@/lib/studio/emailHtmlGenerator";

export interface CampaignToCopy {
  id: string;
  name: string;
  /** The one name every screen shows (deriveCampaignDisplayName). */
  displayName: string;
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

export interface CampaignToCopyRow {
  id: string;
  name: string;
  subject_line: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: unknown;
}

const COPY_LIMIT = 10;

/**
 * What "Copy a previous email" offers: sent emails first (newest send first),
 * then drafts that have a subject or content (most recently edited first).
 * Empty drafts and text messages are left out.
 */
export function selectCampaignsToCopy(rows: CampaignToCopyRow[]): CampaignToCopy[] {
  const items = rows
    .filter((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return String(metadata.campaignType ?? "email").toLowerCase() !== "sms";
    })
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const blocks = Array.isArray(metadata.contentBlocks)
        ? (metadata.contentBlocks as StudioBlock[])
        : [];
      const status: CampaignToCopy["status"] = row.status === "sent" ? "sent" : "draft";
      return {
        id: row.id,
        name: row.name,
        displayName: deriveCampaignDisplayName({
          name: row.name,
          subjectLine: row.subject_line,
          blocks,
          date: row.created_at,
          status: row.status,
          sentAt: row.sent_at,
        }),
        subjectLine: row.subject_line ?? "",
        status,
        date: status === "sent" ? (row.sent_at ?? row.updated_at) : row.updated_at,
        blocks,
        thumbnailUrl: firstImage(blocks),
      } satisfies CampaignToCopy;
    })
    .filter(
      (item) =>
        item.status === "sent" ||
        item.subjectLine.trim() !== "" ||
        hasContentBlocks(item.blocks),
    );
  const newestFirst = (a: CampaignToCopy, b: CampaignToCopy) =>
    (b.date ?? "").localeCompare(a.date ?? "");
  return [
    ...items.filter((item) => item.status === "sent").sort(newestFirst),
    ...items.filter((item) => item.status === "draft").sort(newestFirst),
  ].slice(0, COPY_LIMIT);
}

const COPY_COLUMNS = "id, name, subject_line, status, sent_at, created_at, updated_at, metadata";

/** Up to 10 emails to copy: sent first, then drafts with content. */
export function useRecentCampaignsToCopy(
  tenantId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["recent-campaigns-to-copy", tenantId],
    enabled: Boolean(tenantId) && options.enabled !== false,
    staleTime: 60_000,
    queryFn: async (): Promise<CampaignToCopy[]> => {
      const [sent, drafts] = await Promise.all([
        supabase
          .from("crm_campaigns")
          .select(COPY_COLUMNS)
          .eq("tenant_id", tenantId as string)
          .eq("status", "sent")
          .order("sent_at", { ascending: false, nullsFirst: false })
          .limit(COPY_LIMIT * 2),
        supabase
          .from("crm_campaigns")
          .select(COPY_COLUMNS)
          .eq("tenant_id", tenantId as string)
          .eq("status", "draft")
          // updated_at is the real last edit (the demo refresh no longer bumps it).
          .order("updated_at", { ascending: false })
          .limit(40),
      ]);
      if (sent.error) throw sent.error;
      if (drafts.error) throw drafts.error;
      return selectCampaignsToCopy([...(sent.data ?? []), ...(drafts.data ?? [])]);
    },
  });
}
