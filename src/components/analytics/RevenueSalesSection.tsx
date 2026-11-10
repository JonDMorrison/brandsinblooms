import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { POSAnalytics } from "@/hooks/usePOSAnalytics";
import { POSDetailCards } from "@/components/analytics/POSDetailCards";
import { RevenueChart, type RevenuePoint } from "@/components/analytics/RevenueChart";
import {
  formatCurrency,
  getAnalyticsPeriodLabel,
} from "@/components/analytics/analyticsUtils";

type RevenueSalesSectionProps = {
  period: number;
  posData?: POSAnalytics;
  posLoading?: boolean;
  posError?: string | null;
};

const calculateTrend = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export function RevenueSalesSection({
  period,
  posData,
  posLoading = false,
  posError,
}: RevenueSalesSectionProps) {
  const currency = posData?.revenueCurrency;
  const dailyData: RevenuePoint[] = currency
    ? (posData?.dailySales ?? [])
        .filter((row) => row.currency === currency)
        .map((row) => ({ date: row.date, revenue: row.revenue, orders: row.orders }))
    : [];
  const priorCurrency = posData?.previousRevenueByCurrency.find(
    (item) => item.currency === currency,
  );
  const priorAov = priorCurrency && priorCurrency.orders > 0
    ? priorCurrency.revenue / priorCurrency.orders : 0;
  const averageOrderTrend = currency && priorAov > 0
    ? calculateTrend(posData?.avgOrderValue ?? 0, priorAov) : null;

  if (posError) {
    return (
      <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Typography level="title-sm">Sales reporting unavailable</Typography>
        <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.5 }}>
          We couldn't load the POS reporting source. No sales totals have been substituted.
        </Typography>
      </Sheet>
    );
  }

  return (
    <Stack spacing={1.75}>
      <Stack spacing={0.5}>
        <Typography level="title-lg" sx={{ color: "neutral.900" }}>Revenue & Sales</Typography>
        <Typography level="body-sm" sx={{ color: "neutral.600" }}>
          Confirmed POS orders, separated by currency and sourced from every linked provider.
        </Typography>
      </Stack>
      {posData?.hasMixedCurrencies ? (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
          <Typography level="title-sm">Sales by currency</Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.5, mb: 1.5 }}>
            We never add different currencies together. Connect a currency conversion
            source before comparing total sales across currencies.
          </Typography>
          <Stack spacing={1}>
            {posData.revenueByCurrency.map((item) => (
              <Stack key={item.currency} direction="row" justifyContent="space-between">
                <Typography level="body-sm">
                  {item.currency} · {item.orders.toLocaleString()} orders
                </Typography>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {item.currency === "UNKNOWN"
                    ? "Currency unknown"
                    : formatCurrency(item.revenue, { currency: item.currency })}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Sheet>
      ) : null}
      <Grid container spacing={2}>
        <Grid xs={12} lg={8}>
          {posData?.hasMixedCurrencies ? (
            <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
              <Typography level="title-md">Separate currency trends</Typography>
              <Typography level="body-sm" sx={{ color: "neutral.600", mt: 1 }}>
                A combined revenue chart is unavailable because the synced orders
                contain multiple currencies. The totals above remain separated.
              </Typography>
            </Sheet>
          ) : (
            <RevenueChart
              data={dailyData}
              loading={posLoading}
              currency={currency ?? undefined}
              periodLabel={getAnalyticsPeriodLabel(period)}
            />
          )}
        </Grid>
        <Grid xs={12} lg={4}>
          <POSDetailCards
            avgOrderTrend={averageOrderTrend}
            loading={posLoading}
            loyaltyTrend={null}
            pointsTrend={null}
            posData={posData}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
