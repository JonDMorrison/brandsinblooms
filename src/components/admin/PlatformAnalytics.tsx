import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface PlatformAnalyticsProps {
  metrics: AdminMetrics;
}

export const PlatformAnalytics = ({ metrics }: PlatformAnalyticsProps) => {
  const conversionRate =
    metrics.totalUsers > 0
      ? Math.round((metrics.paidUsers / metrics.totalUsers) * 100)
      : 0;

  return (
    <Grid container spacing={3}>
      <Grid xs={12} md={6}>
        <Stack spacing={2}>
          <Typography level="title-md">Subscription Breakdown</Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-md">Active Subscriptions:</Typography>
              <Typography level="body-md" color="success" fontWeight="lg">
                {metrics.activeSubscriptions}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-md">Free Trial Users:</Typography>
              <Typography level="body-md" color="primary" fontWeight="lg">
                {metrics.freeTrialUsers}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-md">Paid Users:</Typography>
              <Typography level="body-md" color="warning" fontWeight="lg">
                {metrics.paidUsers}
              </Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography level="title-sm">Total Users:</Typography>
              <Typography level="title-sm">{metrics.totalUsers}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-sm" color="neutral">
                Conversion Rate:
              </Typography>
              <Typography level="body-sm" color="neutral">
                {conversionRate}%
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Grid>

      <Grid xs={12} md={6}>
        <Stack spacing={2}>
          <Typography level="title-md">Content Statistics</Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-md">Campaigns:</Typography>
              <Typography level="body-md" fontWeight="lg">
                {metrics.totalCampaigns}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography level="body-md">Content Tasks:</Typography>
              <Typography level="body-md" fontWeight="lg">
                {metrics.totalTasks}
              </Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography level="title-sm">Avg Tasks/Campaign:</Typography>
              <Typography level="title-sm">
                {metrics.totalCampaigns > 0
                  ? Math.round(metrics.totalTasks / metrics.totalCampaigns)
                  : 0}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Grid>
    </Grid>
  );
};
