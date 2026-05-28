import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Clock3,
  DollarSign,
  MessageSquareText,
  MessagesSquare,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import {
  useBloomAuditLog,
  useBloomDailyVolume,
  useBloomModelDistribution,
  useBloomToolUsage,
  useBloomUsageOverview,
} from "@/hooks/bloom/useBloomAdminAnalytics";
import type {
  BloomAdminAnalyticsPeriod,
  BloomAdminAnalyticsPeriodPreset,
  BloomAdminDateRange,
  BloomAuditEntry,
  BloomAuditEventType,
  BloomAuditSecurityEventType,
  BloomDailyVolume,
  BloomModelDistribution,
  BloomToolUsageStats,
  BloomUsageOverview,
} from "@/hooks/bloom/types";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useTenant } from "@/hooks/useTenant";

const ADMIN_PERIOD_OPTIONS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_week", label: "This Week" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
] as const satisfies ReadonlyArray<{
  value: BloomAdminAnalyticsPeriodPreset;
  label: string;
}>;

type AuditDateRangePreset =
  | "last_24_hours"
  | "last_7_days"
  | "last_30_days"
  | "all_time";
type AuditSortDirection = "asc" | "desc";
type ChangeDirection = "up" | "down" | "flat";
type ChangeTone = "success" | "danger" | "neutral";

type AuditDisplayEventType = BloomAuditEventType;
type AuditEventFilterValue = "" | AuditDisplayEventType;

const AUDIT_PAGE_SIZE = 20;
const DAILY_CHART_HEIGHT = 250;
const PIE_CHART_HEIGHT = 250;
const MODEL_COLORS = [
  "var(--joy-palette-primary-500)",
  "var(--joy-palette-primary-300)",
  "var(--joy-palette-neutral-400)",
  "var(--joy-palette-neutral-600)",
  "var(--joy-palette-neutral-300)",
] as const;

const AUDIT_EVENT_OPTIONS = [
  { value: "", label: "All" },
  { value: "prompt", label: "prompt" },
  { value: "tool_call", label: "tool_call" },
  { value: "tool_result", label: "tool_result" },
  { value: "response", label: "response" },
  { value: "error", label: "error" },
  { value: "injection_attempt", label: "injection_attempt" },
  { value: "output_violation", label: "Output Violation" },
  { value: "cross_tenant_attempt", label: "Cross-Tenant Attempt" },
  { value: "rate_limit", label: "rate_limit" },
] as const satisfies ReadonlyArray<{
  value: AuditEventFilterValue;
  label: string;
}>;

const AUDIT_DATE_RANGE_OPTIONS = [
  { value: "last_24_hours", label: "Last 24 Hours" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "all_time", label: "All Time" },
] as const satisfies ReadonlyArray<{
  value: AuditDateRangePreset;
  label: string;
}>;

const numberFormatter = new Intl.NumberFormat("en-US");
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const percentCompactFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "never",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface ChangeDescriptor {
  direction: ChangeDirection;
  tone: ChangeTone;
  label: string;
}

interface AdminStatCardMetric {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  change: ChangeDescriptor;
}

interface DailyTooltipPayloadItem {
  payload?: BloomDailyVolume[number];
}

interface ModelTooltipPayloadItem {
  payload?: BloomModelDistribution[number];
}

const isAuditSecurityEventType = (
  value: string | null | undefined,
): value is BloomAuditSecurityEventType =>
  value === "injection_attempt" ||
  value === "output_violation" ||
  value === "cross_tenant_attempt" ||
  value === "rate_limit";

const readEventText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readEventNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcWeek = (value: Date) => {
  const start = startOfUtcDay(value);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(start, diff);
};

const formatCount = (value: number | null | undefined) =>
  numberFormatter.format(value ?? 0);

const formatCompactValue = (value: number | null | undefined) =>
  compactNumberFormatter.format(value ?? 0);

const formatCurrency = (value: number | null | undefined) =>
  currencyFormatter.format(value ?? 0);

const formatSuccessRate = (value: number) => percentFormatter.format(value);

const formatChartDate = (value: string) =>
  shortDateFormatter.format(new Date(value));

const formatTimestamp = (value: string) =>
  timestampFormatter.format(new Date(value)).replace(" at ", ", ");

const formatLatency = (value: number | null | undefined) =>
  value === null || value === undefined ? "--" : `${Math.round(value)}ms`;

const formatTokens = (value: number | null | undefined) =>
  value === null || value === undefined ? "--" : formatCount(value);

const humanizeToolName = (value: string | null) => {
  if (!value) {
    return "--";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const resolvePeriodDateRange = (
  period: BloomAdminAnalyticsPeriodPreset,
): BloomAdminDateRange => {
  const now = new Date();

  switch (period) {
    case "last_month": {
      const end = startOfUtcMonth(now);
      const start = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1),
      );
      return { start: start.toISOString(), end: end.toISOString() };
    }
    case "this_week": {
      const start = startOfUtcWeek(now);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "last_7_days": {
      const start = addUtcDays(startOfUtcDay(now), -6);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "last_30_days": {
      const start = addUtcDays(startOfUtcDay(now), -29);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "this_month":
    default: {
      const start = startOfUtcMonth(now);
      return { start: start.toISOString(), end: now.toISOString() };
    }
  }
};

const resolveComparisonPeriod = (
  period: BloomAdminAnalyticsPeriodPreset,
): BloomAdminDateRange => {
  const current = resolvePeriodDateRange(period);
  const currentStart = new Date(current.start).getTime();
  const currentEnd = new Date(current.end).getTime();
  const duration = Math.max(currentEnd - currentStart, 1);

  return {
    start: new Date(currentStart - duration).toISOString(),
    end: new Date(currentStart).toISOString(),
  };
};

const resolveAuditDateRange = (
  preset: AuditDateRangePreset,
): Partial<BloomAdminDateRange> | null => {
  const now = new Date();

  switch (preset) {
    case "last_24_hours":
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
    case "last_30_days":
      return {
        start: addUtcDays(startOfUtcDay(now), -29).toISOString(),
        end: now.toISOString(),
      };
    case "all_time":
      return null;
    case "last_7_days":
    default:
      return {
        start: addUtcDays(startOfUtcDay(now), -6).toISOString(),
        end: now.toISOString(),
      };
  }
};

const resolveAuditDisplayEventType = (
  entry: BloomAuditEntry,
): AuditDisplayEventType => {
  const rawEventType = String(entry.event_type);
  if (isAuditSecurityEventType(rawEventType)) {
    return rawEventType;
  }

  const requestedEventType = readEventText(
    entry.event_data.requested_event_type,
  );
  if (isAuditSecurityEventType(requestedEventType)) {
    return requestedEventType;
  }

  const securityEventType = readEventText(entry.event_data.security_event_type);
  if (isAuditSecurityEventType(securityEventType)) {
    return securityEventType;
  }

  return entry.event_type;
};

const resolveEventChipColor = (eventType: AuditDisplayEventType) => {
  switch (eventType) {
    case "tool_call":
    case "tool_result":
      return "primary" as const;
    case "response":
      return "success" as const;
    case "error":
    case "injection_attempt":
    case "output_violation":
    case "cross_tenant_attempt":
      return "danger" as const;
    case "rate_limit":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
};

const resolveAuditTokenCount = (entry: BloomAuditEntry) => {
  const tokens = (entry.tokens_input ?? 0) + (entry.tokens_output ?? 0);
  if (tokens > 0) {
    return tokens;
  }

  return readEventNumber(entry.event_data.context_estimated_input_tokens);
};

const calculateChange = (
  current: number | null | undefined,
  previous: number | null | undefined,
  inverseGood = false,
): ChangeDescriptor => {
  const safeCurrent = current ?? 0;
  const safePrevious = previous ?? 0;

  if (safeCurrent === safePrevious) {
    return { direction: "flat", tone: "neutral", label: "same" };
  }

  if (safePrevious === 0) {
    return {
      direction: safeCurrent > 0 ? "up" : "down",
      tone: inverseGood
        ? safeCurrent > 0
          ? "danger"
          : "success"
        : safeCurrent > 0
          ? "success"
          : "danger",
      label: "new",
    };
  }

  const delta = safeCurrent - safePrevious;
  const percentage = Math.abs((delta / Math.abs(safePrevious)) * 100);
  const isPositive = delta > 0;
  const tone = inverseGood
    ? isPositive
      ? "danger"
      : "success"
    : isPositive
      ? "success"
      : "danger";

  return {
    direction: isPositive ? "up" : "down",
    tone,
    label: `${percentCompactFormatter.format(Math.round(percentage))}%`,
  };
};

const toolSuccessTone = (value: number) => {
  if (value >= 0.95) {
    return "success" as const;
  }

  if (value >= 0.8) {
    return "warning" as const;
  }

  return "danger" as const;
};

function SectionError({ message }: { message: string }) {
  return (
    <Typography level="body-sm" sx={{ color: "danger.600" }}>
      {message}
    </Typography>
  );
}

function SectionEmptyState({ message }: { message: string }) {
  return (
    <Typography level="body-sm" sx={{ color: "neutral.500" }}>
      {message}
    </Typography>
  );
}

function ChangeBadge({ change }: { change: ChangeDescriptor }) {
  const Icon =
    change.direction === "up"
      ? TrendingUp
      : change.direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <JoyChip
      color={change.tone === "neutral" ? "neutral" : change.tone}
      size="sm"
      variant="soft"
      startDecorator={<Icon size={13} strokeWidth={1.9} />}
      sx={{ alignSelf: "flex-start" }}
    >
      {change.label}
    </JoyChip>
  );
}

function BloomAdminStatCard({ metric }: { metric: AdminStatCardMetric }) {
  const Icon = metric.icon;

  return (
    <JoyCard variant="outlined" sx={{ minHeight: 148 }}>
      <JoyCardContent
        sx={{
          display: "flex",
          height: "100%",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box
            sx={{ display: "inline-flex", color: "neutral.500", flexShrink: 0 }}
          >
            <Icon size={18} strokeWidth={1.85} />
          </Box>
          <ChangeBadge change={metric.change} />
        </Stack>

        <Stack spacing={0.5} sx={{ mt: "auto" }}>
          <Typography
            level="h2"
            sx={{ color: "neutral.900", fontVariantNumeric: "tabular-nums" }}
          >
            {metric.value}
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            {metric.label}
          </Typography>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomAdminStatCardsSkeleton() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(1, minmax(0, 1fr))",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
        },
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <JoyCard key={index} variant="outlined" sx={{ minHeight: 148 }}>
          <JoyCardContent
            sx={{
              display: "flex",
              height: "100%",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Skeleton variant="circular" width={18} height={18} />
              <Skeleton
                variant="rectangular"
                width={70}
                height={24}
                sx={{ borderRadius: 999 }}
              />
            </Stack>
            <Stack spacing={0.75} sx={{ mt: "auto" }}>
              <Skeleton variant="text" sx={{ width: "48%", height: 36 }} />
              <Skeleton variant="text" sx={{ width: "62%" }} />
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ))}
    </Box>
  );
}

function BloomAdminStatCards({
  overview,
  comparisonOverview,
  isLoading,
}: {
  overview: BloomUsageOverview;
  comparisonOverview: BloomUsageOverview;
  isLoading: boolean;
}) {
  const metrics = React.useMemo<AdminStatCardMetric[]>(
    () => [
      {
        key: "conversations",
        label: "Conversations",
        value: formatCount(overview.conversation_count),
        icon: Sparkles,
        change: calculateChange(
          overview.conversation_count,
          comparisonOverview.conversation_count,
        ),
      },
      {
        key: "messages",
        label: "Messages",
        value: formatCount(overview.message_count),
        icon: MessagesSquare,
        change: calculateChange(
          overview.message_count,
          comparisonOverview.message_count,
        ),
      },
      {
        key: "tokens",
        label: "Total Tokens",
        value: formatCompactValue(overview.total_tokens),
        icon: MessageSquareText,
        change: calculateChange(
          overview.total_tokens,
          comparisonOverview.total_tokens,
        ),
      },
      {
        key: "cost",
        label: "Estimated Cost",
        value: formatCurrency(overview.estimated_cost),
        icon: DollarSign,
        change: calculateChange(
          overview.estimated_cost,
          comparisonOverview.estimated_cost,
        ),
      },
      {
        key: "users",
        label: "Active Users",
        value: formatCount(overview.active_user_count),
        icon: Users,
        change: calculateChange(
          overview.active_user_count,
          comparisonOverview.active_user_count,
        ),
      },
      {
        key: "latency",
        label: "Avg. Latency",
        value: formatLatency(overview.avg_latency_ms),
        icon: Clock3,
        change: calculateChange(
          overview.avg_latency_ms,
          comparisonOverview.avg_latency_ms,
          true,
        ),
      },
    ],
    [comparisonOverview, overview],
  );

  if (isLoading) {
    return <BloomAdminStatCardsSkeleton />;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(1, minmax(0, 1fr))",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
        },
      }}
    >
      {metrics.map((metric) => (
        <BloomAdminStatCard key={metric.key} metric={metric} />
      ))}
    </Box>
  );
}

function DailyVolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: DailyTooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) {
    return null;
  }

  const entry = payload[0].payload;

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "md",
        borderColor: "neutral.200",
        boxShadow: "var(--joy-shadow-md)",
        px: 1.5,
        py: 1.25,
        backgroundColor: "background.surface",
      }}
    >
      <Typography level="body-xs" sx={{ color: "neutral.500", mb: 0.5 }}>
        {label ? formatChartDate(label) : ""}
      </Typography>
      <Stack spacing={0.35}>
        <Typography level="body-sm" sx={{ color: "neutral.900" }}>
          {formatCount(entry.message_count)} messages
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {formatCount(entry.token_count)} tokens
        </Typography>
      </Stack>
    </Sheet>
  );
}

function BloomAdminDailyChart({
  data,
  isLoading,
  error,
}: {
  data: BloomDailyVolume;
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Daily Volume"
        description="Message volume across the last 30 days"
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent>
        {error ? <SectionError message="Unable to load daily volume." /> : null}
        {!error && isLoading ? (
          <Skeleton
            variant="rectangular"
            sx={{ height: DAILY_CHART_HEIGHT, borderRadius: "lg" }}
          />
        ) : null}
        {!error && !isLoading && data.length === 0 ? (
          <SectionEmptyState message="No daily volume data is available yet." />
        ) : null}
        {!error && !isLoading && data.length > 0 ? (
          <Box sx={{ width: "100%", height: DAILY_CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.14)"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--joy-palette-neutral-500)",
                    fontSize: 12,
                  }}
                  tickFormatter={(value: string | number) =>
                    formatChartDate(String(value))
                  }
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--joy-palette-neutral-500)",
                    fontSize: 12,
                  }}
                />
                <RechartsTooltip
                  content={<DailyVolumeTooltip />}
                  cursor={{
                    fill: "rgba(var(--joy-palette-primary-mainChannel) / 0.08)",
                  }}
                />
                <Bar
                  dataKey="message_count"
                  fill="var(--joy-palette-primary-400)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : null}
      </JoyCardContent>
    </JoyCard>
  );
}

function ModelDistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ModelTooltipPayloadItem[];
}) {
  if (!active || !payload?.length || !payload[0]?.payload) {
    return null;
  }

  const entry = payload[0].payload;

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "md",
        borderColor: "neutral.200",
        boxShadow: "var(--joy-shadow-md)",
        px: 1.5,
        py: 1.25,
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={0.35}>
        <Typography level="body-sm" sx={{ color: "neutral.900" }}>
          {entry.model}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {formatCount(entry.token_count)} tokens
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {formatCurrency(entry.estimated_cost)}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function BloomAdminModelChart({
  data,
  isLoading,
  error,
}: {
  data: BloomModelDistribution;
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <JoyCard variant="outlined" sx={{ height: "100%" }}>
      <JoyCardHeader
        title="Model Distribution"
        description="Token share by response model"
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent>
        {error ? (
          <SectionError message="Unable to load model distribution." />
        ) : null}
        {!error && isLoading ? (
          <Skeleton
            variant="rectangular"
            sx={{ height: PIE_CHART_HEIGHT, borderRadius: "lg" }}
          />
        ) : null}
        {!error && !isLoading && data.length === 0 ? (
          <SectionEmptyState message="No model usage has been recorded for this period." />
        ) : null}
        {!error && !isLoading && data.length > 0 ? (
          <Stack spacing={2}>
            <Box sx={{ width: "100%", height: PIE_CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="token_count"
                    nameKey="model"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`${entry.model}-${index}`}
                        fill={MODEL_COLORS[index % MODEL_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ModelDistributionTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Box>

            <Stack spacing={1}>
              {data.map((entry, index) => (
                <Stack
                  key={entry.model}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1.5}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor:
                          MODEL_COLORS[index % MODEL_COLORS.length],
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.700", minWidth: 0 }}
                    >
                      {entry.model}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "neutral.900",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {entry.percentage}%
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "neutral.500",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCurrency(entry.estimated_cost)}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomAdminToolTable({
  data,
  isLoading,
  error,
}: {
  data: BloomToolUsageStats;
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <JoyCard variant="outlined" sx={{ height: "100%" }}>
      <JoyCardHeader
        title="Top Tools"
        description="Most-used Bloom tool calls for the selected period"
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent sx={{ px: 0, pb: 0 }}>
        {error ? (
          <Box sx={{ px: 4, pb: 4 }}>
            <SectionError message="Unable to load tool usage." />
          </Box>
        ) : null}
        {!error ? (
          <JoyTable stickyHeader>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Tool Name</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Calls</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Avg Time</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">
                  Success Rate
                </JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <JoyTableRow key={index}>
                      <JoyTableCell>
                        <Skeleton
                          variant="text"
                          sx={{ width: `${52 + index * 4}%` }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 36, ml: "auto" }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 48, ml: "auto" }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: 72,
                            height: 24,
                            ml: "auto",
                            borderRadius: 999,
                          }}
                        />
                      </JoyTableCell>
                    </JoyTableRow>
                  ))
                : null}
              {!isLoading && data.length === 0 ? (
                <JoyTableRow>
                  <JoyTableCell colSpan={4}>
                    <SectionEmptyState message="No tool usage was recorded for this period." />
                  </JoyTableCell>
                </JoyTableRow>
              ) : null}
              {!isLoading
                ? data.map((entry) => (
                    <JoyTableRow key={entry.tool_name}>
                      <JoyTableCell>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.800" }}
                        >
                          {humanizeToolName(entry.tool_name)}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatCount(entry.call_count)}
                      </JoyTableCell>
                      <JoyTableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatLatency(entry.avg_execution_time_ms)}
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <JoyChip
                          color={toolSuccessTone(entry.success_rate)}
                          size="sm"
                          variant="soft"
                        >
                          {formatSuccessRate(entry.success_rate)}
                        </JoyChip>
                      </JoyTableCell>
                    </JoyTableRow>
                  ))
                : null}
            </JoyTableBody>
          </JoyTable>
        ) : null}
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomAdminAuditTable({
  eventFilter,
  userFilter,
  userOptions,
  toolSearch,
  dateRange,
  sortDirection,
  expandedId,
  rows,
  totalCount,
  currentPage,
  pageCount,
  isLoading,
  isLoadingAllPages,
  isFetchingNextPage,
  hasNextPage,
  error,
  onEventFilterChange,
  onUserFilterChange,
  onToolSearchChange,
  onDateRangeChange,
  onSortDirectionToggle,
  onToggleExpanded,
  onPreviousPage,
  onNextPage,
}: {
  eventFilter: AuditEventFilterValue;
  userFilter: string;
  userOptions: Array<{ value: string; label: string }>;
  toolSearch: string;
  dateRange: AuditDateRangePreset;
  sortDirection: AuditSortDirection;
  expandedId: string | null;
  rows: BloomAuditEntry[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
  isLoading: boolean;
  isLoadingAllPages: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: unknown;
  onEventFilterChange: (value: AuditEventFilterValue) => void;
  onUserFilterChange: (value: string) => void;
  onToolSearchChange: (value: string) => void;
  onDateRangeChange: (value: AuditDateRangePreset) => void;
  onSortDirectionToggle: () => void;
  onToggleExpanded: (id: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const start = totalCount === 0 ? 0 : (currentPage - 1) * AUDIT_PAGE_SIZE + 1;
  const end =
    totalCount === 0 ? 0 : Math.min(start + rows.length - 1, totalCount);

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Audit Log"
        description="Inspect recent Bloom audit events across prompts, tools, responses, and security checks"
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent sx={{ gap: 0, display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "repeat(1, minmax(0, 1fr))",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            pb: 3,
          }}
        >
          <JoySelect
            label="Event Type"
            value={eventFilter}
            onValueChange={(value) =>
              onEventFilterChange((value as AuditEventFilterValue) ?? "")
            }
            options={AUDIT_EVENT_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <JoySelect
            label="User"
            value={userFilter}
            onValueChange={(value) => onUserFilterChange(value ?? "")}
            options={[{ value: "", label: "All Users" }, ...userOptions]}
          />
          <JoyInput
            label="Tool Name"
            placeholder="Search tool name"
            value={toolSearch}
            onValueChange={onToolSearchChange}
          />
          <JoySelect
            label="Date Range"
            value={dateRange}
            onValueChange={(value) =>
              onDateRangeChange(
                (value as AuditDateRangePreset) ?? "last_7_days",
              )
            }
            options={AUDIT_DATE_RANGE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Box>

        {isLoadingAllPages ? (
          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", px: 0, pb: 2 }}
          >
            Loading all matching audit events to apply this view accurately.
          </Typography>
        ) : null}

        {error ? (
          <SectionError message="Unable to load audit log events." />
        ) : null}

        {!error ? (
          <JoyTable stickyHeader>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={sortDirection}
                  onSort={onSortDirectionToggle}
                >
                  Timestamp
                </JoyTableHeaderCell>
                <JoyTableHeaderCell>User</JoyTableHeaderCell>
                <JoyTableHeaderCell>Event Type</JoyTableHeaderCell>
                <JoyTableHeaderCell>Tool Name</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Tokens</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Latency</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <JoyTableRow key={index}>
                      <JoyTableCell>
                        <Skeleton variant="text" sx={{ width: "70%" }} />
                      </JoyTableCell>
                      <JoyTableCell>
                        <Skeleton variant="text" sx={{ width: "56%" }} />
                      </JoyTableCell>
                      <JoyTableCell>
                        <Skeleton
                          variant="rectangular"
                          sx={{ width: 88, height: 24, borderRadius: 999 }}
                        />
                      </JoyTableCell>
                      <JoyTableCell>
                        <Skeleton variant="text" sx={{ width: "64%" }} />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 40, ml: "auto" }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 40, ml: "auto" }}
                        />
                      </JoyTableCell>
                    </JoyTableRow>
                  ))
                : null}
              {!isLoading && rows.length === 0 ? (
                <JoyTableRow>
                  <JoyTableCell colSpan={6}>
                    <SectionEmptyState message="No audit events matched these filters." />
                  </JoyTableCell>
                </JoyTableRow>
              ) : null}
              {!isLoading
                ? rows.map((entry) => {
                    const displayEventType =
                      resolveAuditDisplayEventType(entry);
                    const combinedTokens = resolveAuditTokenCount(entry);
                    const isExpanded = expandedId === entry.id;

                    return (
                      <React.Fragment key={entry.id}>
                        <JoyTableRow
                          clickable
                          onClick={() => onToggleExpanded(entry.id)}
                        >
                          <JoyTableCell
                            sx={{
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatTimestamp(entry.timestamp)}
                          </JoyTableCell>
                          <JoyTableCell>{entry.user_display_name}</JoyTableCell>
                          <JoyTableCell>
                            <JoyChip
                              color={resolveEventChipColor(displayEventType)}
                              size="sm"
                              variant="soft"
                            >
                              {displayEventType}
                            </JoyChip>
                          </JoyTableCell>
                          <JoyTableCell>
                            {humanizeToolName(entry.tool_name)}
                          </JoyTableCell>
                          <JoyTableCell
                            align="right"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {combinedTokens !== null
                              ? formatCount(combinedTokens)
                              : "--"}
                          </JoyTableCell>
                          <JoyTableCell
                            align="right"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatLatency(entry.latency_ms)}
                          </JoyTableCell>
                        </JoyTableRow>
                        {isExpanded ? (
                          <JoyTableRow>
                            <JoyTableCell
                              colSpan={6}
                              sx={{ backgroundColor: "background.surface" }}
                            >
                              <Sheet
                                variant="soft"
                                sx={{
                                  borderRadius: "sm",
                                  px: 2,
                                  py: 1.5,
                                  backgroundColor:
                                    "rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
                                }}
                              >
                                <Box
                                  component="pre"
                                  sx={{
                                    m: 0,
                                    maxHeight: 300,
                                    overflow: "auto",
                                    fontFamily: "var(--joy-fontFamily-code)",
                                    fontSize: "var(--joy-fontSize-xs)",
                                    lineHeight: 1.5,
                                    color: "neutral.700",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {JSON.stringify(entry.event_data, null, 2)}
                                </Box>
                              </Sheet>
                            </JoyTableCell>
                          </JoyTableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                : null}
            </JoyTableBody>
          </JoyTable>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{
            pt: 2.5,
            mt: 2,
            borderTop: "1px solid",
            borderColor: "neutral.100",
          }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            Showing {start}-{end} of {totalCount} events
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Page {pageCount === 0 ? 0 : currentPage} of {pageCount}
            </Typography>
            <JoyButton
              color="neutral"
              size="sm"
              variant="outlined"
              disabled={currentPage <= 1 || isLoadingAllPages}
              onClick={onPreviousPage}
            >
              Previous
            </JoyButton>
            <JoyButton
              color="neutral"
              size="sm"
              variant="outlined"
              disabled={
                currentPage >= pageCount ||
                (!hasNextPage && currentPage >= pageCount) ||
                isFetchingNextPage ||
                isLoadingAllPages
              }
              onClick={onNextPage}
            >
              Next
            </JoyButton>
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomAdminRateLimitsCard() {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Rate Limits"
        description="Current Bloom rate limits for the active tenant"
        titleProps={{ level: "title-sm" }}
      />
      <JoyCardContent>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "repeat(1, minmax(0, 1fr))",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <Sheet variant="soft" sx={{ borderRadius: "lg", px: 2, py: 1.5 }}>
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.500",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Per-user
            </Typography>
            <Typography
              level="title-md"
              sx={{ color: "neutral.900", fontVariantNumeric: "tabular-nums" }}
            >
              60 msgs/hr
            </Typography>
          </Sheet>
          <Sheet variant="soft" sx={{ borderRadius: "lg", px: 2, py: 1.5 }}>
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.500",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Per-tenant
            </Typography>
            <Typography
              level="title-md"
              sx={{ color: "neutral.900", fontVariantNumeric: "tabular-nums" }}
            >
              500 msgs/hr
            </Typography>
          </Sheet>
        </Box>
        <Typography level="body-xs" sx={{ color: "neutral.500", mt: 1.5 }}>
          Custom limits coming soon
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

function BloomAdminDashboardSkeleton() {
  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.6} sx={{ width: "100%", maxWidth: 380 }}>
            <Skeleton variant="text" sx={{ width: 220, height: 34 }} />
            <Skeleton variant="text" sx={{ width: "72%" }} />
          </Stack>
          <Skeleton
            variant="rectangular"
            sx={{ width: 170, height: 38, borderRadius: "lg" }}
          />
        </Stack>
        <BloomAdminStatCardsSkeleton />
        <JoyCard variant="outlined">
          <JoyCardHeader
            title={<Skeleton variant="text" sx={{ width: 140 }} />}
          />
          <JoyCardContent>
            <Skeleton
              variant="rectangular"
              sx={{ height: DAILY_CHART_HEIGHT, borderRadius: "lg" }}
            />
          </JoyCardContent>
        </JoyCard>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "repeat(1, minmax(0, 1fr))",
              xl: "minmax(0, 1fr) minmax(0, 1fr)",
            },
          }}
        >
          <JoyCard variant="outlined">
            <JoyCardHeader
              title={<Skeleton variant="text" sx={{ width: 160 }} />}
            />
            <JoyCardContent>
              <Skeleton
                variant="rectangular"
                sx={{ height: PIE_CHART_HEIGHT, borderRadius: "lg" }}
              />
            </JoyCardContent>
          </JoyCard>
          <JoyCard variant="outlined">
            <JoyCardHeader
              title={<Skeleton variant="text" sx={{ width: 120 }} />}
            />
            <JoyCardContent sx={{ px: 0, pb: 0 }}>
              <JoyTable>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell>Tool Name</JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">Calls</JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">
                      Avg Time
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">
                      Success Rate
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <JoyTableRow key={index}>
                      <JoyTableCell>
                        <Skeleton
                          variant="text"
                          sx={{ width: `${48 + index * 6}%` }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 32, ml: "auto" }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="text"
                          sx={{ width: 48, ml: "auto" }}
                        />
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: 70,
                            height: 24,
                            ml: "auto",
                            borderRadius: 999,
                          }}
                        />
                      </JoyTableCell>
                    </JoyTableRow>
                  ))}
                </JoyTableBody>
              </JoyTable>
            </JoyCardContent>
          </JoyCard>
        </Box>
        <JoyCard variant="outlined">
          <JoyCardHeader
            title={<Skeleton variant="text" sx={{ width: 120 }} />}
          />
          <JoyCardContent
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "repeat(1, minmax(0, 1fr))",
                  md: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  sx={{ height: 38, borderRadius: "lg" }}
                />
              ))}
            </Box>
            <JoyTable>
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell>Timestamp</JoyTableHeaderCell>
                  <JoyTableHeaderCell>User</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Event Type</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Tool Name</JoyTableHeaderCell>
                  <JoyTableHeaderCell align="right">Tokens</JoyTableHeaderCell>
                  <JoyTableHeaderCell align="right">Latency</JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <JoyTableRow key={index}>
                    <JoyTableCell>
                      <Skeleton variant="text" sx={{ width: "70%" }} />
                    </JoyTableCell>
                    <JoyTableCell>
                      <Skeleton variant="text" sx={{ width: "60%" }} />
                    </JoyTableCell>
                    <JoyTableCell>
                      <Skeleton
                        variant="rectangular"
                        sx={{ width: 88, height: 24, borderRadius: 999 }}
                      />
                    </JoyTableCell>
                    <JoyTableCell>
                      <Skeleton variant="text" sx={{ width: "58%" }} />
                    </JoyTableCell>
                    <JoyTableCell align="right">
                      <Skeleton variant="text" sx={{ width: 40, ml: "auto" }} />
                    </JoyTableCell>
                    <JoyTableCell align="right">
                      <Skeleton variant="text" sx={{ width: 44, ml: "auto" }} />
                    </JoyTableCell>
                  </JoyTableRow>
                ))}
              </JoyTableBody>
            </JoyTable>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
}

function BloomAdminDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const {
    tenant,
    loading: tenantLoading,
    requiresTenantSelection,
  } = useTenant();
  const tenantId = tenant?.id ?? null;
  const [period, setPeriod] =
    React.useState<BloomAdminAnalyticsPeriodPreset>("this_month");
  const [auditEventFilter, setAuditEventFilter] =
    React.useState<AuditEventFilterValue>("");
  const [auditUserFilter, setAuditUserFilter] = React.useState("");
  const [auditToolSearchDraft, setAuditToolSearchDraft] = React.useState("");
  const [auditDateRange, setAuditDateRange] =
    React.useState<AuditDateRangePreset>("last_7_days");
  const [auditSortDirection, setAuditSortDirection] =
    React.useState<AuditSortDirection>("desc");
  const [expandedAuditRowId, setExpandedAuditRowId] = React.useState<
    string | null
  >(null);
  const [auditPage, setAuditPage] = React.useState(1);
  const deferredAuditToolSearch = React.useDeferredValue(auditToolSearchDraft);
  const previousPeriod = React.useMemo(
    () => resolveComparisonPeriod(period),
    [period],
  );
  const auditDateRangeFilter = React.useMemo(
    () => resolveAuditDateRange(auditDateRange),
    [auditDateRange],
  );
  const auditServerEventFilter =
    React.useMemo<BloomAuditEventType | null>(() => {
      if (auditEventFilter === "") {
        return null;
      }

      return auditEventFilter;
    }, [auditEventFilter]);

  const overviewQuery = useBloomUsageOverview(tenantId, period);
  const previousOverviewQuery = useBloomUsageOverview(
    tenantId,
    previousPeriod as BloomAdminAnalyticsPeriod,
  );
  const dailyVolumeQuery = useBloomDailyVolume(tenantId);
  const modelDistributionQuery = useBloomModelDistribution(tenantId, period);
  const toolUsageQuery = useBloomToolUsage(tenantId, period);
  const auditQuery = useBloomAuditLog(tenantId, {
    event_type: auditServerEventFilter,
    user_id: auditUserFilter || null,
    tool_name: deferredAuditToolSearch.trim() || null,
    date_range: auditDateRangeFilter,
  });

  const auditNeedsAllPages = auditSortDirection === "asc";

  React.useEffect(() => {
    if (!tenantId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: ["bloom-admin-daily-volume", tenantId],
    });
  }, [period, queryClient, tenantId]);

  React.useEffect(() => {
    setAuditPage(1);
    setExpandedAuditRowId(null);
  }, [
    auditEventFilter,
    auditUserFilter,
    auditDateRange,
    deferredAuditToolSearch,
    auditSortDirection,
  ]);

  React.useEffect(() => {
    if (
      !auditNeedsAllPages ||
      auditQuery.isLoading ||
      auditQuery.isFetchingNextPage ||
      !auditQuery.hasNextPage
    ) {
      return;
    }

    void auditQuery.fetchNextPage();
  }, [
    auditNeedsAllPages,
    auditQuery.fetchNextPage,
    auditQuery.hasNextPage,
    auditQuery.isFetchingNextPage,
    auditQuery.isLoading,
  ]);

  const sortedAuditEntries = React.useMemo(() => {
    const entries = [...auditQuery.data];
    const multiplier = auditSortDirection === "asc" ? 1 : -1;

    entries.sort((left, right) => {
      const leftTime = new Date(left.timestamp).getTime();
      const rightTime = new Date(right.timestamp).getTime();
      return (leftTime - rightTime) * multiplier;
    });

    return entries;
  }, [auditQuery.data, auditSortDirection]);

  const auditTotalCount = auditNeedsAllPages
    ? sortedAuditEntries.length
    : auditQuery.totalCount;
  const auditPageCount = Math.max(
    1,
    Math.ceil(auditTotalCount / AUDIT_PAGE_SIZE),
  );
  const auditRows = sortedAuditEntries.slice(
    (auditPage - 1) * AUDIT_PAGE_SIZE,
    auditPage * AUDIT_PAGE_SIZE,
  );
  const auditUserOptions = React.useMemo(
    () =>
      Array.from(
        new Map(
          auditQuery.data.map((entry) => [
            entry.user_id,
            entry.user_display_name,
          ]),
        ).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [auditQuery.data],
  );

  React.useEffect(() => {
    if (auditPage > auditPageCount) {
      setAuditPage(auditPageCount);
    }
  }, [auditPage, auditPageCount]);

  const handleAuditNextPage = React.useCallback(() => {
    if (auditPage >= auditPageCount) {
      return;
    }

    const loadedPageCount = Math.max(
      1,
      Math.ceil(sortedAuditEntries.length / AUDIT_PAGE_SIZE),
    );
    const nextPage = auditPage + 1;

    if (nextPage <= loadedPageCount) {
      setAuditPage(nextPage);
      return;
    }

    if (auditQuery.hasNextPage) {
      void auditQuery.fetchNextPage().then(() => {
        setAuditPage(nextPage);
      });
    }
  }, [auditPage, auditPageCount, auditQuery, sortedAuditEntries.length]);

  const handleAuditPreviousPage = React.useCallback(() => {
    setAuditPage((current) => Math.max(1, current - 1));
  }, []);

  if (!user) {
    return <Navigate to="/bloom" replace />;
  }

  if (isAdminLoading || tenantLoading) {
    return <BloomAdminDashboardSkeleton />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/bloom" replace />;
  }

  if (requiresTenantSelection || !tenantId) {
    return (
      <PageContainer
        fullWidth
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}
      >
        <JoyCard variant="outlined">
          <JoyCardHeader
            title="Bloom Admin Dashboard"
            description="Select a tenant from the master admin context to inspect Bloom analytics."
            titleProps={{ level: "title-sm" }}
          />
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.6}>
            <Typography level="h1">Bloom Admin Dashboard</Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.500", maxWidth: 680 }}
            >
              Track Bloom usage, tool performance, and audit activity for the
              active tenant.
            </Typography>
          </Stack>
          <JoySelect
            label="Period"
            value={period}
            onValueChange={(value) => {
              if (!value) {
                return;
              }

              setPeriod(value as BloomAdminAnalyticsPeriodPreset);
            }}
            options={ADMIN_PERIOD_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            sx={{ minWidth: 180 }}
          />
        </Stack>

        <BloomAdminStatCards
          overview={overviewQuery.data}
          comparisonOverview={previousOverviewQuery.data}
          isLoading={overviewQuery.isLoading || previousOverviewQuery.isLoading}
        />

        <BloomAdminDailyChart
          data={dailyVolumeQuery.data}
          isLoading={dailyVolumeQuery.isLoading}
          error={dailyVolumeQuery.error}
        />

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "repeat(1, minmax(0, 1fr))",
              xl: "minmax(0, 1fr) minmax(0, 1fr)",
            },
          }}
        >
          <BloomAdminModelChart
            data={modelDistributionQuery.data}
            isLoading={modelDistributionQuery.isLoading}
            error={modelDistributionQuery.error}
          />
          <BloomAdminToolTable
            data={toolUsageQuery.data}
            isLoading={toolUsageQuery.isLoading}
            error={toolUsageQuery.error}
          />
        </Box>

        <BloomAdminAuditTable
          eventFilter={auditEventFilter}
          userFilter={auditUserFilter}
          userOptions={auditUserOptions}
          toolSearch={auditToolSearchDraft}
          dateRange={auditDateRange}
          sortDirection={auditSortDirection}
          expandedId={expandedAuditRowId}
          rows={auditRows}
          totalCount={auditTotalCount}
          currentPage={auditPage}
          pageCount={auditPageCount}
          isLoading={auditQuery.isLoading}
          isLoadingAllPages={auditNeedsAllPages && auditQuery.hasNextPage}
          isFetchingNextPage={auditQuery.isFetchingNextPage}
          hasNextPage={auditQuery.hasNextPage ?? false}
          error={auditQuery.error}
          onEventFilterChange={setAuditEventFilter}
          onUserFilterChange={setAuditUserFilter}
          onToolSearchChange={setAuditToolSearchDraft}
          onDateRangeChange={setAuditDateRange}
          onSortDirectionToggle={() => {
            setAuditSortDirection((current) =>
              current === "desc" ? "asc" : "desc",
            );
          }}
          onToggleExpanded={(id) => {
            setExpandedAuditRowId((current) => (current === id ? null : id));
          }}
          onPreviousPage={handleAuditPreviousPage}
          onNextPage={handleAuditNextPage}
        />

        <BloomAdminRateLimitsCard />
      </Stack>
    </PageContainer>
  );
}

export default function BloomAdminDashboardPage() {
  return <BloomAdminDashboard />;
}
