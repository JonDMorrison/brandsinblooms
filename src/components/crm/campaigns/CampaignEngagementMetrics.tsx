import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Eye, Flag, MousePointerClick, UserMinus } from "lucide-react";

export interface CampaignEngagementMetricsProps {
  uniqueOpens: number;
  totalOpens: number;
  adjustedUniqueOpens: number;
  adjustedTotalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  unsubscribes: number;
  complaints: number;
  totalDelivered: number;
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function EngagementCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  color?: "neutral" | "warning" | "danger";
}) {
  return (
    <Box sx={{ flex: 1, p: 2.25, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar size="sm" variant="soft" color="neutral">
          <Icon size={16} />
        </Avatar>
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography level="body-xs" color="neutral">
            {label}
          </Typography>
          <Typography
            level="title-sm"
            fontWeight="lg"
            color={color ?? "neutral"}
          >
            {value}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export function CampaignEngagementMetrics({
  uniqueOpens,
  totalOpens,
  adjustedUniqueOpens,
  adjustedTotalOpens,
  uniqueClicks,
  totalClicks,
  unsubscribes,
  complaints,
  totalDelivered,
}: CampaignEngagementMetricsProps) {
  const complaintRate = totalDelivered > 0 ? complaints / totalDelivered : 0;
  const items = [
    {
      key: "clicked",
      icon: MousePointerClick,
      label: "Clicked",
      value: `${uniqueClicks.toLocaleString()} unique / ${totalClicks.toLocaleString()} total (${formatPercent(uniqueClicks, totalDelivered)})`,
    },
    {
      key: "opened",
      icon: Eye,
      label: "Opened (reported)",
      value: `${uniqueOpens.toLocaleString()} unique / ${totalOpens.toLocaleString()} total (${formatPercent(uniqueOpens, totalDelivered)})`,
    },
    {
      key: "unsubscribed",
      icon: UserMinus,
      label: "Unsubscribed",
      value: `${unsubscribes.toLocaleString()} (${formatPercent(unsubscribes, totalDelivered)})`,
    },
    {
      key: "complaints",
      icon: Flag,
      label: "Complaints",
      value: `${complaints.toLocaleString()} (${formatPercent(complaints, totalDelivered)})`,
      color: complaintRate > 0.001 ? "danger" : "neutral",
    },
  ] as const;

  return (
    <Stack spacing={0.75}>
      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "lg",
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          overflow: "hidden",
        }}
      >
        {items.map(({ key, ...item }, index) => (
          <React.Fragment key={key}>
            <EngagementCell {...item} />
            {index < items.length - 1 ? (
              <>
                <Divider sx={{ display: { xs: "block", lg: "none" } }} />
                <Divider
                  orientation="vertical"
                  sx={{ display: { xs: "none", lg: "block" } }}
                />
              </>
            ) : null}
          </React.Fragment>
        ))}
      </Sheet>
      <Typography level="body-xs" color="neutral" sx={{ px: 0.5 }}>
        Open tracking can be inflated by mail privacy features. Estimated
        non-privacy opens: {adjustedUniqueOpens.toLocaleString()} unique /{" "}
        {adjustedTotalOpens.toLocaleString()} total. Clicks are more reliable.
      </Typography>
    </Stack>
  );
}
