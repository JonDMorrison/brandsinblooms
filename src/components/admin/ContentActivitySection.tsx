import { Calendar, Activity } from "lucide-react";
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

interface ContentActivitySectionProps {
  metrics: AdminMetrics;
}

export const ContentActivitySection = ({
  metrics,
}: ContentActivitySectionProps) => {
  return (
    <Stack spacing={2}>
      <Typography
        level="title-lg"
        sx={{ color: "var(--joy-palette-brandNavy-800)" }}
      >
        Content Activity
      </Typography>
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <MetricCard
            title="Total Campaigns"
            value={metrics.totalCampaigns}
            description="Created campaigns"
            icon={Calendar}
            color={
              metrics.totalCampaigns > 0 ? "text-purple-600" : "text-gray-400"
            }
            borderColor={
              metrics.totalCampaigns > 0
                ? "border-purple-200"
                : "border-gray-200"
            }
            bgColor={metrics.totalCampaigns > 0 ? "bg-purple-50" : "bg-gray-50"}
            clickable={true}
            href="/admin/campaigns"
          />
        </Grid>
        <Grid xs={12} md={6}>
          <MetricCard
            title="Content Tasks"
            value={metrics.totalTasks}
            description="Generated content pieces"
            icon={Activity}
            color={metrics.totalTasks > 0 ? "text-indigo-600" : "text-gray-400"}
            borderColor={
              metrics.totalTasks > 0 ? "border-indigo-200" : "border-gray-200"
            }
            bgColor={metrics.totalTasks > 0 ? "bg-indigo-50" : "bg-gray-50"}
            clickable={true}
            href="/admin/content-tasks"
          />
        </Grid>
      </Grid>
    </Stack>
  );
};
