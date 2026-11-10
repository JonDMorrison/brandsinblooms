import {
  resolveCampaignRevenueMetrics,
  type CampaignRevenueMetrics,
  type CampaignRevenueMetricSource,
} from "@/lib/crm/campaignRevenueMetrics";

export type SmsCampaignMetricSource = CampaignRevenueMetricSource & {
  sent?: unknown;
  delivered?: unknown;
  failed?: unknown;
  clicked?: unknown;
  unique_clicked?: unknown;
  total_clicks?: unknown;
  opt_outs?: unknown;
};

export type SmsCampaignMetrics = {
  sent: number;
  delivered: number;
  failed: number;
  uniqueClicks: number;
  totalClicks: number;
  optOuts: number;
  revenue: number;
  attributedOrders: number;
  attributedCustomers: number;
  attributionWindowDays: number;
  attributionCurrency: string;
  attributionHasMixedCurrencies: boolean;
  attributedRevenueByCurrency: Record<string, number>;
  revenueAttribution: CampaignRevenueMetrics;
};

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Normalize legacy and current campaign metric keys without inflating clicks. */
export function resolveSmsCampaignMetrics(
  source: SmsCampaignMetricSource | null | undefined,
): SmsCampaignMetrics {
  const metrics = source ?? {};
  const attribution = resolveCampaignRevenueMetrics(metrics);
  const uniqueClicks = count(metrics.unique_clicked ?? metrics.clicked);
  const totalClicks = Math.max(
    uniqueClicks,
    count(metrics.total_clicks ?? uniqueClicks),
  );

  return {
    sent: count(metrics.sent),
    delivered: count(metrics.delivered),
    failed: count(metrics.failed),
    uniqueClicks,
    totalClicks,
    optOuts: count(metrics.opt_outs),
    revenue: attribution.revenue,
    attributedOrders: attribution.orders,
    attributedCustomers: attribution.customers,
    attributionWindowDays: attribution.windowDays,
    attributionCurrency: attribution.currency,
    attributionHasMixedCurrencies: attribution.hasMixedCurrencies,
    attributedRevenueByCurrency: attribution.revenueByCurrency,
    revenueAttribution: attribution,
  };
}

export function calculateSmsClickThroughRate(
  uniqueClicks: number,
  delivered: number,
  sent: number,
): number {
  const denominator = delivered > 0 ? delivered : sent;
  return denominator > 0 ? (uniqueClicks / denominator) * 100 : 0;
}
