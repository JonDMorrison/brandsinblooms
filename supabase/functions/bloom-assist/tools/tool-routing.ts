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

// "Is my sender set up so I can send campaigns?", "Can I send emails yet?",
// "Will my newsletter reach anyone?", "How many customers can I email?"
const SEND_READINESS_PATTERNS: readonly RegExp[] = [
  /\bsender\b[^?.!]{0,60}\b(?:set ?up|ready|verified|configured|working|work)\b/i,
  /\b(?:set ?up|ready|configured)\b[^?.!]{0,40}\bso (?:i|we) can send\b/i,
  /\b(?:can|could|am|are)\s+(?:i|we)\s+(?:able to\s+)?(?:actually\s+)?send\b[^?.!]{0,40}\b(?:campaigns?|emails?|newsletters?)\b/i,
  /\b(?:ready|able) to send\b[^?.!]{0,30}\b(?:campaigns?|emails?|newsletters?)\b/i,
  /\b(?:will|would|do|does)\b[^?.!]{0,40}\b(?:campaigns?|emails?|newsletters?)\b[^?.!]{0,20}\b(?:go out|get delivered|be delivered|reach)\b/i,
  /\bhow many\b[^?.!]{0,50}\b(?:can|could)\s+(?:i|we)\s+(?:email|reach)\b/i,
  /\bhow many\b[^?.!]{0,50}\bcan (?:get|receive)\b[^?.!]{0,20}\bemails?\b/i,
];

/** The send-readiness tool every "can I send" question is routed to. */
export const SEND_READINESS_TOOL = "get_send_readiness";

/** Does the message ask whether email campaigns can be sent? */
export function isSendReadinessQuestion(message: string): boolean {
  const text = message.replace(/\s+/g, " ");
  return SEND_READINESS_PATTERNS.some((pattern) => pattern.test(text));
}

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
