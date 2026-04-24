import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Globe2,
  MousePointerClick,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { useFormAnalytics } from "@/hooks/useForms";
import type { FormAnalyticsTrend } from "@/types/formBuilder";

const ANALYTICS_RANGE_PRESETS = [
  { days: 7, shortLabel: "7D", label: "Last 7 days" },
  { days: 30, shortLabel: "30D", label: "Last 30 days" },
  { days: 90, shortLabel: "90D", label: "Last 90 days" },
  { days: 365, shortLabel: "12M", label: "Last 12 months" },
  { days: 0, shortLabel: "All", label: "All time" },
] as const;

const REJECTION_SLICE_COLORS: Record<string, string> = {
  invalid: "#ef4444",
  rate_limited: "#f59e0b",
  spam: "#0f172a",
};

interface FormAnalyticsTabProps {
  formId: string;
  tenantId?: string;
  isPublished?: boolean;
  onOpenShare?: () => void;
}

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

function TrendPill({ trend }: { trend: FormAnalyticsTrend | null }) {
  if (!trend || !trend.hasTrend || trend.changePercentage === null) {
    return (
      <JoyChip size="sm" variant="soft" color="neutral">
        No trend yet
      </JoyChip>
    );
  }

  const isPositive = trend.sentiment === "positive";
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <JoyChip
      size="sm"
      variant="soft"
      color={isPositive ? "success" : "danger"}
      startDecorator={<Icon size={14} />}
    >
      {Math.abs(trend.changePercentage).toFixed(1)}%
    </JoyChip>
  );
}

function MetricCard({
  icon,
  title,
  value,
  supportingText,
  trend,
  tone = "neutral",
  placeholder = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  supportingText: string;
  trend: FormAnalyticsTrend | null;
  tone?: "neutral" | "success" | "danger" | "primary";
  placeholder?: boolean;
}) {
  return (
    <JoyCard>
      <JoyCardHeader
        startDecorator={
          <Avatar
            size="sm"
            variant="soft"
            color={tone === "neutral" ? "neutral" : tone}
          >
            {icon}
          </Avatar>
        }
        title={title}
        actions={
          placeholder ? (
            <JoyChip size="sm" variant="outlined" color="warning">
              Coming soon
            </JoyChip>
          ) : (
            <TrendPill trend={trend} />
          )
        }
      />
      <JoyCardContent sx={{ pt: 3, gap: 1 }}>
        <Typography level="h2" sx={{ fontSize: "2rem" }}>
          {value}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {supportingText}
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

function AnalyticsSkeleton() {
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1}>
        {ANALYTICS_RANGE_PRESETS.map((preset) => (
          <Skeleton
            key={preset.days}
            variant="rectangular"
            width={64}
            height={36}
            animation="wave"
          />
        ))}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={156}
            animation="wave"
            sx={{ borderRadius: "lg" }}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.7fr) minmax(320px, 0.8fr)",
          },
          gap: 2,
        }}
      >
        <Skeleton
          variant="rectangular"
          height={380}
          animation="wave"
          sx={{ borderRadius: "lg" }}
        />
        <Skeleton
          variant="rectangular"
          height={380}
          animation="wave"
          sx={{ borderRadius: "lg" }}
        />
      </Box>
    </Stack>
  );
}

export function FormAnalyticsTab({
  formId,
  tenantId,
  isPublished = false,
  onOpenShare,
}: FormAnalyticsTabProps) {
  const [selectedRangeDays, setSelectedRangeDays] = React.useState(30);
  const {
    data: analytics,
    isLoading,
    error,
  } = useFormAnalytics(formId, tenantId, selectedRangeDays);

  const selectedRange = React.useMemo(
    () =>
      ANALYTICS_RANGE_PRESETS.find(
        (preset) => preset.days === selectedRangeDays,
      ) ?? ANALYTICS_RANGE_PRESETS[1],
    [selectedRangeDays],
  );

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <JoyCard>
        <JoyCardContent
          sx={{ pt: 5, gap: 1.5, alignItems: "center", textAlign: "center" }}
        >
          <Avatar size="lg" variant="soft" color="danger">
            <AlertTriangle size={24} />
          </Avatar>
          <Typography level="title-md">Unable to load analytics</Typography>
          <Typography level="body-sm" color="neutral">
            {error instanceof Error ? error.message : "Unknown error"}
          </Typography>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!analytics) {
    return null;
  }

  const current = analytics.summary.current;
  const rejectionSlices = analytics.rejectionBreakdown.slices.filter(
    (slice) => slice.count > 0,
  );
  const hasCurrentSubmissions = current.totalSubmissions > 0;

  if (!hasCurrentSubmissions) {
    return (
      <JoyCard>
        <JoyCardContent
          sx={{ pt: 5, gap: 2, alignItems: "center", textAlign: "center" }}
        >
          <Avatar size="lg" variant="soft" color="neutral">
            <BarChart3 size={24} />
          </Avatar>
          <Typography level="title-md">
            {isPublished
              ? "No submission data yet"
              : "Publish to start collecting analytics"}
          </Typography>
          <Typography level="body-sm" color="neutral" sx={{ maxWidth: 480 }}>
            {isPublished
              ? "This form is live, but there are no accepted or rejected submissions in the selected range yet."
              : "Analytics populate after the form is published and starts receiving traffic and submissions."}
          </Typography>
          {onOpenShare ? (
            <Button
              variant="solid"
              color="primary"
              startDecorator={<ExternalLink size={16} />}
              onClick={onOpenShare}
            >
              Open publish tools
            </Button>
          ) : null}
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.75}>
          <Typography level="h3">Analytics</Typography>
          <Typography level="body-sm" color="neutral">
            Server-computed performance for {selectedRange.label.toLowerCase()}.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <JoyChip size="sm" variant="soft" color="neutral">
              {analytics.range.isAllTime
                ? "All-time view"
                : analytics.range.comparisonLabel ||
                  "Compared with the previous equivalent period"}
            </JoyChip>
            {analytics.lastSubmission ? (
              <JoyChip size="sm" variant="soft" color="neutral">
                Latest submission{" "}
                {formatDistanceToNow(new Date(analytics.lastSubmission), {
                  addSuffix: true,
                })}
              </JoyChip>
            ) : null}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {ANALYTICS_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              size="sm"
              variant={preset.days === selectedRangeDays ? "solid" : "plain"}
              color={preset.days === selectedRangeDays ? "primary" : "neutral"}
              onClick={() => setSelectedRangeDays(preset.days)}
            >
              {preset.shortLabel}
            </Button>
          ))}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <MetricCard
          icon={<BarChart3 size={18} />}
          title="Total submissions"
          value={formatCompactNumber(
            analytics.summary.metrics.totalSubmissions.value,
          )}
          supportingText={`${formatInteger(current.acceptedSubmissions)} accepted and ${formatInteger(current.rejectedSubmissions)} rejected`}
          trend={analytics.summary.metrics.totalSubmissions.trend}
        />
        <MetricCard
          icon={<CheckCircle2 size={18} />}
          title="Accepted"
          value={formatCompactNumber(
            analytics.summary.metrics.acceptedSubmissions.value,
          )}
          supportingText={`${formatPercent(current.acceptanceRate)} acceptance rate`}
          trend={analytics.summary.metrics.acceptedSubmissions.trend}
          tone="success"
        />
        <MetricCard
          icon={<ShieldAlert size={18} />}
          title="Rejected"
          value={formatCompactNumber(
            analytics.summary.metrics.rejectedSubmissions.value,
          )}
          supportingText={`${formatInteger(current.invalidSubmissions)} invalid, ${formatInteger(current.rateLimitedSubmissions)} rate limited, ${formatInteger(current.spamSubmissions)} spam`}
          trend={analytics.summary.metrics.rejectedSubmissions.trend}
          tone="danger"
        />
        <MetricCard
          icon={<MousePointerClick size={18} />}
          title="Conversion tracking"
          value={
            analytics.conversion.available
              ? formatPercent(analytics.conversion.rate)
              : "Coming soon"
          }
          supportingText={
            analytics.conversion.available
              ? `${formatInteger(analytics.conversion.accepted)} accepted from ${formatInteger(analytics.conversion.views)} tracked views`
              : analytics.conversion.note ||
                "View-based conversion tracking is not connected for this form yet."
          }
          trend={
            analytics.conversion.available ? analytics.conversion.trend : null
          }
          tone="primary"
          placeholder={!analytics.conversion.available}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.7fr) minmax(320px, 0.8fr)",
          },
          gap: 2,
        }}
      >
        <JoyCard>
          <JoyCardHeader
            title="Submission volume"
            description="Accepted and rejected responses over the selected period."
          />
          <JoyCardContent sx={{ pt: 2 }}>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.daily}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="acceptedGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop
                        offset="100%"
                        stopColor="#16a34a"
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                    <linearGradient
                      id="rejectedGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#f97316"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="#f97316"
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(15, 23, 42, 0.08)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(label) =>
                      format(
                        new Date(`${label}T00:00:00`),
                        selectedRangeDays <= 31 ? "MMM d" : "MMM",
                      )
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
                    }}
                    labelFormatter={(label) =>
                      format(new Date(`${label}T00:00:00`), "PPP")
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="accepted"
                    stroke="#16a34a"
                    fill="url(#acceptedGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rejected"
                    stroke="#f97316"
                    fill="url(#rejectedGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Rejection breakdown"
            description="Why submissions were rejected in the selected range."
          />
          <JoyCardContent sx={{ pt: 2, gap: 2 }}>
            {rejectionSlices.length > 0 ? (
              <>
                <Box sx={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={rejectionSlices}
                        dataKey="count"
                        innerRadius={56}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {rejectionSlices.map((slice) => (
                          <Cell
                            key={slice.key}
                            fill={
                              REJECTION_SLICE_COLORS[slice.key] || "#64748b"
                            }
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatInteger(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Stack spacing={1}>
                  {rejectionSlices.map((slice) => (
                    <Sheet
                      key={slice.key}
                      variant="soft"
                      sx={{
                        borderRadius: "lg",
                        px: 1.5,
                        py: 1.25,
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                        alignItems="center"
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              backgroundColor:
                                REJECTION_SLICE_COLORS[slice.key] || "#64748b",
                            }}
                          />
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {slice.label}
                          </Typography>
                        </Stack>
                        <Typography level="body-sm" color="neutral">
                          {formatInteger(slice.count)} (
                          {formatPercent(slice.percentage)})
                        </Typography>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </>
            ) : (
              <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
                <Typography level="body-sm" color="neutral">
                  No rejected submissions in this range.
                </Typography>
              </Sheet>
            )}
          </JoyCardContent>
        </JoyCard>
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
        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="neutral">
                <Globe2 size={18} />
              </Avatar>
            }
            title="Top referrers"
            description="Where recent form traffic and submissions came from."
          />
          <JoyCardContent sx={{ pt: 2, gap: 1.25 }}>
            {analytics.topReferrers.length > 0 ? (
              analytics.topReferrers.slice(0, 6).map((referrer) => (
                <Sheet
                  key={`${referrer.rank}-${referrer.displayDomain}`}
                  variant="soft"
                  sx={{ borderRadius: "lg", px: 1.5, py: 1.25 }}
                >
                  <Stack spacing={0.75}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={2}
                      alignItems="center"
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {referrer.displayDomain}
                      </Typography>
                      <Typography level="body-sm" color="neutral">
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
                          width: `${Math.max(referrer.barPercentage, 6)}%`,
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor: "primary.500",
                        }}
                      />
                    </Box>
                    <Typography level="body-xs" color="neutral">
                      {referrer.sourceLabel} •{" "}
                      {formatPercent(referrer.sharePercentage)} share
                    </Typography>
                  </Stack>
                </Sheet>
              ))
            ) : (
              <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
                <Typography level="body-sm" color="neutral">
                  Referrer data will appear once the form receives traffic with
                  attribution context.
                </Typography>
              </Sheet>
            )}
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Field completion"
            description="How often individual fields are filled when a submission is recorded."
          />
          <JoyCardContent sx={{ pt: 2, gap: 1.25 }}>
            {analytics.fieldFillRates.length > 0 ? (
              analytics.fieldFillRates.slice(0, 8).map((field) => (
                <Stack key={field.fieldId} spacing={0.75}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    alignItems="center"
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {field.label}
                      </Typography>
                      {field.required ? (
                        <JoyChip size="sm" variant="soft" color="warning">
                          Required
                        </JoyChip>
                      ) : null}
                    </Stack>
                    <Typography level="body-sm" color="neutral">
                      {formatPercent(field.fillRate)}
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
                        width: `${Math.max(field.fillRate, 4)}%`,
                        height: "100%",
                        borderRadius: 999,
                        backgroundColor: "success.500",
                      }}
                    />
                  </Box>
                  <Typography level="body-xs" color="neutral">
                    {formatInteger(field.filledCount)} of{" "}
                    {formatInteger(field.totalSubmissions)} submissions included
                    this field.
                  </Typography>
                </Stack>
              ))
            ) : (
              <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
                <Typography level="body-sm" color="neutral">
                  Field completion rates appear after the form has enough
                  submission volume to compare usage.
                </Typography>
              </Sheet>
            )}
          </JoyCardContent>
        </JoyCard>
      </Box>
    </Stack>
  );
}
