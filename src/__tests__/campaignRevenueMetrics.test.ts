import { describe, expect, it } from "vitest";
import {
  formatAttributedRevenue,
  resolveCampaignRevenueMetrics,
} from "@/lib/crm/campaignRevenueMetrics";

describe("campaign revenue attribution metrics", () => {
  it("normalizes the auditable attribution rollup", () => {
    expect(
      resolveCampaignRevenueMetrics({
        revenue: 999,
        attributed_revenue: "31480.50",
        attributed_orders: "382",
        attributed_customers: 350,
        attribution_window_days: 7,
        attribution_currency: "cad",
      }),
    ).toEqual({
      revenue: 31480.5,
      orders: 382,
      customers: 350,
      model: "last_click",
      windowDays: 7,
      currency: "CAD",
      hasMixedCurrencies: false,
      revenueByCurrency: {},
    });
  });

  it("retains currency-separated revenue instead of disguising a mixed sum", () => {
    const metrics = resolveCampaignRevenueMetrics({
      attributed_revenue: 125,
      attribution_has_mixed_currencies: true,
      attributed_revenue_by_currency: { USD: 75, CAD: 50 },
    });

    const formatted = formatAttributedRevenue(metrics);
    expect(formatted).toContain("CA");
    expect(formatted).toContain("US");
    expect(formatted).toContain("+");
  });

  it("rejects invalid, negative, and out-of-range values", () => {
    expect(
      resolveCampaignRevenueMetrics({
        attributed_revenue: -1,
        attributed_orders: Number.POSITIVE_INFINITY,
        attributed_customers: "invalid",
        attribution_window_days: 365,
        attribution_currency: "not-currency",
      }),
    ).toMatchObject({
      revenue: 0,
      orders: 0,
      customers: 0,
      windowDays: 7,
      currency: "USD",
    });
  });
});
