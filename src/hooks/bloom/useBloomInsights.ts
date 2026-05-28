import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  bloomSupabase,
  isBloomMissingRelationError,
  toBloomProactiveInsight,
  type BloomInsightSeverity,
  type BloomProactiveInsight,
} from "@/hooks/bloom/types";

const BLOOM_INSIGHTS_STALE_TIME_MS = 300_000;
const BLOOM_INSIGHT_COLUMNS =
  "id, tenant_id, insight_type, title, description, action_prompt, entity_type, entity_id, severity, dismissed_by, expires_at, created_at";
const BLOOM_INSIGHTS_RESULT_LIMIT = 5;

const severityPriority: Record<BloomInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const bloomInsightsQueryKey = (
  tenantId: string | null | undefined,
  userId: string | null | undefined,
) => ["bloom-insights", tenantId ?? null, userId ?? null] as const;

function compareInsights(
  left: BloomProactiveInsight,
  right: BloomProactiveInsight,
) {
  const priorityDelta =
    severityPriority[left.severity] - severityPriority[right.severity];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

export function useBloomInsights(tenantId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: bloomInsightsQueryKey(tenantId, userId),
    enabled: Boolean(tenantId && userId),
    staleTime: BLOOM_INSIGHTS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<BloomProactiveInsight[]> => {
      if (!tenantId || !userId) {
        return [];
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await bloomSupabase
        .from("bloom_proactive_insights")
        .select(BLOOM_INSIGHT_COLUMNS)
        .eq("tenant_id", tenantId)
        .not("dismissed_by", "cs", `{${userId}}`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false });

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return [];
        }

        throw error;
      }

      return (data ?? [])
        .map(toBloomProactiveInsight)
        .filter((insight) => !insight.dismissedBy.includes(userId))
        .sort(compareInsights)
        .slice(0, BLOOM_INSIGHTS_RESULT_LIMIT);
    },
  });

  return {
    ...query,
    data: query.data ?? [],
    isLoading: query.isLoading,
  };
}
