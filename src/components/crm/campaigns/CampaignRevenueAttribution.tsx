import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BadgeDollarSign,
  MousePointerClick,
  Receipt,
  Users,
} from "lucide-react";
import {
  formatAttributedRevenue,
  type CampaignRevenueMetrics,
} from "@/lib/crm/campaignRevenueMetrics";

function AttributionCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <Box sx={{ flex: 1, p: 2.25, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar size="sm" variant="soft" color="success">
          <Icon size={16} />
        </Avatar>
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography level="body-xs" color="neutral">
            {label}
          </Typography>
          <Typography level="title-sm" fontWeight="lg">
            {value}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export function CampaignRevenueAttribution({
  metrics,
}: {
  metrics: CampaignRevenueMetrics;
}) {
  const items = [
    {
      key: "revenue",
      icon: BadgeDollarSign,
      label: "Attributed revenue",
      value: formatAttributedRevenue(metrics),
    },
    {
      key: "customers",
      icon: Users,
      label: "Customers purchased",
      value: metrics.customers.toLocaleString(),
    },
    {
      key: "orders",
      icon: Receipt,
      label: "Attributed orders",
      value: metrics.orders.toLocaleString(),
    },
    {
      key: "model",
      icon: MousePointerClick,
      label: "Attribution method",
      value: `${metrics.windowDays}-day last click`,
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
            <AttributionCell {...item} />
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
        Includes resolved POS purchases after a verified customer click. Opens
        and unlinked purchases are not counted.
      </Typography>
    </Stack>
  );
}
