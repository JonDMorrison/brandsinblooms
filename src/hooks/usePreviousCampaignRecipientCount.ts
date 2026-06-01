import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DELIVERED_STATUSES = [
  "sent",
  "sent_with_errors",
  "sending",
  "queued",
  "partially_queued",
] as const;

export interface PreviousCampaignRecipientCount {
  campaignId: string | null;
  campaignName: string | null;
  count: number | null;
  sentAt: string | null;
}

const EMPTY: PreviousCampaignRecipientCount = {
  campaignId: null,
  campaignName: null,
  count: null,
  sentAt: null,
};

export async function fetchPreviousCampaignRecipientCount(
  tenantId: string,
  excludeCampaignId?: string | null,
): Promise<PreviousCampaignRecipientCount> {
  let query = supabase
    .from("crm_campaigns")
    .select(
      "id, name, total_recipients, projected_recipient_count, sent_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .in("status", [...DELIVERED_STATUSES])
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (excludeCampaignId) {
    query = query.neq("id", excludeCampaignId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return EMPTY;
  }

  if (!data) {
    return EMPTY;
  }

  const totalRecipients =
    typeof data.total_recipients === "number" &&
    Number.isFinite(data.total_recipients)
      ? data.total_recipients
      : null;
  const projected =
    typeof data.projected_recipient_count === "number" &&
    Number.isFinite(data.projected_recipient_count)
      ? data.projected_recipient_count
      : null;

  const count = totalRecipients ?? projected;
  if (count === null || count <= 0) {
    return EMPTY;
  }

  return {
    campaignId: typeof data.id === "string" ? data.id : null,
    campaignName: typeof data.name === "string" ? data.name : null,
    count,
    sentAt:
      typeof data.sent_at === "string"
        ? data.sent_at
        : typeof data.updated_at === "string"
          ? data.updated_at
          : null,
  };
}

export function usePreviousCampaignRecipientCount(
  tenantId: string | null | undefined,
  options?: { enabled?: boolean; excludeCampaignId?: string | null },
) {
  return useQuery({
    queryKey: [
      "previous-campaign-recipient-count",
      tenantId,
      options?.excludeCampaignId ?? null,
    ],
    enabled: (options?.enabled ?? true) && Boolean(tenantId),
    staleTime: 60_000,
    queryFn: () =>
      fetchPreviousCampaignRecipientCount(
        tenantId as string,
        options?.excludeCampaignId ?? null,
      ),
  });
}
