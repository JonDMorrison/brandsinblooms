import Box from "@mui/joy/Box";
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
import { Activity, Clock3, Gauge, MousePointerClick } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import type { EngagementMetrics } from "@/lib/customerDashboardTransformers";
import { formatDaysLabel, getScoreColor } from "./customerDashboardUtils";

interface EngagementHealthOverviewProps {
  metrics: EngagementMetrics;
  timelineData: Array<{
    date: string;
    engagement: number;
    emailEvents: number;
    smsEvents: number;
  }>;
  errorMessage?: string | null;
  onRetry?: () => void;
}

const summaryTiles = (metrics: EngagementMetrics) => [
  {
    label: "Engagement Score",
    value: metrics.engagementScore,
    helper: metrics.engagementTrend
      ? "Based on timeline trend"
      : "Trend data not yet available",
    icon: Gauge,
  },
  {
    label: "Days Since Last Engagement",
    value: formatDaysLabel(metrics.daysSinceLastEngagement),
    helper:
      metrics.daysSinceLastEngagement !== null &&
      metrics.daysSinceLastEngagement <= 7
        ? "Healthy recency"
        : "Watch recency closely",
    icon: Clock3,
  },
  {
    label: "Engagement Velocity",
    value:
      metrics.engagementVelocity === null
        ? "Data not available"
        : `${metrics.engagementVelocity.toFixed(1)}x`,
    helper: "Relative momentum across recent windows",
    icon: Activity,
  },
  {
    label: "Recent Interactions",
    value: metrics.emailInteractions7d + metrics.smsInteractions7d,
    helper: `${metrics.emailInteractions7d} email · ${metrics.smsInteractions7d} SMS in 7d`,
    icon: MousePointerClick,
  },
];

export function EngagementHealthOverview({
  metrics,
  timelineData,
  errorMessage,
  onRetry,
}: EngagementHealthOverviewProps) {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Engagement health"
        description="How quickly this customer is responding and whether momentum is strengthening or fading."
        actions={
          errorMessage && onRetry ? (
            <JoyButton
              color="danger"
              variant="plain"
              size="sm"
              onClick={onRetry}
            >
              Retry
            </JoyButton>
          ) : null
        }
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          {errorMessage ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="title-sm">
                Failed to load engagement chart
              </Typography>
              <Typography level="body-sm" color="danger">
                {errorMessage}
              </Typography>
            </Sheet>
          ) : timelineData.length > 0 ? (
            <Box sx={{ height: 280, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={timelineData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
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
                      backgroundColor: "var(--joy-palette-background-surface)",
                    }}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="emailEvents"
                    fill="var(--joy-palette-primary-200)"
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                    name="Email events"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="smsEvents"
                    fill="var(--joy-palette-success-300)"
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                    name="SMS events"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="engagement"
                    stroke="var(--joy-palette-primary-600)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--joy-palette-primary-600)" }}
                    name="Engagement score"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "xl", p: 2.5 }}
            >
              <Typography level="title-sm">
                Trend data not yet available
              </Typography>
              <Typography level="body-sm" color="neutral">
                This customer does not have enough engagement history for the
                timeline card yet.
              </Typography>
            </Sheet>
          )}

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
            {summaryTiles(metrics).map((tile) => {
              const Icon = tile.icon;
              const scoreColor =
                tile.label === "Engagement Score"
                  ? getScoreColor(metrics.engagementScore)
                  : "neutral";

              return (
                <Sheet
                  key={tile.label}
                  variant="outlined"
                  sx={{ borderRadius: "xl", p: 2, borderColor: "neutral.200" }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Sheet
                        variant="soft"
                        color={scoreColor}
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "lg",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Icon size={16} />
                      </Sheet>
                      <Typography level="body-xs" color="neutral">
                        {tile.label}
                      </Typography>
                    </Stack>
                    <Typography level="h3">{tile.value}</Typography>
                    <Typography level="body-xs" color="neutral">
                      {tile.helper}
                    </Typography>
                  </Stack>
                </Sheet>
              );
            })}
          </Box>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default EngagementHealthOverview;
