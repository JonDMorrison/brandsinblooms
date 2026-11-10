import { normalizeDerivedMetrics } from "@/hooks/analytics/useCampaignDerivedMetrics";
import {
  resolveCampaignRevenueMetrics,
  type CampaignRevenueMetrics,
} from "@/lib/crm/campaignRevenueMetrics";

export interface CampaignPerformanceMetrics {
  sent: number;
  delivered: number;
  adjustedOpens: number;
  reportedOpens: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  failed: number;
  pending: number;
  unconfirmed: number;
  revenueAttribution: CampaignRevenueMetrics;
}

export function toPerformanceMetrics(
  value: unknown,
): CampaignPerformanceMetrics | null {
  const delivery = normalizeDerivedMetrics(value);
  if (!delivery) return null;

  return {
    sent: delivery.totals.sent,
    delivered: delivery.totals.delivered,
    adjustedOpens: delivery.totals.opens_non_mpp,
    reportedOpens: delivery.totals.opens,
    clicked: delivery.totals.clicks,
    bounced: delivery.totals.bounces,
    unsubscribed: delivery.totals.unsubscribes,
    failed: delivery.totals.failed,
    pending: delivery.totals.pending,
    unconfirmed: delivery.totals.unconfirmed,
    revenueAttribution: resolveCampaignRevenueMetrics(
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null,
    ),
  };
}

export function aggregateRevenue(
  campaignMetrics: CampaignPerformanceMetrics[],
): CampaignRevenueMetrics {
  const byCurrency: Record<string, number> = {};
  let orders = 0;
  let customers = 0;

  for (const metrics of campaignMetrics) {
    const revenue = metrics.revenueAttribution;
    orders += revenue.orders;
    customers += revenue.customers;
    const breakdown = Object.entries(revenue.revenueByCurrency);
    if (breakdown.length) {
      for (const [currency, amount] of breakdown) {
        byCurrency[currency] = (byCurrency[currency] || 0) + amount;
      }
    } else if (revenue.revenue > 0) {
      byCurrency[revenue.currency] =
        (byCurrency[revenue.currency] || 0) + revenue.revenue;
    }
  }

  const currencies = Object.keys(byCurrency);
  return {
    revenue: Object.values(byCurrency).reduce((sum, amount) => sum + amount, 0),
    orders,
    customers,
    model: "last_click",
    windowDays: 7,
    currency: currencies.length === 1 ? currencies[0] : "USD",
    hasMixedCurrencies: currencies.length > 1,
    revenueByCurrency: byCurrency,
  };
}
