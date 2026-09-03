export type CampaignRevenueMetricSource = {
  revenue?: unknown;
  attributed_revenue?: unknown;
  attributed_orders?: unknown;
  attributed_customers?: unknown;
  attribution_model?: unknown;
  attribution_window_days?: unknown;
  attribution_currency?: unknown;
  attribution_has_mixed_currencies?: unknown;
  attributed_revenue_by_currency?: unknown;
};

export type CampaignRevenueMetrics = {
  revenue: number;
  orders: number;
  customers: number;
  model: "last_click";
  windowDays: number;
  currency: string;
  hasMixedCurrencies: boolean;
  revenueByCurrency: Record<string, number>;
};

function nonNegativeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function count(value: unknown): number {
  return Math.floor(nonNegativeNumber(value));
}

function currencyCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function revenueByCurrency(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, number>>(
    (result, [currency, amount]) => {
      const code = currencyCode(currency);
      result[code] = nonNegativeNumber(amount);
      return result;
    },
    {},
  );
}

export function resolveCampaignRevenueMetrics(
  source: CampaignRevenueMetricSource | null | undefined,
): CampaignRevenueMetrics {
  const metrics = source ?? {};
  const breakdown = revenueByCurrency(metrics.attributed_revenue_by_currency);
  const window = count(metrics.attribution_window_days);
  const hasMixedCurrencies =
    metrics.attribution_has_mixed_currencies === true ||
    Object.keys(breakdown).length > 1;

  return {
    revenue: nonNegativeNumber(metrics.attributed_revenue ?? metrics.revenue),
    orders: count(metrics.attributed_orders),
    customers: count(metrics.attributed_customers),
    model: "last_click",
    windowDays: window >= 1 && window <= 90 ? window : 7,
    currency: currencyCode(metrics.attribution_currency),
    hasMixedCurrencies,
    revenueByCurrency: breakdown,
  };
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatAttributedRevenue(
  metrics: CampaignRevenueMetrics,
): string {
  const breakdown = Object.entries(metrics.revenueByCurrency).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (metrics.hasMixedCurrencies && breakdown.length > 0) {
    return breakdown
      .map(
        ([currency, amount]) => `${currency} ${formatMoney(amount, currency)}`,
      )
      .join(" + ");
  }

  return formatMoney(metrics.revenue, metrics.currency);
}
