import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  getRecentItems,
  getRecentSearchEntries,
  getRecentSearches,
  getSearchHistoryUsageSnapshot,
  removeRecentSearch,
  recordRecentItem,
  saveRecentSearch,
} from "@/components/search/searchHistory";
import type { SearchResultItem } from "@/components/search/types";

const TEST_USER_ID = "user-123";

const createItem = (
  id: string,
  route: string,
  title: string,
): SearchResultItem => ({
  id,
  type: "page",
  title,
  route,
  categoryIcon: "pages",
  group: "pages",
});

describe("searchHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores recent searches uniquely and keeps the newest casing", () => {
    saveRecentSearch(TEST_USER_ID, "dashboard");
    saveRecentSearch(TEST_USER_ID, "Dashboard");
    saveRecentSearch(TEST_USER_ID, "crm");

    expect(getRecentSearches(TEST_USER_ID)).toEqual(["crm", "Dashboard"]);
  });

  it("stores the latest selected result title for recent searches", () => {
    saveRecentSearch(TEST_USER_ID, "dashboard", {
      selectedResultTitle: "Dashboard",
    });

    expect(getRecentSearchEntries(TEST_USER_ID)).toEqual([
      expect.objectContaining({
        normalizedQuery: "dashboard",
        query: "dashboard",
        selectedResultTitle: "Dashboard",
      }),
    ]);
  });

  it("removes a single recent search entry without clearing the rest", () => {
    saveRecentSearch(TEST_USER_ID, "dashboard");
    saveRecentSearch(TEST_USER_ID, "crm");

    removeRecentSearch(TEST_USER_ID, "dashboard");

    expect(getRecentSearches(TEST_USER_ID)).toEqual(["crm"]);
  });

  it("clears recent searches without touching recent items", () => {
    saveRecentSearch(TEST_USER_ID, "dashboard");
    recordRecentItem(TEST_USER_ID, createItem("page:dashboard", "/dashboard", "Dashboard"));

    clearRecentSearches(TEST_USER_ID);

    expect(getRecentSearches(TEST_USER_ID)).toEqual([]);
    expect(getRecentItems(TEST_USER_ID)).toHaveLength(1);
  });

  it("deduplicates recent items by route and increments visit counts", () => {
    recordRecentItem(TEST_USER_ID, createItem("page:dashboard", "/dashboard", "Dashboard"));
    recordRecentItem(TEST_USER_ID, createItem("page:dashboard-duplicate", "/dashboard", "Dashboard"));
    recordRecentItem(TEST_USER_ID, createItem("page:crm", "/crm", "CRM"));

    const recentItems = getRecentItems(TEST_USER_ID);

    expect(recentItems).toHaveLength(2);
    expect(recentItems[0]?.item.route).toBe("/crm");
    expect(recentItems[1]?.count).toBe(2);
    expect(recentItems[1]?.item.route).toBe("/dashboard");
  });

  it("exposes usage counts for searches and visited routes", () => {
    saveRecentSearch(TEST_USER_ID, "Dashboard");
    saveRecentSearch(TEST_USER_ID, "dashboard");
    recordRecentItem(TEST_USER_ID, createItem("page:dashboard", "/dashboard", "Dashboard"));
    recordRecentItem(TEST_USER_ID, createItem("page:dashboard", "/dashboard", "Dashboard"));

    expect(getSearchHistoryUsageSnapshot(TEST_USER_ID)).toEqual({
      queryCounts: {
        dashboard: 2,
      },
      recentItemRoutes: {
        "/dashboard": 2,
      },
    });
  });
});