import { describe, expect, it, vi } from "vitest";
import {
  applyRouteVisitBoost,
  getCachedDatabaseSearchGroups,
  getRetryAfterSeconds,
  mergeSearchGroups,
  normalizeSearchGroups,
  setCachedDatabaseSearchGroups,
} from "@/components/search/databaseSearch";
import type { SearchGroupKey, SearchResultGroup, SearchResultItem } from "@/components/search/types";

const createResult = (
  id: string,
  group: SearchGroupKey,
  route: string,
  overrides: Partial<SearchResultItem> = {},
): SearchResultItem => ({
  id,
  type: overrides.type ?? "page",
  title: overrides.title ?? id,
  route,
  icon: overrides.icon,
  subtitle: overrides.subtitle,
  categoryIcon: overrides.categoryIcon ?? group,
  metadata: overrides.metadata,
  keywords: overrides.keywords,
  group,
});

const createGroup = (
  category: SearchGroupKey,
  results: SearchResultItem[],
): SearchResultGroup => ({
  category,
  title: category,
  icon: category,
  results,
});

describe("databaseSearch", () => {
  it("normalizes saved block groups from the edge function payload", () => {
    const groups = normalizeSearchGroups([
      {
        category: "saved_blocks",
        results: [
          {
            id: "db:saved_block:block-1",
            type: "saved_block",
            title: "Spring Header",
            route: "/crm/campaigns/blocks?highlight=block-1",
          },
        ],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe("saved_blocks");
    expect(groups[0]?.results[0]?.group).toBe("saved_blocks");
    expect(groups[0]?.results[0]?.categoryIcon).toBe("saved-block");
  });

  it("keeps static results ahead of database results and deduplicates exact routes", () => {
    const merged = mergeSearchGroups(
      [
        createGroup("pages", [
          createResult("static:page:customers", "pages", "/crm/customers", {
            title: "Customers",
          }),
        ]),
      ],
      [
        createGroup("pages", [
          createResult("db:page:customers", "pages", "/crm/customers", {
            title: "Customers list",
          }),
        ]),
        createGroup("customers", [
          createResult("db:customer:1", "customers", "/crm/customers/1", {
            type: "customer",
            title: "Jane Doe",
            categoryIcon: "customers",
          }),
        ]),
      ],
    );

    const pagesGroup = merged.find((group) => group.category === "pages");
    const customersGroup = merged.find((group) => group.category === "customers");

    expect(pagesGroup?.results.map((result) => result.id)).toEqual([
      "static:page:customers",
    ]);
    expect(customersGroup?.results.map((result) => result.id)).toEqual([
      "db:customer:1",
    ]);
  });

  it("caps merged results to five per group and thirty overall", () => {
    const groups: SearchGroupKey[] = [
      "pages",
      "customers",
      "campaigns",
      "products",
      "segments",
      "personas",
      "automations",
    ];

    const merged = mergeSearchGroups(
      [],
      groups.map((group) =>
        createGroup(
          group,
          Array.from({ length: 6 }, (_, index) =>
            createResult(
              `${group}:${index}`,
              group,
              `/${group}/${index}`,
              { title: `${group}-${index}` },
            ),
          ),
        ),
      ),
    );

    expect(merged.every((group) => group.results.length <= 5)).toBe(true);
    expect(merged.flatMap((group) => group.results)).toHaveLength(30);
  });

  it("boosts frequently revisited routes within a group", () => {
    const boosted = applyRouteVisitBoost(
      [
        createGroup("pages", [
          createResult("page:dashboard", "pages", "/dashboard", {
            title: "Dashboard",
          }),
          createResult("page:crm", "pages", "/crm", {
            title: "CRM",
          }),
        ]),
      ],
      {
        "/crm": 3,
      },
    );

    expect(boosted[0]?.results.map((result) => result.route)).toEqual([
      "/crm",
      "/dashboard",
    ]);
  });

  it("reads retry-after seconds from function errors", () => {
    const retryAfter = getRetryAfterSeconds({
      context: {
        status: 429,
        headers: new Headers({ "Retry-After": "45" }),
      },
    });

    expect(retryAfter).toBe(45);
  });

  it("falls back to retry_after_seconds in the error body when headers are absent", () => {
    const retryAfter = getRetryAfterSeconds({
      context: {
        status: 429,
        body: JSON.stringify({ retry_after_seconds: 12 }),
      },
    });

    expect(retryAfter).toBe(12);
  });

  it("expires cached database groups after five seconds", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
      setCachedDatabaseSearchGroups(
        "crm|customers",
        [createGroup("customers", [createResult("db:customer:1", "customers", "/crm/customers/1")])],
      );

      expect(getCachedDatabaseSearchGroups("crm|customers")).toHaveLength(1);

      vi.advanceTimersByTime(5_001);

      expect(getCachedDatabaseSearchGroups("crm|customers")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});