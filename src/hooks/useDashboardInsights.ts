import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface Insight {
  id: string;
  text: string;
  value: number;
}

interface DashboardInsights {
  hasPOSConnection: boolean;
  primaryPOSProvider: string | null;
  lastSyncAt: string | null;
  insights: Insight[];
  loaded: boolean;
}

export function useDashboardInsights(): DashboardInsights {
  const { tenant } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-insights", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // Check POS connection
      const { data: posConns } = await supabase
        .from("pos_connections")
        .select("platform, last_sync_at, sync_status")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .eq("sync_status", "success")
        .order("last_sync_at", { ascending: false })
        .limit(1);

      // Also check legacy POS tables
      const { data: squareConn } = await supabase
        .from("square_connections")
        .select("id, last_sync_at")
        .eq("tenant_id", tenant.id)
        .limit(1)
        .maybeSingle();

      const posConn = posConns?.[0] || null;
      const hasConnection = !!posConn || !!squareConn;

      if (!hasConnection) {
        return { hasPOSConnection: false, primaryPOSProvider: null, lastSyncAt: null, insights: [] };
      }

      const provider = posConn?.platform || (squareConn ? "square" : null);
      const lastSync = posConn?.last_sync_at || squareConn?.last_sync_at || null;

      // Get system segments
      const { data: segments } = await supabase
        .from("crm_segments")
        .select("name, customer_count")
        .eq("tenant_id", tenant.id)
        .eq("is_system_segment", true)
        .is("deleted_at", null)
        .gt("customer_count", 0);

      if (!segments || segments.length < 2) {
        return { hasPOSConnection: true, primaryPOSProvider: provider, lastSyncAt: lastSync, insights: [] };
      }

      const segMap = Object.fromEntries(segments.map((s) => [s.name, s.customer_count]));
      const insights: Insight[] = [];

      // Lapsed with Rewards
      const lapsedRewardsCount = segMap["Lapsed with Rewards to Spend"] || 0;
      if (lapsedRewardsCount > 0) {
        const { data: agg } = await supabase
          .from("crm_customers")
          .select("loyalty_rewards_balance.sum()")
          .eq("tenant_id", tenant.id)
          .gte("last_visit_date", new Date(Date.now() - 365 * 86400000).toISOString())
          .lt("last_visit_date", new Date(Date.now() - 180 * 86400000).toISOString())
          .gt("loyalty_rewards_balance", 0);

        // Fallback: count-based insight if aggregate fails
        const rewardsTotal = (agg as any)?.[0]?.sum ?? null;
        const rewardsStr = rewardsTotal
          ? `with <strong>$${Math.round(rewardsTotal).toLocaleString()}</strong> in unused rewards`
          : "with unused rewards";

        insights.push({
          id: "lapsed-rewards",
          text: `<strong>${lapsedRewardsCount.toLocaleString()}</strong> customers ${rewardsStr} haven't visited in 6-12 months. Your highest-probability win-back list.`,
          value: lapsedRewardsCount * 100,
        });
      }

      // VIP
      const vipCount = segMap["VIP Customers"] || 0;
      if (vipCount > 0) {
        insights.push({
          id: "vip",
          text: `<strong>${vipCount.toLocaleString()}</strong> VIP customers in your top 10% of spenders. Worth personal outreach.`,
          value: vipCount * 50,
        });
      }

      // Active
      const activeCount = segMap["Active Customers"] || 0;
      if (activeCount > 0) {
        insights.push({
          id: "active",
          text: `<strong>${activeCount.toLocaleString()}</strong> customers visited in the last 30 days. Ready for what's new.`,
          value: activeCount * 10,
        });
      }

      // Dormant with Rewards
      const dormantRewardsCount = segMap["Dormant with Rewards to Spend"] || 0;
      if (dormantRewardsCount > 0) {
        insights.push({
          id: "dormant-rewards",
          text: `<strong>${dormantRewardsCount.toLocaleString()}</strong> dormant customers still holding unused rewards. A longer shot but potentially high-value.`,
          value: dormantRewardsCount * 5,
        });
      }

      // Sort by business value
      insights.sort((a, b) => b.value - a.value);

      return { hasPOSConnection: true, primaryPOSProvider: provider, lastSyncAt: lastSync, insights };
    },
    enabled: !!tenant?.id,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return { hasPOSConnection: false, primaryPOSProvider: null, lastSyncAt: null, insights: [], loaded: !isLoading };
  }

  return { ...data, loaded: true };
}
