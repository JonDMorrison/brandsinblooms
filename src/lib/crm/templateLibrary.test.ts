import { describe, expect, it } from "vitest";
import type { SavedTemplate } from "@/hooks/useSavedTemplates";
import { normalizeTemplateTags } from "@/hooks/useSavedTemplates";
import { categoriesInUse, DEFAULT_TEMPLATE_FILTERS, filterTemplates, parseTagInput } from "./templateLibrary";

const template = (id: string, fields: Partial<SavedTemplate>): SavedTemplate => ({
  id,
  user_id: "u1",
  tenant_id: "t1",
  name: id,
  description: null,
  layout_json: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  isOwn: true,
  category: null,
  tags: [],
  ...fields,
});

const library = [
  template("a", { name: "Spring perennials", category: "Spring", tags: ["sale"], updated_at: "2026-03-01T00:00:00Z" }),
  template("b", { name: "Christmas trees", category: "Christmas", description: "Fresh cut", updated_at: "2026-11-01T00:00:00Z", isOwn: false }),
  template("c", { name: "apple day", updated_at: "2026-09-01T00:00:00Z" }),
  template("d", { name: "Workshop invite", category: "Staff picks", tags: ["Events", "wreath"], updated_at: "2026-10-01T00:00:00Z" }),
];
const ids = (list: SavedTemplate[]) => list.map((item) => item.id);

describe("template library filters", () => {
  it("sorts newest first by default", () => {
    expect(ids(filterTemplates(library, DEFAULT_TEMPLATE_FILTERS))).toEqual(["b", "d", "c", "a"]);
  });

  it("sorts oldest first and by name without regard to case", () => {
    expect(ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, sort: "oldest" }))).toEqual(["a", "c", "d", "b"]);
    expect(ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, sort: "name" }))).toEqual(["c", "b", "a", "d"]);
  });

  it("searches name, description, category and tags, every word required", () => {
    const search = (text: string) => ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, search: text }));
    expect(search("fresh")).toEqual(["b"]);
    expect(search("WREATH")).toEqual(["d"]);
    expect(search("spring sale")).toEqual(["a"]);
    expect(search("spring trees")).toEqual([]);
  });

  it("filters by category, by no category and by owner", () => {
    expect(ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, category: "Spring" }))).toEqual(["a"]);
    expect(ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, category: "none" }))).toEqual(["c"]);
    expect(ids(filterTemplates(library, { ...DEFAULT_TEMPLATE_FILTERS, owner: "mine" }))).not.toContain("b");
  });

  it("stays quick with a large library", () => {
    const many = Array.from({ length: 500 }, (_, i) => template(`t${i}`, { name: `Design ${i}`, tags: [`tag${i % 7}`] }));
    const started = performance.now();
    expect(filterTemplates(many, { ...DEFAULT_TEMPLATE_FILTERS, search: "design tag3", sort: "name" }).length).toBeGreaterThan(50);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("lists the categories in use, known ones first", () => {
    expect(categoriesInUse(library)).toEqual(["Spring", "Christmas", "Staff picks"]);
  });
});

describe("template tags", () => {
  it("splits typed tags on commas, semicolons and new lines", () => {
    expect(parseTagInput("spring, sale; perennials\n\n  ")).toEqual(["spring", "sale", "perennials"]);
  });

  it("drops blanks and repeats and keeps at most 12", () => {
    expect(normalizeTemplateTags([" Sale ", "sale", "", "Spring"])).toEqual(["Sale", "Spring"]);
    expect(normalizeTemplateTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(12);
  });
});
