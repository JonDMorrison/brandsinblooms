import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, RefreshCw } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  formatAnalyticsDay,
  formatCurrency,
} from "@/components/analytics/analyticsUtils";

export type RevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
};

type RevenueChartProps = {
  data: RevenuePoint[];
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
  periodLabel: string;
};

function RevenueTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; payload: RevenuePoint }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;

  return (
    <Box
      sx={{
        borderRadius: "md",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-md)",
        px: 1.25,
        py: 1,
      }}
    >
      <Typography level="body-xs" sx={{ color: "neutral.500", mb: 0.25 }}>
        {label ? formatAnalyticsDay(label) : "Revenue"}
      </Typography>
      <Typography level="title-sm" sx={{ color: "neutral.900" }}>
        {formatCurrency(row?.revenue ?? 0)}
      </Typography>
      <Typography level="body-xs" sx={{ color: "neutral.600" }}>
        {row?.orders ?? 0} orders
      </Typography>
    </Box>
  );
}

export function RevenueChart({
  data,
  error,
  loading = false,
  onRetry,
  periodLabel,
}: RevenueChartProps) {
  if (loading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title={<Skeleton variant="text" sx={{ width: 180 }} />}
          actions={
            <Skeleton variant="rectangular" sx={{ width: 56, height: 24 }} />
          }
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <Skeleton
            variant="rectangular"
            sx={{ height: 280, borderRadius: "lg" }}
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardHeader title="Revenue Over Time" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load revenue history.
            </Typography>
            {onRetry ? (
              <JoyButton
                size="sm"
                variant="soft"
                color="danger"
                startDecorator={<RefreshCw size={14} />}
                onClick={onRetry}
              >
                Retry
              </JoyButton>
            ) : null}
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!data.length) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="Revenue Over Time"
          actions={<JoyChip size="sm">{periodLabel}</JoyChip>}
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <JoyEmptyState
            icon={<BarChart3 />}
            title="No revenue data yet"
            description="Connect a POS source or sync order history to unlock the revenue trend view."
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Revenue Over Time"
        description="Daily revenue trend across synced POS orders"
        actions={<JoyChip size="sm">{periodLabel}</JoyChip>}
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Box sx={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="analytics-revenue-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="rgb(var(--joy-palette-primary-mainChannel))"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor="rgb(var(--joy-palette-primary-mainChannel))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.08)"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
                tickFormatter={formatAnalyticsDay}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  formatCurrency(value, { compact: true })
                }
                tickLine={false}
                width={72}
              />
              <Tooltip
                content={<RevenueTooltip />}
                cursor={{
                  stroke: "rgba(var(--joy-palette-primary-mainChannel) / 0.25)",
                }}
              />
              <Area
                dataKey="revenue"
                fill="url(#analytics-revenue-fill)"
                fillOpacity={1}
                stroke="var(--joy-palette-primary-500)"
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </JoyCardContent>
    </JoyCard>
  );
}
