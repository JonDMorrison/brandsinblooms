import type { BloomMode } from "../types.ts";
import type { IntentClassificationResult, ToolCategory } from "./types.ts";

// "utility" holds export_data and compute_audience_size. Users ask for a list
// or an audience size in plain words, which classify as query, analytics or
// mutation, so those sets must include it or the tools are hidden.
const QUERY_TOOL_CATEGORIES = new Set<ToolCategory>(["query", "utility"]);
const QUERY_ANALYTICS_TOOL_CATEGORIES = new Set<ToolCategory>([
  "query",
  "analytics",
  "utility",
]);
// Mutation requests often need drafted copy (for example "write and schedule
// a campaign"), so content tools stay available.
const MUTATION_TOOL_CATEGORIES = new Set<ToolCategory>([
  "query",
  "mutation",
  "content",
  "utility",
]);
const CONTENT_TOOL_CATEGORIES = new Set<ToolCategory>(["content"]);
const NAVIGATION_TOOL_CATEGORIES = new Set<ToolCategory>(["navigation"]);
const RESEARCH_TOOL_CATEGORIES = QUERY_ANALYTICS_TOOL_CATEGORIES;

export function getToolCategoriesForRouting(
  mode: BloomMode,
  classification: IntentClassificationResult,
): Set<ToolCategory> | null {
  if (mode === "research") {
    return RESEARCH_TOOL_CATEGORIES;
  }

  if (mode === "image") {
    return CONTENT_TOOL_CATEGORIES;
  }

  switch (classification.category) {
    case "query":
      return classification.complexity === "simple"
        ? QUERY_TOOL_CATEGORIES
        : QUERY_ANALYTICS_TOOL_CATEGORIES;
    case "mutation":
      return MUTATION_TOOL_CATEGORIES;
    case "analytics":
      return QUERY_ANALYTICS_TOOL_CATEGORIES;
    case "content":
    case "image":
      return CONTENT_TOOL_CATEGORIES;
    case "navigation":
      return NAVIGATION_TOOL_CATEGORIES;
    case "general":
      return null;
  }
}
