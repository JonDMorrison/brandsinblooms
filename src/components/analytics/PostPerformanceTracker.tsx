import { useCallback, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  formatCompactNumber,
  formatPercentage,
  formatRelativeTime,
  getTrendInfo,
  normalizePlatformLabel,
} from "@/components/analytics/analyticsUtils";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformConfig } from "@/utils/platformConfig";

interface PostPerformance {
  id: string;
  content_task_id: string;
  platform: string;
  platform_post_id: string;
  impressions: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reach: number;
  engagement_rate: number;
  collected_at: string;
  content_tasks: {
    post_type: string;
    ai_output: string;
  };
}

type SummaryMetric = {
  label: string;
  value: string;
  trend: ReturnType<typeof getTrendInfo> | null;
};

const shimmerSx = {
  position: "relative",
  overflow: "hidden",
  bgcolor: "background.surface",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    transform: "translateX(-100%)",
    background:
      "linear-gradient(90deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.12) 50%, rgba(var(--joy-palette-neutral-mainChannel) / 0.04) 100%)",
    animation: "postPerformanceShimmer 1.35s ease-in-out infinite",
  },
  "@keyframes postPerformanceShimmer": {
    to: {
      transform: "translateX(100%)",
    },
  },
} as const;

const blockSx = {
  borderRadius: "sm",
  bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
} as const;

const SummarySkeleton = () => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        ...shimmerSx,
        flex: "1 1 220px",
        minWidth: { xs: "100%", sm: 220 },
        borderRadius: "sm",
        p: 2,
      }}
    >
      <Stack spacing={1.1}>
        <Box sx={{ ...blockSx, width: "44%", height: 12 }} />
        <Box sx={{ ...blockSx, width: "58%", height: 28 }} />
        <Box sx={{ ...blockSx, width: "32%", height: 24, borderRadius: 999 }} />
      </Stack>
    </Sheet>
  );
};

const TableSkeleton = () => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        ...shimmerSx,
        borderRadius: "md",
        minHeight: 300,
        p: 2,
      }}
    >
      <Stack spacing={1.25}>
        <Box sx={{ ...blockSx, width: "18%", height: 12 }} />
        {Array.from({ length: 6 }).map((_, index) => (
          <Box
            key={index}
            sx={{ ...blockSx, width: "100%", height: 36, borderRadius: "md" }}
          />
        ))}
      </Stack>
    </Sheet>
  );
};

const getEngagementColor = (engagementRate: number) => {
  if (engagementRate > 3) {
    return "success" as const;
  }

  if (engagementRate >= 1) {
    return "neutral" as const;
  }

  return "warning" as const;
};

const formatPreview = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "No content preview available.";
  }

  if (trimmed.length <= 60) {
    return trimmed;
  }

  return `${trimmed.slice(0, 60).trimEnd()}...`;
};

const SummaryMetricSheet = ({ metric }: { metric: SummaryMetric }) => {
  const TrendIcon = metric.trend?.icon;

  return (
    <Sheet
      variant="outlined"
      sx={{
        flex: "1 1 220px",
        minWidth: { xs: "100%", sm: 220 },
        borderRadius: "sm",
        p: 2,
        bgcolor: "background.surface",
        boxShadow: "none",
      }}
    >
      <Stack spacing={1}>
        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
          {metric.label}
        </Typography>
        <Typography level="title-lg">{metric.value}</Typography>
        {metric.trend && TrendIcon ? (
          <JoyChip
            color={metric.trend.tone}
            size="sm"
            startDecorator={<TrendIcon size={12} />}
            variant="soft"
          >
            {metric.trend.label}
          </JoyChip>
        ) : null}
      </Stack>
    </Sheet>
  );
};

export const PostPerformanceTracker: React.FC = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const { data, isError, isLoading, refetch } = useQuery<PostPerformance[]>({
    queryKey: ["analytics-post-performance", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from("post_performance")
        .select(
          `
          *,
          content_tasks!inner(
            post_type,
            ai_output,
            user_id
          )
        `,
        )
        .eq("content_tasks.user_id", user.id)
        .order("collected_at", { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return (data || []).map((item) => ({
        id: item.id,
        content_task_id: item.content_task_id,
        platform: item.platform,
        platform_post_id: item.platform_post_id,
        impressions: item.impressions || 0,
        likes_count: item.likes_count || 0,
        comments_count: item.comments_count || 0,
        shares_count: item.shares_count || 0,
        reach: item.reach || 0,
        engagement_rate: Number(item.engagement_rate) || 0,
        collected_at: item.collected_at,
        content_tasks: item.content_tasks,
      }));
    },
  });

  const performances = useMemo(() => data ?? [], [data]);

  const syncAnalytics = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setSyncing(true);

      const { error } = await supabase.functions.invoke("sync-analytics", {
        body: { userId: user.id },
      });

      if (error) {
        throw error;
      }

      toast.success("Analytics sync started.");
    } catch (error) {
      console.error("Error syncing analytics:", error);
      toast.error("Unable to start analytics sync right now.");
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const summaryMetrics = useMemo<SummaryMetric[]>(() => {
    const totalEngagement = performances.reduce(
      (sum, performance) =>
        sum +
        performance.likes_count +
        performance.comments_count +
        performance.shares_count,
      0,
    );
    const averageReach =
      performances.length > 0
        ? performances.reduce(
            (sum, performance) => sum + performance.reach,
            0,
          ) / performances.length
        : 0;
    const averageEngagementRate =
      performances.length > 0
        ? performances.reduce(
            (sum, performance) => sum + performance.engagement_rate,
            0,
          ) / performances.length
        : 0;
    const totalImpressions = performances.reduce(
      (sum, performance) => sum + performance.impressions,
      0,
    );

    const latest = performances[0];
    const previous = performances[1];
    const latestEngagement = latest
      ? latest.likes_count + latest.comments_count + latest.shares_count
      : undefined;
    const previousEngagement = previous
      ? previous.likes_count + previous.comments_count + previous.shares_count
      : undefined;
    const canShowTrend = performances.length >= 2;

    return [
      {
        label: "Total Engagement",
        value: formatCompactNumber(totalEngagement),
        trend: canShowTrend
          ? getTrendInfo(latestEngagement, previousEngagement)
          : null,
      },
      {
        label: "Avg. Reach",
        value: formatCompactNumber(Math.round(averageReach)),
        trend: canShowTrend
          ? getTrendInfo(latest?.reach, previous?.reach)
          : null,
      },
      {
        label: "Avg. Engagement Rate",
        value: formatPercentage(averageEngagementRate),
        trend: canShowTrend
          ? getTrendInfo(latest?.engagement_rate, previous?.engagement_rate)
          : null,
      },
      {
        label: "Impressions",
        value: formatCompactNumber(totalImpressions),
        trend: canShowTrend
          ? getTrendInfo(latest?.impressions, previous?.impressions)
          : null,
      },
    ];
  }, [performances]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography level="title-md">Post Performance</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Engagement and reach metrics from your connected accounts.
          </Typography>
        </Stack>

        <JoyButton
          color="neutral"
          loading={syncing}
          loadingPosition="start"
          size="sm"
          startDecorator={<BarChart3 size={14} />}
          variant="outlined"
          onClick={() => {
            void syncAnalytics();
          }}
        >
          Sync Analytics
        </JoyButton>
      </Stack>

      {isLoading ? (
        <>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <SummarySkeleton key={index} />
            ))}
          </Box>
          <TableSkeleton />
        </>
      ) : isError ? (
        <Sheet color="warning" variant="soft" sx={{ borderRadius: "md", p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box
                sx={{
                  color: "text.secondary",
                  display: "inline-flex",
                  "& > .lucide": {
                    width: 18,
                    height: 18,
                  },
                }}
              >
                <AlertTriangle />
              </Box>
              <Stack spacing={0.5}>
                <Typography level="title-sm">
                  Unable to load performance data
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  There was a problem fetching analytics. Try again.
                </Typography>
              </Stack>
            </Stack>
            <JoyButton
              color="neutral"
              size="sm"
              startDecorator={<BarChart3 size={14} />}
              variant="outlined"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </JoyButton>
          </Stack>
        </Sheet>
      ) : performances.length === 0 ? (
        <Sheet
          variant="outlined"
          sx={{ borderRadius: "md", bgcolor: "background.surface" }}
        >
          <JoyEmptyState
            icon={
              <Box
                sx={{
                  color: "text.tertiary",
                  display: "inline-flex",
                  "& > .lucide": {
                    width: 32,
                    height: 32,
                  },
                }}
              >
                <BarChart3 />
              </Box>
            }
            title="No performance data yet"
            description="Metrics will appear here after your connected accounts publish content."
          />
        </Sheet>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {summaryMetrics.map((metric) => (
              <SummaryMetricSheet key={metric.label} metric={metric} />
            ))}
          </Box>

          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "md",
              overflow: "auto",
              bgcolor: "background.surface",
            }}
          >
            <Table
              hoverRow
              stripe="odd"
              sx={{
                minWidth: 760,
                "--TableCell-paddingX": "12px",
                "--TableCell-paddingY": "12px",
                "& thead th": {
                  bgcolor: "transparent",
                  fontWeight: "md",
                  fontSize: "xs",
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
                "& tbody td": {
                  verticalAlign: "middle",
                },
              }}
            >
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Reach</th>
                  <th>Engagement</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {performances.map((performance) => {
                  const platformConfig = getPlatformConfig(
                    performance.platform,
                  );
                  const platformLabel = normalizePlatformLabel(
                    performance.platform,
                  );
                  const PlatformIcon = platformConfig.icon;

                  return (
                    <tr key={performance.id}>
                      <td>
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: platformConfig.color,
                              flexShrink: 0,
                            }}
                          >
                            <PlatformIcon size={16} strokeWidth={1.9} />
                          </Box>
                          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                            <Typography
                              level="body-sm"
                              noWrap
                              sx={{ maxWidth: 240 }}
                            >
                              {formatPreview(
                                performance.content_tasks.ai_output,
                              )}
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{ color: "text.tertiary" }}
                            >
                              {platformLabel}
                            </Typography>
                          </Stack>
                        </Stack>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {formatCompactNumber(performance.likes_count)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {formatCompactNumber(performance.comments_count)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {formatCompactNumber(performance.shares_count)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {formatCompactNumber(performance.reach)}
                        </Typography>
                      </td>
                      <td>
                        <JoyChip
                          color={getEngagementColor(
                            performance.engagement_rate,
                          )}
                          size="sm"
                          variant="soft"
                        >
                          {formatPercentage(performance.engagement_rate)}
                        </JoyChip>
                      </td>
                      <td>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.tertiary" }}
                        >
                          {formatRelativeTime(performance.collected_at)}
                        </Typography>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Sheet>
        </>
      )}
    </Stack>
  );
};

export default PostPerformanceTracker;
