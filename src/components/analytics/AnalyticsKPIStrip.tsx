import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { DollarSign, ShoppingBag, Users } from "lucide-react";
import { formatCompactNumber, formatCurrency } from "@/components/analytics/analyticsUtils";
import type { POSAnalytics } from "@/hooks/usePOSAnalytics";

type AnalyticsKPIStripProps = {
  posData?: POSAnalytics;
  posLoading?: boolean;
  posError?: string | null;
};

export function AnalyticsKPIStrip({
  posData,
  posLoading = false,
  posError,
}: AnalyticsKPIStripProps) {
  if (posError) {
    return (
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
        <Typography level="body-sm" sx={{ color: "neutral.700" }}>
          POS metrics couldn't be loaded. No replacement zeroes have been shown.
        </Typography>
      </Sheet>
    );
  }

  const revenueMessage = posData?.hasMixedCurrencies
    ? "Multiple currencies — see the breakdown below"
    : !posData?.revenueCurrency
      ? "No single verified sales currency"
      : "Confirmed POS orders for this period";

  const metrics = [
    {
      key: "customers",
      label: "Customers",
      icon: <Users size={18} aria-hidden="true" />,
      value: posData ? formatCompactNumber(posData.totalCustomers) : "—",
      helper: "Profiles in your CRM · all time",
    },
    {
      key: "orders",
      label: "POS orders",
      icon: <ShoppingBag size={18} aria-hidden="true" />,
      value: posData ? formatCompactNumber(posData.totalOrders) : "—",
      helper: "Confirmed paid or fulfilled orders · selected period",
    },
    {
      key: "revenue",
      label: "POS revenue",
      icon: <DollarSign size={18} aria-hidden="true" />,
      value: posData?.revenueCurrency
        ? formatCurrency(posData.totalRevenue, {
            compact: true,
            currency: posData.revenueCurrency,
          })
        : "—",
      helper: revenueMessage,
    },
  ];

  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        sm: "repeat(3, minmax(0, 1fr))",
      },
      gap: 1.5,
    }}>
      {metrics.map((item) => (
        <Sheet key={item.key} variant="outlined" sx={{
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          borderRadius: "lg",
          p: 2,
        }}>
          <Stack spacing={0.9}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Box sx={{ display: "flex", color: "neutral.600" }}>{item.icon}</Box>
              <Typography level="body-sm" sx={{ fontWeight: 600, color: "neutral.700" }}>
                {item.label}
              </Typography>
            </Stack>
            {posLoading ? <Skeleton sx={{ width: 100, height: 38 }} /> : (
              <Typography level="h2" sx={{ fontWeight: 700, color: "neutral.900" }}>
                {item.value}
              </Typography>
            )}
            <Typography level="body-xs" sx={{ color: "neutral.600" }}>
              {item.helper}
            </Typography>
          </Stack>
        </Sheet>
      ))}
    </Box>
  );
}
