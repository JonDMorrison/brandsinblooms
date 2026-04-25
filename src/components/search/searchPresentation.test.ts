import { describe, expect, it } from "vitest";
import {
  buildHighlightedTextSegments,
  buildSearchSuggestions,
} from "@/components/search/searchPresentation";
import type { RecentSearchItemEntry } from "@/components/search/searchHistory";
import type { SearchResultGroup } from "@/components/search/types";

const recentItems: RecentSearchItemEntry[] = [
  {
    count: 2,
    item: {
      id: "item:1",
      type: "page",
      title: "Dashboard",
      route: "/dashboard",
      categoryIcon: "pages",
      group: "pages",
    },
    lastVisitedAt: "2026-01-01T00:00:00.000Z",
  },
];

const results: SearchResultGroup[] = [
  {
    category: "pages",
    title: "Pages",
    icon: "pages",
    results: [
      {
        id: "item:2",
        type: "page",
        title: "Dashboard Overview",
        route: "/dashboard/overview",
        categoryIcon: "pages",
        group: "pages",
      },
    ],
  },
];

describe("searchPresentation", () => {
  it("highlights all matching query tokens in the result text", () => {
    expect(buildHighlightedTextSegments("Plant Killers", "plant killer")).toEqual([
      { matched: true, text: "Plant" },
      { matched: false, text: " " },
      { matched: true, text: "Killer" },
      { matched: false, text: "s" },
    ]);
  });

  it("builds live suggestions from recent searches, recent items, and current results", () => {
    expect(
      buildSearchSuggestions({
        query: "dash",
        recentItems,
        recentSearches: ["Dashboard settings", "CRM"],
        results,
      }),
    ).toEqual(["Dashboard settings", "Dashboard", "Dashboard Overview"]);
  });
});