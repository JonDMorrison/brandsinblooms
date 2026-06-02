/**
 * Content Intelligence Gate
 *
 * Analyzes streaming assistant text in real-time and classifies it so the
 * renderer can make an intelligent decision instead of blindly painting raw
 * markdown. It detects:
 * - PASS: safe to render as normal text/markdown
 * - SUPPRESS: redundant data or a tool-error JSON payload that should be hidden
 *   (a loader is shown in its place)
 * - INTERCEPT_FORM: a text "please provide the following fields" request that
 *   should become an interactive form (raw field list is suppressed)
 * - INTERCEPT_PLAN: a text-based task plan that should become an approval card
 * - GATE_JSON: a partial JSON payload still streaming in — hold until complete
 *
 * Every exported function is pure. The runtime form/plan rendering itself is a
 * later milestone; this gate only classifies and strips, and surfaces the
 * structured detection result for whoever renders the interactive UI.
 */

import { isToolErrorPayload } from "@/components/bloom/utils/stripToolJson";

export type GateSuppressReason =
  | "tool_error_json"
  | "tool_json_payload"
  | "redundant_data"
  | "redundant_intro";

export type GateDecision =
  | { action: "pass" }
  | { action: "suppress"; reason: GateSuppressReason; loaderMessage: string }
  | {
      action: "intercept_form";
      fields: DetectedFormField[];
      resourceType: string;
      prefilledValues: Record<string, string>;
    }
  | { action: "intercept_plan"; plan: DetectedTextPlan }
  | { action: "gate_json"; bufferedText: string };

export type DetectedFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "select"
  | "boolean"
  | "textarea";

export type DetectedFormFieldTransform =
  | "to_number"
  | "to_integer"
  | "comma_to_array"
  | "to_boolean";

export interface DetectedFormField {
  name: string;
  label: string;
  type: DetectedFormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  transform?: DetectedFormFieldTransform;
}

export interface DetectedTextPlanStep {
  action: string;
  params: Record<string, string>;
}

export interface DetectedTextPlan {
  title: string;
  steps: DetectedTextPlanStep[];
  resourceType: string;
}

export interface ContentGateContext {
  hasToolResultBlocks: boolean;
  toolResultIdentifiers: Set<string>;
  isAfterToolResult: boolean;
}

/**
 * Classifies a streaming text buffer. Order matters: JSON payloads are checked
 * first (they must never flash), then redundant data, then interactive
 * form/plan interception.
 */
export function analyzeStreamingContent(
  text: string,
  context: ContentGateContext,
): GateDecision {
  const trimmed = text.trim();
  if (!trimmed) {
    return { action: "pass" };
  }

  const jsonGate = detectJsonPayload(trimmed);
  if (jsonGate) {
    return jsonGate;
  }

  if (context.hasToolResultBlocks && context.isAfterToolResult) {
    const redundancy = detectRedundantData(
      trimmed,
      context.toolResultIdentifiers,
    );
    if (redundancy) {
      return redundancy;
    }
  }

  const formIntercept = detectFormRequest(trimmed);
  if (formIntercept) {
    return formIntercept;
  }

  const planIntercept = detectTextPlan(trimmed);
  if (planIntercept) {
    return planIntercept;
  }

  return { action: "pass" };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 1 — JSON tool payload detection
// ═══════════════════════════════════════════════════════════════════════════

const TEXT_LABELLED_JSON_REGEX = /^text\s*\n\s*\{/;
const JSON_TOOL_MARKER_REGEX =
  /^\s*\{[\s\S]*"(?:success|error|block_type|tool_output|confirmation_required|validation_error)"/;

export function detectJsonPayload(text: string): GateDecision | null {
  // "text\n{ ... }" — a block_type label followed by a JSON envelope.
  if (TEXT_LABELLED_JSON_REGEX.test(text)) {
    return {
      action: "suppress",
      reason: "tool_error_json",
      loaderMessage: "Processing tool response...",
    };
  }

  // A standalone JSON object carrying tool-result markers.
  if (JSON_TOOL_MARKER_REGEX.test(text)) {
    return {
      action: "suppress",
      reason: "tool_json_payload",
      loaderMessage: "Processing response...",
    };
  }

  // A complete, parseable JSON envelope that is unmistakably a tool payload.
  const start = text.trimStart();
  if (start.startsWith("{") && start.includes("}")) {
    try {
      if (isToolErrorPayload(JSON.parse(start))) {
        return {
          action: "suppress",
          reason: "tool_json_payload",
          loaderMessage: "Processing response...",
        };
      }
    } catch {
      // Not yet valid JSON — fall through to the buffering check below.
    }
  }

  // A JSON object still streaming in (opened but not closed) — hold it.
  if (start.startsWith("{") && !text.includes("}")) {
    return { action: "gate_json", bufferedText: text };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 2 — Redundant data detection
// ═══════════════════════════════════════════════════════════════════════════

const REDUNDANT_INTRO_REGEX = /here (?:are|is) (?:your|the)/i;

export function detectRedundantData(
  text: string,
  cardIdentifiers: Set<string>,
): GateDecision | null {
  if (cardIdentifiers.size === 0) {
    return null;
  }

  const lower = text.toLowerCase();
  let matchCount = 0;
  for (const id of cardIdentifiers) {
    if (id.length >= 3 && lower.includes(id)) {
      matchCount += 1;
    }
  }

  if (matchCount >= 2) {
    return {
      action: "suppress",
      reason: "redundant_data",
      loaderMessage: "Organizing your results...",
    };
  }

  if (REDUNDANT_INTRO_REGEX.test(text) && matchCount >= 1) {
    return {
      action: "suppress",
      reason: "redundant_intro",
      loaderMessage: "Preparing your results...",
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 3 — Form / field request detection
// ═══════════════════════════════════════════════════════════════════════════

// Lead-in phrasings the assistant uses right before listing the fields it needs
// to create a resource. Any one match (combined with >= 2 parsed fields) treats
// the following list as a form request.
const FORM_INTRO_PATTERNS: RegExp[] = [
  // "To create a new customer, please provide…" / "…, I'll need…"
  /to (?:create|add|set up|register) (?:a |an |the )?(?:new |existing |another )?\w[\w\s]*?,?\s*(?:please )?(?:provide|i(?:'ll| will| would)? need|i need)/i,
  // "Please provide the following", "enter the following details", "share some information"
  /(?:please )?(?:provide|enter|fill in|share)\s+(?:me\s+)?(?:the\s+|some\s+|a few\s+)?(?:following|details|information|info)\b/i,
  // "I'll need some additional details", "I need the following information to proceed"
  /i(?:'ll| will| would)?\s+need\s+(?:some\s+|a few\s+|the\s+|more\s+|additional\s+)*(?:details|information|info|fields|the following)\b/i,
  // "Here's what I'll need", "Here is what you'll need"
  /here(?:'s| is)\s+what\s+(?:i(?:'ll)?|you'?ll)\s+need\b/i,
  // Confirmation phrasing: "To create a segment named X, I'll proceed with the
  // following details:" — the assistant lists the details it intends to use and
  // asks the user to confirm. Surfacing these as the interactive form popup lets
  // the user review and grant permission instead of confirming in plain text.
  /i(?:'ll| will| would)?\s+proceed\s+with\s+(?:the\s+)?following\b/i,
  // "Please confirm these details", "confirm the following before I proceed"
  /(?:please\s+)?confirm\s+(?:these|the|those|the following)\s+(?:details|fields|information|info)\b/i,
];

// A field line in a "create a resource" list. Accepts bullets (-, •, *) or a
// number (1., 2)), an optional **bold** label, and an optional ": hint". Anchored
// per line so colon-less numbered labels ("1. First Name") parse cleanly.
const FORM_FIELD_REGEX =
  /^[ \t]*(?:[-•*]|\d{1,2}[.)])[ \t]+\*{0,2}([^:*\n]+?)\*{0,2}[ \t]*(?::[ \t]*([^\n]*))?$/gm;

function hasFormIntro(text: string): boolean {
  return FORM_INTRO_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectFormRequest(text: string): GateDecision | null {
  if (!hasFormIntro(text)) {
    return null;
  }

  const fields: DetectedFormField[] = [];
  FORM_FIELD_REGEX.lastIndex = 0;
  let fieldMatch: RegExpExecArray | null;

  while ((fieldMatch = FORM_FIELD_REGEX.exec(text)) !== null) {
    let label = fieldMatch[1].trim();
    let hint = (fieldMatch[2] ?? "").trim();

    // A trailing parenthetical on a colon-less label ("Phone Number (optional)")
    // carries the hint, so lift it out and clean the label.
    const parenMatch = label.match(/\s*\(([^)]*)\)\s*$/);
    if (parenMatch) {
      if (!hint) {
        hint = parenMatch[1].trim();
      }
      label = label.slice(0, label.length - parenMatch[0].length).trim();
    }

    // Skip prose that merely happens to look like a list item.
    if (label.length === 0 || label.length > 40 || label.includes(".")) {
      continue;
    }

    fields.push({
      name: labelToFieldName(label),
      label,
      type: inferFieldType(label, hint),
      required: !hint.toLowerCase().includes("optional"),
      placeholder: extractPlaceholder(hint),
      options: extractOptions(hint),
    });
  }

  if (fields.length < 2) {
    return null;
  }

  return {
    action: "intercept_form",
    fields,
    resourceType: inferFormResourceType(text),
    prefilledValues: extractPrefilledValues(text),
  };
}

/** Infer the resource being created from the form intro prose. */
export function inferFormResourceType(text: string): string {
  const introMatch = text.match(
    /(?:create|add|set up|register)\s+(?:a |an |the )?(?:new |existing |another |additional )?(\w+)/i,
  );
  const noun = introMatch?.[1]?.toLowerCase() ?? "";
  if (noun.startsWith("customer") || noun === "contact" || noun === "buyer") {
    return "customer";
  }
  if (noun.startsWith("product") || noun === "item" || noun === "sku") {
    return "product";
  }
  if (noun.startsWith("segment") || noun === "audience" || noun === "list") {
    return "segment";
  }
  if (
    noun.startsWith("campaign") ||
    noun === "newsletter" ||
    noun === "email" ||
    noun === "blast"
  ) {
    return "campaign";
  }
  if (noun.startsWith("tag") || noun === "label") {
    return "tag";
  }
  return noun || "resource";
}

/**
 * Extracts any values the assistant already filled in (e.g. "Name: NEW TRIP
 * BUYERS") so the rendered form can prefill them. Placeholder-ish hints such as
 * "(optional)" or "please specify" are ignored.
 */
export function extractPrefilledValues(text: string): Record<string, string> {
  const prefilled: Record<string, string> = {};
  const valuePattern =
    /(?:[-•*]|\d{1,2}[.)])\s+\*{0,2}([^:*\n]+?)\*{0,2}\s*:\s*([^(\n]+?)(?:\s*\(|$)/g;
  valuePattern.lastIndex = 0;
  let valueMatch: RegExpExecArray | null;

  while ((valueMatch = valuePattern.exec(text)) !== null) {
    const label = valueMatch[1].trim();
    const value = valueMatch[2].trim();
    if (!value || label.length === 0 || label.length > 40) {
      continue;
    }

    const lowered = value.toLowerCase();
    if (
      lowered.includes("optional") ||
      lowered.includes("please") ||
      lowered.includes("specify") ||
      lowered.startsWith("e.g")
    ) {
      continue;
    }

    prefilled[labelToFieldName(label)] = value;
  }

  return prefilled;
}

export function labelToFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function inferFieldType(label: string, hint: string): DetectedFormFieldType {
  const l = label.toLowerCase();
  if (l.includes("email")) {
    return "email";
  }
  if (l.includes("phone") || l.includes("mobile") || l.includes("tel")) {
    return "phone";
  }
  if (l.includes("description") || l.includes("notes") || l.includes("bio")) {
    return "textarea";
  }
  if (
    l.includes("vip") ||
    l.includes("active") ||
    l.includes("auto update") ||
    l.includes("include all")
  ) {
    return "boolean";
  }
  if (hint.includes(",") && hint.includes("or")) {
    return "select";
  }
  if (hint.startsWith("(") && hint.includes(",")) {
    return "select";
  }
  return "text";
}

function extractPlaceholder(hint: string): string | undefined {
  const egMatch = hint.match(/e\.g\.\s*[,:]?\s*["']?([^"'\n)]+)["']?/i);
  if (egMatch) {
    return egMatch[1].trim();
  }

  if (hint.length > 0 && hint.length < 50 && !hint.includes("(")) {
    return hint;
  }
  return undefined;
}

function extractOptions(hint: string): string[] | undefined {
  const optMatch = hint.match(
    /\(?\s*([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+){1,})\s*\)?/,
  );
  if (optMatch) {
    return optMatch[1].split(/\s*,\s*/).map((option) => option.trim());
  }

  if (/yes or no/i.test(hint)) {
    return ["Yes", "No"];
  }

  const orMatch = hint.match(/(\w+) or (\w+)/);
  if (orMatch) {
    return [orMatch[1], orMatch[2]];
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 4 — Text-based task plan detection
// ═══════════════════════════════════════════════════════════════════════════

const PLAN_HEADER_REGEX = /\*{0,2}task (?:execution )?plan\*{0,2}\s*\n/i;
const PLAN_STEP_REGEX =
  /\d+\.\s+\*{0,2}(?:create|update|delete|send|schedule|export|import|assign|remove|add|set)\s+(?:a |an |the )?(\w[\w\s]*?)\*{0,2}\s*:?\n((?:\s+[•\-*]\s+[^\n]+\n?)*)/gi;
const PLAN_ACTION_REGEX =
  /(?:create|update|delete|send|schedule|export|import|assign|remove|add|set)\s+(?:a |an |the )?(?:\w[\w\s]*?)(?:\*|\s*:)/i;
const PLAN_PARAM_REGEX = /[•\-*]\s+\*{0,2}([^:*]+?)\*{0,2}\s*:\s*(.+)/g;

export function detectTextPlan(text: string): GateDecision | null {
  if (!PLAN_HEADER_REGEX.test(text)) {
    return null;
  }

  const steps: DetectedTextPlanStep[] = [];
  PLAN_STEP_REGEX.lastIndex = 0;
  let stepMatch: RegExpExecArray | null;

  while ((stepMatch = PLAN_STEP_REGEX.exec(text)) !== null) {
    const actionMatch = stepMatch[0].match(PLAN_ACTION_REGEX);
    const action = (actionMatch?.[0] ?? "").replace(/[:*]/g, "").trim();
    const paramBlock = stepMatch[2] || "";

    const params: Record<string, string> = {};
    PLAN_PARAM_REGEX.lastIndex = 0;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = PLAN_PARAM_REGEX.exec(paramBlock)) !== null) {
      params[paramMatch[1].trim()] = paramMatch[2].trim();
    }

    steps.push({ action: action || stepMatch[1].trim(), params });
  }

  if (steps.length === 0) {
    return null;
  }

  return {
    action: "intercept_plan",
    plan: {
      title: "Task Execution Plan",
      steps,
      resourceType: inferResourceType(steps),
    },
  };
}

function inferResourceType(steps: DetectedTextPlanStep[]): string {
  const firstAction = steps[0]?.action.toLowerCase() ?? "";
  if (firstAction.includes("customer")) {
    return "customer";
  }
  if (firstAction.includes("product")) {
    return "product";
  }
  if (firstAction.includes("segment")) {
    return "segment";
  }
  if (firstAction.includes("campaign")) {
    return "campaign";
  }
  if (firstAction.includes("order")) {
    return "order";
  }
  if (firstAction.includes("tag")) {
    return "tag";
  }
  return "resource";
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

const FORM_START_PATTERNS = [
  /(?:please )?provide the following/i,
  /to (?:create|add|set up|register) (?:a |an |the )?\w[\w\s]*?:/i,
  /(?:please )?(?:enter|fill in) the following/i,
];

// The first bullet/numbered field line of a list. Used as a fallback cut point
// so the intro is preserved even when the lead-in phrasing isn't one of the
// patterns above.
const FIELD_LIST_START_REGEX = /\n[ \t]*(?:[-•*]|\d{1,2}[.)])[ \t]+\S/;

/**
 * Returns the prose that precedes a form/plan field list (e.g. "To create a new
 * customer..."), so the intro stays visible while the raw field list is
 * suppressed and routed to interactive UI. Empty string when there is no
 * meaningful preamble.
 */
export function extractPreFormText(fullText: string): string {
  let cut = -1;
  for (const pattern of FORM_START_PATTERNS) {
    const index = fullText.search(pattern);
    if (index > 0 && (cut === -1 || index < cut)) {
      cut = index;
    }
  }

  const planHeader = fullText.search(PLAN_HEADER_REGEX);
  const hasPlanHeader = planHeader !== -1;
  if (planHeader > 0 && (cut === -1 || planHeader < cut)) {
    cut = planHeader;
  }

  // Fallback for form requests whose lead-in phrasing isn't covered above
  // ("…I'll need some additional details:"): keep everything before the first
  // bullet/numbered field line. Skipped for task plans, which the header
  // patterns already bound.
  if (!hasPlanHeader) {
    const listStart = fullText.search(FIELD_LIST_START_REGEX);
    if (listStart > 0 && (cut === -1 || listStart < cut)) {
      cut = listStart;
    }
  }

  if (cut > 0) {
    return fullText.slice(0, cut).trim();
  }
  return "";
}

/** Loader copy for a gate decision that hides text behind a spinner. */
export function gateLoaderMessage(decision: GateDecision): string {
  switch (decision.action) {
    case "suppress":
      return decision.loaderMessage;
    case "intercept_form":
      return "Preparing form...";
    case "intercept_plan":
      return "Building your task plan...";
    case "gate_json":
      return "Processing...";
    default:
      return "Working on it...";
  }
}

/**
 * True for gate actions that should hide the ENTIRE live text buffer (JSON
 * payloads, form requests, task plans). Redundant-data suppression is excluded
 * because the precise table/list stripper handles that case while preserving
 * any surrounding analysis.
 */
export function isGlobalGateAction(decision: GateDecision): boolean {
  switch (decision.action) {
    case "gate_json":
    case "intercept_form":
    case "intercept_plan":
      return true;
    case "suppress":
      return (
        decision.reason === "tool_error_json" ||
        decision.reason === "tool_json_payload"
      );
    default:
      return false;
  }
}
