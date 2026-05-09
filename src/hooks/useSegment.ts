import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { normalizeSegmentRuleGroup } from "@/lib/segmentFields";
import type { SegmentListItem, SegmentStatus } from "@/hooks/useSegments";

export interface SegmentUsageRecord {
  id: string;
  kind: "campaign" | "sms-campaign";
  name: string;
  status: string | null;
}

export interface SegmentDetailResult extends SegmentListItem {
  usage: SegmentUsageRecord[];
}

function normalizeStatus(value?: string | null): SegmentStatus {
  switch (value) {
    case "draft":
    case "paused":
    case "archived":
      return value;
    default:
      return "active";
  }
}

export function useSegment(segmentId?: string) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  return useQuery({
    queryKey: ["segment", tenantId, segmentId],
    enabled: Boolean(tenantId && segmentId),
    queryFn: async (): Promise<SegmentDetailResult | null> => {
      if (!tenantId || !segmentId) {
        return null;
      }

      const { data: segmentRow, error: segmentError } = await supabase
        .from("crm_segments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", segmentId)
        .is("deleted_at", null)
        .maybeSingle();

      if (segmentError) {
        throw segmentError;
      }

      if (!segmentRow) {
        return null;
      }

      const [campaignsResult, smsCampaignsResult] = await Promise.all([
        supabase
          .from("crm_campaigns")
          .select("id, name, status")
          .eq("tenant_id", tenantId)
          .eq("segment_id", segmentId)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("crm_sms_campaigns")
          .select("id, name, status")
          .eq("tenant_id", tenantId)
          .eq("segment_id", segmentId)
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      if (campaignsResult.error) {
        throw campaignsResult.error;
      }
      if (smsCampaignsResult.error) {
        throw smsCampaignsResult.error;
      }

      return {
        id: segmentRow.id,
        name: segmentRow.name,
        description: segmentRow.description,
        type: segmentRow.auto_update ? "dynamic" : "static",
        status: normalizeStatus(segmentRow.status),
        rules: normalizeSegmentRuleGroup(segmentRow.conditions),
        includeAllCustomers: segmentRow.include_all_customers,
        memberCount: segmentRow.customer_count ?? 0,
        createdAt: segmentRow.created_at,
        updatedAt: segmentRow.updated_at,
        deletedAt: segmentRow.deleted_at,
        isSystemSegment: segmentRow.is_system_segment,
        tenantId: segmentRow.tenant_id,
        personaId: segmentRow.persona_id,
        source: segmentRow.source,
        sourceId: segmentRow.source_id,
        autoUpdate: segmentRow.auto_update,
        usage: [
          ...(campaignsResult.data ?? []).map((campaign) => ({
            id: campaign.id,
            kind: "campaign" as const,
            name: campaign.name,
            status: campaign.status,
          })),
          ...(smsCampaignsResult.data ?? []).map((campaign) => ({
            id: campaign.id,
            kind: "sms-campaign" as const,
            name: campaign.name,
            status: campaign.status,
          })),
        ],
      };
    },
    staleTime: 30_000,
  });
}
