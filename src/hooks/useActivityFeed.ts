import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityEvent, ActivityFeedFilters } from '@/types/activity';

export interface UseActivityFeedOptions {
  pageSize?: number;
  enabled?: boolean;
}

function normalizeEvent(row: any): ActivityEvent {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    customer_id: row.customer_id ?? null,
    actor_type: row.actor_type ?? 'system',
    actor_id: row.actor_id ?? null,
    source: row.source ?? 'sync',
    integration_name: row.integration_name ?? null,
    activity_type: row.activity_type ?? 'unknown',
    status: row.status ?? 'success',
    title: row.title ?? '',
    description: (row.description ?? { parts: [] }) as any,
    metadata: (row.metadata ?? {}) as any,
    related_entities: (row.related_entities ?? {}) as any,
    links: (row.links ?? []) as any,
    error_message: row.error_message ?? null,
  };
}

export function useActivityFeed(filters: ActivityFeedFilters, options: UseActivityFeedOptions = {}) {
  const pageSize = options.pageSize ?? 50;

  return useInfiniteQuery({
    queryKey: ['activity-feed', filters, pageSize],
    enabled: options.enabled ?? true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam) * pageSize;

      const { data, error } = await supabase.rpc('get_activity_feed', {
        p_customer_id: filters.customerId ?? null,
        p_limit: pageSize,
        p_offset: offset,
        p_search: filters.search ?? null,
        p_status: filters.status?.length ? filters.status : null,
        p_actor_types: filters.actorTypes?.length ? filters.actorTypes : null,
        p_sources: filters.sources?.length ? filters.sources : null,
        p_activity_types: filters.activityTypes?.length ? filters.activityTypes : null,
        p_start: filters.start ? filters.start.toISOString() : null,
        p_end: filters.end ? filters.end.toISOString() : null,
        p_segment_ids: filters.segmentIds?.length ? filters.segmentIds : null,
        p_persona_ids: filters.personaIds?.length ? filters.personaIds : null,
      });

      if (error) throw error;
      return (data ?? []).map(normalizeEvent);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length;
    },
  });
}
