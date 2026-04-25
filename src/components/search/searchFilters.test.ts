import { describe, expect, it } from "vitest";
import {
  buildSearchRequestConfig,
  filterSearchGroups,
  getContextualSearchFilter,
  getVisibleSearchFilters,
} from "@/components/search/searchFilters";
import type { SearchGroupKey, SearchResultGroup, SearchResultItem } from "@/components/search/types";

const createResult = (
  id: string,
  group: SearchGroupKey,
): SearchResultItem => ({
  id,
  type: group === "campaign_recipients" ? "campaign_recipient" : "page",
  title: id,
  route: `/${group}/${id}`,
  categoryIcon: group,
  group,
});

const createGroup = (
  category: SearchGroupKey,
  count: number,
): SearchResultGroup => ({
  category,
  title: category,
  icon: category,
  results: Array.from({ length: count }, (_, index) =>
    createResult(`${category}-${index}`, category),
  ),
});

describe("searchFilters", () => {
  it("maps route context to the matching default filter", () => {
    expect(getContextualSearchFilter("/sms/automations/auto-1")).toBe(
      "sms_automations",
    );
    expect(getContextualSearchFilter("/crm/campaigns/campaign-1")).toBe(
      "campaigns",
    );
  });

  it("includes campaign recipients in scoped requests for campaign detail routes", () => {
    const config = buildSearchRequestConfig("all", "/crm/campaigns/campaign-1");

    expect(config.campaignId).toBe("campaign-1");
    expect(config.entityTypes).toContain("campaign_recipient");
    expect(config.skipDatabase).toBe(false);
  });

  it("skips database search when the active chip is purely static", () => {
    const config = buildSearchRequestConfig("pages", "/crm/customers");

    expect(config.skipDatabase).toBe(true);
    expect(config.entityTypes).toEqual([]);
  });

  it("hides campaign recipients from the All filter outside campaign detail routes", () => {
    const groups = [
      createGroup("campaigns", 1),
      createGroup("campaign_recipients", 2),
    ];

    const filtered = filterSearchGroups(groups, "all", "/crm/customers");

    expect(filtered.map((group) => group.category)).toEqual(["campaigns"]);
  });

  it("keeps campaign recipients visible inside campaign-scoped filters", () => {
    const groups = [
      createGroup("campaigns", 1),
      createGroup("campaign_recipients", 2),
    ];

    const filtered = filterSearchGroups(
      groups,
      "campaigns",
      "/crm/campaigns/campaign-1",
    );

    expect(filtered.map((group) => group.category)).toEqual([
      "campaigns",
      "campaign_recipients",
    ]);
  });

  it("shows the Campaigns chip when only campaign recipients matched", () => {
    const filters = getVisibleSearchFilters(
      [createGroup("campaign_recipients", 2)],
      "/crm/campaigns/campaign-1",
    );

    expect(filters).toEqual(["all", "campaigns", "campaign_recipients"]);
  });
});