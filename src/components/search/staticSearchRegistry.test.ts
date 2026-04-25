import { describe, expect, it } from "vitest";
import {
  getStaticSearchItemForPathname,
  getStaticSearchItemById,
  scoreStaticSearchItem,
  searchStaticRegistry,
} from "@/components/search/staticSearchRegistry";

const flattenGroups = (query: string) =>
  searchStaticRegistry(query).flatMap((group) => group.results);

describe("staticSearchRegistry", () => {
  it("returns Dashboard first for an exact page title query", () => {
    const results = flattenGroups("dashboard");

    expect(results[0]?.id).toBe("static:page:dashboard");
  });

  it("returns Dashboard first for a close typo", () => {
    const results = flattenGroups("dashbord");

    expect(results[0]?.id).toBe("static:page:dashboard");
  });

  it("surfaces POS integrations for the pos keyword", () => {
    const results = flattenGroups("pos").map((item) => item.title);

    expect(results).toEqual(
      expect.arrayContaining([
        "Square",
        "Clover",
        "Lightspeed X-Series",
        "Shopify",
      ]),
    );
  });

  it("surfaces compliance settings for a gdpr search", () => {
    const results = flattenGroups("gdpr");

    expect(results[0]?.title).toBe("Compliance & Privacy");
  });

  it("finds the Plant Killers segment by a two-word query", () => {
    const results = flattenGroups("plant killer").map((item) => item.title);

    expect(results).toContain("Plant Killers");
  });

  it("finds the VIP waitlist form template", () => {
    const results = flattenGroups("waitlist").map((item) => item.title);

    expect(results).toContain("VIP Waitlist Template");
  });

  it("finds field types for a checkbox query", () => {
    const results = flattenGroups("checkbox").map((item) => item.title);

    expect(results).toEqual(
      expect.arrayContaining(["Checkbox Field", "Segment Checkbox Field"]),
    );
  });

  it("finds the welcome automation preset", () => {
    const results = flattenGroups("welcome").map((item) => item.title);

    expect(results).toContain("Welcome New Customers");
  });

  it("preserves group ordering with pages before settings", () => {
    const results = searchStaticRegistry("support").map((group) => group.category);

    expect(results.indexOf("pages")).toBeLessThan(results.indexOf("settings"));
  });

  it("caps setup results to five per group", () => {
    const setupGroup = searchStaticRegistry("setup").find(
      (group) => group.category === "setup",
    );

    expect(setupGroup?.results).toHaveLength(5);
  });

  it("caps total results at thirty", () => {
    const results = flattenGroups("a");

    expect(results.length).toBeLessThanOrEqual(30);
  });

  it("scores exact title matches higher than subtitle-only matches", () => {
    const dashboard = getStaticSearchItemById("static:page:dashboard");
    const community = getStaticSearchItemById("static:page:community");

    expect(dashboard).not.toBeNull();
    expect(community).not.toBeNull();
    expect(scoreStaticSearchItem(dashboard!, "dashboard")).toBeGreaterThan(
      scoreStaticSearchItem(community!, "dashboard"),
    );
  });

  it("resolves the best static item for the current pathname", () => {
    expect(getStaticSearchItemForPathname("/crm/customers/123")?.id).toBe(
      "static:page:customers",
    );
    expect(getStaticSearchItemForPathname("/crm/customers/new")?.id).toBe(
      "static:page:customers",
    );
  });
});