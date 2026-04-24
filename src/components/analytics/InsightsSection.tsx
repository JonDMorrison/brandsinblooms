import Grid from "@mui/joy/Grid";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Lightbulb,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  clampPercentage,
  formatPercent,
  getProgressColor,
} from "@/components/analytics/analyticsUtils";

type InsightsSectionProps = {
  clicks: number;
  conversions: number;
  engagementRate: number;
  growth: number;
  totalRevenue: number;
  totalViews: number;
};

type InsightDefinition = {
  actionPath: string;
  description: string;
  icon: React.ReactNode;
  id: string;
  severity: "success" | "warning" | "info";
  title: string;
};

export function InsightsSection({
  clicks,
  conversions,
  engagementRate,
  growth,
  totalRevenue,
  totalViews,
}: InsightsSectionProps) {
  const navigate = useNavigate();
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  const insights: InsightDefinition[] = [];

  if (growth >= 15) {
    insights.push({
      actionPath: "/crm/campaigns",
      description: `Overall reach is up ${Math.round(growth)}% versus the prior period. This is a strong time to repeat the channels and offers driving that lift.`,
      icon: <TrendingUp size={16} />,
      id: "growth-strong",
      severity: "success",
      title: "Growth momentum is strong",
    });
  }

  if (engagementRate > 0 && engagementRate < 3) {
    insights.push({
      actionPath: "/content/library",
      description: `Engagement is sitting at ${formatPercent(engagementRate)}. Review creative formats and posting cadence to improve interaction quality.`,
      icon: <Lightbulb size={16} />,
      id: "engagement-low",
      severity: "warning",
      title: "Engagement is lagging",
    });
  }

  if (clicks > 0 && conversions === 0) {
    insights.push({
      actionPath: "/crm/campaigns/new",
      description:
        "You generated clicks but no tracked conversions. Tighten your CTA flow or landing experience to reduce the drop-off after the click.",
      icon: <TrendingDown size={16} />,
      id: "conversions-missing",
      severity: "warning",
      title: "Clicks are not converting",
    });
  }

  if (totalRevenue === 0 && totalViews > 0) {
    insights.push({
      actionPath: "/crm/pos",
      description:
        "Traffic is present, but revenue data is still missing. Connect or resync a POS source so analytics can link demand to actual sales.",
      icon: <BarChart3 size={16} />,
      id: "pos-missing",
      severity: "info",
      title: "Revenue attribution is incomplete",
    });
  }

  const topInsights = insights.slice(0, 3);
  const goals = [
    engagementRate > 0
      ? {
          helper: `${formatPercent(engagementRate)} of a 5% engagement benchmark`,
          label: "Engagement Benchmark",
          progress: clampPercentage((engagementRate / 5) * 100),
        }
      : null,
    clicks > 0
      ? {
          helper: `${formatPercent(conversionRate)} of a 3% click-to-conversion target`,
          label: "Conversion Efficiency",
          progress: clampPercentage((conversionRate / 3) * 100),
        }
      : null,
  ].filter(Boolean) as Array<{
    helper: string;
    label: string;
    progress: number;
  }>;

  return (
    <Stack spacing={1.75}>
      <Grid container spacing={2}>
        <Grid xs={12} lg={8}>
          <JoyCard variant="outlined">
            <JoyCardHeader
              title="Insights & Recommendations"
              actions={
                <JoyChip size="sm" variant="soft" color="neutral">
                  Auto-generated
                </JoyChip>
              }
            />
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack spacing={1.5}>
                {topInsights.length ? (
                  topInsights.map((insight) => (
                    <JoyCard
                      key={insight.id}
                      variant="soft"
                      color="neutral"
                      sx={{
                        borderRadius: "md",
                        borderInlineStart: "3px solid",
                        borderColor:
                          insight.severity === "success"
                            ? "success.500"
                            : insight.severity === "warning"
                              ? "warning.500"
                              : "primary.500",
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1.1}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          spacing={1.5}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                          >
                            <Stack
                              alignItems="center"
                              justifyContent="center"
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                backgroundColor:
                                  insight.severity === "success"
                                    ? "rgba(var(--joy-palette-success-mainChannel) / 0.14)"
                                    : insight.severity === "warning"
                                      ? "rgba(var(--joy-palette-warning-mainChannel) / 0.14)"
                                      : "rgba(var(--joy-palette-primary-mainChannel) / 0.14)",
                              }}
                            >
                              {insight.icon}
                            </Stack>
                            <Stack spacing={0.35}>
                              <Typography
                                level="body-sm"
                                sx={{ fontWeight: 700, color: "neutral.900" }}
                              >
                                {insight.title}
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ color: "neutral.600" }}
                              >
                                {insight.description}
                              </Typography>
                            </Stack>
                          </Stack>
                          <JoyButton
                            size="sm"
                            variant="plain"
                            color="primary"
                            onClick={() => navigate(insight.actionPath)}
                          >
                            Take Action
                          </JoyButton>
                        </Stack>
                      </Stack>
                    </JoyCard>
                  ))
                ) : (
                  <JoyCard variant="soft" color="success" sx={{ p: 1.75 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                      Everything looks good
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "success.800" }}>
                      No immediate actions are required from the current
                      analytics snapshot.
                    </Typography>
                  </JoyCard>
                )}
              </Stack>
            </JoyCardContent>
          </JoyCard>
        </Grid>
        <Grid xs={12} lg={4}>
          <JoyCard variant="outlined">
            <JoyCardHeader title="Performance Goals" />
            <JoyCardContent sx={{ pt: 3 }}>
              {goals.length ? (
                <Stack spacing={1.5}>
                  {goals.map((goal) => (
                    <Stack key={goal.label} spacing={0.55}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={1.5}
                      >
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.700" }}
                        >
                          {goal.label}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {Math.round(goal.progress)}% of goal
                        </Typography>
                      </Stack>
                      <LinearProgress
                        determinate
                        value={goal.progress}
                        color={getProgressColor(goal.progress)}
                        sx={{ borderRadius: 999, height: 10 }}
                      />
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {goal.helper}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Stack spacing={1.25}>
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    There is not enough meaningful benchmark data yet to render
                    dynamic goals for this workspace.
                  </Typography>
                  <JoyButton
                    size="sm"
                    variant="soft"
                    color="neutral"
                    startDecorator={<Settings size={14} />}
                    onClick={() => navigate("/settings")}
                  >
                    Set Goals
                  </JoyButton>
                </Stack>
              )}
            </JoyCardContent>
          </JoyCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
