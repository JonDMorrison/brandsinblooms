import { useMemo, useState } from "react";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PostPerformanceTracker } from "@/components/analytics/PostPerformanceTracker";
import {
  formatCompactNumber,
  formatPercent,
  formatRelativeTimestamp,
  getTrendMeta,
  normalizePlatformLabel,
} from "@/components/analytics/analyticsUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { supabase } from "@/integrations/supabase/client";

type SocialAnalyticsTabProps = {
  dateRange: number;
};

type SocialConnectionRecord = {
  id: string;
  platform: string;
  platform_account_name: string | null;
  updated_at: string;
};

type AnalyticsMetricRow = {
  connection_id: string;
  metric_type: string;
  metric_value: number;
  date_collected: string;
  social_connections: {
    platform: string;
    platform_account_name: string | null;
  };
};

type PlatformSummary = {
  accountCount: number;
  accountNames: string[];
  engagementRate: number | null;
  label: string;
  lastSyncedAt: string | null;
  metricLabel: string;
  metricValue: number;
  platform: string;
  trend: number | null;
};

type PlatformAccumulator = PlatformSummary & {
  engagementSamples: number;
  engagementTotal: number;
  previousMetricValue: number;
};

type SocialAnalyticsSummary = {
  hasMultiAccountPlatforms: string[];
  platformSummaries: PlatformSummary[];
  totalConnections: number;
};

const getPercentageDelta = (currentValue: number, previousValue: number) => {
  if (!previousValue) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

const metricPriority = [
  "reach",
  "impressions",
  "views",
  "search_queries",
  "calls",
];

const getMetricLabel = (metricType: string) => {
  switch (metricType) {
    case "search_queries":
      return "Search Queries";
    case "calls":
      return "Calls";
    default:
      return normalizePlatformLabel(metricType);
  }
};

export function SocialAnalyticsTab({ dateRange }: SocialAnalyticsTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const { data, error, isLoading, refetch } = useQuery<SocialAnalyticsSummary>({
    queryKey: ["analytics-social-summary", user?.id, dateRange],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return {
          hasMultiAccountPlatforms: [],
          platformSummaries: [],
          totalConnections: 0,
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const { data: connections, error: connectionsError } = await supabase
        .from("social_connections")
        .select("id, platform, platform_account_name, updated_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (connectionsError) {
        throw connectionsError;
      }

      const connectionRows = (connections ?? []) as SocialConnectionRecord[];

      if (!connectionRows.length) {
        return {
          hasMultiAccountPlatforms: [],
          platformSummaries: [],
          totalConnections: 0,
        };
      }

      const connectionIds = connectionRows.map((connection) => connection.id);
      const { data: analyticsRows, error: analyticsError } = await supabase
        .from("analytics_data")
        .select(
          `
          connection_id,
          metric_type,
          metric_value,
          date_collected,
          social_connections!inner(platform, platform_account_name)
        `,
        )
        .in("connection_id", connectionIds)
        .gte("date_collected", startDate.toISOString())
        .order("date_collected", { ascending: false });

      if (analyticsError) {
        throw analyticsError;
      }

      const metricsByConnection = new Map<
        string,
        Record<string, { current: number; previous: number | null }>
      >();

      for (const row of (analyticsRows ?? []) as AnalyticsMetricRow[]) {
        const connectionMetrics =
          metricsByConnection.get(row.connection_id) ?? {};
        const existing = connectionMetrics[row.metric_type];

        if (!existing) {
          connectionMetrics[row.metric_type] = {
            current: row.metric_value,
            previous: null,
          };
        } else if (existing.previous === null) {
          connectionMetrics[row.metric_type] = {
            ...existing,
            previous: row.metric_value,
          };
        }

        metricsByConnection.set(row.connection_id, connectionMetrics);
      }

      const platformMap = new Map<string, PlatformAccumulator>();

      for (const connection of connectionRows) {
        const metrics = metricsByConnection.get(connection.id) ?? {};
        const preferredMetricType =
          metricPriority.find((metricType) => metrics[metricType]) ??
          Object.keys(metrics)[0];

        const preferredMetric = preferredMetricType
          ? metrics[preferredMetricType]
          : null;
        const engagementMetric =
          metrics.engagement_rate ?? metrics.engagement ?? null;

        const existingSummary = platformMap.get(connection.platform) ?? {
          accountCount: 0,
          accountNames: [],
          engagementRate: null,
          engagementSamples: 0,
          engagementTotal: 0,
          label: normalizePlatformLabel(connection.platform),
          lastSyncedAt: connection.updated_at,
          metricLabel: preferredMetricType
            ? getMetricLabel(preferredMetricType)
            : "Activity",
          metricValue: 0,
          platform: connection.platform,
          previousMetricValue: 0,
          trend: null,
        };

        existingSummary.accountCount += 1;
        existingSummary.accountNames.push(
          connection.platform_account_name ?? existingSummary.label,
        );
        existingSummary.metricValue += preferredMetric?.current ?? 0;
        existingSummary.previousMetricValue += preferredMetric?.previous ?? 0;
        existingSummary.lastSyncedAt =
          !existingSummary.lastSyncedAt ||
          new Date(connection.updated_at).getTime() >
            new Date(existingSummary.lastSyncedAt).getTime()
            ? connection.updated_at
            : existingSummary.lastSyncedAt;

        if (engagementMetric?.current !== undefined) {
          existingSummary.engagementTotal += engagementMetric.current;
          existingSummary.engagementSamples += 1;
        }

        platformMap.set(connection.platform, existingSummary);
      }

      const platformSummaries = Array.from(platformMap.values()).map(
        ({
          engagementSamples,
          engagementTotal,
          previousMetricValue,
          ...summary
        }) => ({
          ...summary,
          accountNames: Array.from(new Set(summary.accountNames)),
          engagementRate:
            engagementSamples > 0 ? engagementTotal / engagementSamples : null,
          trend:
            previousMetricValue > 0 || summary.metricValue > 0
              ? getPercentageDelta(summary.metricValue, previousMetricValue)
              : null,
        }),
      );

      return {
        hasMultiAccountPlatforms: platformSummaries
          .filter((summary) => summary.accountCount > 1)
          .map((summary) => summary.label),
        platformSummaries,
        totalConnections: connectionRows.length,
      };
    },
  });

  const platformSummaries = data?.platformSummaries ?? [];

  const hasAnalyticsData = useMemo(
    () => platformSummaries.some((summary) => summary.metricValue > 0),
    [platformSummaries],
  );

  const handleSyncSocial = async () => {
    setSyncing(true);

    try {
      const { error } = await supabase.functions.invoke("sync-analytics");

      if (error) {
        throw error;
      }

      toast.success("Social analytics synced successfully");
      await refetch();
    } catch (error) {
      console.error("Failed to sync social analytics", error);
      toast.error("Failed to sync social analytics");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <Grid container spacing={1.5}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Grid key={index} xs={12} md={4}>
            <JoyCard variant="outlined" sx={{ p: 1.75 }}>
              <Stack spacing={1.25}>
                <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                  Loading card {index + 1}
                </Typography>
              </Stack>
            </JoyCard>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardContent sx={{ pt: 4 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load social performance.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="danger"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void refetch()}
            >
              Retry
            </JoyButton>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if ((data?.totalConnections ?? 0) === 0) {
    return (
      <JoyCard variant="soft" color="neutral">
        <JoyCardContent sx={{ pt: 4 }}>
          <JoyEmptyState
            icon={<Share2 />}
            title="Connect your social channels"
            description="Track platform reach, engagement, and post performance once Facebook, Instagram, or Google Business accounts are connected."
            primaryAction={{
              label: "Connect",
              onClick: () => navigate("/social-accounts"),
            }}
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!hasAnalyticsData) {
    return (
      <JoyCard variant="soft" color="neutral">
        <JoyCardContent sx={{ pt: 4 }}>
          <JoyEmptyState
            icon={<Share2 />}
            title="No synced social metrics yet"
            description="Connections are in place, but analytics haven’t been pulled yet. Run a sync to hydrate this view."
            primaryAction={{
              label: syncing ? "Syncing…" : "Sync Social Data",
              onClick: () => void handleSyncSocial(),
              disabled: syncing,
            }}
            secondaryAction={{
              label: "Manage Accounts",
              variant: "plain",
              color: "primary",
              onClick: () => navigate("/social-accounts"),
            }}
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack spacing={0.4}>
          <Typography level="title-md">Social Media</Typography>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Platform-level activity from connected social accounts.
          </Typography>
        </Stack>
        <JoyButton
          size="sm"
          variant="soft"
          color="neutral"
          startDecorator={<RefreshCw size={14} />}
          onClick={() => void handleSyncSocial()}
          loading={syncing}
        >
          Sync Social Data
        </JoyButton>
      </Stack>

      {data?.hasMultiAccountPlatforms.length ? (
        <Sheet
          variant="soft"
          color="warning"
          sx={{ borderRadius: "md", p: 1.25 }}
        >
          <Typography level="body-xs" sx={{ color: "warning.800" }}>
            Multiple accounts are connected for{" "}
            {data.hasMultiAccountPlatforms.join(", ")}. Platform totals include
            every connected account for that network.
          </Typography>
        </Sheet>
      ) : null}

      <Grid container spacing={1.5}>
        {platformSummaries.map((summary) => {
          const trend = getTrendMeta(summary.trend);

          return (
            <Grid key={summary.platform} xs={12} md={6} lg={4}>
              <JoyCard variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                <Stack spacing={1.25} sx={{ height: "100%" }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={1.5}
                  >
                    <Stack direction="row" spacing={1.1} alignItems="center">
                      <Sheet
                        variant="soft"
                        color="primary"
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Share2 size={16} />
                      </Sheet>
                      <Stack spacing={0.2}>
                        <Typography
                          level="body-sm"
                          sx={{ fontWeight: 700, color: "neutral.900" }}
                        >
                          {summary.label}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          Last synced{" "}
                          {formatRelativeTimestamp(summary.lastSyncedAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                    <JoyChip size="sm" variant="soft" color="neutral">
                      {summary.accountCount} account
                      {summary.accountCount > 1 ? "s" : ""}
                    </JoyChip>
                  </Stack>

                  <Stack spacing={0.35}>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {summary.metricLabel}
                    </Typography>
                    <Typography
                      level="title-lg"
                      sx={{
                        color: "neutral.900",
                        fontWeight: 700,
                        fontFamily: "var(--joy-fontFamily-display)",
                      }}
                    >
                      {formatCompactNumber(summary.metricValue)}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={1.5}
                  >
                    <Stack spacing={0.15}>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        Engagement
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{ fontWeight: 600, color: "neutral.800" }}
                      >
                        {summary.engagementRate === null
                          ? "Not available"
                          : formatPercent(summary.engagementRate)}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.15} alignItems="flex-end">
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        Trend
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{
                          fontWeight: 600,
                          color:
                            trend.tone === "success"
                              ? "success.600"
                              : trend.tone === "danger"
                                ? "danger.600"
                                : "neutral.500",
                        }}
                      >
                        {trend.label}
                      </Typography>
                    </Stack>
                  </Stack>

                  {summary.accountCount > 1 ? (
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Includes {summary.accountNames.join(", ")}
                    </Typography>
                  ) : null}
                </Stack>
              </JoyCard>
            </Grid>
          );
        })}
      </Grid>

      <PostPerformanceTracker />
    </Stack>
  );
}
