import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { JoyChip } from "@/components/joy/JoyChip";
import { useFormAnalytics } from "@/hooks/useForms";
import type {
  FormAnalyticsDailyPoint,
  FormAnalyticsReferrer,
  FormAnalyticsTrend,
  FormAnalyticsTrendSentiment,
} from "@/types/formBuilder";

const ANALYTICS_RANGE_PRESETS = [
  { days: 7, shortLabel: "7 days", label: "Last 7 days" },
  { days: 30, shortLabel: "30 days", label: "Last 30 days" },
  { days: 90, shortLabel: "90 days", label: "Last 90 days" },
  { days: 0, shortLabel: "All time", label: "All time" },
] as const;

const CHART_HEIGHT = 320;

interface FormAnalyticsTabProps {
  formId: string;
  tenantId?: string;
  isPublished?: boolean;
  onOpenShare?: () => void;
}

type RateTrend = {
  color: "success" | "danger" | "neutral";
  label: string;
  icon?: React.ReactNode;
};

function formatCompactNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatInteger(value: number | null) {
  if (value === null) {
    return "0";
  }

  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "No trend";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function buildRateTrend(
  currentValue: number,
  previousValue: number | null | undefined,
  positiveDirection: "up" | "down",
): RateTrend {
  if (previousValue === null || previousValue === undefined) {
    return {
      color: "neutral",
      label: "No trend yet",
    };
  }

  const delta = currentValue - previousValue;
  if (Math.abs(delta) < 0.05) {
    return {
      color: "neutral",
      label: "Flat",
    };
  }

  const changePercentage =
    previousValue === 0
      ? currentValue === 0
        ? 0
        : 100
      : Math.abs((delta / previousValue) * 100);
  const isPositive = positiveDirection === "up" ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;

  return {
    color: isPositive ? "success" : "danger",
    label: formatSignedPercent(changePercentage),
    icon: <Icon size={14} />,
  };
}

function getTrendTone(trend: FormAnalyticsTrend | null | undefined) {
  if (!trend || !trend.hasTrend || trend.changePercentage === null) {
    return {
      color: "neutral" as const,
      label: "No trend yet",
      icon: undefined,
    };
  }

  const isPositive = trend.sentiment === "positive";
  const Icon = trend.direction === "down" ? TrendingDown : TrendingUp;

  return {
    color:
      trend.sentiment === "neutral"
        ? ("neutral" as const)
        : isPositive
          ? ("success" as const)
          : ("danger" as const),
    label: formatSignedPercent(trend.changePercentage),
    icon:
      trend.sentiment === "neutral" ? undefined : <Icon size={14} />, 
  };
}

function MetricTile(props: {
  label: string;
  value: string;
  periodLabel: string;
  detail: string;
  trend: RateTrend | ReturnType<typeof getTrendTone>;
  tooltip?: string;
}) {
  return (
    <Stack
      spacing={0.9}
      sx={{
        flex: 1,
        minWidth: { xs: "100%", md: 0 },
        px: { xs: 0, md: 2.5 },
        py: 0.35,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap>
        <Typography level="body-xs" color="neutral">
          {props.label}
        </Typography>
        {props.tooltip ? (
          <Tooltip title={props.tooltip} placement="top">
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                color: "neutral.500",
              }}
            >
              <Info size={12} />
            </Box>
          </Tooltip>
        ) : null}
      </Stack>
      <Typography level="h3" sx={{ fontSize: { xs: "1.7rem", md: "1.9rem" } }}>
        {props.value}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Chip
          size="sm"
          variant="soft"
          color={props.trend.color}
          startDecorator={props.trend.icon}
        >
          {props.trend.label}
        </Chip>
        <Typography level="body-xs" color="neutral">
          {props.periodLabel}
        </Typography>
      </Stack>
      <Typography level="body-sm" color="neutral">
        {props.detail}
      </Typography>
    </Stack>
  );
}

function SectionShell(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "24px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: { xs: 2, md: 2.5 },
        minHeight: props.minHeight,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.35}>
            <Typography level="title-md">{props.title}</Typography>
            {props.description ? (
              <Typography level="body-sm" color="neutral">
                {props.description}
              </Typography>
            ) : null}
          </Stack>
          {props.actions}
        </Stack>
        {props.children}
      </Stack>
    </Sheet>
  );
}

function AnalyticsSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Stack spacing={0.75}>
          <Skeleton variant="text" width={200} height={28} animation="wave" />
          <Skeleton variant="text" width={280} height={18} animation="wave" />
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {ANALYTICS_RANGE_PRESETS.map((preset) => (
            <Skeleton
              key={preset.days}
              variant="rectangular"
              width={92}
              height={36}
              animation="wave"
              sx={{ borderRadius: 999 }}
            />
          ))}
          <Skeleton
            variant="circular"
            width={36}
            height={36}
            animation="wave"
          />
        </Stack>
      </Stack>

      <Skeleton
        variant="rectangular"
        height={168}
        animation="wave"
        sx={{ borderRadius: "28px" }}
      />
      <Skeleton
        variant="rectangular"
        height={94}
        animation="wave"
        sx={{ borderRadius: "22px" }}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
          },
          gap: 2,
        }}
      >
        <Skeleton
          variant="rectangular"
          height={430}
          animation="wave"
          sx={{ borderRadius: "24px" }}
        />
        <Skeleton
          variant="rectangular"
          height={430}
          animation="wave"
          sx={{ borderRadius: "24px" }}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1fr) minmax(0, 1fr)",
          },
          gap: 2,
        }}
      >
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <Sheet
            key={sectionIndex}
            variant="outlined"
            sx={{
              borderRadius: "24px",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              p: { xs: 2, md: 2.5 },
            }}
          >
            <Stack spacing={1.5}>
              <Skeleton variant="text" width={180} height={24} animation="wave" />
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <Skeleton
                  key={rowIndex}
                  variant="rectangular"
                  height={56}
                  animation="wave"
                  sx={{ borderRadius: "18px" }}
                />
              ))}
            </Stack>
          </Sheet>
        ))}
      </Box>
    </Stack>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "18px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-md)",
        p: 1.5,
      }}
    >
      <Stack spacing={0.75}>
        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
          {format(new Date(`${label}T00:00:00`), "PPP")}
        </Typography>
        {payload.map((entry) => (
          <Stack
            key={entry.name}
            direction="row"
            spacing={1}
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: entry.color || "neutral.400",
                }}
              />
              <Typography level="body-sm">{entry.name}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
              {formatInteger(entry.value ?? 0)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Sheet>
  );
}

function ReferrerRow({ referrer }: { referrer: FormAnalyticsReferrer }) {
  return (
    <Sheet variant="soft" sx={{ borderRadius: "18px", px: 1.5, py: 1.35 }}>
      <Stack spacing={0.9}>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack spacing={0.2} sx={{ minWidth: 0 }}>
            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
              {referrer.displayDomain}
            </Typography>
            <Tooltip title={referrer.sourceLabel} placement="top-start">
              <Typography level="body-xs" color="neutral" noWrap>
                {referrer.sourceLabel}
              </Typography>
            </Tooltip>
          </Stack>
          <Typography level="body-sm" sx={{ fontWeight: 700 }}>
            {formatInteger(referrer.count)}
          </Typography>
        </Stack>
        <Box
          sx={{
            height: 8,
            borderRadius: 999,
            backgroundColor: "neutral.100",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.max(referrer.barPercentage, 4)}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: "primary.500",
            }}
          />
        </Box>
        <Typography level="body-xs" color="neutral">
          {formatPercent(referrer.sharePercentage)} of submissions in this period
        </Typography>
      </Stack>
    </Sheet>
  );
}

export function FormAnalyticsTab({
  formId,
  tenantId,
  isPublished = false,
  onOpenShare,
}: FormAnalyticsTabProps) {
  const [selectedRangeDays, setSelectedRangeDays] = React.useState(30);
  const [showAllReferrers, setShowAllReferrers] = React.useState(false);
  const {
    data: analytics,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useFormAnalytics(formId, tenantId, selectedRangeDays);

  const selectedRange = React.useMemo(
    () =>
      ANALYTICS_RANGE_PRESETS.find(
        (preset) => preset.days === selectedRangeDays,
      ) ?? ANALYTICS_RANGE_PRESETS[1],
    [selectedRangeDays],
  );

  const sortedFieldFillRates = React.useMemo(
    () =>
      [...(analytics?.fieldFillRates ?? [])].sort((left, right) => {
        if (left.fillRate !== right.fillRate) {
          return left.fillRate - right.fillRate;
        }

        return left.fieldOrder - right.fieldOrder;
      }),
    [analytics?.fieldFillRates],
  );

  const visibleReferrers = React.useMemo(() => {
    const referrers = analytics?.topReferrers ?? [];
    if (showAllReferrers) {
      return referrers;
    }

    return referrers.slice(0, 5);
  }, [analytics?.topReferrers, showAllReferrers]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <SectionShell title="Analytics" description="Unable to load form analytics right now.">
        <Sheet
          variant="soft"
          color="danger"
          sx={{ borderRadius: "20px", p: 2.25 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AlertTriangle size={18} />
            <Typography level="body-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </Typography>
          </Stack>
        </Sheet>
      </SectionShell>
    );
  }

  if (!analytics) {
    return null;
  }

  const current = analytics.summary.current;
  const previous = analytics.summary.previous;
  const hasAnalyticsData = current.totalSubmissions > 0;
  const totalTrend = getTrendTone(analytics.summary.metrics.totalSubmissions.trend);
  const acceptanceTrend = buildRateTrend(
    current.acceptanceRate,
    previous?.acceptanceRate,
    "up",
  );
  const rejectionTrend = buildRateTrend(
    current.rejectionRate,
    previous?.rejectionRate,
    "down",
  );
  const conversionTrend = analytics.conversion.available
    ? getTrendTone(analytics.conversion.trend)
    : {
        color: "neutral" as const,
        label: "Tracking needed",
        icon: undefined,
      };
  const lastUpdatedText = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
    : "just now";
  const referrerHasMore = (analytics.topReferrers?.length ?? 0) > 5;

  if (!hasAnalyticsData) {
    return (
      <Stack
        spacing={1.5}
        sx={{
          minHeight: 420,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: 3,
        }}
      >
        <Typography level="title-md">No analytics data yet</Typography>
        <Typography level="body-sm" color="neutral" sx={{ maxWidth: 460 }}>
          Once your form receives submissions, analytics will appear here.
        </Typography>
        {onOpenShare ? (
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<ExternalLink size={15} />}
            onClick={onOpenShare}
          >
            Go to Publish tab
          </Button>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
      >
        <Stack spacing={0.5}>
          <Typography level="title-lg">Analytics overview</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Typography level="body-sm" color="neutral">
              Form health for {selectedRange.label.toLowerCase()}
            </Typography>
            {analytics.range.comparisonLabel ? (
              <JoyChip size="sm" variant="soft" color="neutral">
                {analytics.range.comparisonLabel}
              </JoyChip>
            ) : null}
            {analytics.lastSubmission ? (
              <JoyChip size="sm" variant="soft" color="neutral">
                Last submission {formatDistanceToNow(new Date(analytics.lastSubmission), { addSuffix: true })}
              </JoyChip>
            ) : null}
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Sheet
            variant="soft"
            sx={{
              borderRadius: 999,
              p: 0.5,
              display: "inline-flex",
              gap: 0.5,
              flexWrap: "wrap",
            }}
          >
            {ANALYTICS_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.days}
                size="sm"
                variant={preset.days === selectedRangeDays ? "solid" : "plain"}
                color={preset.days === selectedRangeDays ? "primary" : "neutral"}
                onClick={() => setSelectedRangeDays(preset.days)}
                sx={{ borderRadius: 999 }}
              >
                {preset.shortLabel}
              </Button>
            ))}
          </Sheet>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="body-xs" color="neutral">
              Updated {lastUpdatedText}
            </Typography>
            <Tooltip title="Refresh analytics" placement="top">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => void refetch()}
                disabled={isFetching}
                sx={{
                  "& svg": {
                    animation: isFetching ? "analyticsSpin 0.9s linear infinite" : "none",
                  },
                  "@keyframes analyticsSpin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Stack>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "28px",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          divider={
            <Divider
              orientation="vertical"
              sx={{ display: { xs: "none", md: "block" } }}
            />
          }
          sx={{ px: { xs: 2.25, md: 0 }, py: { xs: 2.25, md: 2.5 } }}
        >
          <MetricTile
            label="Total submissions"
            value={formatCompactNumber(current.totalSubmissions)}
            periodLabel={selectedRange.label}
            detail={`${formatInteger(current.acceptedSubmissions)} accepted and ${formatInteger(current.rejectedSubmissions)} rejected`}
            trend={totalTrend}
          />
          <MetricTile
            label="Acceptance rate"
            value={formatPercent(current.acceptanceRate)}
            periodLabel={selectedRange.label}
            detail={`${formatInteger(current.acceptedSubmissions)} accepted in this period`}
            trend={acceptanceTrend}
          />
          <MetricTile
            label="Rejection rate"
            value={formatPercent(current.rejectionRate)}
            periodLabel={selectedRange.label}
            detail={`${formatInteger(current.invalidSubmissions)} validation errors · ${formatInteger(current.rateLimitedSubmissions)} rate limited`}
            trend={rejectionTrend}
            tooltip={`${formatInteger(current.invalidSubmissions)} validation errors, ${formatInteger(current.rateLimitedSubmissions)} rate limited, ${formatInteger(current.spamSubmissions)} spam`}
          />
          <MetricTile
            label="Conversion rate"
            value={analytics.conversion.available ? formatPercent(analytics.conversion.rate) : "—"}
            periodLabel={selectedRange.label}
            detail={
              analytics.conversion.available
                ? `${formatInteger(analytics.conversion.accepted)} accepted from ${formatInteger(analytics.conversion.views)} tracked views`
                : analytics.conversion.note || "Requires embed tracking to calculate conversion rate."
            }
            trend={conversionTrend}
            tooltip={
              analytics.conversion.available
                ? undefined
                : "Conversion analytics requires embed view tracking."
            }
          />
        </Stack>
      </Sheet>

      {current.rejectedSubmissions > 0 ? (
        <Sheet
          variant="soft"
          color="warning"
          sx={{ borderRadius: "22px", p: { xs: 2, md: 2.25 } }}
        >
          <Stack spacing={1.25}>
            <Typography level="title-sm">Rejection breakdown</Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1.25,
              }}
            >
              <Sheet variant="plain" sx={{ p: 0 }}>
                <Typography level="body-xs" color="neutral">
                  Validation errors
                </Typography>
                <Typography level="title-lg">{formatInteger(current.invalidSubmissions)}</Typography>
                <Typography level="body-xs" color="neutral">
                  Field-level failure hotspots are not tracked in the current analytics contract.
                </Typography>
              </Sheet>
              <Sheet variant="plain" sx={{ p: 0 }}>
                <Typography level="body-xs" color="neutral">
                  Rate limited
                </Typography>
                <Typography level="title-lg">{formatInteger(current.rateLimitedSubmissions)}</Typography>
                <Typography level="body-xs" color="neutral">
                  Requests blocked by submission throttling.
                </Typography>
              </Sheet>
              <Sheet variant="plain" sx={{ p: 0 }}>
                <Typography level="body-xs" color="neutral">
                  Spam or honeypot
                </Typography>
                <Typography level="title-lg">{formatInteger(current.spamSubmissions)}</Typography>
                <Typography level="body-xs" color="neutral">
                  Submissions rejected by spam protection.
                </Typography>
              </Sheet>
            </Box>
          </Stack>
        </Sheet>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
          },
          gap: 2,
        }}
      >
        <SectionShell
          title="Submissions over time"
          description="Accepted and rejected submissions across the selected period."
          actions={
            <Typography level="body-xs" color="neutral">
              {selectedRange.label}
            </Typography>
          }
          minHeight={420}
        >
          <Box sx={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.daily}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="analyticsAcceptedGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--joy-palette-primary-500)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--joy-palette-primary-500)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(value) =>
                    format(
                      new Date(`${value}T00:00:00`),
                      analytics.range.isAllTime || selectedRangeDays > 30 ? "MMM d" : "MMM d",
                    )
                  }
                  minTickGap={28}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="accepted"
                  name="Accepted"
                  stroke="var(--joy-palette-primary-500)"
                  fill="url(#analyticsAcceptedGradient)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stroke="var(--joy-palette-neutral-500)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <JoyChip size="sm" variant="soft" color="primary">
              Accepted {formatInteger(current.acceptedSubmissions)}
            </JoyChip>
            <JoyChip size="sm" variant="soft" color="neutral">
              Rejected {formatInteger(current.rejectedSubmissions)}
            </JoyChip>
          </Stack>
        </SectionShell>

        <SectionShell
          title="Performance mix"
          description="Conversion status and outcome distribution for the same period."
          minHeight={420}
        >
          <Stack spacing={2.25}>
            <Sheet variant="soft" sx={{ borderRadius: "20px", p: 1.75 }}>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography level="body-xs" color="neutral">
                    Conversion tracking
                  </Typography>
                  <Chip size="sm" variant="soft" color={analytics.conversion.available ? "success" : "neutral"}>
                    {analytics.conversion.available ? "Tracked" : "Unavailable"}
                  </Chip>
                </Stack>
                <Typography level="h3">
                  {analytics.conversion.available ? formatPercent(analytics.conversion.rate) : "—"}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {analytics.conversion.available
                    ? `${formatInteger(analytics.conversion.accepted)} accepted from ${formatInteger(analytics.conversion.views)} tracked views`
                    : analytics.conversion.note ||
                      "Enable embed tracking to measure unique visitors and conversion rate."}
                </Typography>
              </Stack>
            </Sheet>

            <Stack spacing={1.25}>
              <Typography level="title-sm">Submission outcomes</Typography>
              {[
                {
                  key: "accepted",
                  label: "Accepted",
                  count: current.acceptedSubmissions,
                  total: current.totalSubmissions,
                  color: "primary" as const,
                },
                {
                  key: "invalid",
                  label: "Validation errors",
                  count: current.invalidSubmissions,
                  total: current.totalSubmissions,
                  color: "danger" as const,
                },
                {
                  key: "rate_limited",
                  label: "Rate limited",
                  count: current.rateLimitedSubmissions,
                  total: current.totalSubmissions,
                  color: "warning" as const,
                },
                {
                  key: "spam",
                  label: "Spam or honeypot",
                  count: current.spamSubmissions,
                  total: current.totalSubmissions,
                  color: "neutral" as const,
                },
              ].map((row) => {
                const progressValue =
                  row.total === 0 ? 0 : (row.count / row.total) * 100;

                return (
                  <Stack key={row.key} spacing={0.6}>
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {row.label}
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        {formatInteger(row.count)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={progressValue}
                      color={row.color}
                      thickness={8}
                      sx={{
                        "--LinearProgress-radius": "999px",
                        backgroundColor: "neutral.100",
                      }}
                    />
                    <Typography level="body-xs" color="neutral">
                      {formatPercent(progressValue)} of submissions in this period
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </SectionShell>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1fr) minmax(0, 1fr)",
          },
          gap: 2,
        }}
      >
        <SectionShell
          title="Top referrers"
          description="Top sources sending form traffic and attributed submissions."
          actions={
            referrerHasMore ? (
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setShowAllReferrers((current) => !current)}
              >
                {showAllReferrers ? "Show less" : "View all"}
              </Button>
            ) : undefined
          }
        >
          {visibleReferrers.length > 0 ? (
            <Stack spacing={1}>
              {visibleReferrers.map((referrer) => (
                <ReferrerRow
                  key={`${referrer.rank}-${referrer.displayDomain}-${referrer.sourceLabel}`}
                  referrer={referrer}
                />
              ))}
            </Stack>
          ) : (
            <Typography level="body-sm" color="neutral">
              Referrer data will appear once this form receives attributed traffic.
            </Typography>
          )}
        </SectionShell>

        <SectionShell
          title="Field fill rates"
          description="Fields with low fill rates may be confusing or unnecessary — consider simplifying."
        >
          {sortedFieldFillRates.length > 0 ? (
            <Stack spacing={1.15}>
              {sortedFieldFillRates.map((field) => (
                <Sheet
                  key={field.fieldId}
                  variant="soft"
                  sx={{ borderRadius: "18px", px: 1.5, py: 1.35 }}
                >
                  <Stack spacing={0.85}>
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                          {field.label}
                        </Typography>
                        {field.required ? (
                          <Chip size="sm" variant="soft" color="warning">
                            Required
                          </Chip>
                        ) : null}
                      </Stack>
                      <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                        {formatPercent(field.fillRate)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={field.fillRate}
                      color={field.fillRate < 50 ? "warning" : "success"}
                      thickness={8}
                      sx={{
                        "--LinearProgress-radius": "999px",
                        backgroundColor: "neutral.100",
                      }}
                    />
                    <Typography level="body-xs" color="neutral">
                      {formatInteger(field.filledCount)} / {formatInteger(field.totalSubmissions)} submissions filled this field
                    </Typography>
                  </Stack>
                </Sheet>
              ))}
            </Stack>
          ) : (
            <Typography level="body-sm" color="neutral">
              Field fill rates will appear once the form has enough submission volume to compare usage.
            </Typography>
          )}
        </SectionShell>
      </Box>
    </Stack>
  );
}