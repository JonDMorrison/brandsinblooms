import {
  filterIntegrations,
  getSummaryCounts,
  getTabCounts,
  getIntegrationSeeds,
  groupIntegrationsByStatus,
} from "@/components/integrations/integrationsHubConfig";

describe("integrations hub config helpers", () => {
  const items = getIntegrationSeeds().map((seed) => ({
    ...seed,
    status: seed.slug === "square" ? "connected" : seed.defaultStatus,
  }));

  it("filters by search terms across grouped child keywords", () => {
    const results = filterIntegrations(items, "all", "instagram");

    expect(results.map((item) => item.slug)).toContain("meta");
    expect(results.some((item) => item.slug === "square")).toBe(false);
  });

  it("calculates tab counts from the visible card set", () => {
    const counts = getTabCounts(items, "mail");

    expect(counts.all).toBeGreaterThanOrEqual(1);
    expect(counts["marketing-import"]).toBeGreaterThanOrEqual(1);
    expect(counts["pos-systems"]).toBe(0);
  });

  it("groups cards by status in display order buckets", () => {
    const grouped = groupIntegrationsByStatus(items);

    expect(grouped.connected.map((item) => item.slug)).toContain("square");
    expect(grouped.comingSoon.map((item) => item.slug)).toContain("shopify");
  });

  it("summarizes connected, available, and coming soon counts", () => {
    const summary = getSummaryCounts(items);

    expect(summary.connected).toBe(1);
    expect(summary.total).toBe(items.length);
    expect(summary.comingSoon).toBeGreaterThan(0);
  });
});
