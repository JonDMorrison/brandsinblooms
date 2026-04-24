import * as React from "react";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, DollarSign, ShoppingBag, TrendingUp } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import type { PurchaseDisplayMetrics } from "@/lib/customerDashboardTransformers";
import {
  formatCurrency,
  formatDateLabel,
  formatPercent,
} from "./customerDashboardUtils";

interface PurchaseTimelinePoint {
  date: string;
  orders: number;
  revenue: number;
}

interface PurchaseValueBehaviorProps {
  metrics: PurchaseDisplayMetrics;
  purchaseTimeline: PurchaseTimelinePoint[];
  errorMessage?: string | null;
  onRetry?: () => void;
}

type TimelineMode = "per-order" | "cumulative";

const buildTimelineData = (
  mode: TimelineMode,
  timeline: PurchaseTimelinePoint[],
) => {
  if (mode === "per-order") {
    return timeline;
  }

  let orders = 0;
  let revenue = 0;

  return timeline.map((point) => {
    orders += point.orders;
    revenue += point.revenue;

    return {
      ...point,
      orders,
      revenue,
    };
  });
};

export function PurchaseValueBehavior({
  metrics,
  purchaseTimeline,
  errorMessage,
  onRetry,
}: PurchaseValueBehaviorProps) {
  const [timelineMode, setTimelineMode] =
    React.useState<TimelineMode>("per-order");

  const chartData = React.useMemo(
    () => buildTimelineData(timelineMode, purchaseTimeline),
    [purchaseTimeline, timelineMode],
  );

  const affinityEntries = Object.entries(metrics.categoryAffinity || {}).sort(
    (left, right) => right[1] - left[1],
  );

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Purchase & value behavior"
        description="Order cadence, value concentration, category affinity, and discount dependence."
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <JoyButton
              size="sm"
              variant={timelineMode === "per-order" ? "solid" : "plain"}
              color={timelineMode === "per-order" ? "primary" : "neutral"}
              onClick={() => setTimelineMode("per-order")}
            >
              Per order
            </JoyButton>
            <JoyButton
              size="sm"
              variant={timelineMode === "cumulative" ? "solid" : "plain"}
              color={timelineMode === "cumulative" ? "primary" : "neutral"}
              onClick={() => setTimelineMode("cumulative")}
            >
              Cumulative
            </JoyButton>
            {errorMessage && onRetry ? (
              <JoyButton
                color="danger"
                variant="plain"
                size="sm"
                onClick={onRetry}
              >
                Retry
              </JoyButton>
            ) : null}
          </Stack>
        }
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(4, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <JoyStatCard
              icon={<ShoppingBag />}
              label="Total orders"
              value={metrics.totalPurchases}
              iconColor="success"
            />
            <JoyStatCard
              icon={<DollarSign />}
              label="Lifetime value"
              value={formatCurrency(metrics.ltv)}
              iconColor="primary"
            />
            <JoyStatCard
              icon={<TrendingUp />}
              label="Average order value"
              value={formatCurrency(metrics.aov)}
              iconColor="warning"
            />
            <JoyStatCard
              icon={<Calendar />}
              label="Repeat rate"
              value={formatPercent(metrics.repeatPurchaseRate, 0)}
              iconColor="neutral"
            />
          </Box>

          {errorMessage ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="title-sm">
                Purchase timeline unavailable
              </Typography>
              <Typography level="body-sm" color="danger">
                {errorMessage}
              </Typography>
            </Sheet>
          ) : chartData.length > 0 ? (
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Purchase timeline</Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 8, right: 12, left: -14, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="var(--joy-palette-neutral-200)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fill: "var(--joy-palette-neutral-500)",
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{
                          fill: "var(--joy-palette-neutral-500)",
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{
                          fill: "var(--joy-palette-neutral-500)",
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--joy-palette-neutral-200)",
                          backgroundColor:
                            "var(--joy-palette-background-surface)",
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="orders"
                        fill="var(--joy-palette-success-300)"
                        radius={[6, 6, 0, 0]}
                        name="Orders"
                        barSize={18}
                      />
                      <Line
                        yAxisId="right"
                        dataKey="revenue"
                        stroke="var(--joy-palette-primary-600)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        name="Revenue"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </Sheet>
          ) : (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "xl", p: 2.5 }}
            >
              <Typography level="title-sm">No purchase history yet</Typography>
              <Typography level="body-sm" color="neutral">
                Once the customer starts ordering, trend and value behavior will
                appear here.
              </Typography>
            </Sheet>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1fr) minmax(0, 1fr)",
              },
              gap: 2,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Discount behavior</Typography>
                <Stack spacing={1}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-sm">Full price mix</Typography>
                      <Typography level="body-xs" color="neutral">
                        {formatPercent(metrics.fullPricePercentage, 0)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={metrics.fullPricePercentage}
                      color="success"
                      sx={{ borderRadius: 999 }}
                    />
                  </Stack>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-sm">Discounted mix</Typography>
                      <Typography level="body-xs" color="neutral">
                        {formatPercent(metrics.discountedPercentage, 0)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={metrics.discountedPercentage}
                      color="warning"
                      sx={{ borderRadius: 999 }}
                    />
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyChip color="neutral" variant="soft" size="sm">
                    Discount amount{" "}
                    {formatCurrency(metrics.totalDiscountAmount)}
                  </JoyChip>
                  <JoyChip color="neutral" variant="soft" size="sm">
                    Avg gap {metrics.avgDaysBetweenPurchases ?? "--"} days
                  </JoyChip>
                </Stack>
                {metrics.consecutiveDiscountPurchases !== null &&
                metrics.consecutiveDiscountPurchases >= 3 ? (
                  <Sheet
                    variant="soft"
                    color="warning"
                    sx={{ borderRadius: "xl", p: 1.5 }}
                  >
                    <Typography level="body-sm">
                      {metrics.consecutiveDiscountPurchases} consecutive
                      discount-driven purchases detected.
                    </Typography>
                  </Sheet>
                ) : null}
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Category affinity</Typography>
                {affinityEntries.length > 0 ? (
                  affinityEntries.slice(0, 5).map(([category, percentage]) => (
                    <Stack key={category} spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography level="body-sm">{category}</Typography>
                        <Typography level="body-xs" color="neutral">
                          {formatPercent(percentage, 0)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        determinate
                        value={percentage}
                        color="primary"
                        sx={{ borderRadius: 999 }}
                      />
                    </Stack>
                  ))
                ) : (
                  <Typography level="body-sm" color="neutral">
                    Category affinity has not been calculated yet.
                  </Typography>
                )}
              </Stack>
            </Sheet>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="body-xs" color="neutral">
                First purchase
              </Typography>
              <Typography level="title-md">
                {formatDateLabel(metrics.firstPurchaseDate)}
              </Typography>
            </Sheet>
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="body-xs" color="neutral">
                Last purchase
              </Typography>
              <Typography level="title-md">
                {formatDateLabel(metrics.lastPurchaseDate)}
              </Typography>
            </Sheet>
          </Box>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default PurchaseValueBehavior;
