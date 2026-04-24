import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingCart, Target, Users } from "lucide-react";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import {
  formatCompactNumber,
  formatCurrency,
} from "@/components/analytics/analyticsUtils";
import { useTenant } from "@/hooks/useTenant";
import type { AnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import type { POSAnalytics } from "@/hooks/usePOSAnalytics";
import { supabase } from "@/integrations/supabase/client";

type AnalyticsKPIStripProps = {
  overview: AnalyticsOverview;
  posData?: POSAnalytics;
  posLoading?: boolean;
  posError?: string | null;
  period: number;
};

type KPITrendData = {
  customersDelta: number | null;
  revenueDelta: number | null;
  ordersDelta: number | null;
  conversionsDelta: number | null;
};

const getPercentageDelta = (currentValue: number, previousValue: number) => {
  if (!previousValue) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

function KPIItem({
  icon,
  label,
  loading,
  trend,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  trend?: number | null;
  value: React.ReactNode;
}) {
  const trendLabel =
    trend === null || trend === undefined || !Number.isFinite(trend)
      ? "No previous period"
      : trend > 0
        ? `+${Math.round(trend)}% vs previous period`
        : trend < 0
          ? `${Math.round(trend)}% vs previous period`
          : "0% vs previous period";

  return (
    <JoyCard>
      <JoyCardContent sx={{ pt: 4 }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.75}>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" sx={{ width: 86, height: 42 }} />
            ) : (
              <Typography
                level="h2"
                sx={{
                  fontFamily: "var(--joy-fontFamily-display)",
                  fontSize: { xs: "1.75rem", md: "2rem" },
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "neutral.900",
                }}
              >
                {value}
              </Typography>
            )}
            {loading ? (
              <Skeleton variant="text" sx={{ width: 112, height: 18 }} />
            ) : (
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {trendLabel}
              </Typography>
            )}
          </Stack>

          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              "& > *": {
                width: 20,
                height: 20,
              },
            }}
          >
            {icon}
          </Sheet>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export function AnalyticsKPIStrip({
  overview,
  posData,
  posLoading = false,
  posError,
  period,
}: AnalyticsKPIStripProps) {
  const { tenant } = useTenant();

  const { data: trendData, isLoading: trendsLoading } = useQuery<KPITrendData>({
    queryKey: ["analytics-kpi-trends", tenant?.id, period],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          customersDelta: null,
          revenueDelta: null,
          ordersDelta: null,
          conversionsDelta: null,
        };
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

      const [
        currentCustomers,
        previousCustomers,
        currentConversions,
        previousConversions,
        currentOrders,
        previousOrders,
      ] = await Promise.all([
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", currentStart.toISOString()),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", previousStart.toISOString())
          .lt("created_at", previousEnd.toISOString()),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", currentStart.toISOString())
          .in("event_type", ["coupon_redeem", "share_click"]),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", previousStart.toISOString())
          .lt("created_at", previousEnd.toISOString())
          .in("event_type", ["coupon_redeem", "share_click"]),
        connectionIds.length > 0
          ? supabase
              .from("pos_orders")
              .select("total_amount")
              .in("pos_connection_id", connectionIds)
              .gte("order_date", currentStart.toISOString())
          : Promise.resolve({ data: [], error: null }),
        connectionIds.length > 0
          ? supabase
              .from("pos_orders")
              .select("total_amount")
              .in("pos_connection_id", connectionIds)
              .gte("order_date", previousStart.toISOString())
              .lt("order_date", previousEnd.toISOString())
          : Promise.resolve({ data: [], error: null }),
      ]);

      const currentRevenue = (currentOrders.data ?? []).reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0,
      );
      const previousRevenue = (previousOrders.data ?? []).reduce(
        (sum, order) => sum + (order.total_amount ?? 0),
        0,
      );

      return {
        customersDelta: getPercentageDelta(
          currentCustomers.count ?? 0,
          previousCustomers.count ?? 0,
        ),
        revenueDelta:
          connectionIds.length > 0
            ? getPercentageDelta(currentRevenue, previousRevenue)
            : null,
        ordersDelta:
          connectionIds.length > 0
            ? getPercentageDelta(
                currentOrders.data?.length ?? 0,
                previousOrders.data?.length ?? 0,
              )
            : null,
        conversionsDelta: getPercentageDelta(
          currentConversions.count ?? 0,
          previousConversions.count ?? 0,
        ),
      };
    },
  });

  const isLoading = overview.loading || posLoading || trendsLoading;

  if (overview.error && posError) {
    return (
      <Sheet variant="soft" color="danger" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Stack spacing={0.75}>
          <Typography level="title-sm">
            Failed to load headline metrics
          </Typography>
          <Typography level="body-sm">
            Analytics overview and POS summary data were unavailable. Refresh
            the page to try again.
          </Typography>
        </Stack>
      </Sheet>
    );
  }

  const kpis = [
    {
      key: "customers",
      label: "Customers",
      value: formatCompactNumber(posData?.totalCustomers ?? 0),
      trend: trendData?.customersDelta,
      icon: <Users />,
    },
    {
      key: "revenue",
      label: "Revenue",
      value: formatCurrency(posData?.totalRevenue ?? 0, { compact: true }),
      trend: trendData?.revenueDelta,
      icon: <DollarSign />,
    },
    {
      key: "orders",
      label: "Orders",
      value: formatCompactNumber(posData?.totalOrders ?? 0),
      trend: trendData?.ordersDelta,
      icon: <ShoppingCart />,
    },
    {
      key: "conversions",
      label: "Conversions",
      value: formatCompactNumber(overview.conversions),
      trend: trendData?.conversionsDelta,
      icon: <Target />,
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        gap: 3,
      }}
    >
      {kpis.map((item) => (
        <KPIItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          loading={isLoading}
          trend={item.trend}
          value={item.value}
        />
      ))}
    </Box>
  );
}
