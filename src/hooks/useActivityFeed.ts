import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeActivityEventRow } from "@/lib/activityEventNormalizer";
import { isUuid } from "@/lib/activityUtils";
import type { ActivityFeedFilters } from "@/types/activity";

export interface UseActivityFeedOptions {
  pageSize?: number;
  enabled?: boolean;
}

export function useActivityFeed(
  filters: ActivityFeedFilters,
  options: UseActivityFeedOptions = {},
) {
  const pageSize = options.pageSize ?? 50;

  return useInfiniteQuery({
    queryKey: ["activity-feed", filters, pageSize],
    enabled: options.enabled ?? true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam) * pageSize;

      const customerId = isUuid(filters.customerId) ? filters.customerId : null;
      const segmentIds = (filters.segmentIds ?? []).filter(isUuid);
      const personaIds = (filters.personaIds ?? []).filter(Boolean);

      const { data, error } = await supabase.rpc("get_activity_feed", {
        p_customer_id: customerId,
        p_limit: pageSize,
        p_offset: offset,
        p_search: filters.search ?? null,
        p_status: filters.status?.length ? filters.status : null,
        p_actor_types: filters.actorTypes?.length ? filters.actorTypes : null,
        p_sources: filters.sources?.length ? filters.sources : null,
        p_activity_types: filters.activityTypes?.length
          ? filters.activityTypes
          : null,
        p_start: filters.start ? filters.start.toISOString() : null,
        p_end: filters.end ? filters.end.toISOString() : null,
        p_segment_ids: segmentIds.length ? segmentIds : null,
        p_persona_ids: personaIds.length ? personaIds : null,
      });

      if (error) {
        // PostgREST returns 400 for invalid input casts (e.g. non-uuid strings in uuid[] args).
        // Logging the params helps identify which filter caused it.
        // eslint-disable-next-line no-console
        console.error("[ActivityFeed] get_activity_feed RPC error", {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code,
          params: {
            p_customer_id: customerId,
            p_limit: pageSize,
            p_offset: offset,
            p_search: filters.search ?? null,
            p_status: filters.status?.length ? filters.status : null,
            p_actor_types: filters.actorTypes?.length
              ? filters.actorTypes
              : null,
            p_sources: filters.sources?.length ? filters.sources : null,
            p_activity_types: filters.activityTypes?.length
              ? filters.activityTypes
              : null,
            p_start: filters.start ? filters.start.toISOString() : null,
            p_end: filters.end ? filters.end.toISOString() : null,
            p_segment_ids: segmentIds.length ? segmentIds : null,
            p_persona_ids: personaIds.length ? personaIds : null,
          },
        });
        throw error;
      }
      return (data ?? []).map(normalizeActivityEventRow);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length;
    },
  });
}
