import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import {
  EMPTY_SEGMENT_COUNTS,
  useCrmDashboardSnapshot,
} from "@/hooks/useCrmDashboardSnapshot";

export const useSegmentCounts = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const snapshotQuery = useCrmDashboardSnapshot(
    {
      tenantId: tenant?.id,
      userId: user?.id,
    },
    {
      enabled: Boolean(user?.id && tenant?.id),
    },
  );

  const refreshCounts = useCallback(() => {
    void snapshotQuery.refetch();
  }, [snapshotQuery.refetch]);

  return {
    counts: snapshotQuery.data?.segmentCounts ?? EMPTY_SEGMENT_COUNTS,
    loading: snapshotQuery.isLoading,
    error: snapshotQuery.error,
    refreshCounts,
  };
};
