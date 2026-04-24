import Box from "@mui/joy/Box";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Globe, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  formatAnalyticsDay,
  formatCompactNumber,
  formatDurationLabel,
  formatPercent,
  formatRelativeTimestamp,
} from "@/components/analytics/analyticsUtils";

interface GoogleAnalyticsCardProps {
  propertyId?: string;
  dateRange?: number;
}

export const GoogleAnalyticsCard = ({
  propertyId,
  dateRange = 30,
}: GoogleAnalyticsCardProps) => {
  const { data, loading, error, refresh } = useGoogleAnalytics(
    propertyId,
    dateRange,
  );

  if (!propertyId) {
    return (
      <JoyCard variant="soft" color="neutral">
        <JoyCardContent sx={{ pt: 4 }}>
          <JoyEmptyState
            icon={<Globe />}
            title="Connect Google Analytics"
            description="See website traffic, visitor quality, and audience geography once your GA4 property is connected."
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (loading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title={<Skeleton variant="text" sx={{ width: 180 }} />}
          actions={
            <Skeleton variant="rectangular" sx={{ width: 96, height: 24 }} />
          }
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <Grid container spacing={1.5}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Grid key={index} xs={12} sm={6} lg={3}>
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ p: 1.5, borderRadius: "md" }}
                  >
                    <Skeleton variant="text" sx={{ width: 72 }} />
                    <Skeleton variant="text" sx={{ width: 96, height: 28 }} />
                  </Sheet>
                </Grid>
              ))}
            </Grid>
            <Skeleton
              variant="rectangular"
              sx={{ height: 220, borderRadius: "lg" }}
            />
            <Grid container spacing={1.5}>
              <Grid xs={12} md={6}>
                <Skeleton
                  variant="rectangular"
                  sx={{ height: 120, borderRadius: "lg" }}
                />
              </Grid>
              <Grid xs={12} md={6}>
                <Skeleton
                  variant="rectangular"
                  sx={{ height: 120, borderRadius: "lg" }}
                />
              </Grid>
            </Grid>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardHeader title="Website Analytics" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load website analytics.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="danger"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void refresh()}
            >
              Retry
            </JoyButton>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!data) {
    return null;
  }

  const metrics = [
    {
      label: "Page Views",
      value: formatCompactNumber(data.overview.totalPageviews),
    },
    {
      label: "Sessions",
      value: formatCompactNumber(data.overview.totalSessions),
    },
    {
      label: "Avg Duration",
      value: formatDurationLabel(data.overview.avgSessionDuration),
    },
    {
      label: "Bounce Rate",
      value: formatPercent(data.overview.bounceRate),
    },
  ];

  const deviceChartData = data.deviceBreakdown.map((device) => ({
    ...device,
    value: device.sessions,
  }));
  const deviceColors = [
    "var(--joy-palette-primary-500)",
    "var(--joy-palette-success-500)",
    "var(--joy-palette-warning-500)",
  ];

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Website Analytics"
        description={`GA4 traffic and audience quality across the last ${dateRange} days`}
        actions={
          <Stack direction="row" spacing={0.75} alignItems="center">
            {data.isMockData ? (
              <JoyChip size="sm" variant="soft" color="warning">
                Demo Data
              </JoyChip>
            ) : null}
            <JoyChip size="sm" variant="soft" color="neutral">
              {dateRange}d
            </JoyChip>
          </Stack>
        }
        startDecorator={<Globe size={18} />}
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          <Grid container spacing={1.5}>
            {metrics.map((metric) => (
              <Grid key={metric.label} xs={12} sm={6} lg={3}>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{
                    borderRadius: "md",
                    p: 1.5,
                    background:
                      "linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.08), rgba(var(--joy-palette-neutral-mainChannel) / 0.02))",
                  }}
                >
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {metric.label}
                  </Typography>
                  <Typography
                    level="title-lg"
                    sx={{
                      color: "neutral.900",
                      fontWeight: 700,
                      fontFamily: "var(--joy-fontFamily-display)",
                    }}
                  >
                    {metric.value}
                  </Typography>
                </Sheet>
              </Grid>
            ))}
          </Grid>

          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 1.5, borderRadius: "lg" }}
          >
            <Stack spacing={1}>
              <Typography
                level="body-sm"
                sx={{ color: "neutral.700", fontWeight: 600 }}
              >
                Daily Traffic Trend
              </Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.dailyData}
                    margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.08)"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      tick={{
                        fill: "var(--joy-palette-neutral-500)",
                        fontSize: 12,
                      }}
                      tickFormatter={formatAnalyticsDay}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fill: "var(--joy-palette-neutral-500)",
                        fontSize: 12,
                      }}
                      tickFormatter={(value: number) =>
                        formatCompactNumber(value)
                      }
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      content={({ active, label, payload }) => {
                        if (!active || !payload?.length) {
                          return null;
                        }

                        return (
                          <Box
                            sx={{
                              borderRadius: "md",
                              border: "1px solid",
                              borderColor: "neutral.200",
                              backgroundColor: "background.surface",
                              boxShadow: "var(--joy-shadow-md)",
                              px: 1.25,
                              py: 1,
                            }}
                          >
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.500", mb: 0.25 }}
                            >
                              {label ? formatAnalyticsDay(label) : "Traffic"}
                            </Typography>
                            <Typography level="title-sm">
                              {formatCompactNumber(payload[0]?.value as number)}{" "}
                              sessions
                            </Typography>
                          </Box>
                        );
                      }}
                    />
                    <Line
                      dataKey="sessions"
                      dot={false}
                      name="Sessions"
                      stroke="var(--joy-palette-primary-500)"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          </Sheet>

          <Grid container spacing={1.5}>
            <Grid xs={12} md={6}>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 1.5, borderRadius: "lg", height: "100%" }}
              >
                <Stack spacing={1.25}>
                  <Typography
                    level="body-sm"
                    sx={{ color: "neutral.700", fontWeight: 600 }}
                  >
                    Top Countries
                  </Typography>
                  <Stack spacing={0.9}>
                    {data.topCountries.slice(0, 5).map((country) => (
                      <Stack
                        key={country.country}
                        direction="row"
                        justifyContent="space-between"
                        spacing={1.5}
                      >
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.700" }}
                        >
                          {country.country}
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.900", fontWeight: 600 }}
                        >
                          {formatCompactNumber(country.sessions)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Sheet>
            </Grid>
            <Grid xs={12} md={6}>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 1.5, borderRadius: "lg", height: "100%" }}
              >
                <Stack spacing={1.25}>
                  <Typography
                    level="body-sm"
                    sx={{ color: "neutral.700", fontWeight: 600 }}
                  >
                    Device Types
                  </Typography>
                  <Grid container spacing={1} alignItems="center">
                    <Grid xs={12} sm={6}>
                      <Box sx={{ height: 120 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceChartData}
                              innerRadius={28}
                              outerRadius={48}
                              dataKey="value"
                              paddingAngle={2}
                            >
                              {deviceChartData.map((entry, index) => (
                                <Cell
                                  key={entry.device}
                                  fill={
                                    deviceColors[index % deviceColors.length]
                                  }
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Grid>
                    <Grid xs={12} sm={6}>
                      <Stack spacing={0.8}>
                        {data.deviceBreakdown.map((device, index) => (
                          <Stack
                            key={device.device}
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  backgroundColor:
                                    deviceColors[index % deviceColors.length],
                                }}
                              />
                              <Typography
                                level="body-sm"
                                sx={{
                                  color: "neutral.700",
                                  textTransform: "capitalize",
                                }}
                              >
                                {device.device}
                              </Typography>
                            </Stack>
                            <Typography
                              level="body-sm"
                              sx={{ color: "neutral.900", fontWeight: 600 }}
                            >
                              {formatCompactNumber(device.sessions)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              </Sheet>
            </Grid>
          </Grid>

          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Last updated {formatRelativeTimestamp(data.lastUpdated)}
          </Typography>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};
