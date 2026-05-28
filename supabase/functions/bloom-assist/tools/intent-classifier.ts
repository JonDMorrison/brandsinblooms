import type {
  IntentClassification,
  IntentClassificationResult,
  IntentClassifierOptions,
  IntentComplexity,
} from "./types.ts";
import { INTENT_CATEGORIES, INTENT_COMPLEXITIES } from "./types.ts";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const INTENT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 500;

const IMAGE_GENERATION_PATTERNS = [
  /\b(?:generate|create|make|draw|design|render|produce)\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+)?(?:image|picture|photo|banner|graphic|illustration|artwork|poster|flyer|email header|visual creative|social (?:image|graphic|creative)|product (?:image|photo|shot))\b/i,
  /\b(?:generate|create|make|design|produce)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:[a-z0-9'-]+\s+){0,5}(?:image|picture|photo|banner|graphic|visual|illustration|artwork|poster|flyer)\s+(?:for|of)\b/i,
  /\b(?:i|we)\s+need\s+(?:an?\s+|some\s+)?(?:photo|image|picture|banner|graphic|visual|creative)\s+(?:for|of)\b/i,
  /\bneed\s+(?:an?\s+|some\s+)?(?:photo|image|picture|banner|graphic|visual|creative)\s+(?:for|of)\b/i,
  /\b(?:create|make|design|generate|produce)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:visual|graphic)\s+(?:for|of)\b/i,
  /\bdraw\s+(?:me\s+)?(?:an?\s+|the\s+)[a-z0-9][a-z0-9'\s-]{1,120}\b/i,
] as const;

const IMAGE_VIEW_PATTERNS = [
  /\b(?:show|view|list|find|open|display|see|inspect|analy[sz]e)\b.{0,48}\b(?:images?|photos?|pictures?)\b/i,
  /\b(?:images?|photos?|pictures?)\b.{0,48}\b(?:show|view|list|find|open|display|see|inspect|analy[sz]e)\b/i,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntentClassification(value: unknown): value is IntentClassification {
  return (
    typeof value === "string" &&
    INTENT_CATEGORIES.includes(value as IntentClassification)
  );
}

function isIntentComplexity(value: unknown): value is IntentComplexity {
  return (
    typeof value === "string" &&
    INTENT_COMPLEXITIES.includes(value as IntentComplexity)
  );
}

function extractMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : null;
}

function parseClassification(value: string | null): IntentClassification {
  if (!value) {
    return "general";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]/g, "");
  return isIntentClassification(normalized) ? normalized : "general";
}

function parseComplexity(value: unknown): IntentComplexity {
  if (typeof value !== "string") {
    return "complex";
  }

  const normalized = value.trim().toLowerCase();
  return isIntentComplexity(normalized) ? normalized : "complex";
}

function parseClassificationResult(
  value: string | null,
): IntentClassificationResult {
  if (!value) {
    return { category: "general", complexity: "complex" };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isRecord(parsed)) {
      return {
        category: parseClassification(
          typeof parsed.category === "string" ? parsed.category : null,
        ),
        complexity: parseComplexity(parsed.complexity),
      };
    }
  } catch {
    return {
      category: parseClassification(value),
      complexity: "complex",
    };
  }

  return { category: parseClassification(value), complexity: "complex" };
}

function hasImageGenerationIntent(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!IMAGE_GENERATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const hasCreationVerb =
    /\b(?:generate|create|make|draw|design|render|produce|need)\b/i.test(
      normalized,
    );
  return (
    hasCreationVerb ||
    !IMAGE_VIEW_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export async function classifyIntentWithComplexity(
  message: string,
  options: IntentClassifierOptions = {},
): Promise<IntentClassificationResult> {
  const hasExplicitImageIntent = hasImageGenerationIntent(message);
  if (hasExplicitImageIntent) {
    return { category: "image", complexity: "simple" };
  }

  const openAiApiKey = options.openAiApiKey ?? Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return { category: "general", complexity: "complex" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: INTENT_MODEL,
        temperature: 0,
        max_tokens: 48,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "Classify the user's message into exactly one category and one complexity score.",
              "query: asks to find, list, show, inspect, or retrieve records.",
              "mutation: asks to create, update, delete, assign, send, schedule, pause, or change records.",
              "analytics: asks for metrics, trends, summaries, health, insights, revenue, performance, or counts with interpretation.",
              "content: asks to draft, write, or generate copy/text.",
              "image: asks to generate, create, make, draw, design, render, or produce an image, picture, photo, banner, graphic, visual, or visual creative. Use image only for explicit new image creation, not viewing or analyzing existing images.",
              "navigation: asks to open, go to, or navigate to an app page.",
              "general: none of the above or conversational help.",
              "Ambiguity rule: false positives are worse than false negatives. 'create a campaign' is mutation, 'show me product images' is query, and 'create something visual' is general unless the user explicitly asks for an image/graphic/banner/photo.",
              "complexity simple: likely a single tool call, factual lookup, straightforward list/detail request, or a direct what/show/list question.",
              "complexity complex: likely multiple tools, comparison, why/how reasoning, cross-entity analysis, diagnostics, trend interpretation, or synthesis.",
              "Examples: 'what is X' is simple; 'compare X vs Y' is complex; 'why did X happen' is complex.",
              'Return only compact JSON: {"category":"query","complexity":"simple"}.',
            ].join("\n"),
          },
          { role: "user", content: message.slice(0, 2_000) },
        ],
      }),
    });

    if (!response.ok) {
      return { category: "general", complexity: "complex" };
    }

    const payload: unknown = await response.json();
    const result = parseClassificationResult(extractMessageContent(payload));
    return result.category === "image"
      ? { category: "general", complexity: result.complexity }
      : result;
  } catch {
    return { category: "general", complexity: "complex" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function classifyIntent(
  message: string,
  options: IntentClassifierOptions = {},
): Promise<IntentClassification> {
  const result = await classifyIntentWithComplexity(message, options);
  return result.category;
}
