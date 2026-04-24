import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useSubscription } from "@/hooks/useSubscription";
import { Link as RouterLink } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Infinity,
  Mail,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

const tierLabels: Record<string, string> = {
  seed: "Seed",
  sprout: "Sprout",
  bloom: "Bloom",
  thrive: "Thrive",
  legacy: "Legacy",
  free_trial: "Free Trial",
  free: "Free",
};

const intervalLabels: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  yearly: "Annual",
};

const usageCardSx = {
  p: 3,
  gap: 2.5,
  boxShadow: "none",
  bgcolor: "background.surface",
};

const softMetricSx = {
  borderRadius: "18px",
  p: 2,
  bgcolor: "background.level1",
};

const countFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatCount = (value: number) => countFormatter.format(Math.max(0, value));

const formatRate = (value: number | null | undefined, unit: string) => {
  if (!value || value <= 0) {
    return "N/A";
  }

  return `${currencyFormatter.format(value)} / ${unit}`;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return dateFormatter.format(date);
};

const getCurrentPeriodStart = (endDate: string | null | undefined, billingInterval: string) => {
  if (!endDate) {
    return null;
  }

  const currentPeriodEnd = new Date(endDate);

  if (Number.isNaN(currentPeriodEnd.getTime())) {
    return null;
  }

  const currentPeriodStart = new Date(currentPeriodEnd);

  if (billingInterval === "annual" || billingInterval === "yearly") {
    currentPeriodStart.setFullYear(currentPeriodStart.getFullYear() - 1);
  } else {
    currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 1);
  }

  return currentPeriodStart.toISOString();
};

const getProgressColor = (percent: number) => {
  if (percent >= 100) {
    return "danger" as const;
  }

  if (percent >= 80) {
    return "warning" as const;
  }

  if (percent >= 60) {
    return "primary" as const;
  }

  return "neutral" as const;
};

const UsageLoadingState = () => {
  return (
    <Stack spacing={3}>
      <JoyCard sx={{ ...usageCardSx, minHeight: 100 }} variant="outlined">
        <Skeleton animation="wave" sx={{ height: 24, width: 180 }} variant="text" />
        <Skeleton animation="wave" sx={{ height: 18, width: 260 }} variant="text" />
      </JoyCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
        }}
      >
        {Array.from({ length: 2 }).map((_, index) => (
          <JoyCard key={index} sx={{ ...usageCardSx, minHeight: 180 }} variant="outlined">
            <Skeleton animation="wave" sx={{ height: 24, width: 120 }} variant="text" />
            <Skeleton animation="wave" sx={{ height: 12, width: "100%", borderRadius: 999 }} variant="rectangular" />
            <Skeleton animation="wave" sx={{ height: 18, width: "68%" }} variant="text" />
            <Skeleton animation="wave" sx={{ height: 18, width: "52%" }} variant="text" />
          </JoyCard>
        ))}
      </Box>

      <JoyCard sx={{ ...usageCardSx, minHeight: 80 }} variant="outlined">
        <Skeleton animation="wave" sx={{ height: 20, width: 140 }} variant="text" />
        <Skeleton animation="wave" sx={{ height: 18, width: "100%" }} variant="text" />
      </JoyCard>
    </Stack>
  );
};

const UsageErrorState = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <JoyCard sx={{ ...usageCardSx, alignItems: "center", textAlign: "center" }} variant="outlined">
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "18px",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.level1",
          color: "danger.500",
        }}
      >
        <AlertCircle size={24} />
      </Box>
      <Stack spacing={0.75} alignItems="center">
        <Typography level="title-md">Failed to load usage data</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 420 }}>
          Usage statistics could not be loaded right now. Retry to fetch the latest plan usage and limits.
        </Typography>
      </Stack>
      <JoyButton color="neutral" onClick={onRetry} variant="outline">
        Retry
      </JoyButton>
    </JoyCard>
  );
};

const UsageEmptyState = () => {
  return (
    <JoyCard sx={{ ...usageCardSx, alignItems: "center", textAlign: "center", minHeight: 280 }} variant="outlined">
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "22px",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.level1",
          color: "text.tertiary",
        }}
      >
        <BarChart3 size={40} />
      </Box>
      <Stack spacing={0.75} alignItems="center">
        <Typography level="title-md">No usage data yet</Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 420 }}>
          Usage statistics will appear here once you start sending emails and SMS.
        </Typography>
      </Stack>
    </JoyCard>
  );
};

const UsageMetricCard = ({
  title,
  icon,
  used,
  limit,
  remaining,
  percent,
  unlimited,
  overageThisMonth,
  overageRate,
}: {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  unlimited: boolean;
  overageThisMonth: number;
  overageRate: number;
}) => {
  const overageCost = overageThisMonth > 0 && overageRate > 0
    ? currencyFormatter.format(overageThisMonth * overageRate)
    : "None";

  return (
    <JoyCard sx={usageCardSx} variant="outlined">
      <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.level1",
              color: "text.secondary",
            }}
          >
            {icon}
          </Box>
          <Typography level="title-sm">{title}</Typography>
        </Stack>

        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {formatCount(used)} / {unlimited ? "Unlimited" : formatCount(limit)}
        </Typography>
      </Stack>

      {unlimited ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "success.plainColor" }}>
          <Infinity size={18} />
          <Typography level="body-sm" sx={{ color: "success.plainColor" }}>
            Unlimited
          </Typography>
        </Stack>
      ) : (
        <LinearProgress
          color={getProgressColor(percent)}
          determinate
          thickness={8}
          value={Math.min(percent, 100)}
          sx={{ borderRadius: 4 }}
        />
      )}

      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Stack spacing={0.5}>
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            Remaining
          </Typography>
          <Typography level="body-sm">
            {unlimited ? "Unlimited" : formatCount(remaining)}
          </Typography>
        </Stack>
        <Stack spacing={0.5} sx={{ textAlign: "right" }}>
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            Overage this month
          </Typography>
          <Typography level="body-sm">{overageCost}</Typography>
        </Stack>
      </Stack>
    </JoyCard>
  );
};

export const UsageDashboard = () => {
  const {
    usage,
    loading: usageLoading,
    error,
    refetch,
    getUpgradeRecommendation,
  } = useUsageTracking();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  if (usageLoading || subscriptionLoading) {
    return <UsageLoadingState />;
  }

  if (error && !usage) {
    return <UsageErrorState onRetry={() => void refetch()} />;
  }

  if (!usage) {
    return <UsageEmptyState />;
  }

  const recommendation = getUpgradeRecommendation();
  const planLabel = tierLabels[usage.tier] ?? tierLabels[usage.plan] ?? usage.plan;
  const billingInterval = intervalLabels[usage.billingInterval] ?? usage.billingInterval;
  const renewalDate = usage.endDate || subscription?.end_date;
  const currentPeriodStart = getCurrentPeriodStart(renewalDate, usage.billingInterval);
  const emailOverageRate = usage.email.overageRate || subscription?.email_overage_price || 0;
  const smsOverageRate = usage.sms.overageRate || subscription?.sms_overage_price || 0;

  return (
    <Stack spacing={3}>
      <JoyCard sx={usageCardSx} variant="outlined">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <JoyChip color="primary" size="md" variant="soft">
              {planLabel}
            </JoyChip>
            <JoyChip color="neutral" size="sm" variant="outlined">
              {billingInterval}
            </JoyChip>
            {usage.isFoundingCustomer ? (
              <JoyChip color="success" size="sm" variant="soft">
                Founding Member
              </JoyChip>
            ) : null}
          </Stack>

          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Renews {formatDate(renewalDate)}
          </Typography>
        </Stack>
      </JoyCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
        }}
      >
        <UsageMetricCard
          icon={<Mail size={18} />}
          limit={usage.email.limit}
          overageRate={emailOverageRate}
          overageThisMonth={usage.email.overageThisMonth}
          percent={usage.email.percent}
          remaining={usage.email.remaining}
          title="Email"
          unlimited={usage.email.unlimited}
          used={usage.email.used}
        />
        <UsageMetricCard
          icon={<MessageSquare size={18} />}
          limit={usage.sms.limit}
          overageRate={smsOverageRate}
          overageThisMonth={usage.sms.overageThisMonth}
          percent={usage.sms.percent}
          remaining={usage.sms.remaining}
          title="SMS"
          unlimited={usage.sms.unlimited}
          used={usage.sms.used}
        />
      </Box>

      <JoyCard sx={usageCardSx} variant="outlined">
        <Typography level="title-sm">Billing Cycle</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          <Sheet sx={softMetricSx} variant="soft">
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Billing interval
            </Typography>
            <Typography level="body-sm">{billingInterval}</Typography>
          </Sheet>
          <Sheet sx={softMetricSx} variant="soft">
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Current period
            </Typography>
            <Typography level="body-sm">
              {formatDate(currentPeriodStart)}  {formatDate(renewalDate)}
            </Typography>
          </Sheet>
          <Sheet sx={softMetricSx} variant="soft">
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Overage rate (email)
            </Typography>
            <Typography level="body-sm">{formatRate(emailOverageRate, "email")}</Typography>
          </Sheet>
          <Sheet sx={softMetricSx} variant="soft">
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Overage rate (SMS)
            </Typography>
            <Typography level="body-sm">{formatRate(smsOverageRate, "SMS")}</Typography>
          </Sheet>
        </Box>
      </JoyCard>

      {recommendation.shouldUpgrade && (
        <Alert
          color="neutral"
          startDecorator={<TrendingUp size={20} />}
          endDecorator={
            <JoyButton component={RouterLink} size="sm" to="/pricing" variant="outline">
              View Plans
            </JoyButton>
          }
          sx={{ borderRadius: "20px", bgcolor: "background.surface" }}
          variant="outlined"
        >
          <Stack spacing={0.5}>
            <Typography level="body-sm">{recommendation.reason}</Typography>
            {recommendation.savings ? (
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {recommendation.savings}
              </Typography>
            ) : null}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
};
