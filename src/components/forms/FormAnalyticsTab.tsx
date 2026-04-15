import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
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
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Globe2,
  Minus,
  MousePointerClick,
  Share2,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Skeleton } from "@/components/ui-legacy/skeleton";
import { useFormAnalytics } from "@/hooks/useForms";
import { cn } from "@/lib/utils";
import { FormAnalyticsTrend } from "@/types/formBuilder";

const ANALYTICS_RANGE_PRESETS = [
  { days: 7, shortLabel: "7D", label: "Last 7 days" },
  { days: 30, shortLabel: "30D", label: "Last 30 days" },
  { days: 90, shortLabel: "90D", label: "Last 90 days" },
  { days: 365, shortLabel: "12M", label: "Last 12 months" },
  { days: 0, shortLabel: "All", label: "All time" },
] as const;

const REJECTION_SLICE_COLORS: Record<string, string> = {
  invalid: "#EF4444",
  rate_limited: "#F59E0B",
  spam: "#8B5CF6",
};

interface FormAnalyticsTabProps {
  formId: string;
  tenantId?: string;
  isPublished?: boolean;
  onOpenShare?: () => void;
}

export function FormAnalyticsTab({
  formId,
  tenantId,
  isPublished = false,
  onOpenShare,
}: FormAnalyticsTabProps) {
  const [selectedRangeDays, setSelectedRangeDays] = useState(30);
  const {
    data: analytics,
    isLoading,
    error,
  } = useFormAnalytics(formId, tenantId, selectedRangeDays);

  const selectedRange = useMemo(
    () =>
      ANALYTICS_RANGE_PRESETS.find(
        (preset) => preset.days === selectedRangeDays,
      ) || ANALYTICS_RANGE_PRESETS[1],
    [selectedRangeDays],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {ANALYTICS_RANGE_PRESETS.map((preset) => (
            <Skeleton key={preset.days} className="h-9 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((value) => (
            <Skeleton key={value} className="h-40 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Skeleton className="h-[360px] rounded-2xl" />
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
        <Skeleton className="h-[360px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-muted-foreground">Failed to load analytics</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const current = analytics.summary.current;
  const hasCurrentSubmissions = current.totalSubmissions > 0;
  const rejectionSlices = analytics.rejectionBreakdown.slices.filter(
    (slice) => slice.count > 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Server-computed form performance for{" "}
            {selectedRange.label.toLowerCase()}.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {analytics.range.isAllTime
                ? "All-time view"
                : analytics.range.comparisonLabel ||
                  "Compared with the previous equivalent period"}
            </span>
            {analytics.lastSubmission && (
              <span>
                Latest response{" "}
                {formatDistanceToNow(new Date(analytics.lastSubmission), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ANALYTICS_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              type="button"
              size="sm"
              variant={
                preset.days === selectedRangeDays ? "default" : "outline"
              }
              onClick={() => setSelectedRangeDays(preset.days)}
              className="rounded-full px-4"
            >
              {preset.shortLabel}
            </Button>
          ))}
        </div>
      </div>

      {hasCurrentSubmissions ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={BarChart3}
              title="Total Submissions"
              value={formatCompactNumber(
                analytics.summary.metrics.totalSubmissions.value,
              )}
              supportingText={`${formatInteger(current.acceptedSubmissions)} accepted • ${formatInteger(current.rejectedSubmissions)} rejected`}
              trend={analytics.summary.metrics.totalSubmissions.trend}
              allTime={analytics.range.isAllTime}
            />
            <MetricCard
              icon={CheckCircle2}
              title="Accepted"
              value={formatCompactNumber(
                analytics.summary.metrics.acceptedSubmissions.value,
              )}
              supportingText={`${formatPercent(current.acceptanceRate)} acceptance rate`}
              trend={analytics.summary.metrics.acceptedSubmissions.trend}
              allTime={analytics.range.isAllTime}
              accentClassName="text-emerald-700"
            />
            <MetricCard
              icon={ShieldAlert}
              title="Rejected"
              value={formatCompactNumber(
                analytics.summary.metrics.rejectedSubmissions.value,
              )}
              supportingText={`${formatInteger(current.invalidSubmissions)} invalid • ${formatInteger(current.rateLimitedSubmissions)} rate limited • ${formatInteger(current.spamSubmissions)} spam`}
              trend={analytics.summary.metrics.rejectedSubmissions.trend}
              allTime={analytics.range.isAllTime}
              accentClassName="text-rose-700"
            />
            <MetricCard
              icon={MousePointerClick}
              title="Conversion Rate"
              value={
                analytics.conversion.available
                  ? formatPercent(analytics.conversion.rate)
                  : "Not available"
              }
              supportingText={
                analytics.conversion.available
                  ? `${formatInteger(analytics.conversion.accepted)} accepted from ${formatInteger(analytics.conversion.views)} tracked views`
                  : analytics.conversion.note ||
                    "Conversion tracking is not enabled."
              }
              trend={
                analytics.conversion.available
                  ? analytics.conversion.trend
                  : null
              }
              allTime={analytics.range.isAllTime}
              unavailable={!analytics.conversion.available}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle>Submissions Over Time</CardTitle>
                <CardDescription>
                  Accepted and rejected responses for the selected range.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[360px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.daily}
                    margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="acceptedGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#10B981"
                          stopOpacity={0.04}
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
                          stopColor="#F97316"
                          stopOpacity={0.24}
                        />
                        <stop
                          offset="100%"
                          stopColor="#F97316"
                          stopOpacity={0.04}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartDayLabel}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                      }}
                      formatter={(value: number, name: string) => [
                        formatInteger(value),
                        name === "accepted" ? "Accepted" : "Rejected",
                      ]}
                      labelFormatter={(label) =>
                        format(new Date(`${label}T00:00:00`), "PPP")
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="accepted"
                      name="accepted"
                      stroke="#10B981"
                      fill="url(#acceptedGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="rejected"
                      name="rejected"
                      stroke="#F97316"
                      fill="url(#rejectedGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Rejection Breakdown</CardTitle>
                <CardDescription>
                  Server-classified rejection causes for this range.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {analytics.rejectionBreakdown.totalRejections > 0 &&
                rejectionSlices.length > 0 ? (
                  <div className="space-y-5">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={rejectionSlices}
                            dataKey="count"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {rejectionSlices.map((slice) => (
                              <Cell
                                key={slice.key}
                                fill={
                                  REJECTION_SLICE_COLORS[slice.key] || "#94A3B8"
                                }
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "12px",
                            }}
                            formatter={(value: number, _name, details) => {
                              const payload = details?.payload as
                                | { percentage?: number; label?: string }
                                | undefined;

                              return [
                                `${formatInteger(value)} (${formatPercent(payload?.percentage ?? null)})`,
                                payload?.label || "Rejections",
                              ];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {rejectionSlices.map((slice) => (
                        <div
                          key={slice.key}
                          className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor:
                                  REJECTION_SLICE_COLORS[slice.key] ||
                                  "#94A3B8",
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {slice.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPercent(slice.percentage)} of rejected
                                submissions
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {formatInteger(slice.count)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <FriendlyEmptyState
                    icon={CheckCircle2}
                    title="No rejections in this period."
                    description="Every recorded submission in the selected range was accepted."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Top Referrers</CardTitle>
                <CardDescription>
                  Ranked by response volume for the current range.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {analytics.topReferrers.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topReferrers.map((referrer) => (
                      <div
                        key={`${referrer.rank}-${referrer.sourceLabel}`}
                        className="space-y-2"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                #{referrer.rank}
                              </span>
                              <p className="truncate text-sm font-medium text-foreground">
                                {referrer.displayDomain}
                              </p>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {referrer.sourceLabel}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {formatInteger(referrer.count)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPercent(referrer.sharePercentage)}
                            </p>
                          </div>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${referrer.barPercentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FriendlyEmptyState
                    icon={Globe2}
                    title="No referrer data yet"
                    description="Referrer and source metadata will appear here once submissions include attribution context."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Field Completion</CardTitle>
                <CardDescription>
                  Fill rate by visible field, ordered as the form is built.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {analytics.fieldFillRates.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.fieldFillRates.map((field) => (
                      <div key={field.fieldId} className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground">
                                {field.label}
                              </p>
                              {field.required && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  Required
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatInteger(field.filledCount)} of{" "}
                              {formatInteger(field.totalSubmissions)}{" "}
                              submissions provided a value
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {formatPercent(field.fillRate)}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {field.fieldType.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${field.fillRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FriendlyEmptyState
                    icon={BarChart3}
                    title="No field analytics yet"
                    description="Field completion rates will populate after the form records submissions for this range."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <EmptyAnalyticsState
          isPublished={isPublished}
          onOpenShare={onOpenShare}
          rangeLabel={selectedRange.label.toLowerCase()}
        />
      )}

      {analytics.lastSubmission && hasCurrentSubmissions ? (
        <p className="text-xs text-muted-foreground">
          Last recorded submission:{" "}
          {format(new Date(analytics.lastSubmission), "PPpp")}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  supportingText,
  trend,
  allTime,
  accentClassName,
  unavailable = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  supportingText: string;
  trend: FormAnalyticsTrend | null;
  allTime: boolean;
  accentClassName?: string;
  unavailable?: boolean;
}) {
  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span>{title}</span>
            </div>
            <div
              className={cn(
                "text-3xl font-semibold tracking-tight text-foreground",
                accentClassName,
              )}
            >
              {value}
            </div>
          </div>

          <TrendBadge
            trend={trend}
            allTime={allTime}
            unavailable={unavailable}
          />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {supportingText}
        </p>
      </CardContent>
    </Card>
  );
}

function TrendBadge({
  trend,
  allTime,
  unavailable,
}: {
  trend: FormAnalyticsTrend | null;
  allTime: boolean;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return <Badge variant="outline">Tracking off</Badge>;
  }

  if (!trend || !trend.hasTrend) {
    return <Badge variant="outline">{allTime ? "All time" : "No trend"}</Badge>;
  }

  const Icon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus;
  const badgeClassName =
    trend.sentiment === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : trend.sentiment === "negative"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge variant="outline" className={badgeClassName}>
      <Icon className="mr-1 h-3 w-3" />
      {formatPercent(Math.abs(trend.changePercentage ?? 0))}
    </Badge>
  );
}

function FriendlyEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function EmptyAnalyticsState({
  isPublished,
  onOpenShare,
  rangeLabel,
}: {
  isPublished: boolean;
  onOpenShare?: () => void;
  rangeLabel: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BarChart3 className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            No submissions in this range yet
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Analytics will appear here as soon as the form starts collecting
            responses for {rangeLabel}.
          </p>
          <p className="text-sm text-muted-foreground">
            {isPublished
              ? "Share the published form to start driving traffic and responses."
              : "Publish the form when you’re ready to start collecting responses."}
          </p>
        </div>

        {isPublished && onOpenShare ? (
          <Button onClick={onOpenShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatCompactNumber(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatInteger(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatChartDayLabel(day: string) {
  return format(new Date(`${day}T00:00:00`), "MMM d");
}
