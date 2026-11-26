import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, result } = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  result: { data: [] as Array<{ id: string }>, error: null as null | { message: string } },
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.limit = (...args: unknown[]) => {
    calls.push(["limit", ...args]);
    return Promise.resolve(result);
  };
  return {
    supabase: {
      from: (table: string) => {
        calls.push(["from", table]);
        return builder;
      },
    },
  };
});

import { findThemeDraft } from "@/hooks/useStartThemeNewsletter";

describe("findThemeDraft", () => {
  beforeEach(() => {
    calls.length = 0;
    result.data = [];
    result.error = null;
  });

  it("finds the tenant's unsent draft for this week's theme", async () => {
    result.data = [{ id: "a89755c1-a858-4ff2-923c-dd341027a3de" }];
    await expect(
      findThemeDraft("3eade43c-2e5a-4ad0-80fb-500e3d7afbd4", [
        "weekly_theme:d9625fc1-2322-4cbd-9f04-b0dbbee7eead",
        "weekly_theme:master:48",
      ]),
    ).resolves.toBe("a89755c1-a858-4ff2-923c-dd341027a3de");
    expect(calls).toContainEqual(["from", "crm_campaigns"]);
    expect(calls).toContainEqual(["eq", "tenant_id", "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4"]);
    expect(calls).toContainEqual(["eq", "status", "draft"]);
    expect(calls).toContainEqual([
      "in",
      "origin",
      ["weekly_theme:d9625fc1-2322-4cbd-9f04-b0dbbee7eead", "weekly_theme:master:48"],
    ]);
    expect(calls.some(([method, column]) => method === "gte" && column === "created_at")).toBe(true);
  });

  it("returns null when there is no draft yet, so a new one is created", async () => {
    await expect(findThemeDraft("t1", ["weekly_theme:master:48"])).resolves.toBeNull();
  });

  it("surfaces a failed lookup instead of creating a duplicate", async () => {
    result.error = { message: "boom" };
    await expect(findThemeDraft("t1", ["weekly_theme:master:48"])).rejects.toEqual({ message: "boom" });
  });
});
