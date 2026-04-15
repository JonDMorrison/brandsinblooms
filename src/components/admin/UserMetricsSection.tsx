import { Users, UserCheck, Crown } from "lucide-react";
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

interface UserMetricsSectionProps {
  metrics: AdminMetrics;
}

export const UserMetricsSection = ({ metrics }: UserMetricsSectionProps) => {
  return (
    <Stack spacing={2}>
      <Typography
        level="title-lg"
        sx={{ color: "var(--joy-palette-brandNavy-800)" }}
      >
        User Metrics
      </Typography>
      <Grid container spacing={3}>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Total Users"
            value={metrics.totalUsers}
            description="All registered users"
            icon={Users}
            color={metrics.totalUsers > 0 ? "text-blue-600" : "text-gray-400"}
            borderColor={
              metrics.totalUsers > 0 ? "border-blue-200" : "border-gray-200"
            }
            bgColor={metrics.totalUsers > 0 ? "bg-blue-50" : "bg-gray-50"}
            clickable={true}
            href="/admin/users"
          />
        </Grid>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Free Trial Users"
            value={metrics.freeTrialUsers}
            description="Users on free trial"
            icon={UserCheck}
            color={
              metrics.freeTrialUsers > 0 ? "text-orange-600" : "text-gray-400"
            }
            borderColor={
              metrics.freeTrialUsers > 0
                ? "border-orange-200"
                : "border-gray-200"
            }
            bgColor={metrics.freeTrialUsers > 0 ? "bg-orange-50" : "bg-gray-50"}
            clickable={true}
            href="/admin/users?filter=free_trial"
          />
        </Grid>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Paid Users"
            value={metrics.paidUsers}
            description="Paying customers"
            icon={Crown}
            color={metrics.paidUsers > 0 ? "text-green-600" : "text-gray-400"}
            borderColor={
              metrics.paidUsers > 0 ? "border-green-200" : "border-gray-200"
            }
            bgColor={metrics.paidUsers > 0 ? "bg-green-50" : "bg-gray-50"}
            clickable={true}
            href="/admin/users?filter=paid"
          />
        </Grid>
      </Grid>
    </Stack>
  );
};
