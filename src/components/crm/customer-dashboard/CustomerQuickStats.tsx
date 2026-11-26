import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Clock3,
  DollarSign,
  MessageSquare,
  ShoppingBag,
} from "lucide-react";
import {
  formatAccountAge,
  formatCompactNumber,
  formatCurrency,
  humanizeChannel,
} from "./customerDashboardUtils";

export interface CustomerQuickStatsProps {
  lifetimeValue?: number | null;
  totalOrders?: number | null;
  preferredChannel?: string | null;
  accountAgeDays?: number | null;
  loading?: boolean;
}

const stats = (props: CustomerQuickStatsProps) => [
  {
    icon: DollarSign,
    label: "Lifetime Value",
    value: formatCurrency(props.lifetimeValue),
  },
  {
    icon: ShoppingBag,
    label: "Total Orders",
    value: formatCompactNumber(props.totalOrders),
  },
  {
    icon: MessageSquare,
    label: "Preferred Channel",
    value: humanizeChannel(props.preferredChannel),
  },
  {
    icon: Clock3,
    label: "Account Age",
    value: formatAccountAge(props.accountAgeDays),
  },
];

export function CustomerQuickStats(props: CustomerQuickStatsProps) {
  const items = stats(props);

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "xl",
        borderColor: "neutral.200",
        boxShadow: "xs",
        overflow: "hidden",
      }}
    >
      {/*
        A grid, not one forced row. Two columns on phones, four when wide.
        The 1px gap over a neutral background draws the dividers.
        Health and engagement score rings were removed: their source
        (customer_360_enriched.engagement_overall_score) is never computed
        and read 0 for every customer.
      */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: "1px",
          bgcolor: "neutral.200",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Stack
              key={item.label}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                px: 2,
                py: 1.75,
                minWidth: 0,
                bgcolor: "background.surface",
              }}
            >
              <Sheet
                variant="soft"
                color="neutral"
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: "lg",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </Sheet>

              <Stack spacing={0.375} sx={{ minWidth: 0 }}>
                <Typography level="body-xs" color="neutral">
                  {item.label}
                </Typography>
                {typeof item.value === "string" ? (
                  <Typography
                    level="title-md"
                    sx={{ overflowWrap: "anywhere", lineHeight: 1.3 }}
                  >
                    {item.value}
                  </Typography>
                ) : (
                  <Box>{item.value}</Box>
                )}
              </Stack>
            </Stack>
          );
        })}
      </Box>
    </Sheet>
  );
}
