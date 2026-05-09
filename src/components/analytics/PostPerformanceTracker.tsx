import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  formatCompactNumber,
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

type SortableMetric =
  | "likes_count"
  | "comments_count"
  | "shares_count"
  | "reach"
  | "engagement_rate";

type SortState = {
  column: SortableMetric | null;
  direction: "asc" | "desc";
};

const SYNC_SUCCESS_RESET_MS = 2000;

const integerFormatter = new Intl.NumberFormat("en-US");

const formatAverageInteger = (value: number) =>
  integerFormatter.format(Math.round(value));

const formatAveragePercentage = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";

const formatMetricValue = (value: number) =>
  Number.isFinite(value) ? integerFormatter.format(value) : "—";

const renderPlaceholderValue = () => "—";

const METRIC_CARD_SX = {
  flex: "1 1 180px",
  borderRadius: "lg",
  p: 2.5,
} as const;

const getPlatformAvatarSx = (platform: string) => {
  const normalized = platform.trim().toLowerCase();

  if (normalized === "facebook") {
    return {
      bgcolor: "#1877F2",
      color: "#FFFFFF",
    };
  }

  if (normalized === "instagram") {
    return {
      background:
        "linear-gradient(135deg, #F58529 0%, #DD2A7B 55%, #515BD4 100%)",
      color: "#FFFFFF",
    };
  }

  return {
    bgcolor: "neutral.300",
    color: "neutral.800",
  };
};

const SummarySkeletonCard = () => {
  return (
    <Card variant="soft" color="neutral" sx={METRIC_CARD_SX}>
      <Stack spacing={1.1}>
        <Skeleton variant="text" level="body-xs" width="44%" />
        <Skeleton variant="text" level="h3" width="52%" />
        <Skeleton variant="rectangular" width={76} height={24} />
      </Stack>
    </Card>
  );
};

const TableSkeleton = () => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "lg",
        overflow: "hidden",
        bgcolor: "background.surface",
      }}
    >
      <Box sx={{ overflowX: "auto" }}>
        <Table
          stripe="odd"
          sx={{
            minWidth: 880,
            "& thead th": {
              bgcolor: "background.level1",
            },
          }}
        >
          <thead>
            <tr>
              {Array.from({ length: 8 }).map((_, index) => (
                <th key={index}>
                  <Skeleton variant="text" width="70%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <td key={cellIndex}>
                    <Skeleton
                      variant="text"
                      width={cellIndex === 0 ? "90%" : "60%"}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>
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

const getSortedArrow = (direction: "asc" | "desc") => {
  return direction === "asc" ? ArrowUp : ArrowDown;
};

const EmptyState = ({
  onSync,
  syncing,
}: {
  onSync: () => void;
  syncing: boolean;
}) => {
  return (
    <Sheet
      variant="outlined"
      sx={{
        minHeight: 300,
        borderRadius: "xl",
        borderColor: "divider",
        bgcolor: "background.surface",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 4,
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        textAlign="center"
        sx={{ maxWidth: 420 }}
      >
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BarChart3 size={48} />
        </Sheet>
        <Stack spacing={0.75}>
          <Typography level="title-lg">No performance data yet</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Publish some posts and sync analytics to see how they&apos;re
            performing.
          </Typography>
        </Stack>
        <Button
          variant="soft"
          color="neutral"
          size="sm"
          startDecorator={<RefreshCw size={14} />}
          loading={syncing}
          onClick={onSync}
        >
          Sync Analytics
        </Button>
      </Stack>
    </Sheet>
  );
};

const FilteredEmptyState = () => {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        minHeight: 220,
        borderRadius: "xl",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 4,
      }}
    >
      <Stack
        spacing={1}
        alignItems="center"
        textAlign="center"
        sx={{ maxWidth: 360 }}
      >
        <Typography level="title-md">No posts match this search</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Try a different caption keyword to find the post you want.
        </Typography>
      </Stack>
    </Sheet>
  );
};

const SortableHeader = ({
  active,
  align,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  align?: "left" | "center" | "right";
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
}) => {
  const SortIcon = getSortedArrow(direction);

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        p: 0,
        m: 0,
        width: "100%",
        border: 0,
        bgcolor: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent:
          align === "right"
            ? "flex-end"
            : align === "center"
              ? "center"
              : "flex-start",
        gap: 0.5,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
      }}
    >
      <span>{label}</span>
      {active ? <SortIcon size={12} /> : null}
    </Box>
  );
};

const SummaryMetricSheet = ({ metric }: { metric: SummaryMetric }) => {
  const TrendIcon = metric.trend?.icon;

  return (
    <Card variant="soft" color="neutral" sx={METRIC_CARD_SX}>
      <Stack spacing={1}>
        <Typography
          level="body-xs"
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: "md",
          }}
        >
          {metric.label}
        </Typography>
        <Typography level="h3" sx={{ fontWeight: "lg" }}>
          {metric.value}
        </Typography>
        {metric.trend && TrendIcon ? (
          <Chip
            color={metric.trend.tone}
            size="sm"
            startDecorator={<TrendIcon size={12} />}
            variant="soft"
          >
            {metric.trend.label}
          </Chip>
        ) : null}
      </Stack>
    </Card>
  );
};

export const PostPerformanceTracker: React.FC = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncSucceeded, setSyncSucceeded] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: "desc",
  });

  useEffect(() => {
    if (!syncSucceeded) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSyncSucceeded(false);
    }, SYNC_SUCCESS_RESET_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [syncSucceeded]);

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

  const filteredPerformances = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const baseRows = normalizedSearch
      ? performances.filter((performance) =>
          (performance.content_tasks.ai_output ?? "")
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : performances;

    if (!sortState.column) {
      return [...baseRows].sort(
        (left, right) =>
          new Date(right.collected_at).getTime() -
          new Date(left.collected_at).getTime(),
      );
    }

    return [...baseRows].sort((left, right) => {
      const leftValue = left[sortState.column] ?? 0;
      const rightValue = right[sortState.column] ?? 0;

      if (leftValue === rightValue) {
        return (
          new Date(right.collected_at).getTime() -
          new Date(left.collected_at).getTime()
        );
      }

      return sortState.direction === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    });
  }, [performances, searchText, sortState]);

  const handleSort = useCallback((column: SortableMetric) => {
    setSortState((currentValue) => {
      if (currentValue.column === column) {
        return {
          column,
          direction: currentValue.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        column,
        direction: "desc",
      };
    });
  }, []);

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

      setSyncSucceeded(true);
      toast.success("Analytics sync started.");
    } catch (error) {
      console.error("Error syncing analytics:", error);
      toast.error("Unable to start analytics sync right now.");
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const summaryMetrics = useMemo<SummaryMetric[]>(() => {
    const averageLikes =
      performances.length > 0
        ? performances.reduce(
            (sum, performance) => sum + performance.likes_count,
            0,
          ) / performances.length
        : 0;
    const averageComments =
      performances.length > 0
        ? performances.reduce(
            (sum, performance) => sum + performance.comments_count,
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

    const latest = performances[0];
    const previous = performances[1];
    const canShowTrend = performances.length >= 2;

    return [
      {
        label: "Total Posts",
        value:
          performances.length > 0
            ? integerFormatter.format(performances.length)
            : renderPlaceholderValue(),
        trend: null,
      },
      {
        label: "Avg Likes",
        value:
          performances.length > 0
            ? formatAverageInteger(averageLikes)
            : renderPlaceholderValue(),
        trend: canShowTrend
          ? getTrendInfo(latest?.likes_count, previous?.likes_count)
          : null,
      },
      {
        label: "Avg Comments",
        value:
          performances.length > 0
            ? formatAverageInteger(averageComments)
            : renderPlaceholderValue(),
        trend: canShowTrend
          ? getTrendInfo(latest?.comments_count, previous?.comments_count)
          : null,
      },
      {
        label: "Avg Engagement Rate",
        value:
          performances.length > 0
            ? formatAveragePercentage(averageEngagementRate)
            : renderPlaceholderValue(),
        trend: canShowTrend
          ? getTrendInfo(latest?.engagement_rate, previous?.engagement_rate)
          : null,
      },
    ];
  }, [performances]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography level="title-lg" sx={{ fontWeight: "lg" }}>
            Post Performance
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Engagement and reach metrics from your connected accounts.
          </Typography>
        </Stack>
      </Stack>

      {isLoading ? (
        <>
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            {Array.from({ length: 4 }).map((_, index) => (
              <SummarySkeletonCard key={index} />
            ))}
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            gap={2}
            sx={{ my: 2 }}
          >
            <Skeleton variant="rectangular" width={320} height={36} />
            <Skeleton variant="rectangular" width={132} height={36} />
          </Stack>
          <TableSkeleton />
        </>
      ) : isError ? (
        <Sheet color="warning" variant="soft" sx={{ borderRadius: "lg", p: 3 }}>
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
            <Button
              color="neutral"
              size="sm"
              startDecorator={<RefreshCw size={14} />}
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </Button>
          </Stack>
        </Sheet>
      ) : performances.length === 0 ? (
        <>
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            {summaryMetrics.map((metric) => (
              <SummaryMetricSheet key={metric.label} metric={metric} />
            ))}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            gap={2}
            sx={{ my: 2 }}
          >
            <Input
              variant="outlined"
              size="sm"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search posts..."
              startDecorator={<Search size={14} />}
              sx={{ maxWidth: 320, width: "100%" }}
            />
            <Button
              variant="soft"
              color="neutral"
              size="sm"
              startDecorator={<RefreshCw size={14} />}
              loading={syncing}
              onClick={() => {
                void syncAnalytics();
              }}
            >
              {syncSucceeded ? "Synced ✓" : "Sync Analytics"}
            </Button>
          </Stack>

          <EmptyState
            syncing={syncing}
            onSync={() => {
              void syncAnalytics();
            }}
          />
        </>
      ) : (
        <>
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            {summaryMetrics.map((metric) => (
              <SummaryMetricSheet key={metric.label} metric={metric} />
            ))}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            gap={2}
            sx={{ my: 2 }}
          >
            <Input
              variant="outlined"
              size="sm"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search posts..."
              startDecorator={<Search size={14} />}
              sx={{ maxWidth: 320, width: "100%" }}
            />
            <Button
              variant="soft"
              color="neutral"
              size="sm"
              startDecorator={<RefreshCw size={14} />}
              loading={syncing}
              onClick={() => {
                void syncAnalytics();
              }}
            >
              {syncSucceeded ? "Synced ✓" : "Sync Analytics"}
            </Button>
          </Stack>

          {filteredPerformances.length === 0 ? (
            <FilteredEmptyState />
          ) : (
            <Sheet
              variant="plain"
              sx={{
                borderRadius: "lg",
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.surface",
              }}
            >
              <Box sx={{ overflowX: "auto" }}>
                <Table
                  variant="plain"
                  stripe="odd"
                  hoverRow
                  sx={{
                    minWidth: 980,
                    "--TableCell-paddingX": "14px",
                    "--TableCell-paddingY": "14px",
                    "& th": {
                      bgcolor: "background.level1",
                      fontWeight: "md",
                      fontSize: "xs",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                    },
                    "& td": {
                      verticalAlign: "middle",
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th style={{ width: 60, textAlign: "center" }}>
                        Platform
                      </th>
                      <th style={{ width: 80, textAlign: "right" }}>
                        <SortableHeader
                          active={sortState.column === "likes_count"}
                          align="right"
                          direction={sortState.direction}
                          label="Likes"
                          onClick={() => handleSort("likes_count")}
                        />
                      </th>
                      <th style={{ width: 100, textAlign: "right" }}>
                        <SortableHeader
                          active={sortState.column === "comments_count"}
                          align="right"
                          direction={sortState.direction}
                          label="Comments"
                          onClick={() => handleSort("comments_count")}
                        />
                      </th>
                      <th style={{ width: 80, textAlign: "right" }}>
                        <SortableHeader
                          active={sortState.column === "shares_count"}
                          align="right"
                          direction={sortState.direction}
                          label="Shares"
                          onClick={() => handleSort("shares_count")}
                        />
                      </th>
                      <th style={{ width: 80, textAlign: "right" }}>
                        <SortableHeader
                          active={sortState.column === "reach"}
                          align="right"
                          direction={sortState.direction}
                          label="Reach"
                          onClick={() => handleSort("reach")}
                        />
                      </th>
                      <th style={{ width: 100, textAlign: "right" }}>
                        <SortableHeader
                          active={sortState.column === "engagement_rate"}
                          align="right"
                          direction={sortState.direction}
                          label="Eng. Rate"
                          onClick={() => handleSort("engagement_rate")}
                        />
                      </th>
                      <th style={{ width: 120, textAlign: "right" }}>
                        Collected
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerformances.map((performance) => {
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
                            <Typography level="body-sm" sx={{ maxWidth: 320 }}>
                              {formatPreview(
                                performance.content_tasks.ai_output,
                              )}
                            </Typography>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <Avatar
                              size="sm"
                              title={platformLabel}
                              sx={getPlatformAvatarSx(performance.platform)}
                            >
                              <PlatformIcon size={14} strokeWidth={2} />
                            </Avatar>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Typography level="body-sm">
                              {formatMetricValue(performance.likes_count)}
                            </Typography>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Typography level="body-sm">
                              {formatMetricValue(performance.comments_count)}
                            </Typography>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Typography level="body-sm">
                              {formatMetricValue(performance.shares_count)}
                            </Typography>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Typography level="body-sm">
                              {formatCompactNumber(performance.reach)}
                            </Typography>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Chip
                              color={getEngagementColor(
                                performance.engagement_rate,
                              )}
                              size="sm"
                              variant="soft"
                            >
                              {formatAveragePercentage(
                                performance.engagement_rate,
                              )}
                            </Chip>
                          </td>
                          <td style={{ textAlign: "right" }}>
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
              </Box>
            </Sheet>
          )}
        </>
      )}
    </Stack>
  );
};

export default PostPerformanceTracker;
