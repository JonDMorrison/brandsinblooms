import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useTenant } from "@/hooks/useTenant";
import type {
  Channel,
  ContentSummary,
  LibraryChannelFilter,
  LibraryMode,
  LibrarySort,
} from "@/lib/content/libraryTypes";

type ContentLibraryRow =
  Database["public"]["Views"]["content_library_view"]["Row"];

export type LibraryFilters = {
  search?: string;
  mode?: LibraryMode | "all";
  channel?: LibraryChannelFilter | "all";
  page?: number;
  pageSize?: number;
  sort?: LibrarySort;
};

const table = "content_library_view" as const;
const CHANNEL_VALUES: ReadonlySet<Channel> = new Set([
  "newsletter",
  "instagram",
  "facebook",
  "video",
  "blog",
]);

function normalizeSearchTerm(search: string) {
  return search.trim().replace(/[,%]/g, " ");
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isChannel(value: Json): value is Channel {
  return typeof value === "string" && CHANNEL_VALUES.has(value as Channel);
}

function parseChannels(channels: Json | null): Channel[] {
  if (!Array.isArray(channels)) {
    return [];
  }

  return channels.filter(isChannel);
}

function dedupeRows(rows: ContentLibraryRow[]) {
  const rowsByBundleId = new Map<string, ContentLibraryRow>();

  for (const row of rows) {
    const bundleId = row.bundle_id;
    if (!bundleId) {
      continue;
    }

    const existingRow = rowsByBundleId.get(bundleId);
    if (!existingRow) {
      rowsByBundleId.set(bundleId, row);
      continue;
    }

    const rowVersion = row.version ?? -1;
    const existingVersion = existingRow.version ?? -1;

    if (rowVersion > existingVersion) {
      rowsByBundleId.set(bundleId, row);
      continue;
    }

    if (
      rowVersion === existingVersion &&
      toTimestamp(row.updated_at) > toTimestamp(existingRow.updated_at)
    ) {
      rowsByBundleId.set(bundleId, row);
    }
  }

  return Array.from(rowsByBundleId.values());
}

function sortRows(rows: ContentLibraryRow[], sort: LibrarySort) {
  const direction = sort === "oldest" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const createdDifference =
      (toTimestamp(left.created_at) - toTimestamp(right.created_at)) *
      direction;

    if (createdDifference !== 0) {
      return createdDifference;
    }

    return (
      (toTimestamp(left.updated_at) - toTimestamp(right.updated_at)) * direction
    );
  });
}

function mapMode(mode: string | null): LibraryMode {
  if (
    mode === "seasonal" ||
    mode === "holiday" ||
    mode === "custom" ||
    mode === "event"
  ) {
    return mode;
  }

  return "event";
}

function mapRow(row: ContentLibraryRow): ContentSummary | null {
  if (!row.bundle_id) {
    return null;
  }

  return {
    bundleId: row.bundle_id,
    snapshotId: row.snapshot_id || undefined,
    mode: mapMode(row.mode),
    title: row.preview_title || undefined,
    sourceLabel: row.source_label || undefined,
    channels: parseChannels(row.channels),
    hasMixedCarousel: Boolean(row.has_mixed_carousel),
    approvedCount: row.approved_count || 0,
    totalItems: row.total_items || 0,
    thumbnail: row.thumbnail || undefined,
    featuredImage: undefined,
    recommendedImages: [],
    createdAt: row.created_at || new Date(0).toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date(0).toISOString(),
  };
}

async function fetchLibraryRows(tenantId: string, filters: LibraryFilters) {
  const { search = "", mode = "all", channel = "all" } = filters;

  let query = supabase.from(table).select("*").eq("workspace_id", tenantId);

  const normalizedSearch = normalizeSearchTerm(search);
  if (normalizedSearch) {
    query = query.or(
      `source_label.ilike.%${normalizedSearch}%,preview_title.ilike.%${normalizedSearch}%`,
    );
  }

  if (mode !== "all") {
    query = query.eq("mode", mode);
  }

  if (channel === "carousel") {
    query = query.eq("has_mixed_carousel", true);
  } else if (channel !== "all") {
    query = query.contains("channels", [channel]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("❌ useContentLibrary: Error fetching content:", error);
    throw error;
  }

  return dedupeRows(data || []);
}

export function useContentLibrary(filters: LibraryFilters = {}) {
  const {
    search = "",
    mode = "all",
    channel = "all",
    page = 1,
    pageSize = 24,
    sort = "newest",
  } = filters;
  const { tenant } = useTenant();

  const queryKey = useMemo(
    () => [
      "content-library",
      { search, mode, channel, page, pageSize, sort, tenantId: tenant?.id },
    ],
    [search, mode, channel, page, pageSize, sort, tenant?.id],
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) {
        throw new Error("No tenant found");
      }

      const dedupedRows = sortRows(
        await fetchLibraryRows(tenant.id, { search, mode, channel }),
        sort,
      );

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const items = dedupedRows
        .slice(from, to + 1)
        .map(mapRow)
        .filter((row): row is ContentSummary => row !== null);

      return { items, total: dedupedRows.length };
    },
    enabled: !!tenant?.id, // Only run query when tenant is available
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  return query;
}

export function useContentLibraryCount(filters: Partial<LibraryFilters> = {}) {
  const { search = "", mode = "all", channel = "all" } = filters;
  const { tenant } = useTenant();

  return useQuery({
    queryKey: [
      "content-library-count",
      { search, mode, channel, tenantId: tenant?.id },
    ],
    queryFn: async () => {
      if (!tenant?.id) {
        throw new Error("No tenant found");
      }

      const rows = await fetchLibraryRows(tenant.id, { search, mode, channel });
      return rows.length;
    },
    enabled: !!tenant?.id, // Only run query when tenant is available
  });
}

export function useDeleteBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bundleId,
      deletedAt,
    }: {
      bundleId: string;
      deletedAt: string | null;
    }) => {
      const { error } = await supabase
        .from("draft_snapshots")
        .update({ deleted_at: deletedAt })
        .eq("doc_type", "content_bundle")
        .eq("doc_id", bundleId);
      if (error) throw error;
      return true;
    },
    onMutate: async ({ bundleId, deletedAt }) => {
      await qc.cancelQueries({ queryKey: ["content-library"] });

      const previousLists = qc.getQueriesData<{
        items: ContentSummary[];
        total: number;
      }>({ queryKey: ["content-library"] });

      if (deletedAt) {
        qc.setQueriesData<{
          items: ContentSummary[];
          total: number;
        }>({ queryKey: ["content-library"] }, (current) => {
          if (!current) {
            return current;
          }

          const nextItems = current.items.filter(
            (item) => item.bundleId !== bundleId,
          );

          if (nextItems.length === current.items.length) {
            return current;
          }

          return {
            ...current,
            items: nextItems,
            total: Math.max(0, current.total - 1),
          };
        });
      }

      return { previousLists };
    },
    onError: (_error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, previousValue]) => {
        qc.setQueryData(queryKey, previousValue);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-library"] });
      qc.invalidateQueries({ queryKey: ["content-library-count"] });
    },
  });
}
