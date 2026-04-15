import {
  useDeliverabilityStatus,
  DeliverabilityStatus,
  DeliverabilityWarning,
} from "@/hooks/useDeliverabilityStatus";
import { useDomainStats } from "@/hooks/useDomainStats";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { Skeleton } from "@/components/ui-legacy/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui-legacy/alert";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Mail,
  MousePointerClick,
  AlertCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DeliverabilityMonitorProps {
  tenantId?: string;
}

const StatusLight = ({
  status,
}: {
  status: "healthy" | "warning" | "critical";
}) => {
  const config = {
    healthy: {
      color: "bg-green-500",
      shadow: "shadow-green-500/50",
      label: "Healthy",
    },
    warning: {
      color: "bg-amber-500",
      shadow: "shadow-amber-500/50",
      label: "Warning",
    },
    critical: {
      color: "bg-red-500",
      shadow: "shadow-red-500/50",
      label: "Critical",
    },
  }[status];

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <div
        className={cn(
          "w-4 h-4 rounded-full animate-pulse shadow-lg",
          config.color,
          config.shadow,
        )}
      />
      <Typography level="title-md" fontWeight="lg">
        {config.label}
      </Typography>
    </Stack>
  );
};

const MetricCard = ({
  label,
  value,
  icon: Icon,
  trend,
  suffix = "",
  status = "neutral",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  suffix?: string;
  status?: "good" | "warning" | "danger" | "neutral";
}) => {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const statusColors = {
    good: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    neutral: "text-foreground",
  };

  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Sheet
          variant="plain"
          sx={{
            p: 1,
            borderRadius: "var(--joy-radius-sm)",
            backgroundColor: "background.surface",
          }}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
        </Sheet>
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <Stack direction="row" spacing={1} alignItems="center">
            <span className={cn("text-lg font-semibold", statusColors[status])}>
              {value}
              {suffix}
            </span>
            {trend && trend !== "neutral" && (
              <TrendIcon
                className={cn(
                  "h-4 w-4",
                  trend === "up" ? "text-green-500" : "text-red-500",
                )}
              />
            )}
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
};

const WarningCard = ({ warning }: { warning: DeliverabilityWarning }) => {
  const Icon = warning.severity === "critical" ? XCircle : AlertTriangle;

  return (
    <Alert
      variant={warning.severity === "critical" ? "destructive" : "default"}
      className={cn(
        warning.severity === "warning" &&
          "border-amber-500 bg-amber-50 text-amber-900",
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle className="capitalize">
        {warning.type.replace("_", " ")}
      </AlertTitle>
      <AlertDescription>{warning.message}</AlertDescription>
    </Alert>
  );
};

const TrendChart = ({ data }: { data: DeliverabilityStatus }) => {
  const chartData = data.trend.recent_open_rates
    .filter((rate): rate is number => rate !== null)
    .map((rate, index) => ({
      campaign: `Campaign ${3 - index}`,
      openRate: rate,
    }))
    .reverse();

  if (chartData.length < 2) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={192}>
        <Typography level="body-sm" color="neutral">
          Not enough campaign data for trend analysis
        </Typography>
      </Stack>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="campaign" className="text-xs" />
          <YAxis
            domain={[0, "auto"]}
            tickFormatter={(v) => `${v}%`}
            className="text-xs"
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Open Rate"]}
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Line
            type="monotone"
            dataKey="openRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const DeliverabilityDetails = ({ data }: { data: DeliverabilityStatus }) => {
  const getBounceStatus = (rate: number) => {
    if (rate <= 2) return "good";
    if (rate <= 5) return "warning";
    return "danger";
  };

  const getComplaintStatus = (rate: number) => {
    if (rate <= 0.1) return "good";
    if (rate <= 0.2) return "warning";
    return "danger";
  };

  return (
    <Stack spacing={3}>
      <JoyCard>
        <JoyCardHeader
          title={data.domain_name}
          description={data.recommendation}
          startDecorator={<Activity className="h-5 w-5" />}
          actions={<StatusLight status={data.status} />}
        />
        <JoyCardContent>
          <Grid container spacing={1.5}>
            <Grid xs={12} sm={6} lg={3}>
              <MetricCard
                label="Open Rate"
                value={data.rates.open_rate}
                suffix="%"
                icon={Mail}
                trend={data.trend.declining ? "down" : "neutral"}
                status={
                  data.rates.open_rate >= 20
                    ? "good"
                    : data.rates.open_rate >= 10
                      ? "warning"
                      : "danger"
                }
              />
            </Grid>
            <Grid xs={12} sm={6} lg={3}>
              <MetricCard
                label="Click Rate"
                value={data.rates.click_rate}
                suffix="%"
                icon={MousePointerClick}
                status={data.rates.click_rate >= 2 ? "good" : "neutral"}
              />
            </Grid>
            <Grid xs={12} sm={6} lg={3}>
              <MetricCard
                label="Bounce Rate"
                value={data.rates.bounce_rate}
                suffix="%"
                icon={AlertCircle}
                status={getBounceStatus(data.rates.bounce_rate)}
              />
            </Grid>
            <Grid xs={12} sm={6} lg={3}>
              <MetricCard
                label="Complaint Rate"
                value={data.rates.complaint_rate}
                suffix="%"
                icon={XCircle}
                status={getComplaintStatus(data.rates.complaint_rate)}
              />
            </Grid>
          </Grid>
        </JoyCardContent>
      </JoyCard>

      {data.warnings.length > 0 ? (
        <Stack spacing={1}>
          <Typography level="body-sm" fontWeight="md" color="neutral">
            Active Warnings
          </Typography>
          {data.warnings.map((warning, index) => (
            <WarningCard key={index} warning={warning} />
          ))}
        </Stack>
      ) : null}

      <JoyCard>
        <JoyCardHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Open Rate Trend</span>
              {data.trend.declining ? (
                <JoyStatusChip label="Declining" status="declining" />
              ) : null}
            </Stack>
          }
        />
        <JoyCardContent>
          <TrendChart data={data} />
        </JoyCardContent>
      </JoyCard>

      <JoyCard>
        <JoyCardHeader title="30-Day Volume" />
        <JoyCardContent>
          <Grid container spacing={1.5} sx={{ textAlign: "center" }}>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2">
                {data.metrics.sent_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Sent
              </Typography>
            </Grid>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2" sx={{ color: "success.600" }}>
                {data.metrics.delivered_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Delivered
              </Typography>
            </Grid>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2" sx={{ color: "primary.600" }}>
                {data.metrics.opened_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Opened
              </Typography>
            </Grid>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2" sx={{ color: "neutral.700" }}>
                {data.metrics.clicked_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Clicked
              </Typography>
            </Grid>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2" sx={{ color: "warning.600" }}>
                {data.metrics.bounced_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Bounced
              </Typography>
            </Grid>
            <Grid xs={6} md={4} lg={2}>
              <Typography level="h2" sx={{ color: "danger.600" }}>
                {data.metrics.complained_30d.toLocaleString()}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Complained
              </Typography>
            </Grid>
          </Grid>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
};

export const DeliverabilityMonitor = ({
  tenantId,
}: DeliverabilityMonitorProps) => {
  const [selectedDomainId, setSelectedDomainId] = useState<
    string | undefined
  >();
  const { data: domains, isLoading: loadingDomains } = useDomainStats(tenantId);
  const {
    data: deliverabilityData,
    isLoading: loadingStatus,
    error,
  } = useDeliverabilityStatus(selectedDomainId);

  if (loadingDomains) {
    return (
      <JoyCard>
        <JoyCardHeader title="Deliverability Monitor" />
        <JoyCardContent>
          <Skeleton className="h-32 w-full" />
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <JoyCard>
        <JoyCardHeader title="Deliverability Monitor" />
        <JoyCardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <AlertCircle className="h-5 w-5" />
            <span>No sending domains configured</span>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <Stack spacing={2}>
      <JoyCard>
        <JoyCardHeader
          title="Deliverability Monitor"
          description="Monitor domain reputation, track delivery metrics, and get actionable warnings"
        />
        <JoyCardContent>
          <JoySelect
            value={selectedDomainId ?? null}
            onChange={(_, newValue) =>
              setSelectedDomainId(newValue ?? undefined)
            }
            placeholder="Select a domain to analyze"
            options={domains.map((domain) => ({
              value: domain.domain_id,
              label: domain.domain_name,
            }))}
            sx={{ width: { xs: "100%", md: 256 } }}
          />
        </JoyCardContent>
      </JoyCard>

      {loadingStatus && selectedDomainId && (
        <JoyCard>
          <JoyCardContent sx={{ pt: 3 }}>
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </JoyCardContent>
        </JoyCard>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load deliverability status
          </AlertDescription>
        </Alert>
      )}

      {deliverabilityData && (
        <DeliverabilityDetails data={deliverabilityData} />
      )}
    </Stack>
  );
};
