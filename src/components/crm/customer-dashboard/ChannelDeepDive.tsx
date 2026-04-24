import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import type {
  EmailChannelMetrics,
  SmsChannelMetrics,
} from "@/lib/customerDashboardTransformers";
import { formatPercent } from "./customerDashboardUtils";

interface HeatmapPoint {
  day: string;
  hour: number;
  value: number;
}

interface ChannelDeepDiveProps {
  emailMetrics: EmailChannelMetrics;
  smsMetrics: SmsChannelMetrics;
  emailHeatmapData: HeatmapPoint[];
  smsHeatmapData: HeatmapPoint[];
  emailError?: string | null;
  smsError?: string | null;
  onRetry?: () => void;
}

const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatTime = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) {
    return "Data not available";
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
};

function HeatmapGrid({
  data,
  emptyMessage,
}: {
  data: HeatmapPoint[];
  emptyMessage: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const hours = Array.from({ length: 24 }, (_, index) => index);

  if (data.length === 0 || maxValue === 0) {
    return (
      <Sheet variant="soft" color="neutral" sx={{ borderRadius: "xl", p: 2 }}>
        <Typography level="body-sm" color="neutral">
          {emptyMessage}
        </Typography>
      </Sheet>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "52px repeat(24, minmax(0, 1fr))",
          gap: 0.5,
          alignItems: "center",
        }}
      >
        <Box />
        {hours.map((hour) => (
          <Typography
            key={hour}
            level="body-xs"
            color="neutral"
            textAlign="center"
          >
            {hour % 6 === 0 ? hour : ""}
          </Typography>
        ))}

        {dayOrder.flatMap((day) => {
          const row = [
            <Typography key={`${day}-label`} level="body-xs" color="neutral">
              {day}
            </Typography>,
          ];

          hours.forEach((hour) => {
            const match = data.find(
              (item) => item.day === day && item.hour === hour,
            );
            const value = match?.value ?? 0;
            const opacity = maxValue > 0 ? value / maxValue : 0;

            row.push(
              <Box
                key={`${day}-${hour}`}
                sx={{
                  height: 14,
                  borderRadius: 4,
                  backgroundColor:
                    value > 0
                      ? `rgba(var(--joy-palette-primary-mainChannel) / ${Math.max(0.12, opacity)})`
                      : "var(--joy-palette-neutral-100)",
                }}
              />,
            );
          });

          return row;
        })}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography level="body-xs" color="neutral">
          Lower engagement
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {[0.2, 0.45, 0.7, 1].map((opacity) => (
            <Box
              key={opacity}
              sx={{
                width: 16,
                height: 10,
                borderRadius: 4,
                backgroundColor: `rgba(var(--joy-palette-primary-mainChannel) / ${opacity})`,
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

function FunnelCard({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: Array<{ label: string; value: number }>;
}) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2, height: "100%" }}>
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Typography level="title-sm">{title}</Typography>
        <Box sx={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--joy-palette-neutral-200)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--joy-palette-neutral-200)",
                  backgroundColor: "var(--joy-palette-background-surface)",
                }}
              />
              <Bar
                dataKey="value"
                fill={color}
                radius={[0, 8, 8, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </Sheet>
  );
}

export function ChannelDeepDive({
  emailMetrics,
  smsMetrics,
  emailHeatmapData,
  smsHeatmapData,
  emailError,
  smsError,
  onRetry,
}: ChannelDeepDiveProps) {
  const emailFunnel = [
    { label: "Sent", value: emailMetrics.sent },
    { label: "Delivered", value: emailMetrics.delivered },
    { label: "Opened", value: emailMetrics.opened },
    { label: "Clicked", value: emailMetrics.clicked },
    { label: "Converted", value: emailMetrics.converted ?? 0 },
  ];

  const smsFunnel = [
    { label: "Sent", value: smsMetrics.sent },
    { label: "Delivered", value: smsMetrics.delivered },
    { label: "Clicked", value: smsMetrics.clicked },
    { label: "Replied", value: smsMetrics.replied },
  ];

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Channel deep dive"
        description="Performance detail for email and SMS, including drop-off, timing, and engagement pockets."
        actions={
          (emailError || smsError) && onRetry ? (
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
        <JoyTabs defaultValue={0}>
          <JoyTabsList sx={{ width: "fit-content" }}>
            <JoyTabsTrigger value={0}>Email</JoyTabsTrigger>
            <JoyTabsTrigger value={1}>SMS</JoyTabsTrigger>
          </JoyTabsList>

          <JoyTabsContent value={0}>
            <Stack spacing={2.5}>
              {emailError ? (
                <Sheet
                  color="danger"
                  variant="soft"
                  sx={{ borderRadius: "xl", p: 2 }}
                >
                  <Typography level="title-sm">
                    Email heatmap unavailable
                  </Typography>
                  <Typography level="body-sm" color="danger">
                    {emailError}
                  </Typography>
                </Sheet>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    lg: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
                  },
                  gap: 2,
                }}
              >
                <FunnelCard
                  title="Email funnel"
                  color="var(--joy-palette-primary-400)"
                  data={emailFunnel}
                />

                <Stack spacing={2}>
                  <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Clock size={16} />
                        <Typography level="title-sm">Time to open</Typography>
                      </Stack>
                      <Typography level="title-lg">
                        {formatTime(emailMetrics.avgTimeToOpen)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 1.5 }}
                    >
                      {emailMetrics.isQuickOpener ? (
                        <JoyChip color="success" variant="soft" size="sm">
                          Quick opener
                        </JoyChip>
                      ) : null}
                      <JoyChip color="neutral" variant="soft" size="sm">
                        Open rate {formatPercent(emailMetrics.openRate, 0)}
                      </JoyChip>
                      <JoyChip color="neutral" variant="soft" size="sm">
                        Click rate {formatPercent(emailMetrics.clickRate, 0)}
                      </JoyChip>
                    </Stack>
                  </Sheet>

                  <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography level="title-sm">
                        Open/click heatmap
                      </Typography>
                      <HeatmapGrid
                        data={emailHeatmapData}
                        emptyMessage="No email activity heatmap is available yet for this customer."
                      />
                    </Stack>
                  </Sheet>
                </Stack>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {[
                  { icon: Mail, label: "Sent", value: emailMetrics.sent },
                  {
                    icon: Mail,
                    label: "Open Rate",
                    value: formatPercent(emailMetrics.openRate, 0),
                  },
                  {
                    icon: Mail,
                    label: "Click Rate",
                    value: formatPercent(emailMetrics.clickRate, 0),
                  },
                  {
                    icon: Mail,
                    label: "Unsubscribe",
                    value: formatPercent(emailMetrics.unsubscribeRate, 0),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Sheet
                      key={item.label}
                      variant="soft"
                      color="neutral"
                      sx={{ borderRadius: "xl", p: 2 }}
                    >
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={14} />
                          <Typography level="body-xs" color="neutral">
                            {item.label}
                          </Typography>
                        </Stack>
                        <Typography level="title-lg">{item.value}</Typography>
                      </Stack>
                    </Sheet>
                  );
                })}
              </Box>
            </Stack>
          </JoyTabsContent>

          <JoyTabsContent value={1}>
            <Stack spacing={2.5}>
              {smsError ? (
                <Sheet
                  color="danger"
                  variant="soft"
                  sx={{ borderRadius: "xl", p: 2 }}
                >
                  <Typography level="title-sm">
                    SMS heatmap unavailable
                  </Typography>
                  <Typography level="body-sm" color="danger">
                    {smsError}
                  </Typography>
                </Sheet>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    lg: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
                  },
                  gap: 2,
                }}
              >
                <FunnelCard
                  title="SMS funnel"
                  color="var(--joy-palette-success-400)"
                  data={smsFunnel}
                />

                <Stack spacing={2}>
                  <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Clock size={16} />
                        <Typography level="title-sm">Response time</Typography>
                      </Stack>
                      <Typography level="title-lg">
                        {formatTime(smsMetrics.avgTimeToResponse)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 1.5 }}
                    >
                      <JoyChip color="neutral" variant="soft" size="sm">
                        Delivery {formatPercent(smsMetrics.deliveryRate, 0)}
                      </JoyChip>
                      <JoyChip color="neutral" variant="soft" size="sm">
                        Click {formatPercent(smsMetrics.clickRate, 0)}
                      </JoyChip>
                      <JoyChip color="neutral" variant="soft" size="sm">
                        Reply {formatPercent(smsMetrics.replyRate, 0)}
                      </JoyChip>
                    </Stack>
                  </Sheet>

                  <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography level="title-sm">
                        Reply/click heatmap
                      </Typography>
                      <HeatmapGrid
                        data={smsHeatmapData}
                        emptyMessage="No SMS activity heatmap is available yet for this customer."
                      />
                    </Stack>
                  </Sheet>
                </Stack>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {[
                  {
                    icon: MessageSquare,
                    label: "Sent",
                    value: smsMetrics.sent,
                  },
                  {
                    icon: MessageSquare,
                    label: "Delivery Rate",
                    value: formatPercent(smsMetrics.deliveryRate, 0),
                  },
                  {
                    icon: MessageSquare,
                    label: "Reply Rate",
                    value: formatPercent(smsMetrics.replyRate, 0),
                  },
                  {
                    icon: MessageSquare,
                    label: "Opt-out",
                    value: formatPercent(smsMetrics.optOutRate, 0),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Sheet
                      key={item.label}
                      variant="soft"
                      color="neutral"
                      sx={{ borderRadius: "xl", p: 2 }}
                    >
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon size={14} />
                          <Typography level="body-xs" color="neutral">
                            {item.label}
                          </Typography>
                        </Stack>
                        <Typography level="title-lg">{item.value}</Typography>
                      </Stack>
                    </Sheet>
                  );
                })}
              </Box>
            </Stack>
          </JoyTabsContent>
        </JoyTabs>
      </JoyCardContent>
    </JoyCard>
  );
}

export default ChannelDeepDive;
