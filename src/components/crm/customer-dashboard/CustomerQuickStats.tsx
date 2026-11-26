import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Activity,
  Clock3,
  DollarSign,
  MessageSquare,
  ShoppingBag,
} from "lucide-react";
import {
  clampPercent,
  formatAccountAge,
  formatCompactNumber,
  formatCurrency,
  getScoreColor,
  humanizeChannel,
} from "./customerDashboardUtils";

export interface CustomerQuickStatsProps {
  /** Computed engagement score 0-100; null when there is no signal yet. */
  engagementScore?: number | null;
  lifetimeValue?: number | null;
  totalOrders?: number | null;
  preferredChannel?: string | null;
  accountAgeDays?: number | null;
  loading?: boolean;
}

const engagementValue = (score?: number | null) => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "Not enough data";
  }

  return (
    <CircularProgress
      determinate
      value={clampPercent(score)}
      color={getScoreColor(score)}
      size="lg"
      aria-label={`Engagement ${Math.round(score)} out of 100`}
      sx={{
        "--CircularProgress-size": "56px",
        "--CircularProgress-thickness": "5px",
      }}
    >
      <Typography level="body-sm" fontWeight="lg">
        {Math.round(score)}
      </Typography>
    </CircularProgress>
  );
};

const stats = (props: CustomerQuickStatsProps) => [
  {
    icon: Activity,
    label: "Engagement",
    value: engagementValue(props.engagementScore),
  },
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
        A grid, not one forced row. Two columns on phones, three on
        tablets, five when wide. The 1px gap over a neutral background
        draws the dividers. Engagement reads the computed score
        (customer_engagement_scores); a customer without one shows
        "Not enough data", never 0.
      */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(5, minmax(0, 1fr))",
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
