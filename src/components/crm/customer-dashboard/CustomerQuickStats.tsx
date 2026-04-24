import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Activity,
  Clock3,
  DollarSign,
  HeartPulse,
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
  healthScore?: number | null;
  engagementScore?: number | null;
  lifetimeValue?: number | null;
  totalOrders?: number | null;
  preferredChannel?: string | null;
  accountAgeDays?: number | null;
  loading?: boolean;
}

const scoreRing = (label: string, value?: number | null) => {
  const color = getScoreColor(value);

  return {
    label,
    color,
    renderValue: (
      <CircularProgress
        determinate
        value={clampPercent(value)}
        color={color}
        size="lg"
        sx={{
          "--CircularProgress-size": "56px",
          "--CircularProgress-thickness": "5px",
        }}
      >
        <Typography level="body-sm" fontWeight="lg">
          {value ?? "--"}
        </Typography>
      </CircularProgress>
    ),
  };
};

const stats = (props: CustomerQuickStatsProps) => [
  {
    icon: HeartPulse,
    label: "Health Score",
    value: scoreRing("Health Score", props.healthScore).renderValue,
  },
  {
    icon: Activity,
    label: "Engagement",
    value: scoreRing("Engagement", props.engagementScore).renderValue,
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
      <Stack
        direction="row"
        divider={<Divider orientation="vertical" />}
        sx={{
          overflowX: "auto",
          "& > *": {
            minWidth: { xs: 160, md: 0 },
          },
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
                flex: 1,
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
                  <Typography level="title-md" sx={{ whiteSpace: "nowrap" }}>
                    {item.value}
                  </Typography>
                ) : (
                  <Box>{item.value}</Box>
                )}
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Sheet>
  );
}
