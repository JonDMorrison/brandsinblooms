import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  Clock3,
  Layers,
  Mail,
  MessageSquare,
  Star,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { CrossChannelDisplayMetrics } from "@/lib/customerDashboardTransformers";
import {
  clampPercent,
  formatDaysLabel,
  humanizeChannel,
} from "./customerDashboardUtils";

interface ChannelTrendPoint {
  month: string;
  preferredChannel: "email" | "sms";
}

interface CrossChannelIntelligenceProps {
  metrics: CrossChannelDisplayMetrics;
  channelTrend: ChannelTrendPoint[];
  engagementDecay: number[];
  errorMessage?: string | null;
  onRetry?: () => void;
}

const getRecommendation = (metrics: CrossChannelDisplayMetrics) => {
  if (metrics.channelFatigueEmail >= 70 && metrics.channelFatigueSms < 55) {
    return "Shift the next sequence toward SMS to reduce email fatigue without going fully silent.";
  }

  if (metrics.channelFatigueSms >= 70 && metrics.channelFatigueEmail < 55) {
    return "Pause SMS-heavy outreach and lean on email until message fatigue cools down.";
  }

  if (metrics.channelFatigueEmail >= 70 && metrics.channelFatigueSms >= 70) {
    return "Reduce overall outreach frequency. This customer is fatigued across both primary channels.";
  }

  return `Preferred channel remains ${humanizeChannel(metrics.preferredChannel).toLowerCase()}, with room to keep cadence steady.`;
};

export function CrossChannelIntelligence({
  metrics,
  channelTrend,
  engagementDecay,
  errorMessage,
  onRetry,
}: CrossChannelIntelligenceProps) {
  const radarData = [
    { channel: "Email", value: metrics.emailEngagement },
    { channel: "SMS", value: metrics.smsEngagement },
    { channel: "Loyalty", value: metrics.loyaltyEngagement },
    { channel: "Multi", value: metrics.multiChannelScore },
  ];

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Cross-channel intelligence"
        description="Where this customer responds best, where fatigue is building, and how channel preference is shifting."
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
              <Typography level="title-sm">Trend data unavailable</Typography>
              <Typography level="body-sm" color="danger">
                {errorMessage}
              </Typography>
            </Sheet>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1fr) minmax(0, 1fr)",
              },
              gap: 2,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Layers size={16} />
                  <Typography level="title-sm">Engagement mix</Typography>
                </Stack>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius={84}>
                      <PolarGrid stroke="var(--joy-palette-neutral-200)" />
                      <PolarAngleAxis
                        dataKey="channel"
                        tick={{
                          fill: "var(--joy-palette-neutral-500)",
                          fontSize: 12,
                        }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        dataKey="value"
                        stroke="var(--joy-palette-primary-500)"
                        fill="rgba(var(--joy-palette-primary-mainChannel) / 0.24)"
                        fillOpacity={1}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyChip color="primary" variant="soft" size="sm">
                    Multi-channel score {metrics.multiChannelScore}
                  </JoyChip>
                  <JoyChip color="neutral" variant="soft" size="sm">
                    Preferred {humanizeChannel(metrics.preferredChannel)}
                  </JoyChip>
                </Stack>
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.75}>
                <Typography level="title-sm">
                  Fatigue & recommendation
                </Typography>
                {[
                  {
                    label: "Email fatigue",
                    value: metrics.channelFatigueEmail,
                    icon: Mail,
                  },
                  {
                    label: "SMS fatigue",
                    value: metrics.channelFatigueSms,
                    icon: MessageSquare,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Stack key={item.label} spacing={0.5}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={14} />
                          <Typography level="body-sm">{item.label}</Typography>
                        </Stack>
                        <Typography level="body-xs" color="neutral">
                          {item.value}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        determinate
                        value={clampPercent(item.value)}
                        color={
                          item.value >= 70
                            ? "danger"
                            : item.value >= 50
                              ? "warning"
                              : "success"
                        }
                        sx={{ borderRadius: 999 }}
                      />
                    </Stack>
                  );
                })}

                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{ borderRadius: "xl", p: 2 }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <AlertTriangle size={16} />
                    <Typography level="body-sm">
                      {getRecommendation(metrics)}
                    </Typography>
                  </Stack>
                </Sheet>
              </Stack>
            </Sheet>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
              },
              gap: 2,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">
                  Preferred channel trend
                </Typography>
                {channelTrend.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {channelTrend.map((item) => (
                      <Sheet
                        key={`${item.month}-${item.preferredChannel}`}
                        variant="soft"
                        color={
                          item.preferredChannel === "email"
                            ? "primary"
                            : "success"
                        }
                        sx={{ borderRadius: "lg", px: 1.25, py: 1 }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                        >
                          {item.preferredChannel === "email" ? (
                            <Mail size={14} />
                          ) : (
                            <MessageSquare size={14} />
                          )}
                          <Stack spacing={0.1}>
                            <Typography level="body-xs">
                              {item.month}
                            </Typography>
                            <Typography level="body-xs" fontWeight="lg">
                              {item.preferredChannel.toUpperCase()}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Typography level="body-sm" color="neutral">
                    No preferred-channel trend history is available yet.
                  </Typography>
                )}
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Channel recency</Typography>
                {[
                  {
                    label: "Email",
                    value: formatDaysLabel(metrics.daysSinceLastEmail),
                    icon: Mail,
                  },
                  {
                    label: "SMS",
                    value: formatDaysLabel(metrics.daysSinceLastSms),
                    icon: MessageSquare,
                  },
                  {
                    label: "Loyalty",
                    value: formatDaysLabel(metrics.daysSinceLastLoyalty),
                    icon: Star,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Sheet
                      key={item.label}
                      variant="soft"
                      color="neutral"
                      sx={{ borderRadius: "lg", p: 1.5 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={14} />
                          <Typography level="body-sm">{item.label}</Typography>
                        </Stack>
                        <Typography level="body-sm" fontWeight="lg">
                          {item.value}
                        </Typography>
                      </Stack>
                    </Sheet>
                  );
                })}
              </Stack>
            </Sheet>
          </Box>

          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "xl", p: 2 }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Clock3 size={16} />
                <Typography level="title-sm">Engagement decay strip</Typography>
              </Stack>
              {engagementDecay.length > 0 ? (
                <Stack direction="row" spacing={0.75} alignItems="flex-end">
                  {engagementDecay.map((value, index) => (
                    <Box key={`${index}-${value}`} sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          height: `${Math.max(18, clampPercent(value))}%`,
                          minHeight: 18,
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
                  Decay data is not yet available.
                </Typography>
              )}
            </Stack>
          </Sheet>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default CrossChannelIntelligence;
