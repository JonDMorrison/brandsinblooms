import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AnalyticsOverview {
  totalViews: number;
  engagementRate: number;
  clicks: number;
  conversions: number;
  growth: number;
  loading: boolean;
  error: string | null;
}

type AnalyticsOverviewPayload = Omit<
  AnalyticsOverview,
  "loading" | "error"
>;

type RpcResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const analyticsRpc = (days: number): RpcResult =>
  (
    supabase.rpc as unknown as (
      rpcName: string,
      rpcArgs: Record<string, unknown>,
    ) => RpcResult
  )("get_marketing_analytics_overview", { p_days: days });

const emptyOverview: AnalyticsOverviewPayload = {
  totalViews: 0,
  engagementRate: 0,
  clicks: 0,
  conversions: 0,
  growth: 0,
};

const normalizeNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeOverview = (data: unknown): AnalyticsOverviewPayload => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return emptyOverview;
  }

  const value = data as Record<string, unknown>;
  return {
    totalViews: Math.round(normalizeNumber(value.totalViews)),
    engagementRate:
      Math.round(normalizeNumber(value.engagementRate) * 100) / 100,
    clicks: Math.round(normalizeNumber(value.clicks)),
    conversions: Math.round(normalizeNumber(value.conversions)),
    growth: Math.round(normalizeNumber(value.growth)),
  };
};

export const useAnalyticsOverview = (days: number = 30) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview>({
    ...emptyOverview,
    loading: true,
    error: null,
  });

  const fetchOverview = useCallback(async () => {
    if (!user) {
      setOverview({ ...emptyOverview, loading: false, error: null });
      return;
    }

    try {
      setOverview((previous) => ({
        ...previous,
        loading: true,
        error: null,
      }));

      // The RPC resolves the effective tenant through get_current_crm_access(),
      // including a master admin's persisted tenant selection. It intentionally
      // excludes the retired social-media analytics tables that were both
      // outside BloomSuite's current product scope and inaccessible in admin
      // tenant context.
      const { data, error } = await analyticsRpc(days);
      if (error) throw new Error(error.message);

      setOverview({
        ...normalizeOverview(data),
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching analytics overview:", error);
      setOverview((previous) => ({
        ...previous,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch analytics",
      }));
    }
  }, [days, user]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  return { ...overview, refetch: fetchOverview };
};
