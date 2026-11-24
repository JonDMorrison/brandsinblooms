import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  normalizeSegmentRuleGroup,
  type SegmentRuleGroup,
} from "@/lib/segmentFields";
import type { Database } from "@/integrations/supabase/types";
import { fetchSegmentMembershipSummary } from "@/lib/segmentMembership";

type SegmentRow = Database["public"]["Tables"]["crm_segments"]["Row"];

export type SegmentStatus = "draft" | "active" | "paused" | "archived";
export type SegmentKind = "dynamic" | "static";
export type SegmentViewMode = "grid" | "table";
export type SegmentSortKey =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "members-desc"
  | "members-asc";

export interface SegmentListFilters {
  search?: string;
  type?: "all" | SegmentKind;
  status?: "all" | SegmentStatus;
  sort?: SegmentSortKey;
}

export interface SegmentListItem {
  id: string;
  name: string;
  description: string | null;
  type: SegmentKind;
  status: SegmentStatus;
  rules: SegmentRuleGroup;
  includeAllCustomers: boolean;
  memberCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isSystemSegment: boolean;
  tenantId: string | null;
  personaId: string | null;
  source: string | null;
  sourceId: string | null;
  autoUpdate: boolean | null;
}

export interface SegmentStats {
  totalSegments: number;
  dynamicSegments: number;
  staticSegments: number;
  totalSegmentedCustomers: number;
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

function mapSegment(row: SegmentRow): SegmentListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.auto_update ? "dynamic" : "static",
    status: normalizeStatus(row.status),
    rules: normalizeSegmentRuleGroup(row.conditions),
    includeAllCustomers: row.include_all_customers,
    memberCount: row.customer_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isSystemSegment: row.is_system_segment,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    source: row.source,
    sourceId: row.source_id,
    autoUpdate: row.auto_update,
  };
}

function sortSegments(segments: SegmentListItem[], sort: SegmentSortKey) {
  const next = [...segments];

  next.sort((left, right) => {
    switch (sort) {
      case "oldest":
        return (
          (new Date(left.createdAt ?? 0).getTime() || 0) -
          (new Date(right.createdAt ?? 0).getTime() || 0)
        );
      case "name-asc":
        return left.name.localeCompare(right.name);
      case "name-desc":
        return right.name.localeCompare(left.name);
      case "members-desc":
        return right.memberCount - left.memberCount;
      case "members-asc":
        return left.memberCount - right.memberCount;
      case "newest":
      default:
        return (
          (new Date(right.createdAt ?? 0).getTime() || 0) -
          (new Date(left.createdAt ?? 0).getTime() || 0)
        );
    }
  });

  return next;
}

export function useSegments(filters: SegmentListFilters = {}) {
  const { loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;

  const query = useQuery({
    queryKey: ["segments", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return {
          segments: [] as SegmentListItem[],
          stats: {
            totalSegments: 0,
            dynamicSegments: 0,
            staticSegments: 0,
            totalSegmentedCustomers: 0,
          } satisfies SegmentStats,
        };
      }

      const { data: segmentRows, error: segmentsError } = await supabase
        .from("crm_segments")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (segmentsError) {
        throw segmentsError;
      }

      const mappedSegments = (segmentRows ?? []).map(mapSegment);
      const segmentIds = mappedSegments.map((segment) => segment.id);

      let totalSegmentedCustomers = 0;
      let segmentsWithCounts = mappedSegments;
      if (segmentIds.length) {
        // Counted in the database: reading customer_segments rows here stops
        // at 1,000 and undercounts large tenants.
        const summary = await fetchSegmentMembershipSummary(tenantId);
        totalSegmentedCustomers = summary.distinctCustomers;
        segmentsWithCounts = mappedSegments.map((segment) =>
          segment.id in summary.segmentCounts
            ? { ...segment, memberCount: summary.segmentCounts[segment.id] }
            : segment,
        );
      }

      return {
        segments: segmentsWithCounts,
        stats: {
          totalSegments: segmentsWithCounts.length,
          dynamicSegments: segmentsWithCounts.filter(
            (segment) => segment.type === "dynamic",
          ).length,
          staticSegments: segmentsWithCounts.filter(
            (segment) => segment.type === "static",
          ).length,
          totalSegmentedCustomers,
        } satisfies SegmentStats,
      };
    },
    staleTime: 60_000,
  });

  const filteredSegments = useMemo(() => {
    const allSegments = query.data?.segments ?? [];
    const normalizedSearch = String(filters.search ?? "")
      .trim()
      .toLowerCase();
    const next = allSegments.filter((segment) => {
      if (
        filters.type &&
        filters.type !== "all" &&
        segment.type !== filters.type
      ) {
        return false;
      }

      if (
        filters.status &&
        filters.status !== "all" &&
        segment.status !== filters.status
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        segment.name.toLowerCase().includes(normalizedSearch) ||
        String(segment.description ?? "")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });

    return sortSegments(next, filters.sort ?? "newest");
  }, [
    filters.search,
    filters.sort,
    filters.status,
    filters.type,
    query.data?.segments,
  ]);

  return {
    ...query,
    isLoading: authLoading || tenantLoading || query.isLoading,
    segments: filteredSegments,
    allSegments: query.data?.segments ?? [],
    stats: query.data?.stats ?? {
      totalSegments: 0,
      dynamicSegments: 0,
      staticSegments: 0,
      totalSegmentedCustomers: 0,
    },
  };
}
