import { describe, expect, it } from "vitest";
import {
  calculateSmsClickThroughRate,
  resolveSmsCampaignMetrics,
} from "@/lib/sms/smsCampaignMetrics";

describe("SMS campaign reporting metrics", () => {
  it("keeps unique recipients separate from repeat clicks", () => {
    expect(
      resolveSmsCampaignMetrics({
        sent: 100,
        delivered: 90,
        clicked: 12,
        unique_clicked: 12,
        total_clicks: 21,
        opt_outs: 3,
      }),
    ).toMatchObject({
      sent: 100,
      delivered: 90,
      failed: 0,
      uniqueClicks: 12,
      totalClicks: 21,
      optOuts: 3,
      revenue: 0,
      attributedOrders: 0,
      attributedCustomers: 0,
      attributionWindowDays: 7,
    });
  });

  it("supports legacy clicked-only campaigns without understating total clicks", () => {
    expect(resolveSmsCampaignMetrics({ clicked: 7 })).toMatchObject({
      uniqueClicks: 7,
      totalClicks: 7,
    });
  });

  it("uses delivered recipients for click-through rate and sent as fallback", () => {
    expect(calculateSmsClickThroughRate(9, 90, 100)).toBe(10);
    expect(calculateSmsClickThroughRate(5, 0, 100)).toBe(5);
    expect(calculateSmsClickThroughRate(5, 0, 0)).toBe(0);
  });

  it("rejects invalid and negative database values", () => {
    expect(
      resolveSmsCampaignMetrics({
        sent: -1,
        delivered: "not-a-number",
        total_clicks: Number.POSITIVE_INFINITY,
        opt_outs: -2,
      }),
    ).toMatchObject({
      sent: 0,
      delivered: 0,
      totalClicks: 0,
      optOuts: 0,
    });
  });

  it("reports audited POS revenue fields without trusting legacy revenue first", () => {
    expect(
      resolveSmsCampaignMetrics({
        revenue: 999,
        attributed_revenue: "187.25",
        attributed_orders: 4,
        attributed_customers: 3,
        attribution_window_days: 14,
        attribution_currency: "cad",
      }),
    ).toMatchObject({
      revenue: 187.25,
      attributedOrders: 4,
      attributedCustomers: 3,
      attributionWindowDays: 14,
      attributionCurrency: "CAD",
    });
  });
});
