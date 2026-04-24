import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { POSAnalytics } from "@/hooks/usePOSAnalytics";
import { POSDetailCards } from "@/components/analytics/POSDetailCards";
import {
  RevenueChart,
  type RevenuePoint,
} from "@/components/analytics/RevenueChart";
import { getAnalyticsPeriodLabel } from "@/components/analytics/analyticsUtils";

type RevenueSalesSectionProps = {
  period: number;
  posData?: POSAnalytics;
  posLoading?: boolean;
};

type RevenueSalesData = {
  avgOrderDelta: number | null;
  revenuePoints: RevenuePoint[];
};

const getPercentageDelta = (currentValue: number, previousValue: number) => {
  if (!previousValue) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

export function RevenueSalesSection({
  period,
  posData,
  posLoading = false,
}: RevenueSalesSectionProps) {
  const { tenant } = useTenant();
  const periodLabel = getAnalyticsPeriodLabel(period);

  const { data, error, isLoading, refetch } = useQuery<RevenueSalesData>({
    queryKey: ["analytics-revenue-sales", tenant?.id, period],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return { avgOrderDelta: null, revenuePoints: [] };
      }

      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - period);
      const previousStart = new Date();
      previousStart.setDate(previousStart.getDate() - period * 2);
      const previousEnd = new Date();
      previousEnd.setDate(previousEnd.getDate() - period);

      const [squareConnections, cloverConnections] = await Promise.all([
        supabase
          .from("square_connections")
          .select("id")
          .eq("tenant_id", tenant.id)
          .in("status", ["active", "connected"]),
        supabase
          .from("clover_connections")
          .select("id")
          .eq("tenant_id", tenant.id)
          .in("status", ["active", "connected"]),
      ]);

      const connectionIds = [
        ...(squareConnections.data ?? []).map((connection) => connection.id),
        ...(cloverConnections.data ?? []).map((connection) => connection.id),
      ];

      if (!connectionIds.length) {
        return { avgOrderDelta: null, revenuePoints: [] };
      }

      const [currentOrders, previousOrders] = await Promise.all([
        supabase
          .from("pos_orders")
          .select("order_date, total_amount")
          .in("pos_connection_id", connectionIds)
          .gte("order_date", currentStart.toISOString())
          .order("order_date", { ascending: true }),
        supabase
          .from("pos_orders")
          .select("total_amount")
          .in("pos_connection_id", connectionIds)
          .gte("order_date", previousStart.toISOString())
          .lt("order_date", previousEnd.toISOString()),
      ]);

      const revenueByDay = new Map<string, RevenuePoint>();

      for (const order of currentOrders.data ?? []) {
        const key = order.order_date?.split("T")[0];

        if (!key) {
          continue;
        }

        const existing = revenueByDay.get(key) ?? {
          date: key,
          revenue: 0,
          orders: 0,
        };
        existing.revenue += order.total_amount ?? 0;
        existing.orders += 1;
        revenueByDay.set(key, existing);
      }

      const currentRevenue = (currentOrders.data ?? []).reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0,
      );
      const previousRevenue = (previousOrders.data ?? []).reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0,
      );
      const currentAov =
        (currentOrders.data?.length ?? 0) > 0
          ? currentRevenue / (currentOrders.data?.length ?? 1)
          : 0;
      const previousAov =
        (previousOrders.data?.length ?? 0) > 0
          ? previousRevenue / (previousOrders.data?.length ?? 1)
          : 0;

      return {
        avgOrderDelta: getPercentageDelta(currentAov, previousAov),
        revenuePoints: Array.from(revenueByDay.values()),
      };
    },
  });

  return (
    <Stack spacing={1.75}>
      <Stack spacing={0.5}>
        <Typography level="title-lg" sx={{ color: "neutral.900" }}>
          Revenue & Sales
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          Revenue performance, POS activity, and loyalty depth for the selected
          period.
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid xs={12} lg={8}>
          <RevenueChart
            data={data?.revenuePoints ?? []}
            error={error instanceof Error ? error.message : null}
            loading={isLoading}
            onRetry={() => void refetch()}
            periodLabel={periodLabel}
          />
        </Grid>
        <Grid xs={12} lg={4}>
          <POSDetailCards
            avgOrderTrend={data?.avgOrderDelta ?? null}
            loading={posLoading}
            loyaltyTrend={null}
            pointsTrend={null}
            posData={posData}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
