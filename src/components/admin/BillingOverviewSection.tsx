import { CreditCard, TrendingUp } from "lucide-react";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MetricCard } from "./MetricCard";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface BillingOverviewSectionProps {
  metrics: AdminMetrics;
}

export const BillingOverviewSection = ({
  metrics,
}: BillingOverviewSectionProps) => {
  const conversionRate =
    metrics.totalUsers > 0
      ? Math.round((metrics.paidUsers / metrics.totalUsers) * 100)
      : 0;

  return (
    <Stack spacing={2}>
      <Typography
        level="title-lg"
        sx={{ color: "var(--joy-palette-brandNavy-800)" }}
      >
        Billing Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <MetricCard
            title="Active Subscriptions"
            value={metrics.activeSubscriptions}
            description="Currently active plans"
            icon={CreditCard}
            color={
              metrics.activeSubscriptions > 0
                ? "text-green-600"
                : "text-gray-400"
            }
            borderColor={
              metrics.activeSubscriptions > 0
                ? "border-green-200"
                : "border-gray-200"
            }
            bgColor={
              metrics.activeSubscriptions > 0 ? "bg-green-50" : "bg-gray-50"
            }
            clickable={true}
            href="/admin/subscriptions"
          />
        </Grid>
        <Grid xs={12} md={6}>
          <MetricCard
            title="Conversion Rate"
            value={conversionRate}
            description="Free trial to paid conversion"
            icon={TrendingUp}
            color={conversionRate > 0 ? "text-blue-600" : "text-gray-400"}
            borderColor={
              conversionRate > 0 ? "border-blue-200" : "border-gray-200"
            }
            bgColor={conversionRate > 0 ? "bg-blue-50" : "bg-gray-50"}
            suffix="%"
            clickable={false}
          />
        </Grid>
      </Grid>
    </Stack>
  );
};
