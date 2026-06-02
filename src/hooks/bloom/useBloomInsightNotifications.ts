import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  bloomSupabase,
  isBloomMissingRelationError,
} from "@/hooks/bloom/types";

const BLOOM_INSIGHT_NOTIFICATION_STALE_TIME_MS = 300_000;
const BLOOM_INSIGHT_NOTIFICATION_LOOKBACK_MS = 86_400_000;

const getSeenStorageKey = (userId: string, tenantId: string) =>
  `bloom-insight-notifications:last-seen:${tenantId}:${userId}`;

const readLastSeenAt = (userId: string, tenantId: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(
    getSeenStorageKey(userId, tenantId),
  );
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const writeLastSeenAt = (
  userId: string,
  tenantId: string,
  timestamp: number,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getSeenStorageKey(userId, tenantId),
    String(timestamp),
  );
};

export const bloomInsightNotificationsQueryKey = (
  tenantId: string | null | undefined,
) => ["bloom-insight-notifications", tenantId ?? null] as const;

export function useBloomInsightNotifications(
  tenantId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: bloomInsightNotificationsQueryKey(tenantId),
    enabled: Boolean(tenantId && userId),
    staleTime: BLOOM_INSIGHT_NOTIFICATION_STALE_TIME_MS,
    refetchInterval:
      tenantId && userId ? BLOOM_INSIGHT_NOTIFICATION_STALE_TIME_MS : false,
    queryFn: async (): Promise<number> => {
      if (!tenantId || !userId) {
        return 0;
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const createdAfterIso = new Date(
        now - BLOOM_INSIGHT_NOTIFICATION_LOOKBACK_MS,
      ).toISOString();
      const lastSeenAt = readLastSeenAt(userId, tenantId);

      const { data, error } = await bloomSupabase
        .from("bloom_proactive_insights")
        .select("id, created_at, dismissed_by")
        .eq("tenant_id", tenantId)
        .gte("created_at", createdAfterIso)
        .not("dismissed_by", "cs", `{${userId}}`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false });

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return 0;
        }

        throw error;
      }

      return (data ?? []).filter((insight) => {
        if ((insight.dismissed_by ?? []).includes(userId)) {
          return false;
        }

        if (lastSeenAt === null) {
          return true;
        }

        return new Date(insight.created_at).getTime() > lastSeenAt;
      }).length;
    },
  });

  const markAllSeen = useCallback(() => {
    if (!tenantId || !userId) {
      return;
    }

    writeLastSeenAt(userId, tenantId, Date.now());
    void queryClient.invalidateQueries({
      queryKey: bloomInsightNotificationsQueryKey(tenantId),
    });
  }, [queryClient, tenantId, userId]);

  return {
    ...query,
    unreadCount: query.data ?? 0,
    markAllSeen,
  };
}
