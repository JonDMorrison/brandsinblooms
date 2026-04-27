import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  MinusCircle,
  XCircle,
} from "lucide-react";

export interface CampaignDeliverySummaryProps {
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function DeliveryCell({
  icon: Icon,
  label,
  value,
  detail,
  valueColor,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  detail?: string;
  valueColor?: "neutral" | "warning" | "danger";
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
            level="title-md"
            fontWeight="lg"
            color={valueColor ?? "neutral"}
          >
            {value}
          </Typography>
          {detail ? (
            <Typography level="body-xs" color="neutral">
              {detail}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export function CampaignDeliverySummary({
  sent,
  delivered,
  bounced,
  failed,
  skipped,
}: CampaignDeliverySummaryProps) {
  const bounceRate = sent > 0 ? bounced / sent : 0;
  const bounceTone = bounceRate > 0.05 ? "danger" : "neutral";

  const items = [
    {
      key: "sent",
      icon: Mail,
      label: "Total Sent",
      value: sent.toLocaleString(),
    },
    {
      key: "delivered",
      icon: CheckCircle2,
      label: "Delivered",
      value: delivered.toLocaleString(),
      detail: formatPercent(delivered, sent),
    },
    {
      key: "bounced",
      icon: AlertTriangle,
      label: "Bounced",
      value: bounced.toLocaleString(),
      detail: formatPercent(bounced, sent),
      valueColor: bounceTone,
    },
    {
      key: "failed",
      icon: XCircle,
      label: "Failed",
      value: failed.toLocaleString(),
      detail: formatPercent(failed, sent),
    },
    {
      key: "skipped",
      icon: MinusCircle,
      label: "Skipped",
      value: skipped.toLocaleString(),
      detail: formatPercent(skipped, sent),
    },
  ] as const;

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "lg",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        overflow: "hidden",
      }}
    >
      {items.map(({ key, ...item }, index) => (
        <React.Fragment key={key}>
          <DeliveryCell {...item} />
          {index < items.length - 1 ? (
            <>
              <Divider sx={{ display: { xs: "block", md: "none" } }} />
              <Divider
                orientation="vertical"
                sx={{ display: { xs: "none", md: "block" } }}
              />
            </>
          ) : null}
        </React.Fragment>
      ))}
    </Sheet>
  );
}
