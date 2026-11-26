import type { SavedTemplate } from "@/hooks/useSavedTemplates";

/** Seasonal and topical groups for a garden centre's saved designs. */
export const TEMPLATE_CATEGORIES = [
  "Spring",
  "Summer",
  "Fall",
  "Christmas",
  "General promotions",
  "Newsletter",
  "Events",
] as const;

export type TemplateSort = "newest" | "oldest" | "name";

export const TEMPLATE_SORTS: ReadonlyArray<{ value: TemplateSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name, A to Z" },
];

export interface TemplateFilters {
  search: string;
  /** "" shows every category. "none" shows designs with no category. */
  category: string;
  /** "" shows everyone's. "mine" shows only the signed-in person's. */
  owner: "" | "mine";
  sort: TemplateSort;
}

export const DEFAULT_TEMPLATE_FILTERS: TemplateFilters = {
  search: "",
  category: "",
  owner: "",
  sort: "newest",
};

const time = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Search looks at the name, description, category and tags. */
export function filterTemplates(
  templates: readonly SavedTemplate[],
  filters: TemplateFilters,
): SavedTemplate[] {
  const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = templates.filter((template) => {
    if (filters.owner === "mine" && !template.isOwn) return false;
    if (filters.category === "none" && template.category) return false;
    if (filters.category && filters.category !== "none" && template.category !== filters.category) return false;
    if (words.length === 0) return true;
    const haystack = [template.name, template.description ?? "", template.category ?? "", ...template.tags]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  return [...shown].sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    const delta = time(b.updated_at || b.created_at) - time(a.updated_at || a.created_at);
    return filters.sort === "oldest" ? -delta : delta;
  });
}

/** Categories in use, known ones first in their set order, then any others A to Z. */
export function categoriesInUse(templates: readonly SavedTemplate[]): string[] {
  const used = new Set(templates.map((template) => template.category).filter((value): value is string => Boolean(value)));
  const known = TEMPLATE_CATEGORIES.filter((category) => used.has(category));
  const other = [...used].filter((category) => !(TEMPLATE_CATEGORIES as readonly string[]).includes(category)).sort();
  return [...known, ...other];
}

/** "spring, sale; perennials" becomes ["spring", "sale", "perennials"]. */
export function parseTagInput(value: string): string[] {
  return value.split(/[,;\n]+/).map((tag) => tag.trim()).filter(Boolean);
}
