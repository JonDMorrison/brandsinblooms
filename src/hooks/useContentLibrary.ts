import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { ContentSummary, Channel } from "@/lib/content/libraryTypes";

export type LibraryFilters = {
  search?: string;
  mode?: 'event'|'seasonal'|'custom'|'all';
  channel?: Channel | 'all';
  page?: number;
  pageSize?: number;
  sort?: 'newest'|'updated';
};

const table = 'content_library_view' as const;

export function useContentLibrary(filters: LibraryFilters = {}) {
  const { search = '', mode = 'all', channel = 'all', page = 1, pageSize = 24, sort = 'updated' } = filters;
  const { tenant } = useTenant();

  const queryKey = useMemo(() => ['content-library', { search, mode, channel, page, pageSize, sort, tenantId: tenant?.id }], [search, mode, channel, page, pageSize, sort, tenant?.id]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) {
        throw new Error('No tenant found');
      }

      let q = supabase.from(table).select('*', { count: 'exact' });

      // Security filter: Only show content from current user's workspace
      q = q.eq('workspace_id', tenant.id);

      // Filters
      if (search) q = q.ilike('source_label', `%${search}%`);
      if (mode !== 'all') q = q.eq('mode', mode);
      if (channel !== 'all') q = q.contains('channels', [channel as string]);

      // Sort
      q = sort === 'newest' ? q.order('created_at', { ascending: false }) : q.order('updated_at', { ascending: false });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;

      const items: ContentSummary[] = (data || []).map((row: any) => ({
        bundleId: row.bundle_id,
        snapshotId: row.snapshot_id,
        mode: row.mode,
        sourceLabel: row.source_label || undefined,
        channels: row.channels || [],
        approvedCount: row.approved_count || 0,
        totalItems: row.total_items || 0,
        thumbnail: row.thumbnail || undefined,
        featuredImage: undefined, // Now consolidated into thumbnail
        recommendedImages: [], // Now consolidated into thumbnail
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return { items, total: count || 0 };
    },
    enabled: !!tenant?.id, // Only run query when tenant is available
  });

  return query;
}

export function useContentLibraryCount() {
  const { tenant } = useTenant();
  
  return useQuery({
    queryKey: ['content-library-count', { tenantId: tenant?.id }],
    queryFn: async () => {
      if (!tenant?.id) {
        throw new Error('No tenant found');
      }

      const { count, error } = await supabase
        .from(table)
        .select('bundle_id', { count: 'exact', head: true })
        .eq('workspace_id', tenant.id); // Security filter
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenant?.id, // Only run query when tenant is available
  });
}

export function useDeleteBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bundleId, deletedAt }: { bundleId: string; deletedAt: string | null }) => {
      // Update all snapshots with this bundleId
      const { error } = await supabase
        .from('draft_snapshots' as any)
        .update({ deleted_at: deletedAt })
        .eq('doc_type', 'content_bundle')
        .filter('content->>id', 'eq', bundleId);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-library'] });
      qc.invalidateQueries({ queryKey: ['content-library-count'] });
    },
  });
}
