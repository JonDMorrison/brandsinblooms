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
      if (segmentIds.length) {
        const { data: memberships, error: membershipError } = await supabase
          .from("customer_segments")
          .select("customer_id, segment_id")
          .in("segment_id", segmentIds);

        if (membershipError) {
          throw membershipError;
        }

        totalSegmentedCustomers = new Set(
          (memberships ?? []).map((membership) => membership.customer_id),
        ).size;
      }

      return {
        segments: mappedSegments,
        stats: {
          totalSegments: mappedSegments.length,
          dynamicSegments: mappedSegments.filter(
            (segment) => segment.type === "dynamic",
          ).length,
          staticSegments: mappedSegments.filter(
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
