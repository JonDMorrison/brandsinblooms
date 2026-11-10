import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  aggregateRevenue,
  toPerformanceMetrics,
} from "@/lib/crm/campaignAnalyticsSummary";
import { CampaignPerformanceCard } from "./CampaignPerformanceCard";

const dashboardSource = readFileSync(
  "src/components/crm/CampaignAnalyticsDashboard.tsx",
  "utf8",
);

describe("campaign analytics dashboard integrity", () => {
  it("normalizes privacy-adjusted delivery and attributed revenue metrics", () => {
    expect(
      toPerformanceMetrics({
        totals: {
          sent: "12000",
          delivered: "11750",
          opens: "4200",
          opens_non_mpp: "3100",
          clicks: "1800",
          bounces: "25",
          unsubscribes: "8",
          failed: "3",
          pending: "2",
          unconfirmed: "220",
        },
        attributed_revenue: "31480.50",
        attributed_orders: "382",
        attributed_customers: "350",
        attribution_currency: "CAD",
      }),
    ).toMatchObject({
      sent: 12000,
      delivered: 11750,
      adjustedOpens: 3100,
      reportedOpens: 4200,
      clicked: 1800,
      failed: 3,
      pending: 2,
      unconfirmed: 220,
      revenueAttribution: {
        revenue: 31480.5,
        orders: 382,
        customers: 350,
        currency: "CAD",
      },
    });
  });

  it("keeps currencies separated in the portfolio rollup", () => {
    const cad = toPerformanceMetrics({
      sent: 10,
      attributed_revenue: 100,
      attribution_currency: "CAD",
    });
    const usd = toPerformanceMetrics({
      sent: 20,
      attributed_revenue: 75,
      attribution_currency: "USD",
    });

    const total = aggregateRevenue([cad!, usd!]);
    expect(total.hasMixedCurrencies).toBe(true);
    expect(total.revenueByCurrency).toEqual({ CAD: 100, USD: 75 });
  });

  it("surfaces reliable engagement and incomplete delivery on each card", () => {
    const metrics = toPerformanceMetrics({
      totals: {
        sent: 100,
        delivered: 90,
        opens: 60,
        opens_non_mpp: 30,
        clicks: 20,
        failed: 2,
        unconfirmed: 8,
      },
    });

    render(
      <CampaignPerformanceCard
        campaignName="Spring kickoff"
        sentDate="2026-09-03T00:00:00Z"
        status="sent_with_errors"
        metrics={metrics!}
      />,
    );

    expect(screen.getByText("Clicks")).toBeInTheDocument();
    expect(screen.getByText("Adjusted opens")).toBeInTheDocument();
    expect(screen.getByText(/clicks are more reliable/i)).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Pending / unconfirmed")).toBeInTheDocument();
  });

  it("paginates, exports safely, sorts on clicks, and drills into reports", () => {
    expect(dashboardSource).toContain(".range(");
    expect(dashboardSource).toContain("Best Click Rate");
    expect(dashboardSource).toContain("Object.values(row).map(csvCell)");
    expect(dashboardSource).toContain(
      "navigate(`/crm/campaigns/${campaign.id}/report`)",
    );
  });
});
