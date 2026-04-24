import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ShieldAlert, TrendingDown } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import type {
  RecentRiskEvent,
  RiskDisplayMetrics,
} from "@/lib/customerDashboardTransformers";
import { clampPercent, getRiskColor } from "./customerDashboardUtils";

interface RiskNegativeSignalsProps {
  metrics: RiskDisplayMetrics;
  recentEvents: RecentRiskEvent[];
  engagementDecay: number[];
}

const subRisks = (metrics: RiskDisplayMetrics) => [
  { label: "Churn risk", value: metrics.ignoreStreakRiskScore },
  { label: "Email fatigue", value: metrics.optOutRiskScore },
  { label: "Discount dependency", value: metrics.couponDependencyRiskScore },
  { label: "Bounce risk", value: metrics.bounceRiskScore },
];

export function RiskNegativeSignals({
  metrics,
  recentEvents,
  engagementDecay,
}: RiskNegativeSignalsProps) {
  const riskColor = getRiskColor(metrics.overallRiskScore);

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Risk & signals"
        description="Flags that suggest churn, fatigue, deliverability issues, or discount dependence."
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress
                determinate
                value={clampPercent(metrics.overallRiskScore)}
                color={riskColor}
                size="lg"
                sx={{
                  "--CircularProgress-size": "78px",
                  "--CircularProgress-thickness": "7px",
                }}
              >
                <Typography level="title-sm">
                  {metrics.overallRiskScore}
                </Typography>
              </CircularProgress>
              <Stack spacing={0.5}>
                <Typography
                  level="body-xs"
                  textTransform="uppercase"
                  color="neutral"
                >
                  Overall risk
                </Typography>
                <Typography level="title-lg">
                  {metrics.overallRiskScore}/100
                </Typography>
                <JoyStatusChip
                  status={metrics.riskLevel}
                  tone={
                    riskColor === "success"
                      ? "success"
                      : riskColor === "warning"
                        ? "warning"
                        : riskColor === "danger"
                          ? "danger"
                          : "neutral"
                  }
                />
              </Stack>
            </Stack>

            <Sheet
              variant="soft"
              color={riskColor}
              sx={{
                borderRadius: "xl",
                px: 2,
                py: 1.5,
                minWidth: { xs: "100%", md: 280 },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingDown size={16} />
                <Typography level="body-sm">
                  Trend:{" "}
                  {metrics.riskTrend.replace(/\b\w/g, (character) =>
                    character.toUpperCase(),
                  )}
                </Typography>
              </Stack>
            </Sheet>
          </Stack>

          {metrics.shouldSuppress ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <ShieldAlert size={18} />
                <Stack spacing={0.35}>
                  <Typography level="title-sm">Suppression warning</Typography>
                  <Typography level="body-sm" color="danger">
                    {metrics.suppressionReason ||
                      "This customer is currently marked for suppression."}
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Sub-risk indicators</Typography>
                {subRisks(metrics).map((item) => (
                  <Stack key={item.label} spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-sm">{item.label}</Typography>
                      <Typography level="body-xs" color="neutral">
                        {item.value}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={clampPercent(item.value)}
                      color={getRiskColor(item.value)}
                      sx={{ borderRadius: 999 }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Recent negative events</Typography>
                {recentEvents.length > 0 ? (
                  <Stack spacing={1}>
                    {recentEvents.slice(0, 3).map((event) => (
                      <Sheet
                        key={event.id}
                        variant="soft"
                        color="danger"
                        sx={{ borderRadius: "lg", p: 1.25 }}
                      >
                        <Typography level="body-sm">
                          {event.description}
                        </Typography>
                        <Typography level="body-xs" color="danger">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </Typography>
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Typography level="body-sm" color="neutral">
                    No recent negative events were recorded.
                  </Typography>
                )}
              </Stack>
            </Sheet>
          </Box>

          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "xl", p: 2 }}
          >
            <Stack spacing={1.25}>
              <Typography level="title-sm">Engagement decay</Typography>
              {engagementDecay.length > 0 ? (
                <Stack direction="row" spacing={0.75} alignItems="flex-end">
                  {engagementDecay.map((value, index) => (
                    <Box key={`${index}-${value}`} sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          height: `${Math.max(20, clampPercent(value))}%`,
                          minHeight: 20,
                          borderRadius: "md md 0 0",
                          backgroundColor:
                            value >= 65
                              ? "success.400"
                              : value >= 40
                                ? "warning.400"
                                : "danger.400",
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography level="body-sm" color="neutral">
                  Decay data is not yet available for this customer.
                </Typography>
              )}
            </Stack>
          </Sheet>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default RiskNegativeSignals;
