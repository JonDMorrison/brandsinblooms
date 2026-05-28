import type { BloomMode } from "./types.ts";
import type { IntentClassification, IntentComplexity } from "./tools/types.ts";

const STANDARD_MODEL = "gpt-4o-mini";
const PRO_MODEL = "gpt-4o";
const CONTENT_MODEL = "gpt-4.1-2025-04-14";

type ModelPreference = "auto" | "bloom_pro" | "bloom_standard";

function normalizePreference(value: unknown): ModelPreference {
  if (typeof value !== "string") {
    return "auto";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "bloom_pro" || normalized === "pro") {
    return "bloom_pro";
  }
  if (normalized === "bloom_standard" || normalized === "standard") {
    return "bloom_standard";
  }

  return "auto";
}

function normalizeIntent(value: unknown): IntentClassification {
  switch (value) {
    case "query":
    case "mutation":
    case "analytics":
    case "content":
    case "image":
    case "navigation":
    case "general":
      return value;
    default:
      return "general";
  }
}

function normalizeComplexity(value: unknown): IntentComplexity {
  return value === "simple" ? "simple" : "complex";
}

export function selectModel(
  intent: IntentClassification | string | null | undefined,
  complexity: IntentComplexity | string | null | undefined,
  mode: BloomMode,
  userPreference: string | null | undefined = null,
): string {
  try {
    if (mode === "reasoning" || mode === "research") {
      return PRO_MODEL;
    }

    const category = normalizeIntent(intent);
    if (mode === "image" || category === "image") {
      return CONTENT_MODEL;
    }

    const preference = normalizePreference(userPreference);
    if (preference === "bloom_pro") {
      return PRO_MODEL;
    }
    if (preference === "bloom_standard") {
      return STANDARD_MODEL;
    }

    const intentComplexity = normalizeComplexity(complexity);

    switch (category) {
      case "query":
        return intentComplexity === "simple" ? STANDARD_MODEL : PRO_MODEL;
      case "navigation":
        return STANDARD_MODEL;
      case "content":
      case "image":
        return CONTENT_MODEL;
      case "mutation":
      case "analytics":
      case "general":
        return PRO_MODEL;
      default:
        return PRO_MODEL;
    }
  } catch {
    return PRO_MODEL;
  }
}
